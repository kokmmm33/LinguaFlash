import { useState, ReactNode } from 'react';
import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';

type Tab = 'translate' | 'history' | 'settings';

interface LayoutProps {
  children: (activeTab: Tab) => ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>('translate');

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-auto p-4">
          {children(activeTab)}
        </main>
      </div>
    </div>
  );
}
