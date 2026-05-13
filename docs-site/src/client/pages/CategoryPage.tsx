import { Link, useParams } from 'react-router-dom';
import { categories, getPagesByCategory } from '../data/inventory';

const categoryStatus: Record<string, string> = {
  'getting-started': 'Supported',
  guides: 'Supported',
  writing: 'Supported',
  graph: 'Partial',
  critic: 'Supported',
  worldview: 'Partial',
  agent: 'Supported',
  knowledge: 'Supported',
  memory: 'Supported',
  desktop: 'Supported',
  sync: 'Roadmap',
  architecture: 'Supported',
  api: 'Partial',
};

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const category = categories.find((c) => c.id === categoryId);
  const pages = categoryId ? getPagesByCategory(categoryId) : [];
  const firstPage = pages[0];
  const lastPage = pages[pages.length - 1];

  if (!category) {
    return <div className="text-[var(--color-text-secondary)]">分类未找到</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">{category.icon}</span>
              <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-[11px] text-[var(--color-text-tertiary)]">
                分类总览
              </span>
              <StatusBadge status={categoryStatus[category.id] ?? 'Supported'} />
            </div>
            <h1 className="text-[26px] font-bold text-[var(--color-text-primary)]">{category.name}</h1>
            <p className="mt-2 text-[14px] leading-7 text-[var(--color-text-secondary)]">{category.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
            <InfoCard label="文档数量" value={`${pages.length}`} />
            <InfoCard label="入口页面" value={firstPage?.title ?? '—'} />
            <InfoCard label="最近条目" value={lastPage?.title ?? '—'} />
            <InfoCard label="建议阅读" value={pages.length > 4 ? '分主题浏览' : '顺序阅读'} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">本分类包含</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {pages.map((page, index) => (
              <span
                key={page.id}
                className="rounded-full bg-[var(--color-bg-secondary)] px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)]"
              >
                {index + 1}. {page.title}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">阅读建议</h2>
          <ol className="mt-4 space-y-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            <li>先阅读第一篇，建立这个模块的整体认知。</li>
            <li>再按你的目标跳到对应页面，例如功能说明、架构设计或接口细节。</li>
            <li>如果你需要完整理解实现边界，建议把本分类全部浏览一遍。</li>
          </ol>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">本分类阅读信号</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InfoCard label="状态标签" value={categoryStatus[category.id] ?? 'Supported'} />
          <InfoCard label="是否含图示" value="多数核心页包含结构图或流程图" />
          <InfoCard label="推荐搭配" value={category.id === 'api' ? '架构设计 / 指南' : category.id === 'guides' ? '架构设计 / API 参考' : '相关 API 或指南'} />
        </div>
      </section>

      <section className="space-y-3">
        {pages.map((page, index) => (
          <Link
            key={page.id}
            to={`/${category.id}/${page.slug}`}
            className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 no-underline transition-all duration-150 hover:border-[var(--color-text-placeholder)] hover:shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-1 text-[11px] text-[var(--color-text-tertiary)]">文档 {index + 1}</div>
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{page.title}</h3>
                <p className="text-[12px] leading-6 text-[var(--color-text-secondary)]">{page.description}</p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="mt-1 flex-shrink-0 text-[var(--color-text-tertiary)]"
              >
                <path
                  d="M6 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3">
      <div className="text-[11px] text-[var(--color-text-tertiary)]">{label}</div>
      <div className="mt-1 text-[13px] font-medium leading-6 text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    Supported: 'bg-[var(--color-tint-green)] text-[var(--color-accent-green)]',
    Partial: 'bg-[var(--color-tint-yellow)] text-[var(--color-accent-orange)]',
    Experimental: 'bg-[var(--color-tint-purple)] text-[var(--color-accent-purple)]',
    Historical: 'bg-[var(--color-tint-gray)] text-[var(--color-text-secondary)]',
    Roadmap: 'bg-[var(--color-tint-blue)] text-[var(--color-accent-blue)]',
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${classes[status] ?? classes.Supported}`}>
      {status}
    </span>
  );
}
