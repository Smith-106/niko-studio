import { Link, useParams } from 'react-router-dom';
import { categories, getPagesByCategory } from '../data/inventory';

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const category = categories.find((c) => c.id === categoryId);
  const pages = categoryId ? getPagesByCategory(categoryId) : [];

  if (!category) {
    return <div className="text-[var(--color-text-secondary)]">分类未找到</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{category.icon}</span>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            {category.name}
          </h1>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {category.description}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {pages.map((page) => (
          <Link
            key={page.id}
            to={`/${category.id}/${page.slug}`}
            className="flex items-center justify-between p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg no-underline transition-all duration-150 hover:border-[var(--color-text-placeholder)] hover:shadow-[var(--shadow-sm)]"
          >
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-0.5">
                {page.title}
              </h3>
              <p className="text-[12px] text-[var(--color-text-secondary)]">
                {page.description}
              </p>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-[var(--color-text-tertiary)] flex-shrink-0 ml-3"
            >
              <path
                d="M6 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
