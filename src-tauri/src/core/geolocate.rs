use std::time::Duration;
use serde_json::{json, Value};

#[tauri::command]
pub async fn geolocate_ip() -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .user_agent("InfoBoard/1.0")
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {e}"))?;

    // 使用国内可直接访问的 IP 定位服务
    let url = "https://api.ip.sb/geoip";
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("IP 定位请求失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("IP 定位 HTTP {}", resp.status().as_u16()));
    }

    let raw: Value = resp.json::<Value>()
        .await
        .map_err(|e| format!("解析失败: {e}"))?;

    // api.ip.sb 返回 { ip, city, region, country, latitude, longitude, ... }
    Ok(json!({
        "latitude": raw["latitude"],
        "longitude": raw["longitude"],
        "city": raw["city"],
        "region": raw["region"],
        "country_name": raw["country"],
    }))
}
