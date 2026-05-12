import type { ReactNode } from 'react';

export function MainContent({ children }: { children?: ReactNode }) {
  return (
    <main className="flex-1 md:ml-[var(--size-sidebar-width)] overflow-y-auto">
      <div className="max-w-[var(--size-content-max-width)] mx-auto px-6 py-8">
        {children}
      </div>
    </main>
  );
}
