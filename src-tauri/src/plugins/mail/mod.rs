//! IMAP 邮件插件后端
//!
//! 多账户 IMAP 客户端，支持：
//! - 配置管理（增删改查）
//! - 每次操作独立建连（同步 imap crate + native-tls）
//! - 邮件拉取 + 新邮件检测 + 验证码提取
//! - 标记已读
//! - 正文获取（HTML → 纯文本）

pub mod types;

use std::fs;
use std::path::PathBuf;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;
use std::borrow::Cow;

use mail_parser::MessageParser;
use native_tls::TlsConnector;
use regex::Regex;
use serde_json::Value;

use types::*;

// ─── 常量 ───

/// 邮件配置文件名
const MAIL_CONFIG_FILE: &str = "mail_config.json";

/// 拉取最近邮件数量
const FETCH_RECENT_COUNT: u32 = 5;

// ─── 邮件管理器 ───

/// 多账户邮件管理器（无状态，每次操作新建连接）
#[derive(Clone)]
pub struct MailManager {
    config_path: PathBuf,
}

impl MailManager {
    pub fn new() -> Self {
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("infoboard-tauri");
        let _ = fs::create_dir_all(&config_dir);
        Self {
            config_path: config_dir.join(MAIL_CONFIG_FILE),
        }
    }

    // ─── 配置读写 ───

    fn read_config(&self) -> Vec<MailConfig> {
        match fs::read_to_string(&self.config_path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => vec![],
        }
    }

    fn write_config(&self, accounts: &[MailConfig]) -> Result<(), String> {
        let json = serde_json::to_string_pretty(accounts)
            .map_err(|e| format!("序列化配置失败: {}", e))?;
        fs::write(&self.config_path, json)
            .map_err(|e| format!("写入配置失败: {}", e))
    }

    pub fn get_config(&self) -> Vec<MailConfig> {
        self.read_config()
    }

    pub fn set_config(&self, accounts: Vec<MailConfig>) -> Result<(), String> {
        self.write_config(&accounts)
    }

    pub fn add_account(&self, config: MailConfig) -> Result<(), String> {
        let mut accounts = self.read_config();
        if let Some(pos) = accounts.iter().position(|a| a.user == config.user) {
            accounts[pos] = config;
        } else {
            accounts.push(config);
        }
        self.write_config(&accounts)
    }

    pub fn remove_account(&self, user: &str) -> Result<(), String> {
        let mut accounts = self.read_config();
        accounts.retain(|a| a.user != user);
        self.write_config(&accounts)
    }

    // ─── IMAP 连接辅助（同步）───

    /// 连接到 IMAP 服务器并登录
    fn connect(config: &MailConfig) -> Result<imap::Session<native_tls::TlsStream<TcpStream>>, String> {
        let addr = format!("{}:{}", config.host, config.port);

        // 解析地址并设置 10 秒连接超时（防止服务器不可达时无限挂起）
        let socket_addr = addr
            .to_socket_addrs()
            .map_err(|e| format!("[{}] DNS 解析失败: {}", config.user, e))?
            .next()
            .ok_or_else(|| format!("[{}] 无法解析地址: {}", config.user, addr))?;

        let tcp = TcpStream::connect_timeout(&socket_addr, Duration::from_secs(10))
            .map_err(|e| format!("[{}] TCP 连接超时 (10s): {}", config.user, e))?;

        let tls = TlsConnector::builder()
            .build()
            .map_err(|e| format!("[{}] TLS 初始化失败: {}", config.user, e))?;

        let tls_stream = tls
            .connect(config.host.as_str(), tcp)
            .map_err(|e| format!("[{}] TLS 握手失败: {}", config.user, e))?;

        let client = imap::Client::new(tls_stream);

        match client.login(config.user.as_str(), config.pass.as_str()) {
            Ok(session) => Ok(session),
            Err((e, _)) => Err(format!("[{}] 登录失败: {}", config.user, e)),
        }
    }

// ─── 公开 API ───

