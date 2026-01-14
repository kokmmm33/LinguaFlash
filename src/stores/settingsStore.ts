import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EngineConfig } from '../services/translation';

interface ShortcutConfig {
  translate: string;
  showWindow: string;
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  translate: 'CommandOrControl+Shift+T',
  showWindow: 'CommandOrControl+Shift+Space',
};

interface SettingsState {
  engines: EngineConfig[];
  defaultEngineIndex: number;
  defaultSourceLang: string;
  defaultTargetLang: string;
  theme: 'light' | 'dark' | 'system';
  shortcuts: ShortcutConfig;

  addEngine: (engine: Omit<EngineConfig, 'id'>) => void;
  removeEngine: (index: number) => void;
  updateEngine: (index: number, engine: EngineConfig) => void;
  setDefaultEngine: (index: number) => void;
  setDefaultLanguages: (source: string, target: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  getDefaultEngine: () => EngineConfig | null;
  setShortcut: (key: keyof ShortcutConfig, value: string) => void;
  resetShortcuts: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      engines: [
        {
          id: 'default-ollama',
          engine_type: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'qwen2',
        },
      ],
      defaultEngineIndex: 0,
      defaultSourceLang: 'auto',
      defaultTargetLang: 'zh',
      theme: 'system',
      shortcuts: DEFAULT_SHORTCUTS,

      addEngine: (engine) =>
        set((state) => ({
          engines: [...state.engines, { ...engine, id: crypto.randomUUID() }],
        })),

      removeEngine: (index) =>
        set((state) => {
          if (state.engines.length <= 1) return state;
          return {
            engines: state.engines.filter((_, i) => i !== index),
            defaultEngineIndex:
              state.defaultEngineIndex >= index
                ? Math.max(0, state.defaultEngineIndex - 1)
                : state.defaultEngineIndex,
          };
        }),

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

      setShortcut: (key, value) =>
        set((state) => ({
          shortcuts: { ...state.shortcuts, [key]: value },
        })),

      resetShortcuts: () => set({ shortcuts: DEFAULT_SHORTCUTS }),
    }),
    {
      name: 'ttime-settings',
    }
  )
);
