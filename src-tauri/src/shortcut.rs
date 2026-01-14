use crate::clipboard::get_selected_text;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

/// 注册全局快捷键
pub fn register_shortcuts(app: &AppHandle) -> Result<(), String> {
    // 划词翻译快捷键: Cmd/Ctrl + Shift + T
    #[cfg(target_os = "macos")]
    let translate_shortcut = Shortcut::new(Some(Modifiers::META | Modifiers::SHIFT), Code::KeyT);
    #[cfg(target_os = "windows")]
    let translate_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyT);

    let app_for_translate = app.clone();
    app.global_shortcut()
        .on_shortcut(translate_shortcut, move |_app, _shortcut, _event| {
            let app = app_for_translate.clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(text) = get_selected_text(&app).await {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("translate-selection", text);
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });
        })
        .map_err(|e| format!("注册划词翻译快捷键失败: {}", e))?;

    // 显示主窗口快捷键: Cmd/Ctrl + Shift + Space
    #[cfg(target_os = "macos")]
    let show_shortcut = Shortcut::new(Some(Modifiers::META | Modifiers::SHIFT), Code::Space);
    #[cfg(target_os = "windows")]
    let show_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);

    let app_for_show = app.clone();
    app.global_shortcut()
        .on_shortcut(show_shortcut, move |_app, _shortcut, _event| {
            if let Some(window) = app_for_show.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        })
        .map_err(|e| format!("注册显示窗口快捷键失败: {}", e))?;

    Ok(())
}
