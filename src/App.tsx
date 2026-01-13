import { Layout } from './components/Layout';
import { TranslatePage } from './pages/TranslatePage';

function App() {
  return (
    <Layout>
      {(activeTab) => (
        <div className="h-full">
          {activeTab === 'translate' && <TranslatePage />}
          {activeTab === 'history' && <div>历史页面</div>}
          {activeTab === 'settings' && <div>设置页面</div>}
        </div>
      )}
    </Layout>
  );
}

export default App;
