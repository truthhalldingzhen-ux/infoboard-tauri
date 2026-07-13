pub mod cookie_tcp;
pub mod types;

use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use regex::Regex;


use types::*;

// ─── 常量 ───

const OPENCODE_URL: &str = "https://opencode.ai/workspace/wrk_01KTZNFM9S42BYDED8M1A393D4/go";
const TIMEOUT_SECS: u64 = 15;

/// 回退硬编码 Key（仅当环境变量和设置均未提供时使用）
const MINIMAX_API_KEY_FALLBACK: &str = "sk-cp-REMOVED";

fn get_minimax_api_key(api_key: Option<String>) -> String {
    api_key
        .filter(|k| !k.is_empty())
        .or_else(|| std::env::var("MINIMAX_API_KEY").ok())
        .unwrap_or_else(|| MINIMAX_API_KEY_FALLBACK.to_string())
}
const MINIMAX_API_URL: &str = "https://www.minimaxi.com/v1/token_plan/remains";
const MINIMAX_TIMEOUT_SECS: u64 = 10;

const CHROME_EXE: &str = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// ─── 路径工具 ───

fn get_cookie_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("C:\\Users\\Default"));
    home.join(".qoderworkcn")
        .join("workspace")
        .join("mr6fnmg6yt79zmq6")
        .join("outputs")
        .join("cookie-refresh")
        .join("host")
        .join("opencode-cookie.txt")
}

fn get_user_data_dir() -> String {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Local".to_string());
    format!("{local_app_data}\\Google\\Chrome\\User Data")
}

// ─── 文件读取 ───

fn read_cookie() -> Option<String> {
    let path = get_cookie_path();
    if !path.exists() {
        return None;
    }
    match fs::read_to_string(&path) {
        Ok(c) => {
            let trimmed = c.trim().to_string();
            if trimmed.is_empty() { None } else { Some(trimmed) }
        }
        Err(_) => None,
    }
}

// ─── HTML 解析 ───

fn parse_usage(html: &str, key: &str) -> Option<ParsedUsage> {
    // key:$R[数字]={status:"ok",resetInSec:数字,usagePercent:数字}
    let pattern = format!(r#"{key}:\$R\[\d+\]=\{{status:"ok",resetInSec:(\d+),usagePercent:(\d+)\}}"#);
    let re = Regex::new(&pattern).ok()?;
    let cap = re.captures(html)?;
    Some(ParsedUsage {
        reset_in_sec: cap[1].parse().ok()?,
        usage_percent: cap[2].parse::<f64>().ok()?,
    })
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn fmt_ms(ms: i64) -> String {
    if ms <= 0 {
        return String::new();
    }
    let sec = ms / 1000;
    let d = sec / 86400;
    let h = (sec % 86400) / 3600;
    let m = (sec % 3600) / 60;
    if d > 0 { return format!("{d}天{h}小时"); }
    if h > 0 { return format!("{h}小时{m}分钟"); }
    if m > 0 { return format!("{m}分钟"); }
    format!("{sec}秒")
}

// ─── Chrome 进程检测 ───

fn is_chrome_running() -> bool {
    match Command::new("tasklist")
        .args(["/FI", "IMAGENAME eq chrome.exe", "/NH"])
        .output()
    {
        Ok(output) => {
            let text = String::from_utf8_lossy(&output.stdout);
            text.lines().any(|line| line.contains("chrome.exe"))
        }
        Err(_) => false,
    }
}

fn get_chrome_pids() -> Vec<u32> {
    let mut pids = Vec::new();
    match Command::new("tasklist")
        .args(["/FI", "IMAGENAME eq chrome.exe", "/FO", "CSV"])
        .output()
    {
        Ok(output) => {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 2 {
                    let pid_str = parts[1].trim_matches('"');
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        pids.push(pid);
                    }
                }
            }
        }
        Err(_) => {}
    }
    pids
}

// ─── command 实现 ───

