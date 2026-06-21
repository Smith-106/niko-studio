/**
 * AI Template Patterns — Single Source of Truth
 *
 * Canonical list of AI-generated text patterns (Chinese + English).
 * Each entry contains all information needed for both detection and replacement.
 *
 * Consumers:
 * - ai-flavor-detector.ts → imports AI_TEMPLATE_PATTERNS_ZH/EN (detection arrays)
 * - revision-service.ts   → imports AI_TEMPLATE_REPLACEMENTS_ZH/EN (replacement arrays)
 *
 * ISS-20260621-010: Deduplication guard ensures no duplicate entries at module load.
 */

// ============================================================
// Types
// ============================================================

export interface AITemplateEntry {
  pattern: RegExp;
  label: string;
  weight: number;
  replacement: string;
}

// ============================================================
// Chinese AI Template Patterns (deduplicated: 38 unique)
// ============================================================

const _AI_TEMPLATE_ENTRIES_ZH: AITemplateEntry[] = [
  { pattern: /值得注意的是/g, label: '值得注意的是', weight: 1.0, replacement: '' },
  { pattern: /让我们/g, label: '让我们', weight: 0.8, replacement: '' },
  { pattern: /综上所述/g, label: '综上所述', weight: 1.0, replacement: '' },
  { pattern: /首先[，,]/g, label: '首先，', weight: 0.6, replacement: '' },
  { pattern: /其次[，,]/g, label: '其次，', weight: 0.6, replacement: '' },
  { pattern: /最后[，,]/g, label: '最后，', weight: 0.6, replacement: '' },
  { pattern: /总而言之/g, label: '总而言之', weight: 1.0, replacement: '' },
  { pattern: /不可否认/g, label: '不可否认', weight: 0.9, replacement: '' },
  { pattern: /毫无疑问/g, label: '毫无疑问', weight: 0.9, replacement: '' },
  { pattern: /显而易见/g, label: '显而易见', weight: 0.9, replacement: '' },
  { pattern: /从某种意义来说/g, label: '从某种意义来说', weight: 0.8, replacement: '' },
  { pattern: /在一定程度上/g, label: '在一定程度上', weight: 0.8, replacement: '' },
  { pattern: /不难发现/g, label: '不难发现', weight: 0.9, replacement: '' },
  { pattern: /由此可见/g, label: '由此可见', weight: 0.9, replacement: '' },
  { pattern: /一言以蔽之/g, label: '一言以蔽之', weight: 1.0, replacement: '' },
  { pattern: /更有甚者/g, label: '更有甚者', weight: 0.8, replacement: '' },
  { pattern: /退一步说/g, label: '退一步说', weight: 0.8, replacement: '' },
  { pattern: /平心而论/g, label: '平心而论', weight: 0.9, replacement: '' },
  { pattern: /众所周知/g, label: '众所周知', weight: 0.9, replacement: '' },
  { pattern: /换言之/g, label: '换言之', weight: 0.7, replacement: '' },
  { pattern: /追根溯源/g, label: '追根溯源', weight: 0.8, replacement: '' },
  { pattern: /归根结底/g, label: '归根结底', weight: 0.9, replacement: '' },
  { pattern: /一言蔽之/g, label: '一言蔽之', weight: 1.0, replacement: '' },
  { pattern: /无独有偶/g, label: '无独有偶', weight: 0.8, replacement: '' },
  { pattern: /退一步讲/g, label: '退一步讲', weight: 0.8, replacement: '' },
  { pattern: /退一步来看/g, label: '退一步来看', weight: 0.8, replacement: '' },
  { pattern: /需要指出的是/g, label: '需要指出的是', weight: 0.9, replacement: '' },
  { pattern: /必须承认/g, label: '必须承认', weight: 0.9, replacement: '' },
  { pattern: /不得不承认/g, label: '不得不承认', weight: 0.9, replacement: '' },
  { pattern: /应当指出/g, label: '应当指出', weight: 0.9, replacement: '' },
  { pattern: /需要强调/g, label: '需要强调', weight: 0.9, replacement: '' },
  { pattern: /有必要说明/g, label: '有必要说明', weight: 0.9, replacement: '' },
  { pattern: /特别需要/g, label: '特别需要', weight: 0.8, replacement: '' },
  { pattern: /特别值得一提的是/g, label: '特别值得一提的是', weight: 0.9, replacement: '' },
  { pattern: /特别值得注意的是/g, label: '特别值得注意的是', weight: 0.9, replacement: '' },
  { pattern: /更加重要的是/g, label: '更加重要的是', weight: 0.8, replacement: '' },
  { pattern: /更为重要的是/g, label: '更为重要的是', weight: 0.8, replacement: '' },
  { pattern: /更重要的是/g, label: '更重要的是', weight: 0.8, replacement: '' },
];

// ============================================================
// English AI Template Patterns (41 entries, all with replacements)
// ============================================================

