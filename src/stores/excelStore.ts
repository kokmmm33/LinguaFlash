import { create } from 'zustand';
import {
  ExcelInfo,
  TranslationProgress,
  ExcelTranslationResult,
  getExcelInfo,
  startExcelTranslation,
  cancelExcelTranslation,
  onTranslationProgress,
  EngineConfig,
  Term,
} from '../services/excel';
import { getTerms } from '../services/terms';
import { UnlistenFn } from '@tauri-apps/api/event';

type ExcelStatus = 'idle' | 'loading' | 'ready' | 'translating' | 'completed' | 'cancelled' | 'error';

interface ExcelState {
  status: ExcelStatus;
  excelInfo: ExcelInfo | null;
  progress: TranslationProgress | null;
  result: ExcelTranslationResult | null;
  error: string | null;

  loadFile: (filePath: string) => Promise<void>;
  startTranslation: (
    sourceLang: string,
    targetLang: string,
    engineConfig: EngineConfig
  ) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
}

export const useExcelStore = create<ExcelState>((set, get) => {
  let progressUnlisten: UnlistenFn | null = null;

  return {
    status: 'idle',
    excelInfo: null,
    progress: null,
    result: null,
    error: null,

    loadFile: async (filePath: string) => {
      set({ status: 'loading', error: null, excelInfo: null, progress: null, result: null });
      try {
        const info = await getExcelInfo(filePath);
        set({ status: 'ready', excelInfo: info });
      } catch (e) {
        set({ status: 'error', error: String(e) });
      }
    },

    startTranslation: async (sourceLang, targetLang, engineConfig) => {
      const { excelInfo } = get();
      if (!excelInfo) {
        set({ status: 'error', error: '请先选择 Excel 文件' });
        return;
      }

      set({ status: 'translating', progress: null, result: null, error: null });

      // 设置进度监听
      progressUnlisten = await onTranslationProgress((progress) => {
        set({ progress });
      });

      try {
        // 获取术语表
        const termsData = await getTerms();
        const terms: Term[] = termsData.map((t) => ({
          term: t.term,
          translation: t.translation,
        }));

        // 获取缓存（需要读取所有文本，但这里简化处理，传空缓存）
        // 实际缓存查询在 Rust 端用前端传入的缓存 map 处理
        const cache: Record<string, string> = {};

        const result = await startExcelTranslation(
          excelInfo.file_path,
          sourceLang,
          targetLang,
          engineConfig,
          terms,
          cache
        );

        if (result.cancelled) {
          set({ status: 'cancelled', result });
        } else {
          set({ status: 'completed', result });
        }
      } catch (e) {
        set({ status: 'error', error: String(e) });
      } finally {
        if (progressUnlisten) {
          progressUnlisten();
          progressUnlisten = null;
        }
      }
    },

    cancel: async () => {
      await cancelExcelTranslation();
    },

    reset: () => {
      if (progressUnlisten) {
        progressUnlisten();
        progressUnlisten = null;
      }
      set({
        status: 'idle',
        excelInfo: null,
        progress: null,
        result: null,
        error: null,
      });
    },
  };
});
