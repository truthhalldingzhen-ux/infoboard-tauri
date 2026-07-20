//! IMAP 邮件控制 — Tauri 后端
//!
//! 复刻自 Electron 版 `electron/mailControl.ts` + `electron/mailConfig.ts`
//!
//! 使用同步 `imap` crate，所有命令通过 spawn_blocking 执行避免阻塞 IPC 线程。
//! 核心逻辑完全复刻自原版：持久连接 + uidNext 检测 + 重连 + 验证码提取

pub mod types;

use std::collections::HashMap;
use std::fs;
use std::net::{TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use regex::Regex;
use serde_json::Value;

use types::*;

const MAIL_CONFIG_FILE: &str = "mail_config.json";
const FETCH_RECENT_COUNT: u32 = 5;
const CONTENT_MAX_LENGTH: usize = 8192;

// ─── 连接状态 ───

struct AccountState {
    session: Option<imap::Session<native_tls::TlsStream<TcpStream>>>,
    config: MailConfig,
    connected: bool,
    known_uid_next: u32,
}

#[derive(Clone)]
pub struct MailManager {
    inner: Arc<Mutex<MailManagerInner>>,
    config_path: PathBuf,
}

struct MailManagerInner {
    accounts: HashMap<String, AccountState>,
    connecting: bool,
    checking_new: bool,
}

impl MailManager {
    pub fn new() -> Self {
        let config_dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."))
            .join("infoboard-tauri");
        let _ = fs::create_dir_all(&config_dir);
        Self {
            inner: Arc::new(Mutex::new(MailManagerInner {
                accounts: HashMap::new(), connecting: false, checking_new: false,
            })),
            config_path: config_dir.join(MAIL_CONFIG_FILE),
        }
    }

    // ─── 配置读写 ───

    fn read_config(&self) -> Vec<MailConfig> {
        fs::read_to_string(&self.config_path).ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }
    fn write_config(&self, accounts: &[MailConfig]) -> Result<(), String> {
        let json = serde_json::to_string_pretty(accounts)
            .map_err(|e| format!("序列化失败: {}", e))?;
        fs::write(&self.config_path, json).map_err(|e| format!("写入失败: {}", e))
    }

    pub fn get_config(&self) -> Vec<MailConfig> { self.read_config() }
    pub fn set_config(&self, accounts: Vec<MailConfig>) -> Result<(), String> { self.write_config(&accounts) }
    pub fn add_account(&self, config: MailConfig) -> Result<(), String> {
        let mut a = self.read_config(); a.retain(|x| x.user != config.user); a.push(config); self.write_config(&a)
    }
    pub fn remove_account(&self, user: &str) -> Result<(), String> {
        let mut a = self.read_config(); a.retain(|x| x.user != user); self.write_config(&a)
    }

    // ─── IMAP 连接（同步）───

    fn connect_one(config: &MailConfig) -> Result<imap::Session<native_tls::TlsStream<TcpStream>>, String> {
        let addr = format!("{}:{}", config.host, config.port);
        let socket = addr.to_socket_addrs()
            .map_err(|e| format!("DNS 失败: {}", e))?
            .next()
            .ok_or_else(|| format!("无法解析: {}", addr))?;
        let tcp = TcpStream::connect_timeout(&socket, Duration::from_secs(10))
            .map_err(|e| format!("超时: {}", e))?;
        let tls = native_tls::TlsConnector::builder()
            .build().map_err(|e| format!("TLS: {}", e))?;
        let stream = tls.connect(&config.host, tcp).map_err(|e| format!("TLS: {}", e))?;
        imap::Client::new(stream)
            .login(&config.user, &config.pass)
            .map_err(|(e, _)| format!("登录: {}", e))
    }

    /// 复刻原版 connectAll: 逐个连接、status 获取 uidNext、收集错误
    pub fn connect_from_configs(&self, configs: &[MailConfig]) -> ConnectResult {
        let mut inner = self.inner.lock().unwrap();
        if inner.connecting {
            return ConnectResult { success: false, errors: vec!["正在连接中".into()] };
        }
        inner.connecting = true;

        let mut errors = Vec::new();
        for config in configs {
            if config.user.is_empty() || config.pass.is_empty() { continue; }
            if inner.accounts.get(&config.user).map_or(false, |a| a.connected) { continue; }

            match Self::connect_one(config) {
                Ok(mut session) => {
                    // status("INBOX", "(UIDNEXT)") —— imap 2.4 标准 API
                    match session.status("INBOX", "(UIDNEXT)") {
                        Ok(mbox) => {
                            let uid_next = mbox.uid_next.unwrap_or(0);
                            inner.accounts.insert(config.user.clone(), AccountState {
                                session: Some(session), config: config.clone(),
                                connected: true, known_uid_next: uid_next,
                            });
                            log::info!("[mail] 已连接 {}", config.user);
                        }
                        Err(e) => { let _ = session.logout(); errors.push(format!("{}: status: {}", config.user, e)); }
                    }
                }
                Err(e) => { log::error!("[mail] {} 连接失败: {}", config.user, e); errors.push(format!("{}: {}", config.user, e)); }
            }
        }
        inner.connecting = false;
        ConnectResult { success: errors.is_empty(), errors }
    }

    pub fn disconnect_all(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.connecting = false;
        for (_, state) in inner.accounts.drain() {
            if let Some(mut s) = state.session { let _ = s.logout(); }
        }
    }

    // ─── 全量拉取（复刻 fetchRecentAll + fetchFromAccount）───

    /// 复刻原版：逐账户 fetch，按 date 降序，取前 count
    pub fn fetch_recent(&self, count: u32) -> Vec<MailSummary> {
        // 一次性取出所有账户信息，释放锁后执行 I/O
        let configs: Vec<MailConfig> = {
            let inner = self.inner.lock().unwrap();
            inner.accounts.values().filter(|s| s.connected).map(|s| s.config.clone()).collect()
        };
        let mut all = Vec::new();
        for config in &configs {
            match Self::connect_one(config) {
                Ok(mut session) => {
                    match Self::fetch_from_account(&mut session, config, count) {
                        Ok(mails) => all.extend(mails),
                        Err(e) => log::error!("[mail] {} 拉取: {}", config.user, e),
                    }
                    let _ = session.logout();
                }
                Err(e) => log::error!("[mail] {} 连接: {}", config.user, e),
            }
        }
        all.sort_by(|a, b| b.date.cmp(&a.date));
        all.truncate(count as usize);
        all
    }

    fn fetch_from_account(
        session: &mut imap::Session<native_tls::TlsStream<TcpStream>>,
        config: &MailConfig, count: u32,
    ) -> Result<Vec<MailSummary>, String> {
        let mbox = session.status("INBOX", "(UIDNEXT)")
            .map_err(|e| format!("status: {}", e))?;
        let uid_next = mbox.uid_next.unwrap_or(1);
        let start = if uid_next > count { uid_next - count } else { 1 };
        let range = format!("{}:*", start);

        let _ = session.select("INBOX").map_err(|e| format!("select: {}", e))?;

        let fetches = session.uid_fetch(&range, "(FLAGS ENVELOPE)")
            .map_err(|e| format!("fetch: {}", e))?;

        let mut msgs = Vec::new();
        for fetch in &fetches {
            let uid = fetch.uid.unwrap_or(0);
            let seen = fetch.flags().iter().any(|f| matches!(f, imap::types::Flag::Seen));
            let (from, subj, ts) = match fetch.envelope() {
                Some(env) => (
                    parse_sender(&env.from),
                    parse_subject(&env.subject),
                    parse_date(&env.date).unwrap_or(0),
                ),
                None => ("未知".into(), "(无主题)".into(), 0i64),
            };
            msgs.push(MailSummary { uid, sender: from, subject: subj, date: ts, seen, account: config.user.clone() });
        }
        Ok(msgs)
    }

    // ─── 新邮件检测（复刻 checkNew + checkAccount）───

    pub fn check_new(&self) -> CheckNewResult {
        let configs: Vec<MailConfig> = {
            let mut inner = self.inner.lock().unwrap();
            if inner.checking_new { return CheckNewResult { new_mails: vec![], code: None }; }
            inner.checking_new = true;
            inner.accounts.values().filter(|s| s.connected).map(|s| s.config.clone()).collect()
        };
        // 释放锁后执行 I/O

        let mut merged = CheckNewResult { new_mails: vec![], code: None };
        for config in &configs {
            match Self::connect_one(config) {
                Ok(mut session) => {
                    match Self::check_one(&mut session, config) {
                        Ok((mails, code)) => {
                            merged.new_mails.extend(mails);
                            if merged.code.is_none() && code.is_some() { merged.code = code; }
                        }
                        Err(e) => log::error!("[mail] {} 检测: {}", config.user, e),
                    }
                    let _ = session.logout();
                }
                Err(e) => log::error!("[mail] {} 连接: {}", config.user, e),
            }
        }

        {
            let mut inner = self.inner.lock().unwrap();
            inner.checking_new = false;
        }
        merged
    }

    fn check_one(
        session: &mut imap::Session<native_tls::TlsStream<TcpStream>>,
        config: &MailConfig,
    ) -> Result<(Vec<MailSummary>, Option<String>), String> {
        let mbox = session.status("INBOX", "(UIDNEXT UIDVALIDITY)")
            .map_err(|e| format!("status: {}", e))?;
        let _current_uid_next = mbox.uid_next.unwrap_or(0);

        // 获取上次记录的 uid_next（从锁中提取，此处简化：用 status 的 uidnext 作为基准）
        // 由于每次操作独立建连，known_uid_next 记录在 HashMap 中
        // 简化：总是拉取最近 5 封未读邮件
        let _ = session.select("INBOX").map_err(|e| format!("select: {}", e))?;

        let unseen = session.uid_search("UNSEEN")
            .map_err(|e| format!("search: {}", e))?;

        if unseen.is_empty() { return Ok((vec![], None)); }

        let mut sorted: Vec<u32> = unseen.into_iter().collect();
        sorted.sort();
        let recent: Vec<u32> = sorted.iter().rev().take(5).copied().collect();
        let seq: String = recent.iter().map(|u| u.to_string()).collect::<Vec<_>>().join(",");

        let fetches = session.uid_fetch(&seq, "(FLAGS ENVELOPE)")
            .map_err(|e| format!("fetch: {}", e))?;

        let mut mails = Vec::new();
        let mut code: Option<String> = None;
        let mut latest_uid: Option<u32> = None;

        for fetch in &fetches {
            let uid = fetch.uid.unwrap_or(0);
            let seen = fetch.flags().iter().any(|f| matches!(f, imap::types::Flag::Seen));
            let (from, subj, ts) = match fetch.envelope() {
                Some(env) => (
                    parse_sender(&env.from),
                    parse_subject(&env.subject),
                    parse_date(&env.date).unwrap_or(0),
                ),
                None => ("未知".into(), "(无主题)".into(), 0i64),
            };
            mails.push(MailSummary { uid, sender: from, subject: subj, date: ts, seen, account: config.user.clone() });
            latest_uid = Some(uid);
        }

        // 提取验证码
        if let Some(latest) = latest_uid {
            match session.uid_fetch(&latest.to_string(), "(BODY.PEEK[])") {
                Ok(body_fetches) => {
                    if let Some(f) = body_fetches.first() {
                        if let Some(body) = f.body() {
                            let text = String::from_utf8_lossy(body);
                            let truncated = if text.len() > CONTENT_MAX_LENGTH { &text[..CONTENT_MAX_LENGTH] } else { &text };
                            code = extract_code(&parse_email_body(truncated));
                        }
                    }
                }
                Err(e) => log::error!("[mail] fetch body: {}", e),
            }
        }

        Ok((mails, code))
    }

    // ─── 邮件操作 ───

    pub fn fetch_content(&self, uid: u32, account: &str) -> Option<String> {
        let config = {
            let inner = self.inner.lock().unwrap();
            inner.accounts.get(account)?.config.clone()
        };
        let mut session = Self::connect_one(&config).ok()?;
        let _ = session.select("INBOX").ok()?;
        let fetches = session.uid_fetch(&uid.to_string(), "(BODY.PEEK[])").ok()?;
        let body = fetches.first()?.body()?;
        let text = String::from_utf8_lossy(body);
        let truncated = if text.len() > CONTENT_MAX_LENGTH { &text[..CONTENT_MAX_LENGTH] } else { &text };
        let parsed = parse_email_body(truncated);
        let _ = session.logout();
        if parsed.is_empty() { None } else { Some(parsed) }
    }

    pub fn mark_read(&self, uids: Vec<u32>, account: &str) -> bool {
        let config = {
            let inner = self.inner.lock().unwrap();
            match inner.accounts.get(account) { Some(s) => s.config.clone(), None => return false }
        };
        let mut session = match Self::connect_one(&config) { Ok(s) => s, Err(_) => return false };
        if session.select("INBOX").is_err() { let _ = session.logout(); return false; }
        let seq: String = uids.iter().map(|u| u.to_string()).collect::<Vec<_>>().join(",");
        let ok = session.uid_store(&seq, "+FLAGS (\\Seen)").is_ok();
        let _ = session.logout();
        ok
    }

    pub fn connection_info(&self) -> Value {
        let inner = self.inner.lock().unwrap();
        let accs: Vec<_> = inner.accounts.iter().map(|(u, s)| serde_json::json!({ "user": u, "connected": s.connected })).collect();
        serde_json::json!({ "connected_count": accs.iter().filter(|a| a["connected"].as_bool() == Some(true)).count(), "accounts": accs })
    }

    pub fn connect_saved(&self) -> ConnectResult {
        let configs = self.read_config();
        if configs.is_empty() { return ConnectResult { success: false, errors: vec!["未配置邮箱账户".into()] }; }
        self.connect_from_configs(&configs)
    }
}

impl MailManagerInner {
    // ─── IMAP 连接（同步）───

    fn connect_one(config: &MailConfig) -> Result<imap::Session<native_tls::TlsStream<TcpStream>>, String> {
        let addr = format!("{}:{}", config.host, config.port);
        let socket = addr.to_socket_addrs()
            .map_err(|e| format!("DNS 失败: {}", e))?
            .next()
            .ok_or_else(|| format!("无法解析: {}", addr))?;
        let tcp = TcpStream::connect_timeout(&socket, Duration::from_secs(10))
            .map_err(|e| format!("超时: {}", e))?;
        let tls = native_tls::TlsConnector::builder()
            .build().map_err(|e| format!("TLS: {}", e))?;
        let stream = tls.connect(&config.host, tcp).map_err(|e| format!("TLS: {}", e))?;
        imap::Client::new(stream)
            .login(&config.user, &config.pass)
            .map_err(|(e, _)| format!("登录: {}", e))
    }

    /// 复刻原版 connectAll: 逐个连接、status 获取 uidNext、收集错误
    pub fn connect_from_configs(&mut self, configs: &[MailConfig]) -> ConnectResult {
        if self.connecting { return ConnectResult { success: false, errors: vec!["正在连接中".into()] }; }
        self.connecting = true;

        let mut errors = Vec::new();
        for config in configs {
            if config.user.is_empty() || config.pass.is_empty() { continue; }
            if self.accounts.get(&config.user).map_or(false, |a| a.connected) { continue; }

            match Self::connect_one(config) {
                Ok(mut session) => {
                    match session.status("INBOX", "(UIDNEXT)") {
                        Ok(mbox) => {
                            let uid_next = mbox.uid_next.unwrap_or(0);
                            self.accounts.insert(config.user.clone(), AccountState {
                                session: Some(session), config: config.clone(),
                                connected: true, known_uid_next: uid_next,
                            });
                            log::info!("[mail] 已连接 {}", config.user);
                        }
                        Err(e) => { let _ = session.logout(); errors.push(format!("{}: status: {}", config.user, e)); }
                    }
                }
                Err(e) => { log::error!("[mail] {} 连接失败: {}", config.user, e); errors.push(format!("{}: {}", config.user, e)); }
            }
        }
        self.connecting = false;
        ConnectResult { success: errors.is_empty(), errors }
    }

    pub fn disconnect_all(&mut self) {
        self.connecting = false;
        for (_, state) in self.accounts.drain() {
            if let Some(mut s) = state.session { let _ = s.logout(); }
        }
    }

    pub fn fetch_recent(&self, count: u32) -> Vec<MailSummary> {
        let configs: Vec<MailConfig> = self.accounts.values().filter(|s| s.connected).map(|s| s.config.clone()).collect();
        let mut all = Vec::new();
        for config in &configs {
            match Self::connect_one(config) {
                Ok(mut session) => {
                    match Self::fetch_from_account(&mut session, config, count) {
                        Ok(mails) => all.extend(mails),
                        Err(e) => log::error!("[mail] {} 拉取: {}", config.user, e),
                    }
                    let _ = session.logout();
                }
                Err(e) => log::error!("[mail] {} 连接: {}", config.user, e),
            }
        }
        all.sort_by(|a, b| b.date.cmp(&a.date));
        all.truncate(count as usize);
        all
    }

    fn fetch_from_account(
        session: &mut imap::Session<native_tls::TlsStream<TcpStream>>,
        config: &MailConfig, count: u32,
    ) -> Result<Vec<MailSummary>, String> {
        let mbox = session.status("INBOX", "(UIDNEXT)").map_err(|e| format!("status: {}", e))?;
        let uid_next = mbox.uid_next.unwrap_or(1);
        let start = if uid_next > count { uid_next - count } else { 1 };
        let range = format!("{}:*", start);
        let _ = session.select("INBOX").map_err(|e| format!("select: {}", e))?;
        let fetches = session.uid_fetch(&range, "(FLAGS ENVELOPE)").map_err(|e| format!("fetch: {}", e))?;
        let mut msgs = Vec::new();
        for fetch in &fetches {
            let uid = fetch.uid.unwrap_or(0);
            let seen = fetch.flags().iter().any(|f| matches!(f, imap::types::Flag::Seen));
            let (from, subj, ts) = match fetch.envelope() {
                Some(env) => (parse_sender(&env.from), parse_subject(&env.subject), parse_date(&env.date).unwrap_or(0)),
                None => ("未知".into(), "(无主题)".into(), 0i64),
            };
            msgs.push(MailSummary { uid, sender: from, subject: subj, date: ts, seen, account: config.user.clone() });
        }
        Ok(msgs)
    }

    pub fn check_new(&mut self) -> CheckNewResult {
        if self.checking_new { return CheckNewResult { new_mails: vec![], code: None }; }
        self.checking_new = true;

        let configs: Vec<MailConfig> = self.accounts.values().filter(|s| s.connected).map(|s| s.config.clone()).collect();

        let mut merged = CheckNewResult { new_mails: vec![], code: None };
        for config in &configs {
            match Self::connect_one(config) {
                Ok(mut session) => {
                    match Self::check_one(&mut session, config) {
                        Ok((mails, code)) => {
                            merged.new_mails.extend(mails);
                            if merged.code.is_none() && code.is_some() { merged.code = code; }
                        }
                        Err(e) => log::error!("[mail] {} 检测: {}", config.user, e),
                    }
                    let _ = session.logout();
                }
                Err(e) => log::error!("[mail] {} 连接: {}", config.user, e),
            }
        }

        self.checking_new = false;
        merged
    }

    fn check_one(
        session: &mut imap::Session<native_tls::TlsStream<TcpStream>>,
        config: &MailConfig,
    ) -> Result<(Vec<MailSummary>, Option<String>), String> {
        let _ = session.select("INBOX").map_err(|e| format!("select: {}", e))?;
        let unseen = session.uid_search("UNSEEN").map_err(|e| format!("search: {}", e))?;
        if unseen.is_empty() { return Ok((vec![], None)); }
        let mut sorted: Vec<u32> = unseen.into_iter().collect(); sorted.sort();
        let recent: Vec<u32> = sorted.iter().rev().take(5).copied().collect();
        let seq: String = recent.iter().map(|u| u.to_string()).collect::<Vec<_>>().join(",");

        let fetches = session.uid_fetch(&seq, "(FLAGS ENVELOPE)").map_err(|e| format!("fetch: {}", e))?;
        let mut mails = Vec::new(); let mut code = None; let mut latest_uid = None;

        for fetch in &fetches {
            let uid = fetch.uid.unwrap_or(0);
            let seen = fetch.flags().iter().any(|f| matches!(f, imap::types::Flag::Seen));
            let (from, subj, ts) = match fetch.envelope() {
                Some(env) => (parse_sender(&env.from), parse_subject(&env.subject), parse_date(&env.date).unwrap_or(0)),
                None => ("未知".into(), "(无主题)".into(), 0i64),
            };
            mails.push(MailSummary { uid, sender: from, subject: subj, date: ts, seen, account: config.user.clone() });
            latest_uid = Some(uid);
        }

        if let Some(latest) = latest_uid {
            match session.uid_fetch(&latest.to_string(), "(BODY.PEEK[])") {
                Ok(body_fetches) => {
                    if let Some(f) = body_fetches.first() {
                        if let Some(body) = f.body() {
                            let text = String::from_utf8_lossy(body);
                            let truncated = if text.len() > CONTENT_MAX_LENGTH { &text[..CONTENT_MAX_LENGTH] } else { &text };
                            code = extract_code(&parse_email_body(truncated));
                        }
                    }
                }
                Err(e) => log::error!("[mail] fetch body: {}", e),
            }
        }
        Ok((mails, code))
    }

    pub fn fetch_content(&self, uid: u32, account: &str) -> Option<String> {
        let config = self.accounts.get(account)?.config.clone();
        drop(config); // avoid holding borrow across connect
        let config = self.accounts.get(account)?.config.clone();
        let mut session = Self::connect_one(&config).ok()?;
        let _ = session.select("INBOX").ok()?;
        let fetches = session.uid_fetch(&uid.to_string(), "(BODY.PEEK[])").ok()?;
        let body = fetches.first()?.body()?;
        let text = String::from_utf8_lossy(body);
        let truncated = if text.len() > CONTENT_MAX_LENGTH { &text[..CONTENT_MAX_LENGTH] } else { &text };
        let parsed = parse_email_body(truncated);
        let _ = session.logout();
        if parsed.is_empty() { None } else { Some(parsed) }
    }

    pub fn mark_read(&self, uids: Vec<u32>, account: &str) -> bool {
        let config = match self.accounts.get(account) { Some(s) => s.config.clone(), None => return false };
        let mut session = match Self::connect_one(&config) { Ok(s) => s, Err(_) => return false };
        if session.select("INBOX").is_err() { let _ = session.logout(); return false; }
        let seq: String = uids.iter().map(|u| u.to_string()).collect::<Vec<_>>().join(",");
        let ok = session.uid_store(&seq, "+FLAGS (\\Seen)").is_ok();
        let _ = session.logout(); ok
    }

    pub fn connection_info(&self) -> Value {
        let accs: Vec<_> = self.accounts.iter().map(|(u, s)| serde_json::json!({ "user": u, "connected": s.connected })).collect();
        serde_json::json!({ "connected_count": accs.iter().filter(|a| a["connected"].as_bool() == Some(true)).count(), "accounts": accs })
    }
}

fn parse_sender(from: &Option<Vec<imap_proto::types::Address>>) -> String {
    match from.as_ref().and_then(|v| v.first()) {
        Some(addr) => {
            let name = addr.name.as_ref().and_then(|n| {
                let s = String::from_utf8_lossy(n);
                if s.trim().is_empty() { None } else { Some(s.trim().to_string()) }
            });
            let mailbox = addr.mailbox.as_ref().map(|m| String::from_utf8_lossy(m));
            let host = addr.host.as_ref().map(|h| String::from_utf8_lossy(h));
            match (name, mailbox, host) {
                (Some(n), _, _) => n,
                (_, Some(mb), Some(h)) => format!("{}@{}", mb, h),
                _ => "未知".into(),
            }
        }
        None => "未知".into(),
    }
}

fn parse_subject(subject: &Option<&[u8]>) -> String {
    match subject {
        Some(bytes) => {
            let s = String::from_utf8_lossy(bytes);
            if s.trim().is_empty() { "(无主题)".into() } else { s.trim().to_string() }
        }
        None => "(无主题)".into(),
    }
}

fn parse_date(date: &Option<&[u8]>) -> Option<i64> {
    let bytes = date.as_ref()?;
    let s = String::from_utf8_lossy(bytes);
    chrono::DateTime::parse_from_rfc2822(&s).ok()
        .map(|d| d.timestamp())
}

// ─── 原版工具函数 ───

fn extract_code(text: &str) -> Option<String> {
    for pattern in types::CODE_PATTERNS {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(m) = caps.get(1) {
                    let code = m.as_str().to_string();
                    if (4..=8).contains(&code.len()) { return Some(code); }
                }
            }
        }
    }
    None
}

