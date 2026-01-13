import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { TranslatePage } from './pages/TranslatePage';
import { HistoryPage } from './pages/HistoryPage';
import { initDatabase } from './services/database';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    initDatabase().then(() => setIsDbReady(true));
  }, []);

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
          {activeTab === 'settings' && <div>设置页面</div>}
        </div>
      )}
    </Layout>
  );
}

export default App;
