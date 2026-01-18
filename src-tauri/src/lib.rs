mod clipboard;
mod excel;
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

#[tauri::command]
async fn get_excel_info(file_path: String) -> Result<excel::ExcelInfo, String> {
    excel::reader::get_excel_info(&file_path)
}

#[tauri::command]
async fn start_excel_translation(
    app: AppHandle,
    state: State<'_, AppState>,
    file_path: String,
    source_lang: String,
    target_lang: String,
    config: translation::EngineConfig,
    terms: Vec<excel::translator::Term>,
    cache: std::collections::HashMap<String, String>,
) -> Result<excel::ExcelTranslationResult, String> {
    // 读取 Excel
    let mut sheets = excel::reader::read_excel(&file_path)?;

    // 翻译
    let (translated_cells, cache_hits) = excel::translator::translate_sheets(
        &app,
        state.inner(),
        &mut sheets,
        &config,
        &source_lang,
        &target_lang,
        &terms,
        &cache,
    ).await?;

    let cancelled = excel::translator::is_cancelled();

    // 写入新文件
    let output_path = if !cancelled {
        excel::writer::write_excel(&sheets, &file_path)?
    } else {
        String::new()
    };

    Ok(excel::ExcelTranslationResult {
        output_path,
        translated_cells,
        cache_hits,
        cancelled,
    })
}

#[tauri::command]
fn cancel_excel_translation() {
    excel::translator::request_cancel();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = Arc::new(Client::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
        .invoke_handler(tauri::generate_handler![
            translate,
            test_engine_connection,
            close_popup,
            update_shortcuts,
            pause_shortcuts,
            resume_shortcuts,
            get_excel_info,
            start_excel_translation,
            cancel_excel_translation
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 阻止默认关闭行为，改为隐藏窗口
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
