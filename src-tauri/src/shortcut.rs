use crate::clipboard::get_selected_text;
use crate::popup;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

// 存储当前注册的快捷键
static CURRENT_SHORTCUTS: Mutex<Option<(Shortcut, Shortcut)>> = Mutex::new(None);

/// 解析快捷键字符串为 Shortcut 对象
fn parse_shortcut(shortcut_str: &str) -> Result<Shortcut, String> {
    let parts: Vec<&str> = shortcut_str.split('+').collect();
    if parts.is_empty() {
        return Err("快捷键格式无效".to_string());
    }

    let mut modifiers = Modifiers::empty();
    let mut key_code: Option<Code> = None;

    for part in parts {
        match part {
            "CommandOrControl" => {
                #[cfg(target_os = "macos")]
                {
                    modifiers |= Modifiers::META;
                }
                #[cfg(target_os = "windows")]
                {
                    modifiers |= Modifiers::CONTROL;
                }
            }
            "Shift" => modifiers |= Modifiers::SHIFT,
            "Alt" => modifiers |= Modifiers::ALT,
            "Control" => modifiers |= Modifiers::CONTROL,
            "Meta" => modifiers |= Modifiers::META,
            key => {
                key_code = Some(match key {
                    // 字母键
                    "A" => Code::KeyA,
                    "B" => Code::KeyB,
                    "C" => Code::KeyC,
                    "D" => Code::KeyD,
                    "E" => Code::KeyE,
                    "F" => Code::KeyF,
                    "G" => Code::KeyG,
                    "H" => Code::KeyH,
                    "I" => Code::KeyI,
                    "J" => Code::KeyJ,
                    "K" => Code::KeyK,
                    "L" => Code::KeyL,
                    "M" => Code::KeyM,
                    "N" => Code::KeyN,
                    "O" => Code::KeyO,
                    "P" => Code::KeyP,
                    "Q" => Code::KeyQ,
                    "R" => Code::KeyR,
                    "S" => Code::KeyS,
                    "T" => Code::KeyT,
                    "U" => Code::KeyU,
                    "V" => Code::KeyV,
                    "W" => Code::KeyW,
                    "X" => Code::KeyX,
                    "Y" => Code::KeyY,
                    "Z" => Code::KeyZ,
                    // 数字键
                    "0" => Code::Digit0,
                    "1" => Code::Digit1,
                    "2" => Code::Digit2,
                    "3" => Code::Digit3,
                    "4" => Code::Digit4,
                    "5" => Code::Digit5,
                    "6" => Code::Digit6,
                    "7" => Code::Digit7,
                    "8" => Code::Digit8,
                    "9" => Code::Digit9,
                    // 功能键
                    "F1" => Code::F1,
                    "F2" => Code::F2,
                    "F3" => Code::F3,
                    "F4" => Code::F4,
                    "F5" => Code::F5,
                    "F6" => Code::F6,
                    "F7" => Code::F7,
                    "F8" => Code::F8,
                    "F9" => Code::F9,
                    "F10" => Code::F10,
                    "F11" => Code::F11,
                    "F12" => Code::F12,
                    // 特殊键
                    "Space" => Code::Space,
                    "Enter" => Code::Enter,
                    "Tab" => Code::Tab,
                    "Backspace" => Code::Backspace,
                    "Delete" => Code::Delete,
                    "Escape" => Code::Escape,
                    "Up" => Code::ArrowUp,
                    "Down" => Code::ArrowDown,
                    "Left" => Code::ArrowLeft,
                    "Right" => Code::ArrowRight,
                    _ => return Err(format!("未知的按键: {}", key)),
                });
            }
        }
    }

    let code = key_code.ok_or("快捷键必须包含主键")?;
    let mods = if modifiers.is_empty() {
        None
    } else {
        Some(modifiers)
    };

    Ok(Shortcut::new(mods, code))
}

/// 注销当前所有快捷键
fn unregister_all(app: &AppHandle) {
    let mut current = CURRENT_SHORTCUTS.lock().unwrap();
    if let Some((translate, show)) = current.take() {
        let _ = app.global_shortcut().unregister(translate);
        let _ = app.global_shortcut().unregister(show);
    }
}

/// 注册快捷键
pub fn register_shortcuts(
    app: &AppHandle,
    translate_shortcut_str: &str,
    show_shortcut_str: &str,
) -> Result<(), String> {
    // 先注销旧的快捷键
    unregister_all(app);

    // 解析新的快捷键
    let translate_shortcut = parse_shortcut(translate_shortcut_str)?;
    let show_shortcut = parse_shortcut(show_shortcut_str)?;

    // 注册划词翻译快捷键
    let app_for_translate = app.clone();
    app.global_shortcut()
        .on_shortcut(translate_shortcut.clone(), move |_app, _shortcut, _event| {
            let app = app_for_translate.clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(text) = get_selected_text(&app).await {
                    let _ = popup::show_popup(&app, text).await;
                }
            });
        })
        .map_err(|e| format!("注册划词翻译快捷键失败: {}", e))?;

    // 注册显示主窗口快捷键
    let app_for_show = app.clone();
    app.global_shortcut()
        .on_shortcut(show_shortcut.clone(), move |_app, _shortcut, _event| {
            if let Some(window) = app_for_show.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        })
        .map_err(|e| format!("注册显示窗口快捷键失败: {}", e))?;

    // 保存当前注册的快捷键
    let mut current = CURRENT_SHORTCUTS.lock().unwrap();
    *current = Some((translate_shortcut, show_shortcut));

    Ok(())
}
