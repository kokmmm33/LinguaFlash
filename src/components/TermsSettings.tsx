import { useState, useEffect } from 'react';
import { useTermsStore } from '../stores/termsStore';

export function TermsSettings() {
  const { terms, isLoading, loadTerms, addTerm, updateTerm, deleteTerm } = useTermsStore();
  const [newTerm, setNewTerm] = useState('');
  const [newTranslation, setNewTranslation] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTerm, setEditTerm] = useState('');
  const [editTranslation, setEditTranslation] = useState('');

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  const handleAdd = async () => {
    if (!newTerm.trim()) return;
    await addTerm(newTerm.trim(), newTranslation.trim() || null);
    setNewTerm('');
    setNewTranslation('');
  };

  const handleStartEdit = (term: { id: number; term: string; translation: string | null }) => {
    setEditingId(term.id);
    setEditTerm(term.term);
    setEditTranslation(term.translation || '');
  };

  const handleSaveEdit = async () => {
    if (editingId === null || !editTerm.trim()) return;
    await updateTerm(editingId, editTerm.trim(), editTranslation.trim() || null);
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* 添加新术语 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
          placeholder="术语"
          className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm"
        />
        <input
          type="text"
          value={newTranslation}
          onChange={(e) => setNewTranslation(e.target.value)}
          placeholder="固定译法（留空则保持原样）"
          className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm"
        />
        <button
          onClick={handleAdd}
          disabled={!newTerm.trim()}
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm
                     hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          添加
        </button>
      </div>

      {/* 术语列表 */}
      {isLoading ? (
        <div className="text-center py-4 text-[var(--text-secondary)]">加载中...</div>
      ) : terms.length === 0 ? (
        <div className="text-center py-4 text-[var(--text-secondary)]">
          暂无术语，添加后可在翻译时自动应用
        </div>
      ) : (
        <div className="space-y-2">
          {terms.map((term) => (
            <div
              key={term.id}
              className="flex items-center gap-2 p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg"
            >
              {editingId === term.id ? (
                <>
                  <input
                    type="text"
                    value={editTerm}
                    onChange={(e) => setEditTerm(e.target.value)}
                    className="flex-1 px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm"
                  />
                  <input
                    type="text"
                    value={editTranslation}
                    onChange={(e) => setEditTranslation(e.target.value)}
                    placeholder="保持原样"
                    className="flex-1 px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm"
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 bg-[var(--accent)] text-white rounded text-sm"
                  >
                    保存
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 bg-[var(--bg-secondary)] rounded text-sm"
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{term.term}</span>
                  <span className="flex-1 text-[var(--text-secondary)]">
                    {term.translation || '(保持原样)'}
                  </span>
                  <button
                    onClick={() => handleStartEdit(term)}
                    className="px-3 py-1 bg-[var(--bg-secondary)] rounded text-sm hover:bg-[var(--border)]"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => deleteTerm(term.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                  >
                    删除
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
