import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { translate } from '../services/translation';
import { useSettingsStore } from '../stores/settingsStore';

export function PopupPage() {
  const { defaultSourceLang, defaultTargetLang, getDefaultEngine, theme } = useSettingsStore();

  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 应用主题
  useEffect(() => {
    const applyTheme = () => {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  // 关闭悬浮窗
  const closePopup = useCallback(async () => {
    try {
      await invoke('close_popup');
    } catch (e) {
      console.error('关闭悬浮窗失败:', e);
    }
  }, []);

  // 执行翻译
  const doTranslate = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const engine = getDefaultEngine();
      if (!engine) {
        setError('请先配置翻译引擎');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await translate(engine, {
          text: text,
          source_lang: defaultSourceLang,
          target_lang: defaultTargetLang,
        });
        setTargetText(response.translated_text);
      } catch (e) {
        setError(typeof e === 'string' ? e : '翻译失败');
        setTargetText('');
      } finally {
        setIsLoading(false);
      }
    },
    [defaultSourceLang, defaultTargetLang, getDefaultEngine]
  );

  // 监听 popup-translate 事件
  useEffect(() => {
    const unlisten = listen<string>('popup-translate', async (event) => {
      const text = event.payload;
      setSourceText(text);
      setTargetText('');
      setError(null);
      await doTranslate(text);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [doTranslate]);

  // 监听窗口失焦事件
  useEffect(() => {
    const currentWindow = getCurrentWindow();
    const unlisten = currentWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        closePopup();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [closePopup]);

  // 监听 Esc 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePopup();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closePopup]);

  // 复制译文并关闭
  const handleCopy = async () => {
    if (targetText) {
      await navigator.clipboard.writeText(targetText);
      closePopup();
    }
  };

  return (
    <div className="p-3 min-h-screen bg-[var(--bg-primary)]">
      <div className="rounded-xl bg-[var(--bg-secondary)] p-3 shadow-lg">
        {/* 原文 - 最多3行截断 */}
        <div className="mb-2">
          <p className="text-xs text-[var(--text-secondary)] mb-1">原文</p>
          <p className="text-sm text-[var(--text-primary)] line-clamp-3 break-words">
            {sourceText || '等待文本...'}
          </p>
        </div>

        {/* 分隔线 */}
        <div className="border-t border-[var(--text-secondary)]/20 my-2" />

        {/* 译文区域 */}
        <div>
          <p className="text-xs text-[var(--text-secondary)] mb-1">译文</p>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              翻译中...
            </div>
          ) : error ? (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          ) : (
            <p className="text-sm text-[var(--text-primary)] break-words">
              {targetText || '等待翻译...'}
            </p>
          )}
        </div>

        {/* 复制按钮 */}
        {targetText && !isLoading && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                         bg-[var(--accent)] text-white rounded-lg
                         hover:opacity-90 transition-opacity"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              复制
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
