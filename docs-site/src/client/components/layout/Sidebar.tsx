import { NavLink, useLocation } from 'react-router-dom';
import { categories, docPages } from '../../data/inventory';
import { useSidebar } from './SidebarContext';

export function Sidebar() {
  const { isOpen, close } = useSidebar();
  const location = useLocation();

  const currentCategory = categories.find(
    (c) => location.pathname.startsWith(`/${c.id}`)
  );

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
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <nav className="p-4">
          {categories.map((category) => {
            const pages = docPages.filter((p) => p.category === category.id);
            const isActive = currentCategory?.id === category.id;

            return (
              <div key={category.id} className="mb-4">
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
                  <span>{category.name}</span>
                </NavLink>

                {isActive && (
                  <div className="ml-4 mt-1 flex flex-col gap-0.5">
                    {pages.map((page) => (
                      <NavLink
                        key={page.id}
                        to={`/${category.id}/${page.slug}`}
                        onClick={close}
                        className={({ isActive: pageActive }) =>
                          `px-3 py-1.5 rounded-md text-[12px] no-underline transition-colors ${
                            pageActive
                              ? 'text-[var(--color-accent-blue)] bg-[var(--color-tint-blue)]'
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
          })}
        </nav>
      </aside>
    </>
  );
}
