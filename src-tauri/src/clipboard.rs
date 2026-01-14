use enigo::{Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// 获取当前选中的文本（同步版本）
/// 通过模拟复制快捷键，从剪贴板读取选中内容
pub fn get_selected_text(app: &tauri::AppHandle) -> Result<String, String> {
    // 保存当前剪贴板内容
    let original = app.clipboard().read_text().ok();

    // 创建 enigo 实例用于模拟键盘操作
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;

    // 根据平台模拟复制快捷键
    #[cfg(target_os = "macos")]
    {
        enigo
            .key(Key::Meta, enigo::Direction::Press)
            .map_err(|e| e.to_string())?;
        enigo
            .key(Key::Unicode('c'), enigo::Direction::Press)
            .map_err(|e| e.to_string())?;
        enigo
            .key(Key::Unicode('c'), enigo::Direction::Release)
            .map_err(|e| e.to_string())?;
        enigo
            .key(Key::Meta, enigo::Direction::Release)
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        enigo
            .key(Key::Control, enigo::Direction::Press)
            .map_err(|e| e.to_string())?;
        enigo
            .key(Key::Unicode('c'), enigo::Direction::Press)
            .map_err(|e| e.to_string())?;
        enigo
            .key(Key::Unicode('c'), enigo::Direction::Release)
            .map_err(|e| e.to_string())?;
        enigo
            .key(Key::Control, enigo::Direction::Release)
            .map_err(|e| e.to_string())?;
    }

    // 等待剪贴板更新
    thread::sleep(Duration::from_millis(100));

    // 读取选中的文本
    let selected = app
        .clipboard()
        .read_text()
        .map_err(|e| format!("读取剪贴板失败: {}", e))?;

    // 恢复原剪贴板内容
    if let Some(orig) = original {
        let _ = app.clipboard().write_text(orig);
    }

    // 检查是否有选中文本
    if selected.trim().is_empty() {
        return Err("未选中任何文本".to_string());
    }

    Ok(selected)
}
