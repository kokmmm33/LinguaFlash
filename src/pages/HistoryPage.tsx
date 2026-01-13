import { useEffect, useState } from 'react';
import { useHistoryStore } from '../stores/historyStore';

export function HistoryPage() {
  const {
    records, isLoading, searchQuery, showFavoritesOnly,
    loadHistory, search, toggleShowFavorites, toggleRecordFavorite, deleteRecord,
  } = useHistoryStore();

  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => { loadHistory(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search(localSearch);
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="搜索历史记录..."
          className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] rounded-lg border border-transparent focus:border-[var(--accent)] focus:outline-none"
        />
        <button type="submit" className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90">
          搜索
        </button>
        <button
          type="button"
          onClick={toggleShowFavorites}
          className={`px-4 py-2 rounded-lg border ${
            showFavoritesOnly ? 'bg-yellow-500 text-white border-yellow-500' : 'border-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
          }`}
        >
          收藏
        </button>
      </form>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="text-center text-[var(--text-secondary)] py-8">加载中...</div>
        ) : records.length === 0 ? (
          <div className="text-center text-[var(--text-secondary)] py-8">
            {searchQuery ? '未找到匹配的记录' : '暂无历史记录'}
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <div key={record.id} className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-[var(--text-secondary)]">
                    {record.source_lang} → {record.target_lang} · {record.engine}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {new Date(record.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm mb-2">{record.source_text}</div>
                <div className="text-sm text-[var(--accent)] mb-3">{record.translated_text}</div>
                <div className="flex gap-2">
                  <button onClick={() => handleCopy(record.translated_text)} className="text-xs px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10">
                    复制译文
                  </button>
                  <button
                    onClick={() => toggleRecordFavorite(record.id)}
                    className={`text-xs px-2 py-1 rounded ${record.is_favorite ? 'text-yellow-500' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
                  >
                    {record.is_favorite ? '取消收藏' : '收藏'}
                  </button>
                  <button onClick={() => deleteRecord(record.id)} className="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30">
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