    /// 测试连接所有已配置的账户
    pub fn connect_saved(&self) -> ConnectResult {
        let accounts = self.read_config();
        if accounts.is_empty() {
            return ConnectResult {
                success: false,
                errors: vec!["未配置邮箱账户".to_string()],
            };
        }
        let mut errors = Vec::new();
        let mut success_any = false;
        for config in &accounts {
            match Self::connect(config) {
                Ok(mut session) => {
                    let _ = session.logout();
                    success_any = true;
                }
                Err(e) => errors.push(e),
            }
        }
        ConnectResult {
            success: success_any,
            errors,
        }
    }

    /// 拉取最近 N 封邮件（全部账户）
    pub fn fetch_recent(&self, count: u32) -> Vec<MailSummary> {
        let accounts = self.read_config();
        let mut all = Vec::new();
        for config in &accounts {
            match Self::connect(config) {
                Ok(session) => {
                    match Self::fetch_account_recent(session, count, &config.user) {
                        Ok(mails) => all.extend(mails),
                        Err(e) => log::error!("[{}] 拉取失败: {}", config.user, e),
                    }
                }
                Err(e) => log::error!("[{}] 连接失败: {}", config.user, e),
            }
        }
        all
    }

    fn fetch_account_recent(
        mut session: imap::Session<native_tls::TlsStream<TcpStream>>,
        count: u32,
        account: &str,
    ) -> Result<Vec<MailSummary>, String> {
        session
            .select("INBOX")
            .map_err(|e| format!("选择 INBOX 失败: {}", e))?;

        let all_uids = session
            .uid_search("ALL")
            .map_err(|e| format!("搜索失败: {}", e))?;

        if all_uids.is_empty() {
            let _ = session.logout();
            return Ok(vec![]);
        }

        // HashSet<u32> → Vec 排序 → 取最近 count 封
        let mut sorted: Vec<u32> = all_uids.into_iter().collect();
        sorted.sort();
        let recent: Vec<u32> = sorted.iter().rev().take(count as usize).copied().collect();
        let seq = uids_to_seq_str(&recent);

        let fetches = session
            .uid_fetch(seq.as_str(), "(FLAGS RFC822.HEADER)")
            .map_err(|e| format!("拉取头部失败: {}", e))?;

        let mut mails = Vec::new();
        for fetch in &fetches {
            let uid = fetch.uid.unwrap_or(0);
            let seen = fetch.flags().iter().any(|f| matches!(f, imap::types::Flag::Seen));

            let (sender, subject, date) = if let Some(body) = fetch.body() {
                parse_header(body)
            } else {
                ("(未知)".to_string(), "(无主题)".to_string(), 0i64)
            };

            mails.push(MailSummary {
                uid,
                sender,
                subject,
                date,
                seen,
                account: account.to_string(),
            });
        }

        let _ = session.logout();
        Ok(mails)
    }

    /// 检测新邮件 + 提取验证码
    pub fn check_new(&self) -> CheckNewResult {
        let accounts = self.read_config();
        let mut new_mails = Vec::new();
        let mut code: Option<String> = None;

        for config in &accounts {
            match Self::connect(config) {
                Ok(session) => {
                    match Self::check_account_new(session, config) {
                        Ok((mails, extracted)) => {
                            new_mails.extend(mails);
                            if code.is_none() && extracted.is_some() {
                                code = extracted;
                            }
                        }
                        Err(e) => log::error!("[{}] 检测新邮件失败: {}", config.user, e),
                    }
                }
                Err(e) => log::error!("[{}] 连接失败: {}", config.user, e),
            }
        }

        CheckNewResult { new_mails, code }
    }