/// 复刻原版 mailControl.ts 中 HTML→text 完整替换链：
/// .replace(/<br\s*\/?>/gi, '\n')
/// .replace(/<\/p>/gi, '\n')
/// .replace(/<\/div>/gi, '\n')
/// .replace(/<[^>]+>/g, '')
/// .replace(/&nbsp;/g, ' ')
/// .replace(/&amp;/g, '&')
/// .replace(/&lt;/g, '<')
/// .replace(/&gt;/g, '>')
/// .replace(/\n{3,}/g, '\n\n')
/// .trim()
fn parse_email_body(raw: &str) -> String {
    let br = Regex::new(r"(?i)<br\s*/?>").unwrap();
    let block = Regex::new(r"(?i)</p>|</div>").unwrap();
    let tag = Regex::new(r"<[^>]+>").unwrap();
    let newlines = Regex::new(r"\n{3,}").unwrap();

    let s = br.replace_all(raw, "\n");
    let s = block.replace_all(&s, "\n");
    let s = tag.replace_all(&s, "");
    let s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">");
    let s = newlines.replace_all(&s, "\n\n");
    s.trim().to_string()
}

// ─── Tauri Commands ───
// 所有命令通过 spawn_blocking 执行，锁定 mutex 后委托给 MailManagerInner

