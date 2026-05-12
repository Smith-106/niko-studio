import { Link } from 'react-router-dom';
import { categories, docPages, getPagesByCategory } from '../data/inventory';
import type { Category } from '../data/inventory';

const tintColors: Record<string, string> = {
  'getting-started': 'bg-[var(--color-tint-green)]',
  writing: 'bg-[var(--color-tint-purple)]',
  knowledge: 'bg-[var(--color-tint-blue)]',
  desktop: 'bg-[var(--color-tint-orange)]',
  architecture: 'bg-[var(--color-tint-gray)]',
  api: 'bg-[var(--color-tint-yellow)]',
  graph: 'bg-[var(--color-tint-blue)]',
  critic: 'bg-[var(--color-tint-orange)]',
  worldview: 'bg-[var(--color-tint-green)]',
  agent: 'bg-[var(--color-tint-purple)]',
  memory: 'bg-[var(--color-tint-gray)]',
  sync: 'bg-[var(--color-tint-yellow)]',
};

const quickLinks = [
  { title: '先选学习路径', description: '按写作者、开发者、集成者或维护者身份选择阅读顺序。', to: '/guides/learning-paths' },
  { title: '完成第一次分析', description: '从创建作品到查看证据和建议，快速进入可用状态。', to: '/getting-started/quickstart' },
  { title: '理解工作台', description: '查看编辑器、写作面板、Story Bible 和 AI 执行链路。', to: '/desktop/editor-integration' },
  { title: '查看架构与 API', description: '面向开发者理解 Gateway、数据流和服务端点。', to: '/architecture/system-overview' },
];

const workflowSteps = [
  { label: '写作', value: '创建作品、编辑章节、导入素材' },
  { label: '分析', value: '技法、结构、角色、场景和网文节奏' },
  { label: '修订', value: '基于证据选择建议并回填正文' },
  { label: '沉淀', value: '把设定、角色和决策晋升到 Wiki / Story Bible' },
  { label: '扩展', value: '通过 API、技能、插件和 Workflow 接入自动化' },
];

const featuredDocs = [
  'quickstart',
  'craft-analysis',
  'writing-dashboard',
  'system-overview',
  'gateway-api',
  'workflow-api',
].map((id) => docPages.find((page) => page.id === id)).filter(Boolean);

export default function LandingPage() {
  const totalCategories = categories.length;
  const totalDocs = docPages.length;
  const apiDocs = getPagesByCategory('api').length;
  const writingDocs = getPagesByCategory('writing').length;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-7 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[680px]">
            <span className="inline-flex items-center rounded-full bg-[var(--color-tint-purple)] px-3 py-1 text-[11px] font-medium text-[var(--color-accent-purple)]">
              Documentation Hub
            </span>
            <h1 className="mt-4 text-[32px] font-bold leading-[1.25] text-[var(--color-text-primary)]">
              Niko Studio 文档站
            </h1>
            <p className="mt-3 text-[15px] leading-7 text-[var(--color-text-secondary)]">
              面向写作者与开发者的统一入口：先帮助作者完成写作、分析、修订和知识沉淀，再为开发者说明桌面架构、Gateway、API、技能、插件与工作流扩展。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[420px]">
            <StatCard label="文档分类" value={String(totalCategories)} />
            <StatCard label="文档页数" value={String(totalDocs)} />
            <StatCard label="写作主题" value={String(writingDocs)} />
            <StatCard label="API 条目" value={String(apiDocs)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">开始阅读</h2>
              <p className="mt-1 text-[13px] leading-6 text-[var(--color-text-secondary)]">
                如果你第一次接触这个项目，建议先按下面顺序浏览。
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map((item, index) => (
              <Link
                key={item.to}
                to={item.to}
                className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 no-underline transition-all duration-150 hover:-translate-y-[1px] hover:border-[var(--color-text-placeholder)] hover:shadow-[var(--shadow-sm)]"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-tint-blue)] text-[11px] font-semibold text-[var(--color-accent-blue)]">
                    {index + 1}
                  </span>
                  <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-blue)]">
                    {item.title}
                  </h3>
                </div>
                <p className="text-[12px] leading-6 text-[var(--color-text-secondary)]">{item.description}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">文档覆盖范围</h2>
          <div className="mt-4 space-y-4 text-[13px] text-[var(--color-text-secondary)]">
            <CoverageItem label="产品使用" value="安装、配置、项目创建、日常写作流" />
            <CoverageItem label="写作能力" value="技法分析、结构识别、角色画像、批评与修订" />
            <CoverageItem label="系统能力" value="图谱、世界观、素材、同步、技能、Wiki" />
            <CoverageItem label="开发者信息" value="架构说明、模块设计、数据流、API 参考" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">从创作到扩展的主路径</h2>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              文档站按真实使用路径组织：先完成创作闭环，再理解底层能力。
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {workflowSteps.map((step, index) => (
            <div key={step.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
              <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-tint-purple)] text-[11px] font-semibold text-[var(--color-accent-purple)]">
                {index + 1}
              </div>
              <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)]">{step.label}</h3>
              <p className="mt-2 text-[12px] leading-6 text-[var(--color-text-secondary)]">{step.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">推荐文档</h2>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              这些页面通常最能帮助你快速建立整体认知。
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {featuredDocs.map((page) => {
            if (!page) {
              return null;
            }

            const category = categories.find((item) => item.id === page.category);
            return (
              <Link
                key={page.id}
                to={`/${page.category}/${page.slug}`}
                className="rounded-xl border border-[var(--color-border)] p-4 no-underline transition-all duration-150 hover:border-[var(--color-text-placeholder)] hover:shadow-[var(--shadow-sm)]"
              >
                <div className="mb-2 flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]">
                  <span>{category?.icon}</span>
                  <span>{category?.name}</span>
                </div>
                <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)]">{page.title}</h3>
                <p className="mt-1 text-[12px] leading-6 text-[var(--color-text-secondary)]">{page.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">按主题浏览</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            所有分类都已经建立，下面按主题展示对应范围和文档数量。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3">
      <div className="text-[11px] text-[var(--color-text-tertiary)]">{label}</div>
      <div className="mt-1 text-[22px] font-semibold leading-none text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}

function CoverageItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--color-border-divider)] pb-4 last:border-b-0 last:pb-0">
      <div className="mb-1 text-[12px] font-medium text-[var(--color-text-primary)]">{label}</div>
      <div className="leading-6">{value}</div>
    </div>
  );
}

function CategoryCard({ category }: { category: Category }) {
  const pages = getPagesByCategory(category.id);
  const tint = tintColors[category.id] || 'bg-[var(--color-tint-gray)]';
  const previewPages = pages.slice(0, 3);

  return (
    <Link
      to={`/${category.id}`}
      className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 no-underline transition-all duration-[180ms] hover:border-[var(--color-text-placeholder)] hover:-translate-y-[2px] hover:shadow-[var(--shadow-md)]"
    >
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${tint}`}>
        <span className="text-[18px]">{category.icon}</span>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{category.name}</h3>
          <p className="text-[12px] leading-6 text-[var(--color-text-secondary)]">{category.description}</p>
        </div>
        <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-[11px] text-[var(--color-text-tertiary)]">
          {pages.length} 篇
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {previewPages.map((page) => (
          <span
            key={page.id}
            className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]"
          >
            {page.title}
          </span>
        ))}
      </div>
    </Link>
  );
}