    fn check_account_new(
        session: imap::Session<native_tls::TlsStream<TcpStream>>,
        config: &MailConfig,
    ) -> Result<(Vec<MailSummary>, Option<String>), String> {
        let mut session = session;
        session
            .select("INBOX")
            .map_err(|e| format!("选择 INBOX 失败: {}", e))?;

        let unseen = session
            .uid_search("UNSEEN")
            .map_err(|e| format!("搜索未读失败: {}", e))?;

        if unseen.is_empty() {
            let _ = session.logout();
            return Ok((vec![], None));
        }

        let mut sorted: Vec<u32> = unseen.into_iter().collect();
        sorted.sort();
        let recent: Vec<u32> = sorted.iter().rev().take(5).copied().collect();
        let seq = uids_to_seq_str(&recent);

        let fetches = session
            .uid_fetch(seq.as_str(), "(FLAGS RFC822.HEADER)")
            .map_err(|e| format!("拉取新邮件头部失败: {}", e))?;

        let mut mails = Vec::new();
        let mut code: Option<String> = None;

        for fetch in &fetches {
            let uid = fetch.uid.unwrap_or(0);
            let seen = fetch.flags().iter().any(|f| matches!(f, imap::types::Flag::Seen));
            let (sender, subject, date) = if let Some(body) = fetch.body() {
                parse_header(body)
            } else {
                ("(未知)".to_string(), "(无主题)".to_string(), 0i64)
            };

            // 对第一封未提取验证码的邮件获取正文
            if code.is_none() {
                let body_fetches = session
                    .uid_fetch(uid.to_string().as_str(), "(BODY.PEEK[TEXT])")
                    .map_err(|e| format!("获取正文失败: {}", e))?;
                if let Some(f) = body_fetches.first() {
                    if let Some(body_bytes) = f.body() {
                        let text = String::from_utf8_lossy(body_bytes);
                        code = extract_code_from_text(&text);
                    }
                }
            }

            mails.push(MailSummary {
                uid,
                sender,
                subject,
                date,
                seen,
                account: config.user.clone(),
            });
        }

        let _ = session.logout();
        Ok((mails, code))
    }

    /// 获取邮件正文
    pub fn fetch_content(&self, uid: u32, account: &str) -> Option<String> {
        let accounts = self.read_config();
        let config = accounts.iter().find(|a| a.user == account)?;

        let mut session = Self::connect(config).ok()?;
        let _ = session.select("INBOX").ok()?;

        let fetches = session
            .uid_fetch(uid.to_string().as_str(), "(RFC822)")
            .ok()?;

        if fetches.is_empty() {
            let _ = session.logout();
            return None;
        }

        let body = fetches[0].body()?;
        let parser = MessageParser::new();
        let msg = parser.parse(body)?;

        let text_body = msg.body_text(0).unwrap_or(Cow::Borrowed(""));
        let result = if text_body.is_empty() {
            let html_body = msg.body_html(0).unwrap_or(Cow::Borrowed(""));
            if html_body.is_empty() {
                // 尝试获取其他文本部分
                let mut t = None;
                for i in 0..5 {
                    let part = msg.body_text(i).unwrap_or(Cow::Borrowed(""));
                    if !part.is_empty() {
                        t = Some(part.to_string());
                        break;
                    }
                }
                t
            } else {
                Some(strip_html_tags(&html_body))
            }
        } else {
            Some(text_body.to_string())
        };

        let _ = session.logout();
        result
    }

    /// 标记已读
    pub fn mark_read(&self, uids: Vec<u32>, account: &str) -> bool {
        let accounts = self.read_config();
        let config = match accounts.iter().find(|a| a.user == account) {
            Some(c) => c,
            None => return false,
        };

        let mut session = match Self::connect(config) {
            Ok(s) => s,
            Err(_) => return false,
        };

        if session.select("INBOX").is_err() {
            let _ = session.logout();
            return false;
        }

        let seq = uids_to_seq_str(&uids);
        let result = session
            .uid_store(seq.as_str(), "+FLAGS (\\Seen)")
            .is_ok();

        let _ = session.logout();
        result
    }

    /// 断开所有连接（无持久连接，空操作）
    pub fn disconnect_all(&self) {
        // 每次操作建连，无需断开
    }

    /// 连接状态信息
    pub fn connection_info(&self) -> Value {
        let accounts = self.read_config();
        serde_json::json!({
            "connected_count": 0,
            "accounts": accounts.iter().map(|a| serde_json::json!({
                "user": a.user,
                "connected": false,
            })).collect::<Vec<_>>(),
        })
    }
}

