use serde::{Deserialize, Serialize};

/// SMTC 媒体会话信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSession {
    /// 视频/音乐标题
    pub title: String,
    /// UP主 / 艺术家
    pub artist: String,
    /// 缩略图 data URI（data:image/jpeg;base64,xxx）
    pub thumbnail: String,
    /// 播放状态："playing" | "paused" | "stopped" | "closed"
    pub playback_status: String,
    /// 来源应用 ID（如 "bilibili.exe"）
    pub source_app_id: String,
}

/// 缩略图缓存（避免每秒都读 SMTC 图片流）
#[derive(Debug, Clone)]
pub struct ThumbnailCache {
    /// 缓存的标题（用于判断是否匹配当前会话）
    pub title: String,
    /// 缩略图 base64 数据（不含 "data:image/..." 前缀）
    pub data: String,
    /// MIME 类型前缀（如 "data:image/jpeg;base64,"）
    pub mime_prefix: String,
}