#[tauri::command]
pub async fn opencode_get_usage() -> Result<UsageStats, String> {
    println!("[OpenCode] 查询用量开始");
    let cookie = match read_cookie() {
        Some(c) => c,
        None => {
            println!("[OpenCode] cookie 文件不存在，返回空状态");
            return Ok(UsageStats {
                db_exists: false,
                today_tokens: 0.0,
                weekly_tokens: 0.0,
                monthly_tokens: 0.0,
                rolling_reset_in_sec: None,
                weekly_reset_in_sec: None,
                monthly_reset_in_sec: None,
                error: Some("cookie 文件不存在".to_string()),
                timestamp: now_millis(),
            });
        }
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {e}"))?;

    let resp = client
        .get(OPENCODE_URL)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Gecko/20100101 Firefox/148.0")
        .header("Accept", "text/html")
        .header("Cookie", &cookie)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                format!("请求超时（{TIMEOUT_SECS}s）")
            } else {
                format!("请求失败: {e}")
            }
        })?;

    if !resp.status().is_success() {
        let err_msg = format!("HTTP {}（cookie 可能已过期）", resp.status().as_u16());
        println!("[OpenCode] {}", err_msg);
        return Ok(UsageStats {
            db_exists: true,
            today_tokens: 0.0,
            weekly_tokens: 0.0,
            monthly_tokens: 0.0,
            rolling_reset_in_sec: None,
            weekly_reset_in_sec: None,
            monthly_reset_in_sec: None,
            error: Some(format!("HTTP {}（cookie 可能已过期）", resp.status().as_u16())),
            timestamp: now_millis(),
        });
    }

    let html = resp.text().await.map_err(|e| format!("读取响应失败: {e}"))?;

    let rolling = parse_usage(&html, "rollingUsage");
    let weekly = parse_usage(&html, "weeklyUsage");
    let monthly = parse_usage(&html, "monthlyUsage");

    if rolling.is_none() && weekly.is_none() && monthly.is_none() {
        let is_login = html.contains("openauth")
            || html.contains("继续使用")
            || html.contains("continue with github")
            || html.to_lowercase().contains("sign in");
        let error = if is_login {
            "cookie 已失效（页面返回登录页）".to_string()
        } else {
            "页面无用量数据".to_string()
        };
        return Ok(UsageStats {
            db_exists: true,
            today_tokens: 0.0,
            weekly_tokens: 0.0,
            monthly_tokens: 0.0,
            rolling_reset_in_sec: None,
            weekly_reset_in_sec: None,
            monthly_reset_in_sec: None,
            error: Some(error),
            timestamp: now_millis(),
        });
    }

    println!(
        "[OpenCode] 用量查询成功 (今日: {:.1}%, 本周: {:.1}%, 本月: {:.1}%)",
        rolling.as_ref().map(|r| r.usage_percent).unwrap_or(0.0),
        weekly.as_ref().map(|r| r.usage_percent).unwrap_or(0.0),
        monthly.as_ref().map(|r| r.usage_percent).unwrap_or(0.0),
    );
    Ok(UsageStats {
        db_exists: true,
        today_tokens: rolling.as_ref().map(|r| r.usage_percent).unwrap_or(0.0),
        weekly_tokens: weekly.as_ref().map(|r| r.usage_percent).unwrap_or(0.0),
        monthly_tokens: monthly.as_ref().map(|r| r.usage_percent).unwrap_or(0.0),
        rolling_reset_in_sec: rolling.map(|r| r.reset_in_sec),
        weekly_reset_in_sec: weekly.map(|r| r.reset_in_sec),
        monthly_reset_in_sec: monthly.map(|r| r.reset_in_sec),
        error: None,
        timestamp: now_millis(),
    })
}

#[tauri::command]
pub async fn opencode_get_sessions() -> Result<Vec<SessionInfo>, String> {
    // opencode.ai 不提供会话接口
    Ok(Vec::new())
}

#[tauri::command]
pub async fn opencode_get_minimax(api_key: Option<String>) -> Result<MiniMaxUsage, String> {
    let has_key = api_key.as_ref().map(|k| !k.is_empty()).unwrap_or(false);
    println!("[OpenCode] MiniMax 查询开始 (有 API Key: {})", has_key);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(MINIMAX_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {e}"))?;

    let resp = client
        .get(MINIMAX_API_URL)
        .header("Authorization", format!("Bearer {}", get_minimax_api_key(api_key)))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                format!("MiniMax 请求超时（{MINIMAX_TIMEOUT_SECS}s）")
            } else {
                format!("MiniMax 请求失败: {e}")
            }
        })?;

    if !resp.status().is_success() {
        return Err(format!("MiniMax HTTP {}", resp.status().as_u16()));
    }

    let data: MiniMaxResponse = resp
        .json()
        .await
        .map_err(|e| format!("MiniMax 响应解析失败: {e}"))?;

    let base = data.base_resp.ok_or("MiniMax 无 base_resp")?;
    if base.status_code != 0 {
        return Err(base.status_msg.unwrap_or_else(|| "MiniMax API 错误".to_string()));
    }

    let remains = data.model_remains.ok_or("MiniMax 无 model_remains")?;
    let general = remains
        .into_iter()
        .find(|m| m.model_name == "general")
        .ok_or("无 general 模型数据")?;

    Ok(MiniMaxUsage {
        rolling_used: 100.0 - general.current_interval_remaining_percent,
        rolling_reset_ms: general.remains_time,
        weekly_used: 100.0 - general.current_weekly_remaining_percent,
        weekly_reset_ms: general.weekly_remains_time,
        rolling_reset_label: fmt_ms(general.remains_time),
        weekly_reset_label: fmt_ms(general.weekly_remains_time),
    })
}