// ─── Helper 函数 ───

/// 将 uid 切片转换为 IMAP 序列字符串（如 "1,2,3"）
fn uids_to_seq_str(uids: &[u32]) -> String {
    uids.iter()
        .map(|u| u.to_string())
        .collect::<Vec<_>>()
        .join(",")
}

/// 解析邮件头部
fn parse_header(header_bytes: &[u8]) -> (String, String, i64) {
    let parser = MessageParser::new();
    match parser.parse(header_bytes) {
        Some(parsed) => {
            let sender = parsed
                .from()
                .and_then(|f| f.first())
                .and_then(|a| a.address())
                .unwrap_or("(未知)")
                .to_string();
            let subject = parsed.subject().unwrap_or("(无主题)").to_string();
            let date = parsed.date().map(|d| d.to_timestamp()).unwrap_or(0);
            (sender, subject, date)
        }
        None => ("(解析失败)".to_string(), "(无主题)".to_string(), 0),
    }
}

/// 从文本中提取验证码
fn extract_code_from_text(text: &str) -> Option<String> {
    for pattern in types::CODE_PATTERNS {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(m) = caps.get(1) {
                    let code = m.as_str().to_string();
                    if (4..=8).contains(&code.len()) {
                        return Some(code);
                    }
                }
            }
        }
    }
    None
}

/// 简易 HTML 标签清理
fn strip_html_tags(html: &str) -> String {
    let re = Regex::new(r"<[^>]*>").unwrap();
    // 用空格替换标签，使 inline 元素（如 <b>、<span>）之间产生正确的分词
    let without_tags = re.replace_all(html, " ");
    // 合并连续空白
    let re2 = Regex::new(r"\s{2,}").unwrap();
    let collapsed = re2.replace_all(&without_tags, " ");
    let result = html_escape::decode_html_entities(&collapsed);
    result.trim().to_string()
}

// ─── Tauri Commands ───
// 所有涉及网络 I/O 的命令均使用 spawn_blocking 执行，避免阻塞 IPC 线程

#[tauri::command]
pub async fn mail_get_config(
    state: tauri::State<'_, MailManager>,
) -> Result<Vec<MailConfig>, String> {
    let manager = state.inner().clone();
    tokio::task::spawn_blocking(move || manager.get_config())
        .await
        .map_err(|e| format!("读取配置失败: {}", e))
}

#[tauri::command]
pub async fn mail_set_config(
    state: tauri::State<'_, MailManager>,
    accounts: Vec<MailConfig>,
) -> Result<(), String> {
    let manager = state.inner().clone();
    tokio::task::spawn_blocking(move || manager.set_config(accounts))
        .await
        .map_err(|e| format!("保存配置失败: {}", e))?
}

#[tauri::command]
pub async fn mail_add_account(
    state: tauri::State<'_, MailManager>,
    config: MailConfig,
) -> Result<(), String> {
    let manager = state.inner().clone();
    tokio::task::spawn_blocking(move || manager.add_account(config))
        .await
        .map_err(|e| format!("添加账户失败: {}", e))?
}

#[tauri::command]
pub async fn mail_remove_account(
    state: tauri::State<'_, MailManager>,
    user: String,
) -> Result<(), String> {
    let manager = state.inner().clone();
    tokio::task::spawn_blocking(move || manager.remove_account(&user))
        .await
        .map_err(|e| format!("删除账户失败: {}", e))?
}

#[tauri::command]
pub async fn mail_connect_saved(
    state: tauri::State<'_, MailManager>,
) -> Result<Value, String> {
    let manager = state.inner().clone();
    let result = tokio::task::spawn_blocking(move || manager.connect_saved())
        .await
        .map_err(|e| format!("连接失败: {}", e))?;
    Ok(serde_json::json!({
        "success": result.success,
        "errors": result.errors,
    }))
}

