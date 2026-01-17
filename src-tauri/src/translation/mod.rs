pub mod cache;
pub mod ollama;
pub mod glm;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationRequest {
    pub text: String,
    pub source_lang: String,
    pub target_lang: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationResponse {
    pub translated_text: String,
    pub detected_lang: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub engine_type: String,
    pub endpoint: Option<String>,
    pub model: Option<String>,
    pub api_key: Option<String>,
}

pub fn build_translation_prompt(text: &str, source_lang: &str, target_lang: &str) -> String {
    let source = if source_lang == "auto" {
        "检测到的语言".to_string()
    } else {
        get_language_name(source_lang)
    };
    let target = get_language_name(target_lang);

    format!(
        "将以下{}文本翻译成{}，只输出译文，不要解释：\n{}",
        source, target, text
    )
}

fn get_language_name(code: &str) -> String {
    match code {
        "zh" => "中文",
        "en" => "英语",
        "ja" => "日语",
        "ko" => "韩语",
        "fr" => "法语",
        "de" => "德语",
        _ => "未知语言",
    }.to_string()
}
