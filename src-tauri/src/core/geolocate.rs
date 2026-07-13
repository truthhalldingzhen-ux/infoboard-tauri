use std::time::Duration;
use serde_json::Value;

#[tauri::command]
pub async fn geolocate_ip() -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .user_agent("InfoBoard/1.0")
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {e}"))?;

    let resp = client
        .get("https://ipapi.co/json/")
        .send()
        .await
        .map_err(|e| format!("IP 定位请求失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("IP 定位 HTTP {}", resp.status().as_u16()));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| format!("解析 IP 定位结果失败: {e}"))
}
