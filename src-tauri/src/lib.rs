mod clipboard;
mod popup;
mod shortcut;
mod translation;
mod tray;

use reqwest::Client;
use tauri::State;
use std::sync::Arc;
use translation::{TranslationRequest, TranslationResponse, EngineConfig};

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
            // 注册全局快捷键
            shortcut::register_shortcuts(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![translate, test_engine_connection, close_popup])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
