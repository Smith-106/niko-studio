import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getResolvedDocPages } from '../../data/inventory';

interface SearchBoxProps {
  mobile?: boolean;
  placeholder?: string;
}

interface SearchOpenDetail {
  query?: string;
}

type SearchGroupId = 'topic' | 'capability' | 'api';
type SearchReason = 'title' | 'alias' | 'category' | 'description' | 'recommended';

interface SearchResultItem {
  doc: ReturnType<typeof getResolvedDocPages>[number];
  score: number;
  group: SearchGroupId;
  reasons: SearchReason[];
}

const keywordAliases: Record<string, string[]> = {
  'common-writing-problems': ['开头弱', '对白平', '设定乱', '节奏塌', '伏笔丢'],
  'chapter-revision-playbook': ['修订', '章节修订', '改单章'],
  'outline-to-final-manuscript': ['大纲', '完稿', '长链路', '规划'],
  'output-field-glossary': ['score', 'evidence', 'suggestion', 'status', 'canon', '字段'],
  'request-lifecycle': ['调用链', '链路', '请求', 'runtime'],
  'workflow-api': ['workflow', '工作流', '编排'],
  'wiki-api': ['wiki', '设定', 'canon'],
  'agent-api': ['agent', '代理'],
  'foreshadow-tracking': ['伏笔'],
  'dialogue-analysis': ['对白', '对话'],
};

const featuredKeywords = ['开头弱', 'workflow', 'wiki', '伏笔', '对白', 'canon'];

const recommendedDocIds = [
  'chapter-revision-playbook',
  'outline-to-final-manuscript',
  'craft-analysis',
  'dialogue-analysis',
  'workflow-api',
  'wiki-api',
];

const searchGroupMeta: Array<{
  id: SearchGroupId;
  label: string;
  description: string;
}> = [
  { id: 'topic', label: '专题', description: '专题路径、指南与起步页' },
  { id: 'capability', label: '能力页', description: '写作、批评、图谱、世界观等能力说明' },
  { id: 'api', label: 'API', description: '端点、调用入口与接口参考' },
];

const searchReasonLabel: Record<SearchReason, string> = {
  title: '标题命中',
  alias: '别名命中',
  category: '分类命中',
  description: '描述命中',
  recommended: '推荐入口',
};

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function getSearchGroupId(categoryId: string): SearchGroupId {
  if (categoryId === 'api') {
    return 'api';
  }

  if (categoryId === 'guides' || categoryId === 'getting-started') {
    return 'topic';
  }

  return 'capability';
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

    const focusDesktopInput = () => {
      window.setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('[data-doc-search-input="desktop"]');
        input?.focus();
      }, 0);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) {
        return;
      }

      event.preventDefault();
      setIsOpen(true);
      focusDesktopInput();
    };

    const handleSearchOpen = (event: Event) => {
      const customEvent = event as CustomEvent<SearchOpenDetail>;
      setQuery(customEvent.detail?.query ?? '');
      setIsOpen(true);
      focusDesktopInput();
    };

    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('niko-docs:search', handleSearchOpen as EventListener);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('niko-docs:search', handleSearchOpen as EventListener);
    };
  }, [mobile]);

  const results = useMemo<SearchResultItem[]>(() => {
    if (!normalizedQuery) {
      const recommendedDocs = recommendedDocIds
        .map((id) => docs.find((doc) => doc.id === id))
        .filter(Boolean)
        .map((doc, index) => ({
          doc: doc!,
          score: recommendedDocIds.length - index,
          group: getSearchGroupId(doc!.category),
          reasons: ['recommended' as const],
        }));

      return recommendedDocs;
    }

    return docs
      .map((doc) => {
        const haystack = normalize([
          doc.title,
          doc.description,
          doc.categoryInfo.name,
          doc.categoryInfo.description,
          ...(keywordAliases[doc.id] ?? []),
        ].join(' '));

        let score = 0;
        const reasons: SearchReason[] = [];
        const titleMatched = normalize(doc.title).includes(normalizedQuery);
        const categoryMatched = normalize(doc.categoryInfo.name).includes(normalizedQuery);
        const descriptionMatched = normalize(doc.description).includes(normalizedQuery) || normalize(doc.categoryInfo.description).includes(normalizedQuery);
        const aliasMatched = (keywordAliases[doc.id] ?? []).some((keyword) => normalize(keyword).includes(normalizedQuery) || normalizedQuery.includes(normalize(keyword)));

        if (titleMatched) {
          score += 5;
          reasons.push('title');
        }
        if (categoryMatched) {
          score += 3;
          reasons.push('category');
        }
        if (haystack.includes(normalizedQuery)) {
          score += 1;
        }
        if (descriptionMatched) {
          reasons.push('description');
        }
        if (aliasMatched) {
          score += 4;
          reasons.push('alias');
        }

        return {
          doc,
          score,
          group: getSearchGroupId(doc.category),
          reasons: Array.from(new Set(reasons)),
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title, 'zh-CN'))
      .slice(0, 8);
  }, [docs, normalizedQuery]);

  const groupedResults = useMemo(() => {
    return searchGroupMeta
      .map((group) => ({
        ...group,
        items: results.filter((item) => item.group === group.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [results]);

  const totalResults = results.length;

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
            {normalizedQuery ? `找到 ${totalResults} 条结果，按专题 / 能力页 / API 分组` : '推荐入口、关键词与分组浏览'}
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {!normalizedQuery ? (
              <div className="px-3 pb-2 pt-1">
                <div className="mb-2 text-[11px] font-medium text-[var(--color-text-tertiary)]">关键词直达</div>
                <div className="flex flex-wrap gap-2">
                  {featuredKeywords.map((keyword) => (
                    <button
                      key={keyword}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setQuery(keyword);
                        setIsOpen(true);
                      }}
                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {groupedResults.length > 0 ? (
              groupedResults.map((group) => (
                <section key={group.id} className="px-1 pb-2 pt-1">
                  <div className="mb-2 flex items-center justify-between px-2">
                    <div className="text-[11px] font-medium text-[var(--color-text-tertiary)]">{group.label}</div>
                    <div className="text-[10px] text-[var(--color-text-tertiary)]">{group.description}</div>
                  </div>
                  <div className="space-y-1">
                    {group.items.map(({ doc, reasons }) => (
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
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {reasons.map((reason) => (
                            <span
                              key={reason}
                              className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]"
                            >
                              {searchReasonLabel[reason]}
                            </span>
                          ))}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
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
