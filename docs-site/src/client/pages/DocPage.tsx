import { useParams, Link } from 'react-router-dom';
import { categories, docPages } from '../data/inventory';
import { getDocContent } from '../data/content';

export default function DocPage() {
  const { categoryId, slug } = useParams<{ categoryId: string; slug: string }>();
  const category = categories.find((c) => c.id === categoryId);
  const page = docPages.find((p) => p.category === categoryId && p.slug === slug);

  if (!category || !page) {
    return <div className="text-[var(--color-text-secondary)]">页面未找到</div>;
  }

  const content = getDocContent(page.id);

  return (
    <div>
      <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-tertiary)] mb-4">
        <Link to="/" className="hover:text-[var(--color-text-secondary)] no-underline text-[var(--color-text-tertiary)]">
          首页
        </Link>
        <span>/</span>
        <Link to={`/${category.id}`} className="hover:text-[var(--color-text-secondary)] no-underline text-[var(--color-text-tertiary)]">
          {category.name}
        </Link>
        <span>/</span>
        <span className="text-[var(--color-text-secondary)]">{page.title}</span>
      </div>

      <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
        {page.title}
      </h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        {page.description}
      </p>

      <div className="prose prose-sm max-w-none">
        <div
          className="text-[var(--color-text-primary)] leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:text-[13px] [&_p]:text-[var(--color-text-secondary)] [&_p]:mb-3 [&_ul]:text-[13px] [&_ul]:text-[var(--color-text-secondary)] [&_ul]:mb-3 [&_ul]:pl-5 [&_li]:mb-1 [&_code]:text-[12px] [&_code]:bg-[var(--color-bg-secondary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-[#2D2A26] [&_pre]:text-[#E8E5DE] [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-[12px] [&_pre]:mb-4"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
}
