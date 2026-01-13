import { invoke } from '@tauri-apps/api/core';

export interface TranslationRequest {
  text: string;
  source_lang: string;
  target_lang: string;
}

export interface TranslationResponse {
  translated_text: string;
  detected_lang: string | null;
}

export interface EngineConfig {
  id: string;
  engine_type: 'ollama' | 'glm';
  endpoint?: string;
  model?: string;
  api_key?: string;
}

export async function translate(
  config: EngineConfig,
  request: TranslationRequest
): Promise<TranslationResponse> {
  return invoke<TranslationResponse>('translate', { config, request });
}

export async function testEngineConnection(config: EngineConfig): Promise<boolean> {
  return invoke<boolean>('test_engine_connection', { config });
}
