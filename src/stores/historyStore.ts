import { create } from 'zustand';
import {
  HistoryRecord,
  getHistory,
  searchHistory,
  toggleFavorite,
  getFavorites,
  deleteHistory,
  addHistory,
} from '../services/database';

interface HistoryState {
  records: HistoryRecord[];
  isLoading: boolean;
  searchQuery: string;
  showFavoritesOnly: boolean;

  loadHistory: () => Promise<void>;
  search: (query: string) => Promise<void>;
  toggleShowFavorites: () => Promise<void>;
  addRecord: (record: Omit<HistoryRecord, 'id' | 'created_at' | 'is_favorite'>) => Promise<void>;
  toggleRecordFavorite: (id: number) => Promise<void>;
  deleteRecord: (id: number) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],
  isLoading: false,
  searchQuery: '',
  showFavoritesOnly: false,

  loadHistory: async () => {
    set({ isLoading: true });
    try {
      const records = await getHistory();
      set({ records });
    } finally {
      set({ isLoading: false });
    }
  },

  search: async (query: string) => {
    set({ searchQuery: query, isLoading: true });
    try {
      const records = query ? await searchHistory(query) : await getHistory();
      set({ records });
    } finally {
      set({ isLoading: false });
    }
  },

  toggleShowFavorites: async () => {
    const { showFavoritesOnly } = get();
    set({ showFavoritesOnly: !showFavoritesOnly, isLoading: true });
    try {
      const records = !showFavoritesOnly ? await getFavorites() : await getHistory();
      set({ records });
    } finally {
      set({ isLoading: false });
    }
  },

  addRecord: async (record) => {
    await addHistory(record);
    const { searchQuery, showFavoritesOnly } = get();
    if (!searchQuery && !showFavoritesOnly) {
      const records = await getHistory();
      set({ records });
    }
  },

  toggleRecordFavorite: async (id: number) => {
    await toggleFavorite(id);
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, is_favorite: !r.is_favorite } : r
      ),
    }));
  },

  deleteRecord: async (id: number) => {
    await deleteHistory(id);
    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
    }));
  },
}));
