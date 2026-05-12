import type { ReactNode } from 'react';
import { SidebarProvider } from './SidebarContext';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';

export function Layout({ children }: { children?: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen bg-[var(--color-bg-primary)]">
        <TopBar />
        <div className="flex pt-[var(--size-topbar-height)] h-screen">
          <Sidebar />
          <MainContent>{children}</MainContent>
        </div>
      </div>
    </SidebarProvider>
  );
}
