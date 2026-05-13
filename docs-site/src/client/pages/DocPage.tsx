import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { categories, docPages } from '../data/inventory';
import { getDocContent } from '../data/content';

interface HeadingItem {
  id: string;
  text: string;
  level: 'h2' | 'h3';
}

interface QuickLinkItem {
  label: string;
  to: string;
  kind: 'scenario' | 'endpoint' | 'glossary';
}

const categoryAudience: Record<string, string> = {
  'getting-started': '第一次接触 Niko Studio 的写作者或团队成员',
  guides: '需要快速建立路径感的写作者、开发者与维护者',
  writing: '日常进行创作分析和修订的写作者',
  graph: '需要追踪关系、伏笔与结构连接的作者或分析者',
  critic: '关注问题定位、证据和修订建议的作者',
  worldview: '需要维护长期设定一致性的作者',
  agent: '依赖自然语言入口来驱动多能力协作的用户',
  knowledge: '需要理解评分依据和知识支撑的开发者或高级作者',
  memory: '需要管理项目素材与证据来源的用户',
  desktop: '需要理解桌面工作台与 UI 入口的用户',
  sync: '关心多设备协作边界的维护者或高级用户',
  architecture: '需要理解 runtime 边界和模块职责的开发者',
  api: '需要接入、调试和验证接口边界的集成者与开发者',
};