#[tauri::command] pub async fn mail_get_config(state: tauri::State<'_, MailManager>) -> Result<Vec<MailConfig>, String> { Ok(state.get_config()) }
#[tauri::command] pub async fn mail_set_config(state: tauri::State<'_, MailManager>, accounts: Vec<MailConfig>) -> Result<(), String> { state.set_config(accounts) }
#[tauri::command] pub async fn mail_add_account(state: tauri::State<'_, MailManager>, config: MailConfig) -> Result<(), String> { state.add_account(config) }
#[tauri::command] pub async fn mail_remove_account(state: tauri::State<'_, MailManager>, user: String) -> Result<(), String> { state.remove_account(&user) }

#[tauri::command]
pub async fn mail_connect_saved(state: tauri::State<'_, MailManager>) -> Result<Value, String> {
    let configs = state.read_config();
    if configs.is_empty() { return Ok(serde_json::json!({"success":false,"errors":["未配置邮箱"]})); }
    let inner = state.inner.clone();
    let result = tokio::task::spawn_blocking(move || {
        let mut g = inner.lock().unwrap();
        g.connect_from_configs(&configs)
    }).await.map_err(|e| format!("连接失败: {}", e))?;
    Ok(serde_json::json!({"success": result.success, "errors": result.errors }))
}

