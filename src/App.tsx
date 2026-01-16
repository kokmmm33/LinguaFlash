import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Layout, Tab } from './components/Layout';
import { TranslatePage } from './pages/TranslatePage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { initDatabase } from './services/database';
import { updateShortcuts } from './services/shortcut';
import { useSettingsStore } from './stores/settingsStore';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('translate');
  const { theme, shortcuts } = useSettingsStore();

  // 用于传递划词翻译文本给 TranslatePage
  const [pendingText, setPendingText] = useState<string | null>(null);

  useEffect(() => {
    initDatabase().then(() => setIsDbReady(true));
  }, []);

  // 同步快捷键配置到后端
  useEffect(() => {
    updateShortcuts(shortcuts.translate, shortcuts.showWindow).catch(console.error);
  }, [shortcuts.translate, shortcuts.showWindow]);

  // 监听划词翻译事件，自动切换到翻译页面
  useEffect(() => {
    console.log('[DEBUG App] 设置 translate-selection 事件监听器');
    const unlisten = listen<string>('translate-selection', (event) => {
      console.log('[DEBUG App] 收到 translate-selection 事件:', event.payload);
      const text = event.payload;
      setPendingText(text);
      setActiveTab('translate');
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // 主题切换逻辑
  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme === 'dark');
    }
  }, [theme]);

  // 清除待处理文本的回调
  const clearPendingText = () => {
    setPendingText(null);
  };

  if (!isDbReady) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">初始化中...</div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="h-full">
        {activeTab === 'translate' && (
          <TranslatePage
            pendingText={pendingText}
            onPendingTextProcessed={clearPendingText}
          />
        )}
        {activeTab === 'history' && <HistoryPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </div>
    </Layout>
  );
}

export default App;
