import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useExcelStore } from '../stores/excelStore';
import { useSettingsStore } from '../stores/settingsStore';
import { LanguageSelector } from '../components/LanguageSelector';

export function ExcelPage() {
  const {
    status,
    excelInfo,
    progress,
    result,
    error,
    loadFile,
    startTranslation,
    cancel,
    reset,
  } = useExcelStore();

  const {
    getDefaultEngine,
    defaultSourceLang,
    defaultTargetLang,
    setDefaultLanguages,
  } = useSettingsStore();

  const sourceLang = defaultSourceLang;
  const targetLang = defaultTargetLang;
  const setSourceLang = (lang: string) => setDefaultLanguages(lang, targetLang);
  const setTargetLang = (lang: string) => setDefaultLanguages(sourceLang, lang);

  const handleSelectFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (selected && typeof selected === 'string') {
      await loadFile(selected);
    }
  }, [loadFile]);

  const handleStartTranslation = useCallback(async () => {
    const engine = getDefaultEngine();
    if (!engine) {
      alert('请先在设置中配置翻译引擎');
      return;
    }
    await startTranslation(sourceLang, targetLang, {
      engine_type: engine.engine_type,
      endpoint: engine.endpoint,
      model: engine.model,
      api_key: engine.api_key,
    });
  }, [sourceLang, targetLang, getDefaultEngine, startTranslation]);

  const handleCancel = useCallback(async () => {
    await cancel();
  }, [cancel]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  const renderProgress = () => {
    if (!progress) return null;
    const percent = progress.total_cells > 0
      ? Math.round((progress.current_cell / progress.total_cells) * 100)
      : 0;
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>
            工作表 {progress.current_sheet}/{progress.total_sheets}: {progress.sheet_name}
          </span>
          <span>{percent}%</span>
        </div>
        <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2">
          <div
            className="bg-[var(--accent)] h-2 rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="text-xs text-[var(--text-secondary)]">
          已翻译 {progress.current_cell}/{progress.total_cells} 个单元格
          {progress.cache_hits > 0 && ` (缓存命中: ${progress.cache_hits})`}
        </div>
      </div>
    );
  };

  const renderResult = () => {
    if (!result) return null;
    return (
      <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg space-y-2">
        <div className="font-medium text-green-700 dark:text-green-400">
          {result.cancelled ? '翻译已取消' : '翻译完成'}
        </div>
        {!result.cancelled && (
          <>
            <div className="text-sm text-green-600 dark:text-green-500">
              共翻译 {result.translated_cells} 个单元格
              {result.cache_hits > 0 && `，缓存命中 ${result.cache_hits} 次`}
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              已保存至: {result.output_path}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-y-auto">
      <h1 className="text-xl font-bold">Excel 翻译</h1>

      {/* 文件选择区域 */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectFile}
            disabled={status === 'translating'}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg
                       hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            选择 Excel 文件
          </button>
          {excelInfo && (
            <span className="text-sm text-[var(--text-secondary)]">
              {excelInfo.file_name}
            </span>
          )}
        </div>

        {excelInfo && (
          <div className="p-3 bg-[var(--bg-secondary)] rounded-lg text-sm space-y-1">
            <div>文件: {excelInfo.file_name}</div>
            <div>工作表: {excelInfo.sheet_names.join(', ')}</div>
            <div>待翻译单元格: {excelInfo.total_cells} 个</div>
          </div>
        )}
      </section>

      {/* 语言选择 */}
      {(status === 'ready' || status === 'translating') && (
        <section className="space-y-2">
          <h2 className="font-medium">翻译语言</h2>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                源语言
              </label>
              <LanguageSelector
                value={sourceLang}
                onChange={setSourceLang}
                showAuto
              />
            </div>
            <div className="pt-5">
              <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                目标语言
              </label>
              <LanguageSelector
                value={targetLang}
                onChange={setTargetLang}
                showAuto={false}
              />
            </div>
          </div>
        </section>
      )}

      {/* 翻译控制按钮 */}
      {status === 'ready' && (
        <button
          onClick={handleStartTranslation}
          className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg font-medium
                     hover:opacity-90 transition-opacity"
        >
          开始翻译
        </button>
      )}

      {status === 'translating' && (
        <div className="space-y-3">
          {renderProgress()}
          <button
            onClick={handleCancel}
            className="w-full py-2.5 bg-red-500 text-white rounded-lg font-medium
                       hover:bg-red-600 transition-colors"
          >
            取消翻译
          </button>
        </div>
      )}

      {/* 结果展示 */}
      {(status === 'completed' || status === 'cancelled') && (
        <div className="space-y-3">
          {renderResult()}
          <button
            onClick={handleReset}
            className="w-full py-2.5 bg-[var(--bg-secondary)] rounded-lg font-medium
                       hover:bg-[var(--border)] transition-colors"
          >
            翻译新文件
          </button>
        </div>
      )}

      {/* 错误展示 */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 加载状态 */}
      {status === 'loading' && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
        </div>
      )}
    </div>
  );
}
