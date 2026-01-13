import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EngineConfig } from '../services/translation';

interface SettingsState {
  engines: EngineConfig[];
  defaultEngineIndex: number;
  defaultSourceLang: string;
  defaultTargetLang: string;
  theme: 'light' | 'dark' | 'system';

  addEngine: (engine: EngineConfig) => void;
  removeEngine: (index: number) => void;
  updateEngine: (index: number, engine: EngineConfig) => void;
  setDefaultEngine: (index: number) => void;
  setDefaultLanguages: (source: string, target: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  getDefaultEngine: () => EngineConfig | null;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      engines: [
        {
          engine_type: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'qwen2',
        },
      ],
      defaultEngineIndex: 0,
      defaultSourceLang: 'auto',
      defaultTargetLang: 'zh',
      theme: 'system',

      addEngine: (engine) =>
        set((state) => ({ engines: [...state.engines, engine] })),

      removeEngine: (index) =>
        set((state) => ({
          engines: state.engines.filter((_, i) => i !== index),
          defaultEngineIndex:
            state.defaultEngineIndex >= index
              ? Math.max(0, state.defaultEngineIndex - 1)
              : state.defaultEngineIndex,
        })),

      updateEngine: (index, engine) =>
        set((state) => ({
          engines: state.engines.map((e, i) => (i === index ? engine : e)),
        })),

      setDefaultEngine: (index) => set({ defaultEngineIndex: index }),

      setDefaultLanguages: (source, target) =>
        set({ defaultSourceLang: source, defaultTargetLang: target }),

      setTheme: (theme) => set({ theme }),

      getDefaultEngine: () => {
        const state = get();
        return state.engines[state.defaultEngineIndex] || null;
      },
    }),
    {
      name: 'ttime-settings',
    }
  )
);
