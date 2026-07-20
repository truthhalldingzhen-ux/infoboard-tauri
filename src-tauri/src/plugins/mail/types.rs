//! IMAP 邮件类型定义
//!
//! 复刻自 Electron 版 `src/types/electron.ts` 中的 MailConfig 及
//! `mailControl.ts` 中的 MailSummary / CheckNewResult / ConnectResult

use serde::{Deserialize, Serialize};

/// 复刻原版 MailConfig 接口
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailConfig {
    pub host: String,
    pub port: u16,
    pub secure: bool,
    pub user: String,
    pub pass: String,
}

/// 复刻原版 MailSummary 接口
#[derive(Debug, Clone, Serialize)]
pub struct MailSummary {
    pub uid: u32,
    pub sender: String,
    pub subject: String,
    pub date: i64,
    pub seen: bool,
    pub account: String,
}

/// 复刻原版 CheckNewResult
#[derive(Debug, Clone, Serialize)]
pub struct CheckNewResult {
    pub new_mails: Vec<MailSummary>,
    pub code: Option<String>,
}

/// 复刻原版 connectAll 返回值
#[derive(Debug, Clone, Serialize)]
pub struct ConnectResult {
    pub success: bool,
    pub errors: Vec<String>,
}

/// 复刻原版 `extractCode()` 中的正则模式
pub static CODE_PATTERNS: &[&str] = &[
    r"验证码[：:\s为是]*[：:\s]*([A-Za-z0-9]{4,8})",
    r"(?i)(?:verification\s*)?code[：:\s]*([A-Za-z0-9]{4,8})",
    r"动态码[：:\s]*([A-Za-z0-9]{4,8})",
    r"校验码[：:\s]*([A-Za-z0-9]{4,8})",
    r"安全码[：:\s]*([A-Za-z0-9]{4,8})",
    r"一次性密码[：:\s]*([A-Za-z0-9]{4,8})",
    r"(?i)OTP[：:\s]*([A-Za-z0-9]{4,8})",
];

#[cfg(test)]
mod tests {
    use super::*;
    use regex::Regex;

    fn extract_code(text: &str) -> Option<String> {
        for pattern in CODE_PATTERNS {
            if let Ok(re) = Regex::new(pattern) {
                if let Some(caps) = re.captures(text) {
                    if let Some(m) = caps.get(1) {
                        return Some(m.as_str().to_string());
                    }
                }
            }
        }
        None
    }

    #[test]
    fn test_normal() {
        assert_eq!(extract_code("验证码是 123456"), Some("123456".into()));
    }

    #[test]
    fn test_with_letter() {
        assert_eq!(extract_code("验证码为: aBcD1234"), Some("aBcD1234".into()));
    }

    #[test]
    fn test_english() {
        assert_eq!(extract_code("Your Code: 556677"), Some("556677".into()));
    }

    #[test]
    fn test_no_match() {
        assert_eq!(extract_code("普通邮件"), None);
    }

    #[test]
    fn test_short_string() {
        assert_eq!(extract_code("验证码: 123456789"), Some("12345678".into()));
    }
}
