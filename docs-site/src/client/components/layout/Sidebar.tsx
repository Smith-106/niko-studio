import { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { categories, docPages } from '../../data/inventory';
import { useSidebar } from './SidebarContext';
import { SearchBox } from './SearchBox';

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

export function Sidebar() {
  const { isOpen, close } = useSidebar();
  const location = useLocation();
  const [filter, setFilter] = useState('');
  const normalizedFilter = normalize(filter);

  const currentCategory = categories.find(
    (c) => location.pathname.startsWith(`/${c.id}`)
  );

  const visibleCategories = useMemo(() => {
    return categories
      .map((category) => {
        const pages = docPages.filter((p) => p.category === category.id);
        const filteredPages = normalizedFilter
          ? pages.filter((page) =>
              normalize(`${page.title} ${page.description} ${category.name}`).includes(normalizedFilter)
            )
          : pages;

        const categoryMatches = normalize(`${category.name} ${category.description}`).includes(normalizedFilter);

        if (!normalizedFilter || categoryMatches || filteredPages.length > 0) {
          return {
            category,
            pages: filteredPages,
            allPages: pages,
          };
        }

        return null;
      })
      .filter(Boolean);
  }, [normalizedFilter]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={close}
        />
      )}
      <aside
        className={`fixed top-[var(--size-topbar-height)] left-0 bottom-0 w-[var(--size-sidebar-width)] bg-[var(--color-bg-card)] border-r border-[var(--color-border)] overflow-y-auto z-40 transition-transform duration-200 ${
          isOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
        } md:visible md:translate-x-0`}
      >
        <div className="p-4 border-b border-[var(--color-border-divider)] md:hidden">
          <SearchBox mobile placeholder="搜索文档..." />
        </div>

        <div className="p-4 border-b border-[var(--color-border-divider)]">
          <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[var(--color-text-tertiary)]">
              <path d="M11.5 11.5L15 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="筛选侧边栏..."
              className="w-full border-0 bg-transparent p-0 text-[12px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
            />
          </label>
        </div>

        <nav className="p-4">
          {visibleCategories.length > 0 ? (
            visibleCategories.map((entry) => {
              if (!entry) {
                return null;
              }

              const { category, pages, allPages } = entry;
              const isActive = currentCategory?.id === category.id;
              const shouldExpand = isActive || normalizedFilter.length > 0;

              return (
                <div key={category.id} className="mb-4 scroll-mt-24" data-category-id={category.id}>
                  <NavLink
                    to={`/${category.id}`}
                    onClick={close}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold no-underline transition-colors ${
                      isActive
                        ? 'text-[var(--color-accent-blue)] bg-[var(--color-tint-blue)]'
                        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                    }`}
                  >
                    <span>{category.icon}</span>
                    <span className="flex-1">{category.name}</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">{pages.length}/{allPages.length}</span>
                  </NavLink>

                  {shouldExpand && (
                    <div className="ml-4 mt-1 flex flex-col gap-0.5">
                      {pages.map((page) => (
                        <NavLink
                          key={page.id}
                          to={`/${category.id}/${page.slug}`}
                          onClick={close}
                          className={({ isActive: pageActive }) =>
                            `px-3 py-1.5 rounded-md text-[12px] no-underline transition-colors ${
                              pageActive
                                ? 'text-[var(--color-accent-blue)] bg-[var(--color-tint-blue)] border-l-2 border-[var(--color-accent-blue)]'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                            }`
                          }
                        >
                          {page.title}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-5 text-[12px] leading-6 text-[var(--color-text-secondary)]">
              没有匹配的文档。可以尝试搜索分类名、功能名或 API 名称。
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
