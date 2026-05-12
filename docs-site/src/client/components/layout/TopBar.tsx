import { Link } from 'react-router-dom';
import { useSidebar } from './SidebarContext';

export function TopBar() {
  const { toggle } = useSidebar();

  return (
    <header className="fixed top-0 left-0 right-0 h-[var(--size-topbar-height)] bg-[var(--color-bg-card)] border-b border-[var(--color-border)] flex items-center px-5 z-50">
      <button
        onClick={toggle}
        className="md:hidden mr-3 p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <div className="w-7 h-7 rounded-md bg-[var(--color-accent-blue)] flex items-center justify-center">
          <span className="text-white font-bold text-sm">N</span>
        </div>
        <span className="font-semibold text-[var(--color-text-primary)] text-[15px]">
          Niko Studio
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-3">
        <a
          href="https://github.com/Smith-106/niko-studio"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="GitHub"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </div>
    </header>
  );
}
