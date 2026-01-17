import { create } from 'zustand';
import { Term, getTerms, addTerm, updateTerm, deleteTerm } from '../services/terms';

interface TermsState {
  terms: Term[];
  isLoading: boolean;
  error: string | null;

  loadTerms: () => Promise<void>;
  addTerm: (term: string, translation: string | null) => Promise<void>;
  updateTerm: (id: number, term: string, translation: string | null) => Promise<void>;
  deleteTerm: (id: number) => Promise<void>;
}

export const useTermsStore = create<TermsState>((set, get) => ({
  terms: [],
  isLoading: false,
  error: null,

  loadTerms: async () => {
    set({ isLoading: true, error: null });
    try {
      const terms = await getTerms();
      set({ terms, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  addTerm: async (term: string, translation: string | null) => {
    try {
      const newTerm = await addTerm(term, translation);
      set({ terms: [...get().terms, newTerm].sort((a, b) => a.term.localeCompare(b.term)) });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  updateTerm: async (id: number, term: string, translation: string | null) => {
    try {
      await updateTerm(id, term, translation);
      set({
        terms: get().terms.map(t =>
          t.id === id ? { ...t, term, translation } : t
        ).sort((a, b) => a.term.localeCompare(b.term))
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteTerm: async (id: number) => {
    try {
      await deleteTerm(id);
      set({ terms: get().terms.filter(t => t.id !== id) });
    } catch (error) {
      set({ error: String(error) });
    }
  },
}));
