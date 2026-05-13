import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getResolvedDocPages } from '../../data/inventory';

interface SearchBoxProps {
  mobile?: boolean;
  placeholder?: string;
}

interface SearchOpenDetail {
  query?: string;
}

type SearchGroupId = 'topic' | 'capability' | 'api';
type PinnedBucketId = 'writing' | 'api' | 'canon';
type SearchReason = 'title' | 'alias' | 'category' | 'description' | 'recommended';
type SearchDoc = ReturnType<typeof getResolvedDocPages>[number];

interface SearchPreset {
  label: string;
  query: string;
  hint: string;
}

interface RecentDocItem {
  id: string;
  path: string;
  bucket?: PinnedBucketId;
}

interface PinnedResolvedItem {
  doc: SearchDoc;
  bucket: PinnedBucketId;
}

interface SearchResultItem {
  doc: SearchDoc;
  score: number;
  group: SearchGroupId;
  reasons: SearchReason[];
}

interface SearchMatchSegment {
  text: string;
  highlighted: boolean;
}

interface EmptyStateSuggestionSet {
  hint: string;
  docIds: string[];
}

interface KeyboardSearchItem {
  doc: SearchDoc;
  source: 'result' | 'fallback';
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

const searchPresets: SearchPreset[] = [
  { label: '写作问题', query: '开头弱', hint: '开头、对白、节奏、伏笔' },
  { label: 'API 接入', query: 'workflow', hint: 'workflow、wiki、agent、workspace' },
  { label: '设定一致性', query: 'canon', hint: 'canon、wiki、设定' },
  { label: '章节修订', query: '修订', hint: '批评、修订路径、改单章' },
];

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

const allSearchGroupId: SearchGroupId | 'all' = 'all';

const searchReasonLabel: Record<SearchReason, string> = {
  title: '标题命中',
  alias: '别名命中',
  category: '分类命中',
  description: '描述命中',
  recommended: '推荐入口',
};

const searchGroupLabel: Record<SearchGroupId, string> = {
  topic: '专题',
  capability: '能力页',
  api: 'API',
};

const pinnedBucketMeta: Array<{
  id: PinnedBucketId;
  label: string;
  description: string;
}> = [
  { id: 'writing', label: '写作用', description: '修订、分析、章节工作流' },
  { id: 'api', label: 'API 用', description: '接口、链路、集成入口' },
  { id: 'canon', label: '设定用', description: '世界观、素材、设定沉淀' },
];

const PINNED_DOCS_KEY = 'niko-docs:pinned-docs';
const PINNED_GROUP_COLLAPSE_KEY = 'niko-docs:pinned-groups-collapsed';
const RECENT_QUERIES_KEY = 'niko-docs:recent-queries';
const RECENT_DOCS_KEY = 'niko-docs:recent-docs';
const MAX_PINNED_ITEMS = 6;
const MAX_RECENT_ITEMS = 4;

const emptyStateSuggestionSets: Array<{
  matchers: string[];
  hint: string;
  docIds: string[];
}> = [
  {
    matchers: ['workflow', 'api', '接口', 'agent', 'workspace', 'wiki', 'canon', '调用'],
    hint: '像是接入或链路问题，先看这些稳定入口。',
    docIds: ['workflow-api', 'workspace-api', 'wiki-api'],
  },
  {
    matchers: ['开头', '对白', '节奏', '伏笔', '人物', '设定', '剧情', '修订'],
    hint: '像是写作诊断问题，先从问题索引和对应能力页切入。',
    docIds: ['common-writing-problems', 'craft-analysis', 'dialogue-analysis', 'foreshadow-tracking'],
  },
];

const defaultEmptyStateSuggestionSet: EmptyStateSuggestionSet = {
  hint: '先从总览路径进入，再收窄到能力页或 API。',
  docIds: ['capability-routing', 'request-lifecycle', 'chapter-revision-playbook'],
};

const searchHighlightRingClass = 'bg-[var(--color-bg-hover)] ring-2 ring-[var(--color-accent-blue)] ring-offset-1 ring-offset-[var(--color-bg-card)]';

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function resolveEmptyStateSuggestion(query: string): EmptyStateSuggestionSet {
  const normalized = normalize(query);
  return emptyStateSuggestionSets.find((item) => item.matchers.some((matcher) => normalized.includes(normalize(matcher)))) ?? defaultEmptyStateSuggestionSet;
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

function inferPinnedBucket(categoryId: string): PinnedBucketId {
  if (categoryId === 'api' || categoryId === 'architecture' || categoryId === 'desktop' || categoryId === 'agent') {
    return 'api';
  }

  if (categoryId === 'worldview' || categoryId === 'memory' || categoryId === 'sync') {
    return 'canon';
  }

  return 'writing';
}

function buildHighlightSegments(text: string, query: string): SearchMatchSegment[] {
  if (!query.trim()) {
    return [{ text, highlighted: false }];
  }

  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase().trim();
  const segments: SearchMatchSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
    if (matchIndex < 0) {
      segments.push({ text: text.slice(cursor), highlighted: false });
      break;
    }

    if (matchIndex > cursor) {
      segments.push({ text: text.slice(cursor, matchIndex), highlighted: false });
    }

    segments.push({
      text: text.slice(matchIndex, matchIndex + normalizedQuery.length),
      highlighted: true,
    });
    cursor = matchIndex + normalizedQuery.length;
  }

  return segments.filter((segment) => segment.text.length > 0);
}

function renderHighlightedText(text: string, query: string, keyPrefix: string) {
  const segments = buildHighlightSegments(text, query);
  return segments.map((segment, index) => (
    segment.highlighted ? (
      <mark
        key={`${keyPrefix}-${index}`}
        className="rounded-sm bg-[var(--color-tint-yellow)] px-0.5 text-[var(--color-text-primary)]"
      >
        {segment.text}
      </mark>
    ) : (
      <span key={`${keyPrefix}-${index}`}>{segment.text}</span>
    )
  ));
}

export function SearchBox({ mobile = false, placeholder = '搜索文档、分类或 API...' }: SearchBoxProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suppressNextFocusOpenRef = useRef(false);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [pinnedDocIds, setPinnedDocIds] = useState<RecentDocItem[]>([]);
  const [collapsedPinnedGroups, setCollapsedPinnedGroups] = useState<PinnedBucketId[]>([]);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [recentDocIds, setRecentDocIds] = useState<RecentDocItem[]>([]);
  const [activeFacet, setActiveFacet] = useState<SearchGroupId | 'all'>(allSearchGroupId);
  const docs = useMemo(() => getResolvedDocPages(), []);
  const normalizedQuery = normalize(query);
  const searchPanelId = mobile ? 'doc-search-panel-mobile' : 'doc-search-panel-desktop';
  const searchHelpId = `${searchPanelId}-help`;
  const searchStatusId = `${searchPanelId}-status`;

  const hydrateRecentState = () => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const storedPinnedDocs = JSON.parse(window.localStorage.getItem(PINNED_DOCS_KEY) ?? '[]');
      const storedCollapsedPinnedGroups = JSON.parse(window.localStorage.getItem(PINNED_GROUP_COLLAPSE_KEY) ?? '[]');
      const storedQueries = JSON.parse(window.localStorage.getItem(RECENT_QUERIES_KEY) ?? '[]');
      const storedDocs = JSON.parse(window.localStorage.getItem(RECENT_DOCS_KEY) ?? '[]');
      setPinnedDocIds(Array.isArray(storedPinnedDocs) ? storedPinnedDocs.filter((item): item is RecentDocItem => !!item && typeof item.id === 'string' && typeof item.path === 'string').slice(0, MAX_PINNED_ITEMS) : []);
      setCollapsedPinnedGroups(Array.isArray(storedCollapsedPinnedGroups) ? storedCollapsedPinnedGroups.filter((item): item is PinnedBucketId => pinnedBucketMeta.some((bucket) => bucket.id === item)) : []);
      setRecentQueries(Array.isArray(storedQueries) ? storedQueries.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_ITEMS) : []);
      setRecentDocIds(Array.isArray(storedDocs) ? storedDocs.filter((item): item is RecentDocItem => !!item && typeof item.id === 'string' && typeof item.path === 'string').slice(0, MAX_RECENT_ITEMS) : []);
    } catch {
      setPinnedDocIds([]);
      setCollapsedPinnedGroups([]);
      setRecentQueries([]);
      setRecentDocIds([]);
    }
  };

  useEffect(() => {
    hydrateRecentState();
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setQuery('');
    setActiveResultIndex(-1);
    setActiveFacet(allSearchGroupId);
  }, [location.pathname]);

  useEffect(() => {
    if (mobile) {
      return;
    }

    const focusDesktopInput = () => {
      window.setTimeout(() => {
        const input = inputRef.current ?? document.querySelector<HTMLInputElement>('[data-doc-search-input="desktop"]');
        input?.focus();
        input?.select();
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
      if (customEvent.detail?.query?.trim()) {
        storeRecentQuery(customEvent.detail.query);
      }
      hydrateRecentState();
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

  useEffect(() => {
    if (!normalizedQuery) {
      setActiveFacet(allSearchGroupId);
    }
  }, [normalizedQuery]);

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

  const facetOptions = useMemo(() => {
    const counts = searchGroupMeta.reduce<Record<SearchGroupId, number>>((accumulator, group) => {
      accumulator[group.id] = results.filter((item) => item.group === group.id).length;
      return accumulator;
    }, { topic: 0, capability: 0, api: 0 });

    return [
      {
        id: allSearchGroupId,
        label: '全部',
        count: results.length,
      },
      ...searchGroupMeta.map((group) => ({
        id: group.id,
        label: group.label,
        count: counts[group.id],
      })),
    ];
  }, [results]);

  const filteredResults = useMemo(() => {
    if (activeFacet === allSearchGroupId) {
      return results;
    }

    return results.filter((item) => item.group === activeFacet);
  }, [activeFacet, results]);

  const groupedResults = useMemo(() => {
    return searchGroupMeta
      .map((group) => ({
        ...group,
        items: filteredResults.filter((item) => item.group === group.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredResults]);

  const matchedResultCount = results.length;
  const totalResults = filteredResults.length;
  const emptyStateSuggestions = useMemo(() => {
    if (!normalizedQuery || matchedResultCount > 0) {
      return null;
    }

    const suggestion = resolveEmptyStateSuggestion(query);
    return {
      hint: suggestion.hint,
      docs: suggestion.docIds
        .map((id) => docs.find((doc) => doc.id === id))
        .filter((doc): doc is SearchDoc => Boolean(doc)),
    };
  }, [docs, matchedResultCount, normalizedQuery, query]);
  const emptyFacetState = useMemo(() => {
    if (!normalizedQuery || activeFacet === allSearchGroupId || matchedResultCount === 0 || totalResults > 0) {
      return null;
    }

    const activeGroup = searchGroupMeta.find((group) => group.id === activeFacet);
    return {
      label: activeGroup?.label ?? '当前分面',
      total: matchedResultCount,
    };
  }, [activeFacet, matchedResultCount, normalizedQuery, totalResults]);
  const pinnedDocs = useMemo<PinnedResolvedItem[]>(() => {
    return pinnedDocIds
      .map((item) => {
        const doc = docs.find((candidate) => candidate.id === item.id && candidate.path === item.path);
        if (!doc) {
          return null;
        }

        return {
          doc,
          bucket: item.bucket ?? inferPinnedBucket(doc.category),
        };
      })
      .filter((item): item is PinnedResolvedItem => Boolean(item))
      .slice(0, MAX_PINNED_ITEMS);
  }, [docs, pinnedDocIds]);
  const pinnedDocGroups = useMemo(() => {
    return pinnedBucketMeta
      .map((bucket) => ({
        ...bucket,
        items: pinnedDocs.filter((item) => item.bucket === bucket.id),
      }))
      .filter((bucket) => bucket.items.length > 0);
  }, [pinnedDocs]);
  const recentDocs = useMemo(() => {
    return recentDocIds
      .map((item) => docs.find((doc) => doc.id === item.id && doc.path === item.path))
      .filter((doc): doc is SearchDoc => Boolean(doc))
      .slice(0, MAX_RECENT_ITEMS);
  }, [docs, recentDocIds]);
  const keyboardItems = useMemo<KeyboardSearchItem[]>(() => {
    if (!normalizedQuery) {
      return [];
    }

    if (filteredResults.length > 0) {
      return filteredResults.map((item) => ({ doc: item.doc, source: 'result' as const }));
    }

    return (emptyStateSuggestions?.docs ?? []).map((doc) => ({ doc, source: 'fallback' as const }));
  }, [emptyStateSuggestions, filteredResults, normalizedQuery]);
  const keyboardIndexByDocId = useMemo(() => {
    return new Map(keyboardItems.map((item, index) => [item.doc.id, index]));
  }, [keyboardItems]);
  const activeKeyboardItem = activeResultIndex >= 0 ? keyboardItems[activeResultIndex] : null;
  const activeKeyboardDocId = activeKeyboardItem?.doc.id ?? null;

  const isPinnedDoc = (docId: string) => pinnedDocIds.some((item) => item.id === docId);

  const storeRecentQuery = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || typeof window === 'undefined') {
      return;
    }

    setRecentQueries((current) => {
      const next = [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, MAX_RECENT_ITEMS);
      window.localStorage.setItem(RECENT_QUERIES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const storeRecentDoc = (docId: string, path: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    setRecentDocIds((current) => {
      const next = [{ id: docId, path }, ...current.filter((item) => item.id !== docId)].slice(0, MAX_RECENT_ITEMS);
      window.localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const persistPinnedDocIds = (next: RecentDocItem[]) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (next.length > 0) {
      window.localStorage.setItem(PINNED_DOCS_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(PINNED_DOCS_KEY);
    }
  };

  const buildPinnedBuckets = (items: RecentDocItem[]) => {
    const buckets: Record<PinnedBucketId, RecentDocItem[]> = {
      writing: [],
      api: [],
      canon: [],
    };

    items.forEach((item) => {
      const doc = docs.find((candidate) => candidate.id === item.id && candidate.path === item.path);
      if (!doc) {
        return;
      }

      const bucket = item.bucket ?? inferPinnedBucket(doc.category);
      buckets[bucket].push(item);
    });

    return buckets;
  };

  const flattenPinnedBuckets = (buckets: Record<PinnedBucketId, RecentDocItem[]>) => {
    return pinnedBucketMeta
      .flatMap((bucket) => buckets[bucket.id])
      .slice(0, MAX_PINNED_ITEMS);
  };

  const openDoc = (doc: SearchDoc, trackedQuery = query) => {
    storeRecentDoc(doc.id, doc.path);
    if (trackedQuery.trim()) {
      storeRecentQuery(trackedQuery);
    }
    setIsOpen(false);
    navigate(doc.path);
  };

  const closeSearchPanel = (options?: { restoreFocus?: boolean; selectText?: boolean }) => {
    const { restoreFocus = false, selectText = false } = options ?? {};
    setIsOpen(false);
    setActiveResultIndex(-1);

    if (!restoreFocus || typeof window === 'undefined') {
      return;
    }

    suppressNextFocusOpenRef.current = true;
    window.setTimeout(() => {
      inputRef.current?.focus();
      if (selectText) {
        inputRef.current?.select();
      }
      window.setTimeout(() => {
        suppressNextFocusOpenRef.current = false;
      }, 0);
    }, 0);
  };

  const moveActiveResult = (direction: 'next' | 'prev') => {
    if (keyboardItems.length === 0) {
      return;
    }

    setActiveResultIndex((current) => {
      if (current < 0) {
        return direction === 'next' ? 0 : keyboardItems.length - 1;
      }

      return direction === 'next'
        ? (current + 1) % keyboardItems.length
        : (current - 1 + keyboardItems.length) % keyboardItems.length;
    });
  };

  const togglePinnedDoc = (doc: SearchDoc) => {
    setPinnedDocIds((current) => {
      const exists = current.some((item) => item.id === doc.id);
      if (exists) {
        const next = current.filter((item) => item.id !== doc.id);
        persistPinnedDocIds(next);
        return next;
      }

      const item = { id: doc.id, path: doc.path };
      const buckets = buildPinnedBuckets(current.filter((entry) => entry.id !== doc.id));
      const previousEntry = current.find((entry) => entry.id === doc.id && entry.path === doc.path);
      const bucket = previousEntry?.bucket ?? inferPinnedBucket(doc.category);
      buckets[bucket] = [{ ...item, bucket }, ...buckets[bucket]].slice(0, MAX_PINNED_ITEMS);
      const next = flattenPinnedBuckets(buckets);
      persistPinnedDocIds(next);
      return next;
    });
  };

  const clearPinnedDocs = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(PINNED_DOCS_KEY);
    setPinnedDocIds([]);
  };

  const togglePinnedGroupCollapsed = (bucket: PinnedBucketId) => {
    setCollapsedPinnedGroups((current) => {
      const next = current.includes(bucket)
        ? current.filter((item) => item !== bucket)
        : [...current, bucket];

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PINNED_GROUP_COLLAPSE_KEY, JSON.stringify(next));
      }

      return next;
    });
  };

  const reorderPinnedDocs = (docId: string, bucket: PinnedBucketId, direction: 'top' | 'up' | 'down') => {
    setPinnedDocIds((current) => {
      const buckets = buildPinnedBuckets(current);
      const currentBucketItems = [...buckets[bucket]];
      const index = currentBucketItems.findIndex((item) => item.id === docId);
      if (index < 0) {
        return current;
      }

      const [target] = currentBucketItems.splice(index, 1);
      if (!target) {
        return current;
      }

      let nextIndex = index;
      if (direction === 'top') {
        nextIndex = 0;
      } else if (direction === 'up') {
        nextIndex = Math.max(0, index - 1);
      } else if (direction === 'down') {
        nextIndex = Math.min(currentBucketItems.length, index + 1);
      }

      currentBucketItems.splice(nextIndex, 0, target);
      buckets[bucket] = currentBucketItems;
      const next = flattenPinnedBuckets(buckets);
      persistPinnedDocIds(next);
      return next;
    });
  };

  const movePinnedDocToBucket = (docId: string, targetBucket: PinnedBucketId) => {
    setPinnedDocIds((current) => {
      const currentBuckets = buildPinnedBuckets(current);
      const sourceBucket = pinnedBucketMeta.find((bucket) => currentBuckets[bucket.id].some((item) => item.id === docId))?.id;
      if (!sourceBucket) {
        return current;
      }

      const sourceItems = currentBuckets[sourceBucket];
      const itemIndex = sourceItems.findIndex((item) => item.id === docId);
      if (itemIndex < 0) {
        return current;
      }

      const [item] = sourceItems.splice(itemIndex, 1);
      if (!item) {
        return current;
      }

      const nextItem: RecentDocItem = { ...item, bucket: targetBucket };
      currentBuckets[targetBucket] = [nextItem, ...currentBuckets[targetBucket].filter((entry) => entry.id !== docId)].slice(0, MAX_PINNED_ITEMS);
      currentBuckets[sourceBucket] = sourceItems.filter((entry) => entry.id !== docId);

      const next = flattenPinnedBuckets(currentBuckets);
      persistPinnedDocIds(next);
      return next;
    });
  };

  const clearRecentQueries = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(RECENT_QUERIES_KEY);
    setRecentQueries([]);
  };

  const clearRecentDocs = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(RECENT_DOCS_KEY);
    setRecentDocIds([]);
  };

  const wrapperClass = mobile
    ? 'relative w-full md:hidden'
    : 'relative hidden w-full max-w-[420px] md:block';
  const searchStatusMessage = normalizedQuery
    ? `找到 ${matchedResultCount} 条结果；当前分面显示 ${totalResults} 条。可用上下箭头浏览并按 Enter 打开。`
    : '推荐入口、关键词与分组浏览。可用 Tab 在搜索面板操作间移动。';

  useEffect(() => {
    if (!isOpen || !normalizedQuery) {
      setActiveResultIndex(-1);
      return;
    }

    setActiveResultIndex(keyboardItems.length > 0 ? 0 : -1);
  }, [isOpen, keyboardItems.length, normalizedQuery]);

  useEffect(() => {
    if (!isOpen || !activeKeyboardDocId || typeof window === 'undefined') {
      return;
    }

    const activeElement = window.document.getElementById(`${searchPanelId}-option-${activeKeyboardDocId}`);
    activeElement?.scrollIntoView({ block: 'nearest' });
  }, [activeKeyboardDocId, isOpen, searchPanelId]);

  return (
    <div
      className={wrapperClass}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        closeSearchPanel({ restoreFocus: true });
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <p id={searchHelpId} className="sr-only">
        输入关键词后，使用上下箭头浏览结果，Enter 打开，Escape 关闭，Tab 在搜索面板操作间移动。
      </p>
      <p id={searchStatusId} className="sr-only" aria-live="polite" aria-atomic="true">
        {searchStatusMessage}
      </p>
      <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 focus-within:border-[var(--color-text-placeholder)]">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[var(--color-text-tertiary)]">
          <path d="M11.5 11.5L15 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <input
          ref={inputRef}
          data-doc-search-input={mobile ? 'mobile' : 'desktop'}
          value={query}
          role="combobox"
          aria-label="文档搜索"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls={searchPanelId}
          aria-expanded={isOpen}
          aria-activedescendant={activeKeyboardDocId ? `${searchPanelId}-option-${activeKeyboardDocId}` : undefined}
          aria-describedby={`${searchHelpId} ${searchStatusId}`}
          onFocus={() => {
            hydrateRecentState();
            if (suppressNextFocusOpenRef.current) {
              suppressNextFocusOpenRef.current = false;
              return;
            }
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setIsOpen(true);
              moveActiveResult('next');
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setIsOpen(true);
              moveActiveResult('prev');
              return;
            }

            if (event.key === 'Enter' && activeKeyboardItem) {
              event.preventDefault();
              openDoc(activeKeyboardItem.doc);
              return;
            }

            if (event.key === 'Enter' && query.trim()) {
              storeRecentQuery(query);
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
        <div
          id={searchPanelId}
          role="region"
          aria-label="搜索面板"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--shadow-lg)]"
        >
          <div
            className="border-b border-[var(--color-border-divider)] px-4 py-3 text-[11px] text-[var(--color-text-tertiary)]"
            data-search-status={mobile ? 'mobile' : 'desktop'}
          >
            {normalizedQuery ? `总命中 ${matchedResultCount} 条；当前分面 ${totalResults} 条，可用 ↑ ↓ 与 Enter 快速打开` : '推荐入口、关键词与分组浏览'}
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {!normalizedQuery ? (
              <div className="px-3 pb-2 pt-1">
                {recentQueries.length > 0 ? (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-3" data-recent-query-section="true">
                      <div className="text-[11px] font-medium text-[var(--color-text-tertiary)]">最近使用</div>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={clearRecentQueries}
                        className="text-[10px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                        aria-label="清空最近使用"
                      >
                        清空
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentQueries.map((recentQuery) => (
                        <button
                          key={recentQuery}
                          data-recent-query-item={recentQuery}
                          type="button"
                          aria-label={`使用最近搜索 ${recentQuery}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setQuery(recentQuery);
                            storeRecentQuery(recentQuery);
                            setIsOpen(true);
                          }}
                          className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                        >
                          {recentQuery}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                {recentDocs.length > 0 ? (
                  <>
                    <div className="mb-2 mt-4 flex items-center justify-between gap-3" data-recent-doc-section="true">
                      <div className="text-[11px] font-medium text-[var(--color-text-tertiary)]">最近点击</div>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={clearRecentDocs}
                        className="text-[10px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                        aria-label="清空最近点击"
                      >
                        清空
                      </button>
                    </div>
                    <div className="grid gap-2">
                      {recentDocs.map((doc) => (
                        <div
                          key={doc.id}
                          data-recent-doc-item={doc.id}
                          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 transition-colors hover:bg-[var(--color-bg-hover)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <Link
                              to={doc.path}
                              aria-label={`打开最近文档 ${doc.title}`}
                              className="min-w-0 flex-1 no-underline"
                              onClick={() => {
                                storeRecentDoc(doc.id, doc.path);
                                setIsOpen(false);
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[12px] font-medium text-[var(--color-text-primary)]">{doc.title}</div>
                                <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                                  {searchGroupLabel[getSearchGroupId(doc.category)]}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{doc.categoryInfo.name}</div>
                            </Link>
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => togglePinnedDoc(doc)}
                              className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                              aria-label={`${isPinnedDoc(doc.id) ? '取消收藏' : '收藏'} ${doc.title}`}
                            >
                              {isPinnedDoc(doc.id) ? '已收藏' : '收藏'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                <div className="mb-2 mt-4 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-medium text-[var(--color-text-tertiary)]">固定入口 / 收藏入口</div>
                  {pinnedDocs.length > 0 ? (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={clearPinnedDocs}
                      className="text-[10px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                      aria-label="清空固定入口"
                    >
                      清空
                    </button>
                  ) : null}
                </div>
                {pinnedDocs.length > 0 ? (
                  <div className="space-y-3">
                    {pinnedDocGroups.map((group) => (
                      <section key={group.id} data-pinned-group={group.id}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] font-medium text-[var(--color-text-tertiary)]">
                              {group.label} · {group.items.length} / {MAX_PINNED_ITEMS}
                            </div>
                            <div className="text-[10px] text-[var(--color-text-tertiary)]">{group.description}</div>
                          </div>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => togglePinnedGroupCollapsed(group.id)}
                            className="text-[10px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                            aria-label={`${collapsedPinnedGroups.includes(group.id) ? '展开' : '折叠'} ${group.label}`}
                          >
                            {collapsedPinnedGroups.includes(group.id) ? '展开' : '折叠'}
                          </button>
                        </div>
                        {!collapsedPinnedGroups.includes(group.id) ? (
                          <div className="grid gap-2">
                            {group.items.map(({ doc, bucket }, index) => (
                              <div
                                key={`pinned-${doc.id}`}
                                data-pinned-item={doc.id}
                                data-pinned-bucket={bucket}
                                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 transition-colors hover:bg-[var(--color-bg-hover)]"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <Link
                                    to={doc.path}
                                    aria-label={`打开固定文档 ${doc.title}`}
                                    className="min-w-0 flex-1 no-underline"
                                    onClick={() => {
                                      storeRecentDoc(doc.id, doc.path);
                                      setIsOpen(false);
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-[12px] font-medium text-[var(--color-text-primary)]">{doc.title}</div>
                                      <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                                        {searchGroupLabel[getSearchGroupId(doc.category)]}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{doc.categoryInfo.name}</div>
                                  </Link>
                                  <div className="flex flex-col items-end gap-1">
                                    <select
                                      value={bucket}
                                      onChange={(event) => movePinnedDocToBucket(doc.id, event.target.value as PinnedBucketId)}
                                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1 text-[10px] text-[var(--color-text-tertiary)] outline-none"
                                      aria-label={`调整分组 ${doc.title}`}
                                    >
                                      {pinnedBucketMeta.map((bucketOption) => (
                                        <option key={bucketOption.id} value={bucketOption.id}>
                                          {bucketOption.label}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => reorderPinnedDocs(doc.id, bucket, 'top')}
                                        className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                                        aria-label={`置顶 ${doc.title}`}
                                        disabled={index === 0}
                                      >
                                        置顶
                                      </button>
                                      <button
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => reorderPinnedDocs(doc.id, bucket, 'up')}
                                        className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                                        aria-label={`上移 ${doc.title}`}
                                        disabled={index === 0}
                                      >
                                        上移
                                      </button>
                                      <button
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => reorderPinnedDocs(doc.id, bucket, 'down')}
                                        className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                                        aria-label={`下移 ${doc.title}`}
                                        disabled={index === group.items.length - 1}
                                      >
                                        下移
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => togglePinnedDoc(doc)}
                                      className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                                      aria-label={`取消收藏 ${doc.title}`}
                                    >
                                      已收藏
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-[11px] text-[var(--color-text-tertiary)]">
                            已折叠，当前共 {group.items.length} 条固定入口。
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-3 text-[11px] leading-6 text-[var(--color-text-tertiary)]">
                    在搜索结果或最近点击里点“收藏”，把常用文档固定在这里。固定入口会自动按写作用、API 用、设定用分层。
                  </div>
                )}
                <div className="mb-2 text-[11px] font-medium text-[var(--color-text-tertiary)]">关键词直达</div>
                <div className="flex flex-wrap gap-2">
                  {featuredKeywords.map((keyword) => (
                    <button
                      key={keyword}
                      type="button"
                      aria-label={`搜索关键词 ${keyword}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setQuery(keyword);
                        storeRecentQuery(keyword);
                        setIsOpen(true);
                      }}
                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
                <div className="mb-2 mt-4 text-[11px] font-medium text-[var(--color-text-tertiary)]">高频问题预设</div>
                <div className="grid gap-2">
                  {searchPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      aria-label={`应用预设 ${preset.label}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setQuery(preset.query);
                        storeRecentQuery(preset.query);
                        setIsOpen(true);
                      }}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-bg-hover)]"
                    >
                      <div className="text-[12px] font-medium text-[var(--color-text-primary)]">{preset.label}</div>
                      <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{preset.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {normalizedQuery ? (
              <div className="px-3 pb-2 pt-1">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-medium text-[var(--color-text-tertiary)]">搜索分面</div>
                  <div className="text-[10px] text-[var(--color-text-tertiary)]">按专题 / 能力页 / API 收窄结果</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {facetOptions.map((facet) => {
                    const isActive = facet.id === activeFacet;
                    return (
                      <button
                        key={facet.id}
                        type="button"
                        data-search-facet={facet.id}
                        data-search-facet-active={isActive ? 'true' : undefined}
                        aria-label={`切换分面 ${facet.label}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setActiveFacet(facet.id);
                          setActiveResultIndex(-1);
                        }}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                          isActive
                            ? 'border-[var(--color-accent-blue)] bg-[var(--color-tint-blue)] text-[var(--color-accent-blue)]'
                            : 'border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
                        }`}
                        aria-pressed={isActive}
                      >
                        {facet.label} · {facet.count}
                      </button>
                    );
                  })}
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
                  <div className="space-y-1" role="listbox" aria-label={`${group.label} 搜索结果`}>
                    {group.items.map(({ doc, reasons }) => {
                      const optionIndex = keyboardIndexByDocId.get(doc.id) ?? -1;
                      const isActive = activeKeyboardDocId === doc.id;

                      return (
                      <div
                        key={doc.id}
                        id={`${searchPanelId}-option-${doc.id}`}
                        role="option"
                        aria-selected={isActive}
                        data-search-option={mobile ? 'mobile' : 'desktop'}
                        data-search-option-type="result"
                        data-search-doc-id={doc.id}
                        data-search-option-index={optionIndex >= 0 ? optionIndex : undefined}
                        data-search-active={isActive ? 'true' : undefined}
                        onMouseEnter={() => {
                          if (optionIndex >= 0) {
                            setActiveResultIndex(optionIndex);
                          }
                        }}
                        className={`rounded-xl px-3 py-3 transition-colors ${
                          isActive
                            ? searchHighlightRingClass
                            : 'hover:bg-[var(--color-bg-hover)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            to={doc.path}
                            aria-label={`打开搜索结果 ${doc.title}`}
                            className="min-w-0 flex-1 no-underline"
                            onClick={() => {
                              openDoc(doc);
                            }}
                          >
                            <div className="mb-1 flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]">
                              <span>{doc.categoryInfo.icon}</span>
                              <span>{renderHighlightedText(doc.categoryInfo.name, query, `${doc.id}-category`)}</span>
                            </div>
                            <div className="text-[13px] font-medium text-[var(--color-text-primary)]">
                              {renderHighlightedText(doc.title, query, `${doc.id}-title`)}
                            </div>
                            <div className="mt-1 text-[12px] leading-6 text-[var(--color-text-secondary)]">
                              {renderHighlightedText(doc.description, query, `${doc.id}-description`)}
                            </div>
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
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              togglePinnedDoc(doc);
                              if (query.trim()) {
                                storeRecentQuery(query);
                              }
                            }}
                            className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                            aria-label={`${isPinnedDoc(doc.id) ? '取消收藏' : '收藏'} ${doc.title}`}
                          >
                            {isPinnedDoc(doc.id) ? '已收藏' : '收藏'}
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                </section>
              ))
            ) : emptyFacetState ? (
              <div className="px-3 py-4">
                <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-4">
                  <div className="text-[12px] font-medium text-[var(--color-text-primary)]">{emptyFacetState.label} 暂无命中</div>
                  <div className="mt-1 text-[11px] leading-6 text-[var(--color-text-tertiary)]">
                    当前查询总共命中 {emptyFacetState.total} 条结果，但都落在其他分面。切回“全部”或改用别的分面继续筛。
                  </div>
                </div>
              </div>
            ) : emptyStateSuggestions ? (
              <div className="px-3 py-4">
                <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-4">
                  <div className="text-[12px] font-medium text-[var(--color-text-primary)]">没有找到直接匹配项</div>
                  <div className="mt-1 text-[11px] leading-6 text-[var(--color-text-tertiary)]">
                    试试分类名、功能名或 API 关键词。下面给你一组更稳妥的推荐跳转，可用 Enter 直接打开当前高亮项。
                  </div>
                </div>
                <div className="mb-2 mt-4 flex items-center justify-between gap-3 px-1">
                  <div className="text-[11px] font-medium text-[var(--color-text-tertiary)]">推荐跳转</div>
                  <div className="text-[10px] text-[var(--color-text-tertiary)]">{emptyStateSuggestions.hint}</div>
                </div>
                <div className="space-y-1" role="listbox" aria-label="空结果推荐跳转">
                  {emptyStateSuggestions.docs.map((doc) => {
                    const optionIndex = keyboardIndexByDocId.get(doc.id) ?? -1;
                    const isActive = activeKeyboardDocId === doc.id;

                    return (
                      <div
                        key={doc.id}
                        id={`${searchPanelId}-option-${doc.id}`}
                        role="option"
                        aria-selected={isActive}
                        data-search-option={mobile ? 'mobile' : 'desktop'}
                        data-search-option-type="fallback"
                        data-search-doc-id={doc.id}
                        data-search-option-index={optionIndex >= 0 ? optionIndex : undefined}
                        data-search-active={isActive ? 'true' : undefined}
                        onMouseEnter={() => {
                          if (optionIndex >= 0) {
                            setActiveResultIndex(optionIndex);
                          }
                        }}
                        className={`rounded-xl px-3 py-3 transition-colors ${
                          isActive
                            ? searchHighlightRingClass
                            : 'hover:bg-[var(--color-bg-hover)]'
                        }`}
                      >
                        <Link
                          to={doc.path}
                          aria-label={`打开推荐跳转 ${doc.title}`}
                          className="block no-underline"
                          onClick={() => {
                            openDoc(doc);
                          }}
                        >
                          <div className="mb-1 flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]">
                            <span>{doc.categoryInfo.icon}</span>
                            <span>{doc.categoryInfo.name}</span>
                            <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                              推荐跳转
                            </span>
                          </div>
                          <div className="text-[13px] font-medium text-[var(--color-text-primary)]">{doc.title}</div>
                          <div className="mt-1 text-[12px] leading-6 text-[var(--color-text-secondary)]">{doc.description}</div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-3 py-6 text-[12px] text-[var(--color-text-secondary)]">没有找到匹配项，试试分类名、功能名或 API 关键词。</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
