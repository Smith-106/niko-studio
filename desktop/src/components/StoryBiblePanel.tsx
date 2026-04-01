import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, BookOpen, Users, Map, FileText, Tag, Sparkles, PenLine, Wand2, SlidersHorizontal } from 'lucide-react'
import { queryGraph } from '../api/client'
import { toGraphItems } from '../components/knowledge/knowledgeUtils'
import { useI18n } from '../i18n'

interface StoryBibleSection {
  title: string
  icon: React.ReactNode
  content: React.ReactNode
  defaultOpen?: boolean
}

function CollapsibleSection({ title, icon, content, defaultOpen = false }: StoryBibleSection) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-[var(--border-default)] rounded-[var(--radius-md)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left bg-[var(--surface-elevated)] hover:bg-[var(--surface-sunken)] transition-colors"
      >
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">{title}</span>
        <ChevronDown
          size={16}
          className={`text-[var(--text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-4 py-3 border-t border-[var(--border-subtle)]">{content}</div>}
    </div>
  )
}

interface GraphItem {
  name?: string
  title?: string
  description?: string
  content?: string
  id?: string
  [key: string]: unknown
}

function CardList({ items, emptyText }: { items: GraphItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] italic">{emptyText}</p>
  }
  return (
    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
      {items.map((item, i) => (
        <div
          key={item.id ?? i}
          className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] border border-[var(--border-subtle)]"
        >
          <div className="text-sm font-medium text-[var(--text-primary)]">
            {item.name || item.title || item.id || `条目 ${i + 1}`}
          </div>
          {(item.description || item.content) && (
            <div className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
              {String(item.description || item.content || '')}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const GENRE_PRESETS_ZH = ['奇幻', '言情', '悬疑', '科幻', '恐怖', '历史', '武侠', '都市', '青春', '冒险', '宫斗', '末世', '仙侠', '推理', '轻小说']

function loadFromStorage(key: string): string {
  try { return localStorage.getItem(key) || '' } catch { return '' }
}

function saveToStorage(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

type StyleId = 'tried' | 'matchMy' | 'soundsLike' | 'custom'

export function StoryBiblePanel() {
  const { t } = useI18n()
  const [characters, setCharacters] = useState<GraphItem[]>([])
  const [locations, setLocations] = useState<GraphItem[]>([])
  const [braindump, setBraindump] = useState(() => loadFromStorage('niko.sb-braindump-v1'))
  const [genres, setGenres] = useState<string[]>(() => {
    const raw = loadFromStorage('niko.sb-genres-v1')
    return raw ? raw.split(',').filter(Boolean) : []
  })
  const [genreInput, setGenreInput] = useState('')
  const [synopsis, setSynopsis] = useState(() => loadFromStorage('niko.sb-synopsis-v1'))
  const [outline, setOutline] = useState(() => loadFromStorage('niko.sb-outline-v1'))
  const [selectedStyle, setSelectedStyle] = useState<StyleId>(() =>
    (loadFromStorage('niko.sb-style-v1') as StyleId) || 'tried'
  )
  const [loading, setLoading] = useState(true)

  const saveBraindump = useCallback((v: string) => { setBraindump(v); saveToStorage('niko.sb-braindump-v1', v) }, [])
  const saveSynopsis = useCallback((v: string) => { setSynopsis(v); saveToStorage('niko.sb-synopsis-v1', v) }, [])
  const saveOutline = useCallback((v: string) => { setOutline(v); saveToStorage('niko.sb-outline-v1', v) }, [])

  const toggleGenre = useCallback((genre: string) => {
    setGenres(prev => {
      const next = prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
      saveToStorage('niko.sb-genres-v1', next.join(','))
      return next
    })
  }, [])

  const addCustomGenre = useCallback(() => {
    const trimmed = genreInput.trim()
    if (trimmed && !genres.includes(trimmed)) {
      setGenres(prev => {
        const next = [...prev, trimmed]
        saveToStorage('niko.sb-genres-v1', next.join(','))
        return next
      })
      setGenreInput('')
    }
  }, [genreInput, genres])

  const handleStyleChange = useCallback((style: StyleId) => {
    setSelectedStyle(style)
    saveToStorage('niko.sb-style-v1', style)
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const [charResult, locResult] = await Promise.allSettled([
          queryGraph('MATCH (c:Character) RETURN c LIMIT 50'),
          queryGraph('MATCH (l:Location) RETURN l LIMIT 50'),
        ])
        if (cancelled) return

        if (charResult.status === 'fulfilled' && charResult.value.data) {
          setCharacters(toGraphItems(charResult.value.data, 'c'))
        }
        if (locResult.status === 'fulfilled' && locResult.value.data) {
          setLocations(toGraphItems(locResult.value.data, 'l'))
        }
      } catch {
        // Graceful degradation
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  const genrePresets = GENRE_PRESETS_ZH

  const styles: { id: StyleId; icon: React.ReactNode; label: string; desc: string }[] = [
    { id: 'tried', icon: <Sparkles size={16} />, label: t.storyBibleStyleTried, desc: t.storyBibleStyleTriedDesc },
    { id: 'matchMy', icon: <PenLine size={16} />, label: t.storyBibleStyleMatchMy, desc: t.storyBibleStyleMatchMyDesc },
    { id: 'soundsLike', icon: <Wand2 size={16} />, label: t.storyBibleStyleSoundsLike, desc: t.storyBibleStyleSoundsLikeDesc },
    { id: 'custom', icon: <SlidersHorizontal size={16} />, label: t.storyBibleStyleCustom, desc: t.storyBibleStyleCustomDesc },
  ]

  const sections: StoryBibleSection[] = [
    {
      title: t.storyBibleBraindump,
      icon: <BookOpen size={16} />,
      defaultOpen: true,
      content: (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-secondary)]">{t.storyBibleBraindumpHint}</p>
          <textarea
            value={braindump}
            onChange={(e) => saveBraindump(e.target.value)}
            placeholder={t.storyBibleBraindumpHint}
            className="w-full min-h-32 text-sm leading-relaxed bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-3 resize-y outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar"
          />
        </div>
      ),
    },
    {
      title: t.storyBibleGenre,
      icon: <Tag size={16} />,
      defaultOpen: true,
      content: (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {genrePresets.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                  genres.includes(genre)
                    ? 'bg-[var(--primary-cta)] text-white border-[var(--primary-cta)]'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--primary-cta)]/50'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={genreInput}
              onChange={(e) => setGenreInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomGenre()}
              placeholder={t.storyBibleGenrePlaceholder}
              className="flex-1 text-sm bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-3 py-1.5 outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)]"
            />
            <button
              onClick={addCustomGenre}
              disabled={!genreInput.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--primary-cta)] text-white rounded-[var(--radius-sm)] hover:bg-[var(--primary-cta-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              +
            </button>
          </div>
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {genres.map((genre) => (
                <span
                  key={genre}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-[var(--primary-cta)]/10 text-[var(--primary-cta)] rounded-full border border-[var(--primary-cta)]/20"
                >
                  {genre}
                  <button
                    onClick={() => toggleGenre(genre)}
                    className="hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      title: t.storyBibleSynopsis,
      icon: <FileText size={16} />,
      content: (
        <textarea
          value={synopsis}
          onChange={(e) => saveSynopsis(e.target.value)}
          placeholder={t.storyBibleSynopsisPlaceholder}
          className="w-full min-h-28 text-sm leading-relaxed bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-3 resize-y outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar"
        />
      ),
    },
    {
      title: `${t.storyBibleCharacters} (${characters.length})`,
      icon: <Users size={16} />,
      content: loading
        ? <p className="text-sm text-[var(--text-muted)]">{t.storyBibleLoading}</p>
        : <CardList items={characters} emptyText={t.storyBibleEmpty} />,
    },
    {
      title: `${t.storyBibleWorldbuilding} (${locations.length})`,
      icon: <Map size={16} />,
      content: loading
        ? <p className="text-sm text-[var(--text-muted)]">{t.storyBibleLoading}</p>
        : <CardList items={locations} emptyText={t.storyBibleEmpty} />,
    },
    {
      title: t.storyBibleStyleTitle,
      icon: <Sparkles size={16} />,
      content: (
        <div className="grid grid-cols-2 gap-2">
          {styles.map((style) => (
            <button
              key={style.id}
              onClick={() => handleStyleChange(style.id)}
              className={`flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] border text-left transition-all ${
                selectedStyle === style.id
                  ? 'bg-[var(--primary-cta)]/10 border-[var(--primary-cta)]/40 ring-1 ring-[var(--primary-cta)]/30'
                  : 'bg-[var(--surface-sunken)] border-[var(--border-subtle)] hover:border-[var(--primary-cta)]/20'
              }`}
            >
              <span className={`mt-0.5 ${selectedStyle === style.id ? 'text-[var(--primary-cta)]' : 'text-[var(--text-muted)]'}`}>
                {style.icon}
              </span>
              <div>
                <div className={`text-xs font-medium ${selectedStyle === style.id ? 'text-[var(--primary-cta)]' : 'text-[var(--text-primary)]'}`}>
                  {style.label}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{style.desc}</div>
              </div>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: t.storyBibleOutline,
      icon: <FileText size={16} />,
      content: (
        <textarea
          value={outline}
          onChange={(e) => saveOutline(e.target.value)}
          placeholder="故事大纲、章节计划、关键情节..."
          className="w-full min-h-32 text-sm leading-relaxed bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-3 resize-y outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar"
        />
      ),
    },
  ]

  return (
    <div className="w-full max-w-[680px] mx-auto space-y-2 pb-6">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen size={14} className="text-[var(--primary-cta)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">{t.storyBibleTitle}</h3>
      </div>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">{t.storyBibleDesc}</p>
      {sections.map((section, i) => (
        <CollapsibleSection key={i} {...section} />
      ))}
      <button
        className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 text-sm font-medium text-white bg-[var(--primary-cta)] hover:bg-[var(--primary-cta-hover)] active:bg-[var(--primary-cta-active)] rounded-[var(--radius-md)] shadow-[var(--shadow-tiny)] transition-all active:scale-[0.99]"
      >
        <Sparkles size={14} />
        {t.storyBibleGenerate}
      </button>
    </div>
  )
}