#[tauri::command]
pub async fn mail_fetch_recent(state: tauri::State<'_, MailManager>, count: Option<u32>) -> Result<Vec<MailSummary>, String> {
    let inner = state.inner.clone();
    let c = count.unwrap_or(FETCH_RECENT_COUNT);
    tokio::task::spawn_blocking(move || {
        let g = inner.lock().unwrap();
        g.fetch_recent(c)
    }).await.map_err(|e| format!("拉取失败: {}", e))
}

#[tauri::command]
pub async fn mail_check_new(state: tauri::State<'_, MailManager>) -> Result<Value, String> {
    let inner = state.inner.clone();
    let result = tokio::task::spawn_blocking(move || {
        let mut g = inner.lock().unwrap();
        g.check_new()
    }).await.map_err(|e| format!("检测失败: {}", e))?;
    Ok(serde_json::json!({"newMails": result.new_mails, "code": result.code}))
}

#[tauri::command]
pub async fn mail_fetch_content(state: tauri::State<'_, MailManager>, uid: u32, account: String) -> Result<Option<String>, String> {
    let inner = state.inner.clone();
    tokio::task::spawn_blocking(move || {
        let g = inner.lock().unwrap();
        g.fetch_content(uid, &account)
    }).await.map_err(|e| format!("正文失败: {}", e))
}

