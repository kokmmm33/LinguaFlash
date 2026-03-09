import { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { EngineSettings } from '../components/EngineSettings';
import { LanguageSelector } from '../components/LanguageSelector';
import { ShortcutInput } from '../components/ShortcutInput';
import { TermsSettings } from '../components/TermsSettings';
import { clearHistory } from '../services/database';

export function SettingsPage() {
  const {
    engines,
    defaultEngineIndex,
    defaultSourceLang,
    defaultTargetLang,
    theme,
    shortcuts,
    addEngine,
    removeEngine,
    updateEngine,
    setDefaultEngine,
    setDefaultLanguages,
    setTheme,
    setShortcut,
  } = useSettingsStore();

  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleAddOllama = () => {
    addEngine({
      engine_type: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'qwen2',
    });
  };

  const handleAddGLM = () => {
    addEngine({
      engine_type: 'glm',
      api_key: '',
      model: 'glm-4-flash',
    });
  };

  const handleClearHistory = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }

    setClearing(true);
    try {
      await clearHistory();
      setConfirmClear(false);
    } catch (error) {
      console.error('Failed to clear history:', error);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {/* 翻译引擎区域 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">翻译引擎</h2>
        <div className="space-y-3">
          {engines.map((engine, index) => (
            <EngineSettings
              key={engine.id}
              config={engine}
              isDefault={index === defaultEngineIndex}
              canDelete={engines.length > 1}
              onUpdate={(config) => updateEngine(index, config)}
              onDelete={() => removeEngine(index)}
              onSetDefault={() => setDefaultEngine(index)}
            />
          ))}

          <div className="flex gap-2">
            <button
              onClick={handleAddOllama}
              className="px-4 py-2 bg-[var(--bg-secondary)] rounded-lg text-sm
                         hover:bg-[var(--border)] transition-colors border border-[var(--border)]"
            >
              + 添加 Ollama
            </button>
            <button
              onClick={handleAddGLM}
              className="px-4 py-2 bg-[var(--bg-secondary)] rounded-lg text-sm
                         hover:bg-[var(--border)] transition-colors border border-[var(--border)]"
            >
              + 添加智谱 GLM
            </button>
          </div>
        </div>
      </section>

      {/* 默认语言区域 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">默认语言</h2>
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                源语言
              </label>
              <LanguageSelector
                value={defaultSourceLang}
                onChange={(value) => setDefaultLanguages(value, defaultTargetLang)}
                showAuto={true}
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                目标语言
              </label>
              <LanguageSelector
                value={defaultTargetLang}
                onChange={(value) => setDefaultLanguages(defaultSourceLang, value)}
                showAuto={false}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 外观区域 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">外观</h2>
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                theme === 'light'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-primary)] hover:bg-[var(--border)]'
              }`}
            >
              浅色
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                theme === 'dark'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-primary)] hover:bg-[var(--border)]'
              }`}
            >
              深色
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                theme === 'system'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-primary)] hover:bg-[var(--border)]'
              }`}
            >
              跟随系统
            </button>
          </div>
        </div>
      </section>

      {/* 术语表区域 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">术语表</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          添加不需要翻译或需要固定译法的专业名词
        </p>
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
          <TermsSettings />
        </div>
      </section>

      {/* 快捷键区域 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">快捷键</h2>
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">划词翻译</span>
            <ShortcutInput
              value={shortcuts.translate}
              onChange={(v) => setShortcut('translate', v)}
              onReset={() => setShortcut('translate', 'CommandOrControl+Shift+T')}
              otherShortcut={shortcuts.showWindow}
              defaultValue="CommandOrControl+Shift+T"
              allShortcuts={shortcuts}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">显示主窗口</span>
            <ShortcutInput
              value={shortcuts.showWindow}
              onChange={(v) => setShortcut('showWindow', v)}
              onReset={() => setShortcut('showWindow', 'CommandOrControl+Shift+Space')}
              otherShortcut={shortcuts.translate}
              defaultValue="CommandOrControl+Shift+Space"
              allShortcuts={shortcuts}
            />
          </div>
        </div>
      </section>

      {/* 数据管理区域 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">数据管理</h2>
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">清空历史记录</div>
              <div className="text-sm text-[var(--text-secondary)]">
                删除所有翻译历史记录，此操作不可恢复
              </div>
            </div>
            {confirmClear ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-4 py-2 bg-[var(--bg-primary)] rounded-lg text-sm
                             hover:bg-[var(--border)] transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleClearHistory}
                  disabled={clearing}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm
                             hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {clearing ? '清空中...' : '确认清空'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleClearHistory}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm
                           hover:bg-red-600 transition-colors"
              >
                清空
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 关于区域 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">关于</h2>
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">应用名称</span>
              <span>LinguaFlash</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">版本</span>
              <span>1.1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">技术栈</span>
              <span>Tauri + React + Rust</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
