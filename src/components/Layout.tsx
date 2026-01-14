import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export type Tab = 'translate' | 'history' | 'settings';

interface LayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

export function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
      <main className="flex-1 overflow-auto p-4">
        {children}
      </main>
    </div>
  );
}