#[tauri::command]
pub async fn mail_fetch_recent(
    state: tauri::State<'_, MailManager>,
    count: Option<u32>,
) -> Result<Vec<MailSummary>, String> {
    let manager = state.inner().clone();
    let c = count.unwrap_or(FETCH_RECENT_COUNT);
    tokio::task::spawn_blocking(move || manager.fetch_recent(c))
        .await
        .map_err(|e| format!("拉取邮件失败: {}", e))
}

#[tauri::command]
pub async fn mail_check_new(
    state: tauri::State<'_, MailManager>,
) -> Result<Value, String> {
    let manager = state.inner().clone();
    let result = tokio::task::spawn_blocking(move || manager.check_new())
        .await
        .map_err(|e| format!("检测新邮件失败: {}", e))?;
    Ok(serde_json::json!({
        "newMails": result.new_mails,
        "code": result.code,
    }))
}

#[tauri::command]
pub async fn mail_fetch_content(
    state: tauri::State<'_, MailManager>,
    uid: u32,
    account: String,
) -> Result<Option<String>, String> {
    let manager = state.inner().clone();
    tokio::task::spawn_blocking(move || manager.fetch_content(uid, &account))
        .await
        .map_err(|e| format!("获取邮件正文失败: {}", e))
}

#[tauri::command]
pub async fn mail_mark_read(
    state: tauri::State<'_, MailManager>,
    uids: Vec<u32>,
    account: String,
) -> Result<bool, String> {
    let manager = state.inner().clone();
    tokio::task::spawn_blocking(move || manager.mark_read(uids, &account))
        .await
        .map_err(|e| format!("标记已读失败: {}", e))
}

#[tauri::command]
pub async fn mail_disconnect_all(
    state: tauri::State<'_, MailManager>,
) -> Result<(), String> {
    let manager = state.inner().clone();
    tokio::task::spawn_blocking(move || {
        manager.disconnect_all();
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("断开连接失败: {}", e))?
}

#[tauri::command]
pub async fn mail_connection_info(
    state: tauri::State<'_, MailManager>,
) -> Result<Value, String> {
    let manager = state.inner().clone();
    let result = tokio::task::spawn_blocking(move || manager.connection_info())
        .await
        .map_err(|e| format!("获取连接状态失败: {}", e))?;
    Ok(result)
}

// ─── 单元测试 ───

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_code_from_text_normal() {
        assert_eq!(extract_code_from_text("您的验证码是 123456"), Some("123456".to_string()));
    }

    #[test]
    fn test_extract_code_from_text_colon() {
        assert_eq!(extract_code_from_text("验证码：987654"), Some("987654".to_string()));
    }

    #[test]
    fn test_extract_code_english() {
        assert_eq!(extract_code_from_text("Your code: AbCd1234"), Some("AbCd1234".to_string()));
    }

    #[test]
    fn test_extract_code_no_match() {
        assert_eq!(extract_code_from_text("普通邮件"), None);
    }

    #[test]
    fn test_extract_code_too_short() {
        assert_eq!(extract_code_from_text("验证码是 123"), None);
    }

    #[test]
    fn test_extract_code_too_long() {
        assert_eq!(extract_code_from_text("验证码是 123456789"), None);
    }

    #[test]
    fn test_strip_html_tags() {
        assert_eq!(strip_html_tags("<p>Hello <b>World</b></p>"), "Hello World");
        assert_eq!(strip_html_tags("<div>Line1</div><p>Line2</p>"), "Line1 Line2");
    }

    #[test]
    fn test_uids_to_seq_str() {
        assert_eq!(uids_to_seq_str(&[1, 2, 3]), "1,2,3");
    }

    #[test]
    fn test_uids_to_seq_str_empty() {
        assert_eq!(uids_to_seq_str(&[]), "");
    }

    #[test]
    fn test_parse_header_empty() {
        let (sender, subject, date) = parse_header(&[]);
        assert_eq!(sender, "(解析失败)");
        assert_eq!(subject, "(无主题)");
        assert_eq!(date, 0);
    }
}
