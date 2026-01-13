import { useState } from 'react';
import { TextArea } from '../components/TextArea';
import { LanguageSelector } from '../components/LanguageSelector';
import { translate } from '../services/translation';
import { useSettingsStore } from '../stores/settingsStore';

export function TranslatePage() {
  const { defaultSourceLang, defaultTargetLang, getDefaultEngine } = useSettingsStore();

  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [sourceLang, setSourceLang] = useState(defaultSourceLang);
  const [targetLang, setTargetLang] = useState(defaultTargetLang);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;

    const engine = getDefaultEngine();
    if (!engine) {
      setError('请先配置翻译引擎');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await translate(engine, {
        text: sourceText,
        source_lang: sourceLang,
        target_lang: targetLang,
      });
      setTargetText(response.translated_text);
    } catch (e) {
      setError(e as string);
      setTargetText('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(targetText);
    setTargetText(sourceText);
  };

  const handleCopy = async () => {
    if (targetText) {
      await navigator.clipboard.writeText(targetText);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* 语言选择栏 */}
      <div className="flex items-center gap-2">
        <LanguageSelector value={sourceLang} onChange={setSourceLang} showAuto />
        <button
          onClick={handleSwapLanguages}
          disabled={sourceLang === 'auto'}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>
        <LanguageSelector value={targetLang} onChange={setTargetLang} showAuto={false} />
      </div>

      {/* 输入区域 */}
      <TextArea
        value={sourceText}
        onChange={setSourceText}
        placeholder="输入要翻译的文本..."
        className="flex-1"
      />

      {/* 翻译按钮 */}
      <button
        onClick={handleTranslate}
        disabled={!sourceText.trim() || isLoading}
        className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg font-medium
                   hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-opacity"
      >
        {isLoading ? '翻译中...' : '翻译'}
      </button>

      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 结果区域 */}
      <div className="flex-1 relative">
        <TextArea
          value={targetText}
          onChange={setTargetText}
          placeholder="翻译结果"
          readOnly
          className="h-full"
        />
        {targetText && (
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-[var(--bg-primary)] hover:bg-black/10 dark:hover:bg-white/10"
              title="复制"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
