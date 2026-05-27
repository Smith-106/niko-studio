/**
 * Worldview Data Extractor
 *
 * Extracts structured worldview settings from novel chapters using the
 * BookWorld term-based extraction method:
 *   chunk → extract atomic facts → filter → cluster → terminology
 *
 * Each setting has: term, nature, detail, source (chapter reference).
 */

import type { INarrativeLLMClient } from './types.js';

// ============================================================
// Types
// ============================================================

export enum WorldviewNature {
  ARTIFACT = 'artifact',
  SOCIAL_NORM = 'social_norm',
  CUSTOM = 'custom',
  GEOGRAPHY = 'geography',
  MAGIC_SYSTEM = 'magic_system',
  POLITICAL = 'political',
  CREATURE = 'creature',
  LANGUAGE = 'language',
  GENERAL = 'general',
}

export interface WorldviewSetting {
  /** The object being described (e.g., "Invisibility Cloak"). Empty for general social atmosphere. */
  term: string;
  /** Category of the setting */
  nature: WorldviewNature | string;
  /** Comprehensive description of the setting */
  detail: string;
  /** Chapter reference where the setting was extracted from */
  source: string;
}

export interface ChapterContent {
  chapterNumber: number;
  title: string;
  content: string;
}

interface RawExtraction {
  term: string;
  nature: string;
  detail: string;
}

// ============================================================
// Constants
// ============================================================

const CHUNK_SIZE = 500;
const MIN_TERM_LENGTH = 2;

const FILTER_PATTERNS = [
  /^(他|她|它|他们|她们|它们|我|我们|你|你们)(说|道|问|答|想|看|走|跑|笑|哭|喊|叫)/,
  /^(走到了|来到|站在|坐在|躺在|跑到)/,
  /^(很|非常|真的|确实|实在太)/,
];

const NATURE_ALIASES: Record<string, string> = {
  '物品': WorldviewNature.ARTIFACT,
  '道具': WorldviewNature.ARTIFACT,
  '法宝': WorldviewNature.ARTIFACT,
  '神器': WorldviewNature.ARTIFACT,
  '社会规范': WorldviewNature.SOCIAL_NORM,
  '规矩': WorldviewNature.SOCIAL_NORM,
  '禁忌': WorldviewNature.SOCIAL_NORM,
  '习俗': WorldviewNature.CUSTOM,
  '风俗': WorldviewNature.CUSTOM,
  '传统': WorldviewNature.CUSTOM,
  '地理': WorldviewNature.GEOGRAPHY,
  '地点': WorldviewNature.GEOGRAPHY,
  '区域': WorldviewNature.GEOGRAPHY,
  '魔法': WorldviewNature.MAGIC_SYSTEM,
  '法术': WorldviewNature.MAGIC_SYSTEM,
  '超自然': WorldviewNature.MAGIC_SYSTEM,
  '政治': WorldviewNature.POLITICAL,
  '势力': WorldviewNature.POLITICAL,
  '组织': WorldviewNature.POLITICAL,
  '种族': WorldviewNature.CREATURE,
  '生物': WorldviewNature.CREATURE,
  '语言': WorldviewNature.LANGUAGE,
  '文字': WorldviewNature.LANGUAGE,
};

// ============================================================
// WorldviewExtractor
// ============================================================

export class WorldviewExtractor {
  private llmClient: INarrativeLLMClient | null;

  constructor(options?: { llmClient?: INarrativeLLMClient }) {
    this.llmClient = options?.llmClient ?? null;
  }

  async extract(chapters: ChapterContent[]): Promise<WorldviewSetting[]> {
    if (chapters.length === 0) return [];

    const allRaw: Array<RawExtraction & { source: string }> = [];

    for (const chapter of chapters) {
      const chunks = this.splitIntoChunks(chapter.content, CHUNK_SIZE);
      for (const chunk of chunks) {
        const raw = await this.extractFromChunk(chunk);
        for (const item of raw) {
          allRaw.push({ ...item, source: `Ch.${chapter.chapterNumber}: ${chapter.title}` });
        }
      }
    }

    const filtered = this.filterExtractions(allRaw);
    const clustered = this.clusterExtractions(filtered);

    return clustered;
  }

