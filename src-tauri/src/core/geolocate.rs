use std::time::Duration;
use serde_json::{json, Value};

#[tauri::command]
pub async fn geolocate_ip() -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .user_agent("InfoBoard/1.0")
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {e}"))?;

    let resp = client
        .get("https://ip-api.com/json/?fields=status,message,country,regionName,city,lat,lon")
        .send()
        .await
        .map_err(|e| format!("IP 定位请求失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("IP 定位 HTTP {}", resp.status().as_u16()));
    }

    let raw: Value = resp.json::<Value>()
        .await
        .map_err(|e| format!("解析失败: {e}"))?;

    if raw.get("status").and_then(|s| s.as_str()) != Some("success") {
        let msg = raw.get("message").and_then(|m| m.as_str()).unwrap_or("未知错误");
        return Err(format!("IP 定位失败: {msg}"));
    }

    // 统一字段名（ip-api.com → 前端期望的格式）
    Ok(json!({
        "latitude": raw["lat"],
        "longitude": raw["lon"],
        "city": raw["city"],
        "region": raw["regionName"],
        "country_name": raw["country"],
    }))
}
