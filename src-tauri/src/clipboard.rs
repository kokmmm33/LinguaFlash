use enigo::{Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// 获取当前选中的文本（同步版本）
/// 通过模拟复制快捷键，从剪贴板读取选中内容
pub fn get_selected_text(app: &tauri::AppHandle) -> Result<String, String> {
    eprintln!("[DEBUG clipboard] get_selected_text 开始执行");

    // 保存当前剪贴板内容
    let original = app.clipboard().read_text().ok();
    eprintln!("[DEBUG clipboard] 原剪贴板内容: {:?}", original);

    // 清空剪贴板，用于检测复制是否成功
    let _ = app.clipboard().write_text(String::new());

    // 创建 enigo 实例用于模拟键盘操作
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;

    // 先释放所有可能被按下的修饰键（用户可能还在按着快捷键）
    #[cfg(target_os = "macos")]
    {
        let _ = enigo.key(Key::Meta, enigo::Direction::Release);
        let _ = enigo.key(Key::Shift, enigo::Direction::Release);
        let _ = enigo.key(Key::Control, enigo::Direction::Release);
        let _ = enigo.key(Key::Alt, enigo::Direction::Release);
    }
    #[cfg(target_os = "windows")]
    {
        let _ = enigo.key(Key::Control, enigo::Direction::Release);
        let _ = enigo.key(Key::Shift, enigo::Direction::Release);
        let _ = enigo.key(Key::Alt, enigo::Direction::Release);
    }

    // 等待一小段时间确保修饰键已释放
    thread::sleep(Duration::from_millis(50));

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

    // 等待剪贴板更新（轮询检查非空内容）
    let mut selected = String::new();
    for _ in 0..15 {
        thread::sleep(Duration::from_millis(30));
        if let Ok(text) = app.clipboard().read_text() {
            // 剪贴板已被清空，只要有内容就说明复制成功
            if !text.is_empty() {
                selected = text;
                break;
            }
        }
    }

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
