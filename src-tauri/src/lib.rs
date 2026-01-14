mod clipboard;
mod popup;
mod shortcut;
mod translation;
mod tray;

use reqwest::Client;
use tauri::{AppHandle, State};
use std::sync::Arc;
use translation::{TranslationRequest, TranslationResponse, EngineConfig};
use shortcut::{register_shortcuts, disable_shortcuts, enable_shortcuts};

pub struct AppState {
    pub client: Arc<Client>,
}

#[tauri::command]
async fn translate(
    state: State<'_, AppState>,
    config: EngineConfig,
    request: TranslationRequest,
) -> Result<TranslationResponse, String> {
    match config.engine_type.as_str() {
        "ollama" => {
            let endpoint = config.endpoint.unwrap_or_else(|| "http://localhost:11434".to_string());
            let model = config.model.unwrap_or_else(|| "qwen2".to_string());
            translation::ollama::translate(&state.client, &endpoint, &model, &request).await
        }
        "glm" => {
            let api_key = config.api_key.ok_or("API Key 未配置")?;
            let model = config.model.unwrap_or_else(|| "glm-4-flash".to_string());
            translation::glm::translate(&state.client, &api_key, &model, &request).await
        }
        _ => Err("不支持的翻译引擎".to_string()),
    }
}

#[tauri::command]
async fn test_engine_connection(
    state: State<'_, AppState>,
    config: EngineConfig,
) -> Result<bool, String> {
    match config.engine_type.as_str() {
        "ollama" => {
            let endpoint = config.endpoint.unwrap_or_else(|| "http://localhost:11434".to_string());
            translation::ollama::test_connection(&state.client, &endpoint).await
        }
        "glm" => {
            let api_key = config.api_key.ok_or("API Key 未配置")?;
            translation::glm::test_connection(&state.client, &api_key).await
        }
        _ => Err("不支持的翻译引擎".to_string()),
    }
}

#[tauri::command]
async fn close_popup(app: tauri::AppHandle) -> Result<(), String> {
    popup::close_popup(&app)
}

#[tauri::command]
fn update_shortcuts(
    app: AppHandle,
    translate: String,
    show_window: String,
) -> Result<(), String> {
    register_shortcuts(&app, &translate, &show_window)
}

#[tauri::command]
fn pause_shortcuts(app: AppHandle) {
    disable_shortcuts(&app);
}

#[tauri::command]
fn resume_shortcuts(
    app: AppHandle,
    translate: String,
    show_window: String,
) -> Result<(), String> {
    enable_shortcuts(&app, &translate, &show_window)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = Arc::new(Client::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState { client })
        .setup(|app| {
            // 创建系统托盘
            tray::create_tray(app.handle())?;
            // 使用默认快捷键初始化
            if let Err(e) = register_shortcuts(
                app.handle(),
                "CommandOrControl+Shift+T",
                "CommandOrControl+Shift+Space",
            ) {
                eprintln!("注册快捷键失败: {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![translate, test_engine_connection, close_popup, update_shortcuts, pause_shortcuts, resume_shortcuts])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
