import { create } from 'zustand';

interface TranslateState {
  sourceText: string;
  targetText: string;
  isLoading: boolean;
  error: string | null;
  setSourceText: (text: string) => void;
  setTargetText: (text: string) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useTranslateStore = create<TranslateState>((set) => ({
  sourceText: '',
  targetText: '',
  isLoading: false,
  error: null,
  setSourceText: (text) => set({ sourceText: text }),
  setTargetText: (text) => set({ targetText: text }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set({ sourceText: '', targetText: '', error: null }),
}));
