import { Layout } from './components/Layout';

function App() {
  return (
    <Layout>
      {(activeTab) => (
        <div className="h-full">
          {activeTab === 'translate' && <div>翻译页面</div>}
          {activeTab === 'history' && <div>历史页面</div>}
          {activeTab === 'settings' && <div>设置页面</div>}
        </div>
      )}
    </Layout>
  );
}

export default App;
