import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { TranslatePage } from './pages/TranslatePage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { initDatabase } from './services/database';
import { updateShortcuts } from './services/shortcut';
import { useSettingsStore } from './stores/settingsStore';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const { theme, shortcuts } = useSettingsStore();

  useEffect(() => {
    initDatabase().then(() => setIsDbReady(true));
  }, []);

  // 同步快捷键配置到后端
  useEffect(() => {
    updateShortcuts(shortcuts.translate, shortcuts.showWindow).catch(console.error);
  }, [shortcuts.translate, shortcuts.showWindow]);

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

  if (!isDbReady) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">初始化中...</div>
      </div>
    );
  }

  return (
    <Layout>
      {(activeTab) => (
        <div className="h-full">
          {activeTab === 'translate' && <TranslatePage />}
          {activeTab === 'history' && <HistoryPage />}
          {activeTab === 'settings' && <SettingsPage />}
        </div>
      )}
    </Layout>
  );
}

export default App;
