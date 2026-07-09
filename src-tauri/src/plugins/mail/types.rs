//! IMAP 邮件插件类型定义

use serde::{Deserialize, Serialize};

/// 邮箱账户配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailConfig {
    pub host: String,
    pub port: u16,
    pub secure: bool,       // 是否使用 SSL/TLS
    pub user: String,
    pub pass: String,
}

/// 邮件摘要（列表展示用）
#[derive(Debug, Clone, Serialize)]
pub struct MailSummary {
    pub uid: u32,
    pub sender: String,
    pub subject: String,
    pub date: i64,          // Unix 时间戳（秒）
    pub seen: bool,
    pub account: String,    // 所属邮箱账户标识（user）
}

/// 新邮件检测结果
#[derive(Debug, Clone, Serialize)]
pub struct CheckNewResult {
    pub new_mails: Vec<MailSummary>,
    /// 提取到的验证码（如有）
    pub code: Option<String>,
}

/// IMAP 连接结果
#[derive(Debug, Clone, Serialize)]
pub struct ConnectResult {
    pub success: bool,
    pub errors: Vec<String>,
}

// ─── 验证码正则模式 ───

/// 中文网站常见验证码正则模式列表
///
/// 匹配 4-8 位纯数字或字母数字混合的验证码
/// 末尾 \b 确保不匹配超长数字的子串（如 123456789 不匹配为 "12345678"）
pub static CODE_PATTERNS: &[&str] = &[
    r"(?i)验证码[\s:：为是]+(\d{4,8})\b",
    r"(?i)验证码[\s:：为是]+([A-Za-z0-9]{4,8})\b",
    r"(?i)校验码[\s:：为是]+(\d{4,8})\b",
    r"(?i)校验码[\s:：为是]+([A-Za-z0-9]{4,8})\b",
    r"(?i)动态码[\s:：为是]+(\d{4,8})\b",
    r"(?i)验证代码[\s:：为是]+(\d{4,8})\b",
    r"(?i)(?:code|CODE|Code)[\s:：为是]+([A-Za-z0-9]{4,8})\b",
];

#[cfg(test)]
mod tests {
    use super::*;
    use regex::Regex;

    /// 从文本中提取验证码
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
    fn test_extract_code_chinese() {
        assert_eq!(
            extract_code("您的验证码是 123456，有效期5分钟"),
            Some("123456".to_string())
        );
    }

    #[test]
    fn test_extract_code_chinese_colon() {
        assert_eq!(
            extract_code("验证码：987654"),
            Some("987654".to_string())
        );
    }

    #[test]
    fn test_extract_code_with_letter() {
        assert_eq!(
            extract_code("验证码为: aBcD1234"),
            Some("aBcD1234".to_string())
        );
    }

    #[test]
    fn test_extract_code_english() {
        assert_eq!(
            extract_code("Your code: 12345678"),
            Some("12345678".to_string())
        );
    }

    #[test]
    fn test_extract_code_xiaoyan() {
        assert_eq!(
            extract_code("校验码：556677"),
            Some("556677".to_string())
        );
    }

    #[test]
    fn test_extract_code_no_match() {
        assert_eq!(extract_code("这是一封普通邮件，没有验证码"), None);
    }

    #[test]
    fn test_extract_code_empty() {
        assert_eq!(extract_code(""), None);
    }

    #[test]
    fn test_extract_code_dongtai() {
        assert_eq!(
            extract_code("动态码：33445566"),
            Some("33445566".to_string())
        );
    }

    #[test]
    fn test_extract_code_short_number() {
        // 3 位数字不匹配（少于 4 位）
        assert_eq!(extract_code("验证码是 123"), None);
    }

    #[test]
    fn test_extract_code_long_number() {
        // 9 位数字不匹配（超过 8 位）
        assert_eq!(extract_code("验证码是 123456789"), None);
    }
}
