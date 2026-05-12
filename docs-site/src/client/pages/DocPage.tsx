import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { categories, docPages } from '../data/inventory';
import { getDocContent } from '../data/content';

interface HeadingItem {
  id: string;
  text: string;
  level: 'h2' | 'h3';
}

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