const _AI_TEMPLATE_ENTRIES_EN: AITemplateEntry[] = [
  { pattern: /it is important to note that/gi, label: 'it is important to note that', weight: 0.9, replacement: '' },
  { pattern: /it should be noted that/gi, label: 'it should be noted that', weight: 0.9, replacement: '' },
  { pattern: /in conclusion/gi, label: 'in conclusion', weight: 1.0, replacement: '' },
  { pattern: /to summarize/gi, label: 'to summarize', weight: 0.9, replacement: '' },
  { pattern: /in summary/gi, label: 'in summary', weight: 0.9, replacement: '' },
  { pattern: /furthermore/gi, label: 'furthermore', weight: 0.7, replacement: 'also' },
  { pattern: /moreover/gi, label: 'moreover', weight: 0.7, replacement: 'also' },
  { pattern: /additionally/gi, label: 'additionally', weight: 0.6, replacement: 'also' },
  { pattern: /consequently/gi, label: 'consequently', weight: 0.7, replacement: 'so' },
  { pattern: /therefore/gi, label: 'therefore', weight: 0.6, replacement: 'so' },
  { pattern: /thus/gi, label: 'thus', weight: 0.6, replacement: '' },
  { pattern: /however/gi, label: 'however', weight: 0.5, replacement: 'but' },
  { pattern: /nevertheless/gi, label: 'nevertheless', weight: 0.7, replacement: 'still' },
  { pattern: /on the other hand/gi, label: 'on the other hand', weight: 0.7, replacement: 'conversely' },
  { pattern: /it is worth noting/gi, label: 'it is worth noting', weight: 0.9, replacement: '' },
  { pattern: /it is worth mentioning/gi, label: 'it is worth mentioning', weight: 0.9, replacement: '' },
  { pattern: /delve into/gi, label: 'delve into', weight: 0.8, replacement: 'explore' },
  { pattern: /navigate the complexities of/gi, label: 'navigate the complexities of', weight: 1.0, replacement: 'understand' },
  { pattern: /in the realm of/gi, label: 'in the realm of', weight: 0.9, replacement: 'in' },
  { pattern: /a myriad of/gi, label: 'a myriad of', weight: 0.8, replacement: 'many' },
  { pattern: /tapestry of/gi, label: 'tapestry of', weight: 0.9, replacement: 'rich' },
  { pattern: /landscape of/gi, label: 'landscape of', weight: 0.8, replacement: 'world of' },
  { pattern: /multifaceted/gi, label: 'multifaceted', weight: 0.8, replacement: 'complex' },
  { pattern: /underscores the importance of/gi, label: 'underscores the importance of', weight: 0.9, replacement: 'shows' },
  { pattern: /highlights the need for/gi, label: 'highlights the need for', weight: 0.9, replacement: 'shows why' },
  { pattern: /serves as a testament to/gi, label: 'serves as a testament to', weight: 1.0, replacement: 'shows' },
  { pattern: /sheds light on/gi, label: 'sheds light on', weight: 0.8, replacement: 'reveals' },
  { pattern: /paves the way for/gi, label: 'paves the way for', weight: 0.9, replacement: 'enables' },
  { pattern: /opens the door to/gi, label: 'opens the door to', weight: 0.8, replacement: 'allows' },
  { pattern: /at the end of the day/gi, label: 'at the end of the day', weight: 0.8, replacement: 'ultimately' },
  { pattern: /when it comes to/gi, label: 'when it comes to', weight: 0.7, replacement: 'regarding' },
  { pattern: /in terms of/gi, label: 'in terms of', weight: 0.6, replacement: '' },
  { pattern: /with respect to/gi, label: 'with respect to', weight: 0.7, replacement: 'about' },
  { pattern: /in the context of/gi, label: 'in the context of', weight: 0.7, replacement: 'in' },
  { pattern: /it goes without saying/gi, label: 'it goes without saying', weight: 0.9, replacement: '' },
  { pattern: /needless to say/gi, label: 'needless to say', weight: 0.9, replacement: '' },
  { pattern: /as a matter of fact/gi, label: 'as a matter of fact', weight: 0.8, replacement: '' },
  { pattern: /to put it simply/gi, label: 'to put it simply', weight: 0.8, replacement: '' },
  { pattern: /in other words/gi, label: 'in other words', weight: 0.6, replacement: '' },
  { pattern: /for instance/gi, label: 'for instance', weight: 0.5, replacement: '' },
  { pattern: /for example/gi, label: 'for example', weight: 0.4, replacement: '' },
];

// ============================================================
// Dedup guard — fails loudly if duplicate labels exist
// ============================================================

function assertNoDuplicates(entries: AITemplateEntry[], lang: string): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.label)) {
      throw new Error(`Duplicate AI template entry [${lang}]: "${entry.label}"`);
    }
    seen.add(entry.label);
  }
}

assertNoDuplicates(_AI_TEMPLATE_ENTRIES_ZH, 'ZH');
assertNoDuplicates(_AI_TEMPLATE_ENTRIES_EN, 'EN');

// ============================================================
// Derived exports for consumers
// ============================================================

/** Detection-oriented arrays for ai-flavor-detector.ts */
export const AI_TEMPLATE_PATTERNS_ZH: Array<{ pattern: RegExp; label: string; weight: number }> =
  _AI_TEMPLATE_ENTRIES_ZH.map(({ pattern, label, weight }) => ({ pattern, label, weight }));

export const AI_TEMPLATE_PATTERNS_EN: Array<{ pattern: RegExp; label: string; weight: number }> =
  _AI_TEMPLATE_ENTRIES_EN.map(({ pattern, label, weight }) => ({ pattern, label, weight }));

/** Replacement-oriented arrays for revision-service.ts */
export const AI_TEMPLATE_REPLACEMENTS_ZH: Array<{ pattern: RegExp; replacement: string }> =
  _AI_TEMPLATE_ENTRIES_ZH.map(({ pattern, replacement }) => ({ pattern, replacement }));

export const AI_TEMPLATE_REPLACEMENTS_EN: Array<{ pattern: RegExp; replacement: string }> =
  _AI_TEMPLATE_ENTRIES_EN.map(({ pattern, replacement }) => ({ pattern, replacement }));
