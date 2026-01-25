use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};
use crate::translation::{TranslationRequest, EngineConfig};
use crate::AppState;
use super::{SheetData, TranslationProgress};

// 全局取消标志
lazy_static::lazy_static! {
    static ref CANCEL_FLAG: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
}

pub fn request_cancel() {
    CANCEL_FLAG.store(true, Ordering::SeqCst);
}

pub fn reset_cancel() {
    CANCEL_FLAG.store(false, Ordering::SeqCst);
}

pub fn is_cancelled() -> bool {
    CANCEL_FLAG.load(Ordering::SeqCst)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Term {
    pub term: String,
    pub translation: Option<String>,
}

pub async fn translate_sheets(
    app: &AppHandle,
    state: &AppState,
    sheets: &mut Vec<SheetData>,
    config: &EngineConfig,
    source_lang: &str,
    target_lang: &str,
    terms: &[Term],
    cache: &std::collections::HashMap<String, String>,
) -> Result<(usize, usize), String> {
    reset_cancel();

    let total_cells: usize = sheets.iter().map(|s| s.cells.len()).sum();
    let total_sheets = sheets.len();
    let mut translated_count = 0;
    let mut cache_hits = 0;
    let mut current_cell = 0;

    for (sheet_idx, sheet) in sheets.iter_mut().enumerate() {
        let sheet_name = sheet.name.clone();

        for cell in sheet.cells.iter_mut() {
            if is_cancelled() {
                return Ok((translated_count, cache_hits));
            }

            current_cell += 1;

            // 1. 检查术语表
            if let Some(replacement) = match_term(&cell.value, terms) {
                cell.translated = Some(replacement);
                translated_count += 1;
                emit_progress(app, sheet_idx, total_sheets, &sheet_name, current_cell, total_cells, cache_hits);
                continue;
            }

            // 2. 检查缓存
            if let Some(cached) = cache.get(&cell.value) {
                cell.translated = Some(cached.clone());
                translated_count += 1;
                cache_hits += 1;
                emit_progress(app, sheet_idx, total_sheets, &sheet_name, current_cell, total_cells, cache_hits);
                continue;
            }

            // 3. 调用翻译 API
            let translated = translate_cell(state, config, &cell.value, source_lang, target_lang, terms).await?;
            cell.translated = Some(translated);
            translated_count += 1;

            emit_progress(app, sheet_idx, total_sheets, &sheet_name, current_cell, total_cells, cache_hits);
        }
    }

    Ok((translated_count, cache_hits))
}

fn match_term(text: &str, terms: &[Term]) -> Option<String> {
    for term in terms {
        if text == term.term {
            return Some(term.translation.clone().unwrap_or_else(|| term.term.clone()));
        }
    }
    None
}

async fn translate_cell(
    state: &AppState,
    config: &EngineConfig,
    text: &str,
    source_lang: &str,
    target_lang: &str,
    terms: &[Term],
) -> Result<String, String> {
    let prompt = build_excel_prompt(text, source_lang, target_lang, terms);

    let request = TranslationRequest {
        text: prompt,
        source_lang: source_lang.to_string(),
        target_lang: target_lang.to_string(),
    };

    let response = match config.engine_type.as_str() {
        "ollama" => {
            let endpoint = config.endpoint.clone().unwrap_or_else(|| "http://localhost:11434".to_string());
            let model = config.model.clone().unwrap_or_else(|| "qwen2".to_string());
            crate::translation::ollama::translate(&state.client, &endpoint, &model, &request).await?
        }
        "glm" => {
            let api_key = config.api_key.clone().ok_or("API Key 未配置")?;
            let model = config.model.clone().unwrap_or_else(|| "glm-4-flash".to_string());
            crate::translation::glm::translate(&state.client, &api_key, &model, &request).await?
        }
        _ => return Err("不支持的翻译引擎".to_string()),
    };

    Ok(response.translated_text)
}

fn build_excel_prompt(text: &str, source_lang: &str, target_lang: &str, terms: &[Term]) -> String {
    let source = if source_lang == "auto" { "检测到的语言" } else { source_lang };

    let terms_instruction = if terms.is_empty() {
        String::new()
    } else {
        let term_list: Vec<String> = terms
            .iter()
            .map(|t| match &t.translation {
                Some(tr) => format!("- \"{}\" → \"{}\"", t.term, tr),
                None => format!("- \"{}\"（保持原样）", t.term),
            })
            .collect();
        format!("\n\n术语表（请严格遵守）：\n{}", term_list.join("\n"))
    };

    format!(
        r#"将以下{}文本翻译成{}。

要求：
1. 只输出译文，不要解释
2. 保留特殊符号、表情符号、数字、公式不翻译
3. 保留专有名词、品牌名、技术术语的原文
4. 如果无法确定是否应该翻译，保持原样{}

原文：
{}"#,
        source, target_lang, terms_instruction, text
    )
}

fn emit_progress(
    app: &AppHandle,
    current_sheet: usize,
    total_sheets: usize,
    sheet_name: &str,
    current_cell: usize,
    total_cells: usize,
    cache_hits: usize,
) {
    let _ = app.emit("excel-translation-progress", TranslationProgress {
        current_sheet: current_sheet + 1,
        total_sheets,
        sheet_name: sheet_name.to_string(),
        current_cell,
        total_cells,
        cache_hits,
    });
}