  quickExtract(chapters: ChapterContent[]): WorldviewSetting[] {
    if (chapters.length === 0) return [];

    const settings: WorldviewSetting[] = [];

    for (const chapter of chapters) {
      const magicRefs = this.extractMagicSettings(chapter.content, chapter);
      const geoRefs = this.extractGeographySettings(chapter.content, chapter);
      settings.push(...magicRefs, ...geoRefs);
    }

    return this.deduplicate(settings);
  }

  // ============================================================
  // Chunk splitting
  // ============================================================

  private splitIntoChunks(text: string, size: number): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\s*\n/);
    let current = '';

    for (const para of paragraphs) {
      if (current.length + para.length > size && current.length > 0) {
        chunks.push(current.trim());
        current = para;
      } else {
        current += '\n' + para;
      }
    }

    if (current.trim().length > 0) {
      chunks.push(current.trim());
    }

    return chunks;
  }

  // ============================================================
  // LLM extraction
  // ============================================================

  private async extractFromChunk(chunk: string): Promise<RawExtraction[]> {
    if (!this.llmClient) {
      return this.ruleBasedExtraction(chunk);
    }

    try {
      const prompt = `Extract worldview settings from this text. A worldview setting is a rule, fact, or element of the fictional world (NOT character actions or common-sense knowledge).

Return a JSON array of objects with fields: term (the thing being described), nature (category: artifact/social_norm/custom/geography/magic_system/political/creature/language/general), detail (description).

Text:
${chunk.slice(0, 1000)}`;

      const result = await this.llmClient.generateJson<RawExtraction[]>(prompt, {
        systemPrompt: 'You are a literary analysis assistant. Extract only fictional world-building elements, not plot events or character behaviors.',
        temperature: 0.3,
      });

      return Array.isArray(result) ? result : [];
    } catch {
      return this.ruleBasedExtraction(chunk);
    }
  }

  // ============================================================
  // Rule-based fallback (no LLM needed)
  // ============================================================

  private ruleBasedExtraction(chunk: string): RawExtraction[] {
    const results: RawExtraction[] = [];

    const MAGIC_TERMS: Array<{ term: string; nature: string; detail: string }> = [
      { term: '法术', nature: WorldviewNature.MAGIC_SYSTEM, detail: '魔法系统中使用的法术能力' },
      { term: '灵力', nature: WorldviewNature.MAGIC_SYSTEM, detail: '角色内在的精神能量' },
      { term: '内力', nature: WorldviewNature.MAGIC_SYSTEM, detail: '武学体系中的内在力量' },
      { term: '真气', nature: WorldviewNature.MAGIC_SYSTEM, detail: '修炼体系中的能量' },
      { term: '阵法', nature: WorldviewNature.MAGIC_SYSTEM, detail: '通过特定排列产生的魔法阵' },
      { term: '禁术', nature: WorldviewNature.MAGIC_SYSTEM, detail: '被禁止使用的法术' },
      { term: '结界', nature: WorldviewNature.MAGIC_SYSTEM, detail: '魔法防御屏障' },
      { term: '修炼', nature: WorldviewNature.MAGIC_SYSTEM, detail: '修炼体系中的实践' },
      { term: '魔力', nature: WorldviewNature.MAGIC_SYSTEM, detail: '魔道体系中的力量' },
      { term: '法力', nature: WorldviewNature.MAGIC_SYSTEM, detail: '法术驱动的力量' },
    ];

    for (const { term, nature, detail } of MAGIC_TERMS) {
      if (chunk.includes(term)) {
        results.push({ term, nature, detail });
      }
    }

    // Regex patterns for rule/norm extraction
    const rulePatterns: RegExp[] = [
      /(.{2,8})(?:的)(?:原理|规则|限制|代价|条件)/g,
      /(.{2,6})(?:必须|不能|禁止|严禁|绝不可)(.{2,20})/g,
    ];

    for (const pattern of rulePatterns) {
      let match;
      while ((match = pattern.exec(chunk)) !== null) {
        results.push({
          term: match[1]?.trim() ?? '',
          nature: WorldviewNature.SOCIAL_NORM,
          detail: match[0].trim(),
        });
      }
    }

    return results;
  }

  // ============================================================
  // Static extraction for quick mode
  // ============================================================

  private extractMagicSettings(content: string, chapter: ChapterContent): WorldviewSetting[] {
    const MAGIC_TERMS: Array<{ term: string; detail: string }> = [
      { term: '法术', detail: '魔法系统中使用的法术能力' },
      { term: '灵力', detail: '角色内在的精神能量' },
      { term: '内力', detail: '武学体系中的内在力量' },
      { term: '真气', detail: '修炼体系中的能量' },
      { term: '阵法', detail: '通过特定排列产生的魔法阵' },
      { term: '禁术', detail: '被禁止使用的法术' },
      { term: '结界', detail: '魔法防御屏障' },
    ];

    const settings: WorldviewSetting[] = [];
    for (const { term, detail } of MAGIC_TERMS) {
      if (content.includes(term)) {
        settings.push({
          term,
          nature: WorldviewNature.MAGIC_SYSTEM,
          detail,
          source: `Ch.${chapter.chapterNumber}: ${chapter.title}`,
        });
      }
    }

    return settings;
  }

  private extractGeographySettings(content: string, chapter: ChapterContent): WorldviewSetting[] {
    const GEO_MARKERS = ['城', '国', '山', '河', '海', '岛', '谷', '林', '漠'];
    const settings: WorldviewSetting[] = [];

    for (const marker of GEO_MARKERS) {
      const pattern = new RegExp(`([一-龥]{1,3}${marker})`, 'g');
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const placeName = match[1];
        if (placeName.length >= MIN_TERM_LENGTH) {
          settings.push({
            term: placeName,
            nature: WorldviewNature.GEOGRAPHY,
            detail: `${placeName} — 故事世界中的地理位置`,
            source: `Ch.${chapter.chapterNumber}: ${chapter.title}`,
          });
        }
      }
    }

    return settings;
  }

  // ============================================================
  // Filtering
  // ============================================================

  private filterExtractions(
    items: Array<RawExtraction & { source: string }>,
  ): Array<RawExtraction & { source: string }> {
    return items.filter((item) => {
      if (!item.detail || item.detail.length < 4) return false;

      for (const pattern of FILTER_PATTERNS) {
        if (pattern.test(item.detail)) return false;
      }

      return true;
    });
  }

  // ============================================================
  // Clustering
  // ============================================================

  private clusterExtractions(
    items: Array<RawExtraction & { source: string }>,
  ): WorldviewSetting[] {
    const groups = new Map<string, Array<RawExtraction & { source: string }>>();

    for (const item of items) {
      const key = (item.term || item.nature).toLowerCase().trim();
      if (!key) continue;

      const existing = groups.get(key) ?? [];

      let merged = false;
      for (const existingItem of existing) {
        if (this.isSimilar(item.term, existingItem.term)) {
          existingItem.detail += '\n' + item.detail;
          merged = true;
          break;
        }
      }

      if (!merged) {
        existing.push({ ...item });
      }

      groups.set(key, existing);
    }

    const settings: WorldviewSetting[] = [];
    for (const items of groups.values()) {
      for (const item of items) {
        const nature = NATURE_ALIASES[item.nature] ?? item.nature ?? WorldviewNature.GENERAL;
        settings.push({
          term: item.term,
          nature,
          detail: item.detail,
          source: item.source,
        });
      }
    }

    return settings;
  }

  private isSimilar(a: string, b: string): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a))) return true;
    return false;
  }

  private deduplicate(settings: WorldviewSetting[]): WorldviewSetting[] {
    const seen = new Set<string>();
    return settings.filter((s) => {
      const key = `${s.term}:${s.nature}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
