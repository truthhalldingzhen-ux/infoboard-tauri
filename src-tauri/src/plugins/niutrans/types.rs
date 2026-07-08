use serde::Serialize;

/// 小牛翻译 API 返回结果
#[derive(Debug, Clone, Serialize)]
pub struct TranslateResult {
    /// 翻译后的文本
    pub text: String,
    /// 源语言代码
    pub from: String,
    /// 目标语言代码
    pub to: String,
}

/// 小牛翻译配置（返回给前端）
#[derive(Debug, Clone, Serialize)]
pub struct TranslateConfig {
    /// 是否已配置 API key 和 App ID
    pub has_key: bool,
    /// App ID（前 4 位 + *** ，用于前端展示）
    pub app_id: String,
    /// API Key 掩码（前 4 位 + ***）
    pub api_key_mask: String,
}
