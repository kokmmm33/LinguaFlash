use super::{TranslationRequest, TranslationResponse, build_translation_prompt};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct GlmRequest {
    model: String,
    messages: Vec<GlmMessage>,
}

#[derive(Debug, Serialize)]
struct GlmMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct GlmResponse {
    choices: Vec<GlmChoice>,
}

#[derive(Debug, Deserialize)]
struct GlmChoice {
    message: GlmMessageResponse,
}

#[derive(Debug, Deserialize)]
struct GlmMessageResponse {
    content: String,
}

pub async fn translate(
    client: &Client,
    api_key: &str,
    model: &str,
    request: &TranslationRequest,
) -> Result<TranslationResponse, String> {
    let prompt = build_translation_prompt(&request.text, &request.source_lang, &request.target_lang);

    let glm_request = GlmRequest {
        model: model.to_string(),
        messages: vec![GlmMessage {
            role: "user".to_string(),
            content: prompt,
        }],
    };

    let response = client
        .post("https://open.bigmodel.cn/api/paas/v4/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&glm_request)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GLM 返回错误: {} - {}", status, body));
    }

    let glm_response: GlmResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let translated_text = glm_response
        .choices
        .first()
        .map(|c| c.message.content.trim().to_string())
        .unwrap_or_default();

    Ok(TranslationResponse {
        translated_text,
        detected_lang: None,
    })
}

pub async fn test_connection(client: &Client, api_key: &str) -> Result<bool, String> {
    let glm_request = GlmRequest {
        model: "glm-4-flash".to_string(),
        messages: vec![GlmMessage {
            role: "user".to_string(),
            content: "Hi".to_string(),
        }],
    };

    let response = client
        .post("https://open.bigmodel.cn/api/paas/v4/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&glm_request)
        .send()
        .await
        .map_err(|e| format!("连接失败: {}", e))?;

    Ok(response.status().is_success())
}
