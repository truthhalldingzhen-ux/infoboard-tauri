use tauri::WebviewWindow;

#[tauri::command]
pub fn window_minimize(window: WebviewWindow) -> Result<(), String> {
    println!("[窗口] 最小化");
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn window_maximize(window: WebviewWindow) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        println!("[窗口] 恢复");
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        println!("[窗口] 最大化");
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn window_close(window: WebviewWindow) -> Result<(), String> {
    println!("[窗口] 隐藏到托盘");
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn window_is_maximized(window: WebviewWindow) -> Result<bool, String> {
    let maximized = window.is_maximized().map_err(|e| e.to_string())?;
    println!("[窗口] 查询最大化状态: {}", maximized);
    Ok(maximized)
}

#[tauri::command]
pub fn window_is_visible(window: WebviewWindow) -> Result<bool, String> {
    let visible = window.is_visible().map_err(|e| e.to_string())?;
    println!("[窗口] 查询可见状态: {}", visible);
    Ok(visible)
}