const categoryQuickLinks: Record<string, QuickLinkItem[]> = {
  guides: [
    { label: '章节修订专题路径', to: '/guides/chapter-revision-playbook', kind: 'scenario' },
    { label: '写作 API', to: '/api/writing-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
  writing: [
    { label: '常见写作问题索引', to: '/guides/common-writing-problems', kind: 'scenario' },
    { label: '写作 API', to: '/api/writing-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
  critic: [
    { label: '章节修订专题路径', to: '/guides/chapter-revision-playbook', kind: 'scenario' },
    { label: '批评 API', to: '/api/critic-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
  graph: [
    { label: '常见写作问题索引', to: '/guides/common-writing-problems', kind: 'scenario' },
    { label: '图谱 API', to: '/api/graph-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
  worldview: [
    { label: '从大纲到完稿', to: '/guides/outline-to-final-manuscript', kind: 'scenario' },
    { label: 'Wiki API', to: '/api/wiki-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
  agent: [
    { label: '章节修订专题路径', to: '/guides/chapter-revision-playbook', kind: 'scenario' },
    { label: 'Agent API', to: '/api/agent-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
  desktop: [
    { label: '从大纲到完稿', to: '/guides/outline-to-final-manuscript', kind: 'scenario' },
    { label: 'Workspace API', to: '/api/workspace-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
  memory: [
    { label: '常见写作问题索引', to: '/guides/common-writing-problems', kind: 'scenario' },
    { label: '素材 API', to: '/api/memory-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
  api: [
    { label: '请求生命周期', to: '/guides/request-lifecycle', kind: 'scenario' },
    { label: 'Workflow API', to: '/api/workflow-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
  architecture: [
    { label: '从大纲到完稿', to: '/guides/outline-to-final-manuscript', kind: 'scenario' },
    { label: 'Gateway API', to: '/api/gateway-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
  knowledge: [
    { label: '章节修订专题路径', to: '/guides/chapter-revision-playbook', kind: 'scenario' },
    { label: '写作 API', to: '/api/writing-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
  sync: [
    { label: '能力状态矩阵', to: '/guides/capability-status', kind: 'scenario' },
    { label: '同步 API', to: '/api/sync-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
  'getting-started': [
    { label: '三维入口矩阵', to: '/guides/entry-matrix', kind: 'scenario' },
    { label: 'Workspace API', to: '/api/workspace-api', kind: 'endpoint' },
    { label: '输出字段词典', to: '/guides/output-field-glossary', kind: 'glossary' },
  ],
};

export default function DocPage() {
  const { categoryId, slug } = useParams<{ categoryId: string; slug: string }>();
  const category = categories.find((c) => c.id === categoryId);
  const page = docPages.find((p) => p.category === categoryId && p.slug === slug);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 320);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const blocks = Array.from(document.querySelectorAll('pre'));
    const cleanups: Array<() => void> = [];

    blocks.forEach((block) => {
      if (block.dataset.enhanced === 'true') {
        return;
      }

      const code = block.querySelector('code');
      if (!code) {
        return;
      }

      block.dataset.enhanced = 'true';
      block.classList.add('group', 'relative');
      if (/flowchart|sequenceDiagram|graph TD|graph LR|graph TB|subgraph/.test(code.textContent ?? '')) {
        block.classList.add('doc-mermaid-block');
        const label = document.createElement('span');
        label.textContent = 'Mermaid 图示';
        label.className = 'doc-pre-label';
        block.appendChild(label);
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '复制';
      button.className = 'absolute right-3 top-3 rounded-md border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100';

      const handleClick = async () => {
        try {
          await navigator.clipboard.writeText(code.textContent ?? '');
          const original = button.textContent;
          button.textContent = '已复制';
          window.setTimeout(() => {
            button.textContent = original;
          }, 1200);
        } catch {
          button.textContent = '复制失败';
          window.setTimeout(() => {
            button.textContent = '复制';
          }, 1200);
        }
      };

      button.addEventListener('click', handleClick);
      block.appendChild(button);
      cleanups.push(() => button.removeEventListener('click', handleClick));
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [categoryId, slug]);

  if (!category || !page) {
    return <div className="text-[var(--color-text-secondary)]">页面未找到</div>;
  }

  const siblingPages = docPages.filter((item) => item.category === category.id);
  const pageIndex = siblingPages.findIndex((item) => item.id === page.id);
  const previousPage = pageIndex > 0 ? siblingPages[pageIndex - 1] : undefined;
  const nextPage = pageIndex >= 0 && pageIndex < siblingPages.length - 1 ? siblingPages[pageIndex + 1] : undefined;

  const rawContent = getDocContent(page.id);
  const headings = useMemo(() => extractHeadings(rawContent), [rawContent]);
  const content = useMemo(() => addHeadingIds(enhanceContent(rawContent)), [rawContent]);
  const readMinutes = Math.max(1, Math.round(stripHtml(rawContent).length / 260));
  const quickLinks = categoryQuickLinks[category.id] ?? categoryQuickLinks.guides;
  const quickLinkGroups: Array<{ title: string; items: QuickLinkItem[] }> = [
    { title: 'Related scenarios', items: quickLinks.filter((item) => item.kind === 'scenario') },
    { title: 'Related endpoints', items: quickLinks.filter((item) => item.kind === 'endpoint') },
    { title: 'Field glossary', items: quickLinks.filter((item) => item.kind === 'glossary') },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-tertiary)]">
        <Link to="/" className="no-underline text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
          首页
        </Link>
        <span>/</span>
        <Link to={`/${category.id}`} className="no-underline text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
          {category.name}
        </Link>
        <span>/</span>
        <span className="text-[var(--color-text-secondary)]">{page.title}</span>
      </div>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[760px]">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]">
              <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1">{category.name}</span>
              <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1">阅读约 {readMinutes} 分钟</span>
              <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1">共 {headings.length || 1} 个小节</span>
              <span className="rounded-full bg-[var(--color-tint-blue)] px-2.5 py-1 text-[var(--color-accent-blue)]">含图示与交叉链接</span>
            </div>
            <h1 className="text-[28px] font-bold text-[var(--color-text-primary)]">{page.title}</h1>
            <p className="mt-3 text-[14px] leading-7 text-[var(--color-text-secondary)]">{page.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:min-w-[280px]">
            <MetaCard label="所在分类" value={category.name} />
            <MetaCard label="分类序号" value={`${pageIndex + 1} / ${siblingPages.length}`} />
            <MetaCard label="上一篇" value={previousPage?.title ?? '无'} />
            <MetaCard label="下一篇" value={nextPage?.title ?? '无'} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]">
          <div className="prose prose-sm max-w-none">
            <div
              className="text-[var(--color-text-primary)] leading-relaxed [&_h2]:scroll-mt-24 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:border-b [&_h2]:border-[var(--color-border-divider)] [&_h2]:pb-2 [&_h3]:scroll-mt-24 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:text-[13px] [&_p]:text-[var(--color-text-secondary)] [&_p]:leading-7 [&_p]:mb-4 [&_ul]:text-[13px] [&_ul]:text-[var(--color-text-secondary)] [&_ul]:leading-7 [&_ul]:mb-4 [&_ul]:pl-5 [&_ol]:text-[13px] [&_ol]:text-[var(--color-text-secondary)] [&_ol]:leading-7 [&_ol]:mb-4 [&_ol]:pl-5 [&_li]:mb-1.5 [&_code]:text-[12px] [&_code]:bg-[var(--color-bg-secondary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-[#2D2A26] [&_pre]:text-[#E8E5DE] [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-[12px] [&_pre]:mb-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-[var(--color-border)] [&_table]:mb-5 [&_thead]:bg-[var(--color-bg-secondary)] [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-semibold [&_th]:text-[var(--color-text-primary)] [&_td]:border-t [&_td]:border-[var(--color-border-divider)] [&_td]:px-4 [&_td]:py-3 [&_td]:text-[12px] [&_td]:text-[var(--color-text-secondary)] [&_.doc-callout]:my-5 [&_.doc-callout]:rounded-xl [&_.doc-callout]:border [&_.doc-callout]:border-[var(--color-border)] [&_.doc-callout]:bg-[var(--color-bg-primary)] [&_.doc-callout]:p-4 [&_.doc-callout]:shadow-[var(--shadow-sm)] [&_.doc-callout-title]:mb-2 [&_.doc-callout-title]:text-[12px] [&_.doc-callout-title]:font-semibold [&_.doc-callout-title]:text-[var(--color-text-primary)] [&_.doc-callout_p]:mb-0 [&_.doc-endpoint]:my-5 [&_.doc-endpoint]:rounded-xl [&_.doc-endpoint]:border [&_.doc-endpoint]:border-[var(--color-border)] [&_.doc-endpoint]:bg-[var(--color-bg-primary)] [&_.doc-endpoint]:p-4 [&_.doc-endpoint-header]:mb-2 [&_.doc-endpoint-header]:flex [&_.doc-endpoint-header]:items-center [&_.doc-endpoint-header]:gap-2 [&_.doc-endpoint-method]:rounded-md [&_.doc-endpoint-method]:bg-[var(--color-tint-blue)] [&_.doc-endpoint-method]:px-2 [&_.doc-endpoint-method]:py-1 [&_.doc-endpoint-method]:text-[11px] [&_.doc-endpoint-method]:font-semibold [&_.doc-endpoint-method]:text-[var(--color-accent-blue)] [&_.doc-endpoint-path]:font-mono [&_.doc-endpoint-path]:text-[12px] [&_.doc-endpoint-path]:text-[var(--color-text-primary)]"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        </article>

        <aside className="space-y-4 xl:sticky xl:top-[88px] xl:self-start">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">关联入口</h2>
              <span className="rounded-full bg-[var(--color-tint-blue)] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-accent-blue)]">
                Related
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {quickLinkGroups.map((group) => (
                <div key={group.title}>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                    {group.title}
                  </div>
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <QuickLinkCard key={`${item.kind}-${item.to}`} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">本页目录</h2>
            {headings.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {headings.map((heading) => (
                  <a
                    key={heading.id}
                    href={`#${heading.id}`}
                    className={`no-underline text-[12px] leading-6 ${heading.level === 'h3' ? 'pl-3 text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]'}`}
                  >
                    {heading.text}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[12px] leading-6 text-[var(--color-text-secondary)]">当前页面没有可提取的章节标题。</p>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">适合谁读</h2>
            <p className="mt-3 text-[12px] leading-6 text-[var(--color-text-secondary)]">
              {categoryAudience[category.id] ?? '需要理解这个模块边界和用途的读者'}
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">继续阅读</h2>
            <div className="mt-3 space-y-3">
              {previousPage ? (
                <AdjacentLink label="上一篇" to={`/${category.id}/${previousPage.slug}`} title={previousPage.title} />
              ) : null}
              {nextPage ? (
                <AdjacentLink label="下一篇" to={`/${category.id}/${nextPage.slug}`} title={nextPage.title} />
              ) : null}
              <AdjacentLink label="返回分类" to={`/${category.id}`} title={`${category.name} 总览`} />
            </div>
          </section>
        </aside>
      </div>

      {showBackToTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-[12px] text-[var(--color-text-primary)] shadow-[var(--shadow-md)] transition-colors hover:bg-[var(--color-bg-hover)]"
        >
          返回顶部
        </button>
      ) : null}
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3">
      <div className="text-[11px] text-[var(--color-text-tertiary)]">{label}</div>
      <div className="mt-1 text-[13px] font-medium leading-6 text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}

function AdjacentLink({ label, to, title }: { label: string; to: string; title: string }) {
  return (
    <Link
      to={to}
      className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 no-underline transition-colors hover:bg-[var(--color-bg-hover)]"
    >
      <div className="text-[11px] text-[var(--color-text-tertiary)]">{label}</div>
      <div className="mt-1 text-[12px] leading-6 text-[var(--color-text-primary)]">{title}</div>
    </Link>
  );
}

function QuickLinkCard({ item }: { item: QuickLinkItem }) {
  const meta: Record<QuickLinkItem['kind'], { chip: string; chipClass: string }> = {
    scenario: {
      chip: 'Scenario',
      chipClass: 'bg-[var(--color-tint-purple)] text-[var(--color-accent-purple)]',
    },
    endpoint: {
      chip: 'Endpoint',
      chipClass: 'bg-[var(--color-tint-yellow)] text-[var(--color-accent-orange)]',
    },
    glossary: {
      chip: 'Glossary',
      chipClass: 'bg-[var(--color-tint-green)] text-[var(--color-accent-green)]',
    },
  };

  return (
    <Link
      to={item.to}
      className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 no-underline transition-all duration-150 hover:-translate-y-[1px] hover:border-[var(--color-text-placeholder)] hover:shadow-[var(--shadow-sm)]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium leading-6 text-[var(--color-text-primary)]">{item.label}</span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${meta[item.kind].chipClass}`}>
          {meta[item.kind].chip}
        </span>
      </div>
      <div className="text-[11px] text-[var(--color-text-tertiary)]">
        {item.kind === 'scenario' ? '关联场景' : item.kind === 'endpoint' ? '关联端点' : '字段词典'}
      </div>
    </Link>
  );
}

function extractHeadings(html: string): HeadingItem[] {
  const matches = Array.from(html.matchAll(/<(h2|h3)>(.*?)<\/\1>/g));
  return matches.map(([_, level, text]) => ({
    id: slugify(stripHtml(text)),
    text: stripHtml(text),
    level: level as 'h2' | 'h3',
  }));
}

function addHeadingIds(html: string): string {
  return html.replace(/<(h2|h3)>(.*?)<\/\1>/g, (_, level: string, text: string) => {
    const plainText = stripHtml(text);
    const id = slugify(plainText);
    return `<${level} id="${id}">${text}</${level}>`;
  });
}

function enhanceContent(html: string): string {
  return rewriteRootLinks(html)
    .replace(/\b(Supported|Partial|Experimental|Historical|Roadmap|supported|partial|experimental|historical|roadmap)\b/g, (match: string) => {
      return `<span class="doc-status-chip" data-status="${match.toLowerCase()}">${match}</span>`;
    })
    .replace(/<p>(注意点|使用建议|推荐使用方式|最佳实践|为什么这很重要|为什么它重要|为什么 MCP 重要|适用场景|常见问题|下一步推荐)([^<]*)<\/p>/g, (_, title: string, rest: string) => {
      return `<div class="doc-callout"><div class="doc-callout-title">${title}</div><p>${rest.trim()}</p></div>`;
    })
    .replace(/<pre><code>(GET|POST|PUT|DELETE|PATCH)\s+([^\n<]+)([\s\S]*?)<\/code><\/pre>/g, (_, method: string, path: string, rest: string) => {
      const details = rest.trim();
      const detailHtml = details ? `<pre><code>${details}</code></pre>` : '';
      return `<div class="doc-endpoint"><div class="doc-endpoint-header"><span class="doc-endpoint-method">${method}</span><span class="doc-endpoint-path">${path.trim()}</span></div>${detailHtml}</div>`;
    });
}

function rewriteRootLinks(html: string): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (!basePath) {
    return html;
  }

  return html.replace(/href="\/(?!\/)/g, `href="${basePath}/`);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w一-龥-\s]/g, '')
    .replace(/\s+/g, '-');
}
