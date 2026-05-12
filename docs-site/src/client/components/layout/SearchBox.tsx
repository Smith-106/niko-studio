import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getResolvedDocPages } from '../../data/inventory';

interface SearchBoxProps {
  mobile?: boolean;
  placeholder?: string;
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

export function SearchBox({ mobile = false, placeholder = '搜索文档、分类或 API...' }: SearchBoxProps) {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const docs = useMemo(() => getResolvedDocPages(), []);
  const normalizedQuery = normalize(query);

  useEffect(() => {
    setIsOpen(false);
    setQuery('');
  }, [location.pathname]);

  useEffect(() => {
    if (mobile) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) {
        return;
      }

      event.preventDefault();
      setIsOpen(true);
      window.setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('[data-doc-search-input="desktop"]');
        input?.focus();
      }, 0);
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [mobile]);

  const results = useMemo(() => {
    if (!normalizedQuery) {
      return docs.slice(0, 8);
    }

    return docs
      .map((doc) => {
        const haystack = normalize([
          doc.title,
          doc.description,
          doc.categoryInfo.name,
          doc.categoryInfo.description,
        ].join(' '));

        let score = 0;
        if (normalize(doc.title).includes(normalizedQuery)) {
          score += 5;
        }
        if (normalize(doc.categoryInfo.name).includes(normalizedQuery)) {
          score += 3;
        }
        if (haystack.includes(normalizedQuery)) {
          score += 1;
        }

        return { doc, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title, 'zh-CN'))
      .slice(0, 8)
      .map((item) => item.doc);
  }, [docs, normalizedQuery]);

  const wrapperClass = mobile
    ? 'relative w-full md:hidden'
    : 'relative hidden w-full max-w-[420px] md:block';

  return (
    <div
      className={wrapperClass}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 focus-within:border-[var(--color-text-placeholder)]">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[var(--color-text-tertiary)]">
          <path d="M11.5 11.5L15 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <input
          data-doc-search-input={mobile ? 'mobile' : 'desktop'}
          value={query}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false);
              event.currentTarget.blur();
            }
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full border-0 bg-transparent p-0 text-[13px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
        />
        {!mobile ? (
          <span className="rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
            Ctrl K
          </span>
        ) : null}
      </label>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--shadow-lg)]">
          <div className="border-b border-[var(--color-border-divider)] px-4 py-3 text-[11px] text-[var(--color-text-tertiary)]">
            {normalizedQuery ? `找到 ${results.length} 条结果` : '推荐入口'}
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {results.length > 0 ? (
              results.map((doc) => (
                <Link
                  key={doc.id}
                  to={doc.path}
                  className="block rounded-xl px-3 py-3 no-underline transition-colors hover:bg-[var(--color-bg-hover)]"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]">
                    <span>{doc.categoryInfo.icon}</span>
                    <span>{doc.categoryInfo.name}</span>
                  </div>
                  <div className="text-[13px] font-medium text-[var(--color-text-primary)]">{doc.title}</div>
                  <div className="mt-1 text-[12px] leading-6 text-[var(--color-text-secondary)]">{doc.description}</div>
                </Link>
              ))
            ) : (
              <div className="px-3 py-6 text-[12px] text-[var(--color-text-secondary)]">没有找到匹配项，试试分类名、功能名或 API 关键词。</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
