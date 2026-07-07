use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
#[allow(dead_code)]
pub struct ToastPayload {
    pub message: String,
    pub level: String,
}

#[allow(dead_code)]
pub fn show(app: &AppHandle, message: &str) {
    show_with_level(app, message, "info");
}

#[allow(dead_code)]
pub fn show_with_level(app: &AppHandle, message: &str, level: &str) {
    let _ = app.emit(
        "toast_show",
        ToastPayload {
            message: message.to_string(),
            level: level.to_string(),
        },
    );
}
