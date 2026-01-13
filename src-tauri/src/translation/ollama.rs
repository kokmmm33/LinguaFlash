use super::{TranslationRequest, TranslationResponse, build_translation_prompt};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct OllamaResponse {
    response: String,
}

pub async fn translate(
    client: &Client,
    endpoint: &str,
    model: &str,
    request: &TranslationRequest,
) -> Result<TranslationResponse, String> {
    let prompt = build_translation_prompt(&request.text, &request.source_lang, &request.target_lang);

    let ollama_request = OllamaRequest {
        model: model.to_string(),
        prompt,
        stream: false,
    };

    let url = format!("{}/api/generate", endpoint.trim_end_matches('/'));

    let response = client
        .post(&url)
        .json(&ollama_request)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Ollama 返回错误: {}", response.status()));
    }

    let ollama_response: OllamaResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(TranslationResponse {
        translated_text: ollama_response.response.trim().to_string(),
        detected_lang: None,
    })
}

pub async fn test_connection(client: &Client, endpoint: &str) -> Result<bool, String> {
    let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("连接失败: {}", e))?;

    Ok(response.status().is_success())
}