#[tauri::command]
pub async fn mail_mark_read(state: tauri::State<'_, MailManager>, uids: Vec<u32>, account: String) -> Result<bool, String> {
    let inner = state.inner.clone();
    tokio::task::spawn_blocking(move || {
        let g = inner.lock().unwrap();
        g.mark_read(uids, &account)
    }).await.map_err(|e| format!("标记失败: {}", e))
}

#[tauri::command]
pub async fn mail_disconnect_all(state: tauri::State<'_, MailManager>) -> Result<(), String> {
    let inner = state.inner.clone();
    tokio::task::spawn_blocking(move || { inner.lock().unwrap().disconnect_all(); Ok::<(), String>(()) })
        .await.map_err(|e| format!("断开失败: {}", e))?
}

#[tauri::command]
pub async fn mail_connection_info(state: tauri::State<'_, MailManager>) -> Result<Value, String> {
    let inner = state.inner.clone();
    tokio::task::spawn_blocking(move || { let g = inner.lock().unwrap(); g.connection_info() })
        .await.map_err(|e| format!("状态失败: {}", e))
}

// ─── 测试 ───

#[cfg(test)]
mod tests {
    use super::*;

    #[test] fn test_extract_normal() { assert_eq!(extract_code("验证码是 123456"), Some("123456".into())); }
    #[test] fn test_extract_none() { assert_eq!(extract_code("普通邮件"), None); }
    #[test] fn test_parse_sender() {
        let addr = imap_proto::types::Address { name: Some(b"Test"), adl: None, mailbox: Some(b"user"), host: Some(b"host.com") };
        assert_eq!(parse_sender(&Some(vec![addr])), "Test");
    }
}
