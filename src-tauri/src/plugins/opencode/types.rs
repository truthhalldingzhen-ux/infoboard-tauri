use serde::{Deserialize, Serialize};

/// OpenCode Go 仪表盘解析出的用量数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageStats {
    pub db_exists: bool,
    pub today_tokens: f64,
    pub weekly_tokens: f64,
    pub monthly_tokens: f64,
    pub rolling_reset_in_sec: Option<i64>,
    pub weekly_reset_in_sec: Option<i64>,
    pub monthly_reset_in_sec: Option<i64>,
    pub error: Option<String>,
    pub timestamp: i64,
}

/// 会话信息（opencode.ai 不提供此接口，留空）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub model_id: String,
    pub tokens: f64,
    pub time_created: i64,
}

/// MiniMax Token 计划用量
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiniMaxUsage {
    pub rolling_used: f64,
    pub rolling_reset_ms: i64,
    pub weekly_used: f64,
    pub weekly_reset_ms: i64,
    pub rolling_reset_label: String,
    pub weekly_reset_label: String,
}

/// Cookie 刷新结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshResult {
    pub started: bool,
    pub message: Option<String>,
}

/// MiniMax API 响应中的模型用量
#[derive(Debug, Deserialize)]
pub struct MiniMaxModelRemain {
    pub model_name: String,
    pub current_interval_remaining_percent: f64,
    pub remains_time: i64,
    pub current_weekly_remaining_percent: f64,
    pub weekly_remains_time: i64,
}

/// MiniMax API 顶级响应
#[derive(Debug, Deserialize)]
pub struct MiniMaxResponse {
    pub base_resp: Option<MiniMaxBaseResp>,
    pub model_remains: Option<Vec<MiniMaxModelRemain>>,
}

#[derive(Debug, Deserialize)]
pub struct MiniMaxBaseResp {
    pub status_code: i64,
    pub status_msg: Option<String>,
}

/// 从 HTML 中解析出的用量片段
#[derive(Debug)]
pub struct ParsedUsage {
    pub usage_percent: f64,
    pub reset_in_sec: i64,
}


