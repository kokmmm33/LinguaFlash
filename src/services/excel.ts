import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface ExcelInfo {
  file_path: string;
  file_name: string;
  sheet_names: string[];
  total_cells: number;
}

export interface TranslationProgress {
  current_sheet: number;
  total_sheets: number;
  sheet_name: string;
  current_cell: number;
  total_cells: number;
  cache_hits: number;
}

export interface ExcelTranslationResult {
  output_path: string;
  translated_cells: number;
  cache_hits: number;
  cancelled: boolean;
}

export interface Term {
  term: string;
  translation: string | null;
}

export interface EngineConfig {
  engine_type: string;
  endpoint?: string;
  model?: string;
  api_key?: string;
}

export async function getExcelInfo(filePath: string): Promise<ExcelInfo> {
  return await invoke<ExcelInfo>('get_excel_info', { filePath });
}

export async function startExcelTranslation(
  filePath: string,
  sourceLang: string,
  targetLang: string,
  config: EngineConfig,
  terms: Term[],
  cache: Record<string, string>
): Promise<ExcelTranslationResult> {
  return await invoke<ExcelTranslationResult>('start_excel_translation', {
    filePath,
    sourceLang,
    targetLang,
    config,
    terms,
    cache,
  });
}

export async function cancelExcelTranslation(): Promise<void> {
  await invoke('cancel_excel_translation');
}

export function onTranslationProgress(
  callback: (progress: TranslationProgress) => void
): Promise<UnlistenFn> {
  return listen<TranslationProgress>('excel-translation-progress', (event) => {
    callback(event.payload);
  });
}