#[tauri::command]
pub fn opencode_refresh_cookie() -> Result<RefreshResult, String> {
    println!("[OpenCode] Cookie 刷新开始");
    // 检测 Chrome 是否运行
    if is_chrome_running() {
        println!("[OpenCode] Chrome 已运行，TCP 触发刷新");
        // 路径 A: TCP 触发
        match cookie_tcp::tcp_send("refresh", 3000) {
            Ok(ref resp) if resp == "OK" => {
                println!("[OpenCode] Cookie 刷新成功 (TCP)");
                return Ok(RefreshResult {
                    started: true,
                    message: None,
                });
            }
            Ok(resp) => {
                println!("[OpenCode] Cookie 刷新失败 (TCP 响应: {resp})");
                return Ok(RefreshResult {
                    started: false,
                    message: Some(format!("TCP 错误: {resp}")),
                });
            }
            Err(e) => {
                println!("[OpenCode] Cookie 刷新失败 (TCP: {e})");
                return Ok(RefreshResult {
                    started: false,
                    message: Some(format!("TCP 失败: {e}")),
                });
            }
        }
    }

    // 路径 B: 启动 headless Chrome
    let mtime_before = get_cookie_mtime_inner();
    let pids_before = get_chrome_pids();

    let user_data_dir = get_user_data_dir();

    let _child = Command::new(CHROME_EXE)
        .args([
            "--headless=new",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-sync",
            "--disable-background-networking",
            &format!("--user-data-dir={user_data_dir}"),
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|e| format!("启动 Chrome 失败: {e}"))?;

    // 等待 TCP 端口就绪（12s 超时）
    let ready = cookie_tcp::wait_for_tcp_port(12000);
    if !ready {
        // 清理 Chrome 进程
        let _ = kill_new_chrome_processes(&pids_before);
        return Ok(RefreshResult {
            started: false,
            message: Some("Chrome 未能在 12s 内启动 cookie-host".to_string()),
        });
    }

    let triggered = cookie_tcp::tcp_send("refresh", 3000)
        .map_err(|e| format!("TCP 触发失败: {e}"))?;

    if triggered != "OK" {
        let _ = kill_new_chrome_processes(&pids_before);
        return Ok(RefreshResult {
            started: false,
            message: Some(format!("TCP 触发失败: {triggered}")),
        });
    }

    // 轮询 cookie mtime（10s 超时）
    let start = std::time::Instant::now();
    let mut updated = false;
    while start.elapsed() < Duration::from_secs(10) {
        std::thread::sleep(Duration::from_millis(200));
        if get_cookie_mtime_inner() > mtime_before {
            updated = true;
            break;
        }
    }

    // 关闭我们启动的 Chrome 进程
    let _ = kill_new_chrome_processes(&pids_before);

    if updated {
        Ok(RefreshResult {
            started: true,
            message: None,
        })
    } else {
        Ok(RefreshResult {
            started: false,
            message: Some("cookie 未更新（请确认已登录 opencode.ai）".to_string()),
        })
    }
}

fn kill_new_chrome_processes(before: &[u32]) -> Result<(), String> {
    let after = get_chrome_pids();
    for pid in &after {
        if !before.contains(pid) {
            let _ = Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string(), "/T"])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();
        }
    }
    Ok(())
}

fn get_cookie_mtime_inner() -> u128 {
    let path = get_cookie_path();
    match fs::metadata(&path) {
        Ok(meta) => match meta.modified() {
            Ok(time) => time.duration_since(UNIX_EPOCH).unwrap_or_default().as_millis(),
            Err(_) => 0,
        },
        Err(_) => 0,
    }
}

#[tauri::command]
pub fn opencode_get_cookie_mtime() -> Result<u128, String> {
    Ok(get_cookie_mtime_inner())
}

// ─── 单元测试 ───

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_usage_success() {
        let html = r#"some text rollingUsage:$R[123]={status:"ok",resetInSec:456,usagePercent:78} more text"#;
        let result = parse_usage(html, "rollingUsage");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.reset_in_sec, 456);
        assert_eq!(p.usage_percent, 78.0);
    }

    #[test]
    fn test_parse_usage_weekly() {
        let html = r#"weeklyUsage:$R[456]={status:"ok",resetInSec:789,usagePercent:90}"#;
        let result = parse_usage(html, "weeklyUsage");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.reset_in_sec, 789);
        assert_eq!(p.usage_percent, 90.0);
    }

    #[test]
    fn test_parse_usage_monthly() {
        let html = r#"monthlyUsage:$R[789]={status:"ok",resetInSec:111,usagePercent:50}"#;
        let result = parse_usage(html, "monthlyUsage");
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.reset_in_sec, 111);
        assert_eq!(p.usage_percent, 50.0);
    }

    #[test]
    fn test_parse_usage_no_match() {
        let html = r#"some random text without the pattern"#;
        let result = parse_usage(html, "rollingUsage");
        assert!(result.is_none());
    }

    #[test]
    fn test_fmt_ms() {
        assert_eq!(fmt_ms(0), "");
        assert_eq!(fmt_ms(5000), "5秒");
        assert_eq!(fmt_ms(120_000), "2分钟");
        assert_eq!(fmt_ms(3600_000), "1小时0分钟");
        assert_eq!(fmt_ms(86400_000), "1天0小时");
    }

    #[test]
    fn test_get_cookie_path_format() {
        let path = get_cookie_path();
        let path_str = path.to_string_lossy();
        assert!(path_str.contains("opencode-cookie.txt"));
        assert!(path_str.contains(".qoderworkcn"));
    }
}
