/**
 * WritingHelper - Safe writing-helper capabilities for Niko Studio
 *
 * Migrated from src/services/writing_helper.py.
 *
 * Provides text processing modes: polish, summarize, outline, rewrite, expand.
 */

const _ALLOWED_MODES = new Set(['polish', 'summarize', 'outline', 'rewrite', 'expand']);
const _SENTENCE_ENDINGS = '.!?。！？';
const _CONCISE_HINTS = ['简洁', '精简', '更短', 'concise', 'shorter'];
const _FORMAL_HINTS = ['正式', '书面', 'formal'];
const _CASUAL_HINTS = ['口语', '轻松', 'casual'];

/**
 * Normalize whitespace in text
 */
function _normalizeWhitespace(text: string): string {
  let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  normalized = normalized.replace(/[\t\f\v]+/g, ' ');
  normalized = normalized.replace(/[ ]{2,}/g, ' ');
  normalized = normalized.replace(/\n{3,}/g, '\n\n');
  return normalized.trim();
}

/**
 * Split text into sentences (supports Chinese and English punctuation)
 */
function _splitSentences(text: string): string[] {
  const matches = text.match(/.+?[。！？.!?]|.+$/g);
  return matches
    ? matches.map((part) => part.trim()).filter((part) => part.length > 0)
    : [];
}

/**
 * Summarize text to a maximum number of sentences
 */
function _summarizeText(content: string, maxSentences: number): string {
  const sentences = _splitSentences(content);
  if (sentences.length === 0) {
    return '';
  }
  const selected = sentences.slice(0, Math.max(1, maxSentences));
  return selected.join(' ').trim();
}

/**
 * Generate an outline from text
 */
function _outlineText(content: string, maxItems: number): string[] {
  const paragraphs = content
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (paragraphs.length === 0) {
    return [];
  }

  const outline: string[] = [];
  for (const paragraph of paragraphs) {
    const lead = _summarizeText(paragraph, 1);
    if (lead) {
      outline.push(lead);
    }
    if (outline.length >= Math.max(1, maxItems)) {
      break;
    }
  }
  return outline;
}

/**
 * Normalize punctuation spacing
 */
function _normalizePunctuationSpacing(text: string): string {
  let normalized = text.replace(/[ \t]+([，。！？；：,.!?;:])/g, '$1');
  normalized = normalized.replace(/([,.;:!?])([^\s])/g, '$1 $2');
  normalized = normalized.replace(/([，。！？；：])[ \t]+/g, '$1');
  return normalized;
}

/**
 * Compress redundant phrases in text
 */
function _compressRedundantPhrases(text: string): string {
  let compressed = text;
  const replacements: [RegExp, string][] = [
    [/\b(in order to)\b/gi, 'to'],
    [/\b(due to the fact that)\b/gi, 'because'],
    [/为了能够/g, '为'],
    [/为了可以/g, '为'],
    [/非常非常/g, '非常'],
    [/很很/g, '很'],
  ];
  for (const [pattern, replacement] of replacements) {
    compressed = compressed.replace(pattern, replacement);
  }
  compressed = compressed.replace(/\b(\w+)\s+\1\b/gi, '$1');
  return compressed;
}

/**
 * Compute sentence identity for deduplication
 */
function _sentenceIdentity(sentence: string): string {
  const compact = sentence.replace(/\s+/g, '').toLowerCase();
  return compact.replace(new RegExp(`[${_escapeRegex(_SENTENCE_ENDINGS)}]+$`), '');
}

/**
 * Escape string for use in RegExp
 */
function _escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Deduplicate adjacent sentences within each line
 */
function _dedupeAdjacentSentences(text: string): string {
  const lines = text.split('\n');
  const dedupedLines: string[] = [];

  for (const line of lines) {
    const strippedLine = line.trim();
    if (!strippedLine) {
      dedupedLines.push('');
      continue;
    }

    const sentences = _splitSentences(strippedLine);

    const deduped: string[] = [];
    let previousIdentity = '';
    for (const sentence of sentences) {
      const identity = _sentenceIdentity(sentence);
      if (identity && identity === previousIdentity) {
        continue;
      }
      deduped.push(sentence);
      previousIdentity = identity;
    }

    dedupedLines.push(deduped.join(' ').trim());
  }

  let merged = dedupedLines.join('\n');
  merged = merged.replace(/\n{3,}/g, '\n\n');
  return merged.trim();
}

/**
 * Apply instruction tone hints (concise, formal, casual)
 */
function _applyInstructionTone(text: string, instruction: string): string {
  const normalizedInstruction = _normalizeWhitespace(instruction).toLowerCase();
  if (!normalizedInstruction) {
    return text;
  }

  let result = text;

  const conciseEnabled = _CONCISE_HINTS.some((hint) => normalizedInstruction.includes(hint));
  const formalEnabled = _FORMAL_HINTS.some((hint) => normalizedInstruction.includes(hint));
  const casualEnabled = _CASUAL_HINTS.some((hint) => normalizedInstruction.includes(hint));

  if (conciseEnabled) {
    const fillers = [
      /\bactually\b/gi,
      /\bbasically\b/gi,
      /\bin fact\b/gi,
      /其实/g,
      /基本上/g,
      /某种程度上/g,
    ];
    for (const filler of fillers) {
      result = result.replace(filler, '');
    }
    result = _compressRedundantPhrases(result);
  }

  if (formalEnabled && !casualEnabled) {
    const formalMap: Record<string, string> = {
      "can't": 'cannot',
      "don't": 'do not',
      "it's": 'it is',
      '挺': '较为',
      '有点': '略微',
      '真的': '确实',
    };
    for (const [src, target] of Object.entries(formalMap)) {
      result = result.replaceAll(src, target);
    }
  }

  if (casualEnabled && !formalEnabled) {
    const casualMap: Record<string, string> = {
      'therefore': 'so',
      'furthermore': 'also',
      '因此': '所以',
      '此外': '还有',
      '较为': '挺',
      '略微': '有点',
    };
    for (const [src, target] of Object.entries(casualMap)) {
      result = result.replaceAll(src, target);
    }
  }

  return _normalizeWhitespace(result);
}

/**
 * Check if text has adjacent duplicate sentences
 */
function _hasAdjacentDuplicateSentence(text: string): boolean {
  for (const line of text.split('\n')) {
    const strippedLine = line.trim();
    if (!strippedLine) {
      continue;
    }
    const sentences = _splitSentences(strippedLine);
    let previousIdentity = '';
    for (const sentence of sentences) {
      const identity = _sentenceIdentity(sentence);
      if (identity && identity === previousIdentity) {
        return true;
      }
      previousIdentity = identity;
    }
  }
  return false;
}

/**
 * Polish text: normalize, deduplicate, apply tone
 */
function _polishText(content: string, instruction: string = ''): string {
  let polished = _normalizeWhitespace(content);
  polished = _normalizePunctuationSpacing(polished);
  polished = _compressRedundantPhrases(polished);
  const hadAdjacentDuplicates = _hasAdjacentDuplicateSentence(polished);
  polished = _dedupeAdjacentSentences(polished);
  polished = _applyInstructionTone(polished, instruction);
  polished = _normalizeWhitespace(polished);
  if (hadAdjacentDuplicates) {
    polished = polished
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join(' ');
  }
  return _normalizeWhitespace(polished);
}

/**
 * Rewrite text: polish then rejoin sentences
 */
function _rewriteText(content: string, instruction: string = ''): string {
  let rewritten = _polishText(content, instruction);
  const sentences = _splitSentences(rewritten);
  if (sentences.length >= 2) {
    rewritten = sentences.join(' ');
  }
  return _normalizeWhitespace(rewritten);
}

/**
 * Expand text: polish then add expansion hint
 */
function _expandText(content: string, instruction: string = ''): string {
  const expandedBase = _polishText(content, instruction);
  const sentences = _splitSentences(expandedBase);
  if (sentences.length === 0) {
    return expandedBase;
  }

  const anchor = sentences[0];
  const endsWithSentenceEnding = anchor.length > 0 && _SENTENCE_ENDINGS.includes(anchor[anchor.length - 1]);
  const addition = endsWithSentenceEnding
    ? `进一步展开：${anchor}`
    : `进一步展开：${anchor}。`;
  return _normalizeWhitespace(`${expandedBase}\n\n${addition}`);
}

/**
 * Process writing helper request
 *
 * @param params - Processing parameters
 * @param params.content - Input text content
 * @param params.mode - Processing mode: polish, summarize, outline, rewrite, expand
 * @param params.maxSentences - Max sentences for summarize mode (default 3)
 * @param params.maxItems - Max items for outline mode (default 6)
 * @param params.instruction - Tone/style instruction hints
 * @returns Processing result with mode-specific output and stats
 */
export function processWritingHelper(params: {
  content: string;
  mode?: string;
  maxSentences?: number;
  maxItems?: number;
  instruction?: string;
}): Record<string, unknown> {
  const {
    content,
    mode = 'polish',
    maxSentences = 3,
    maxItems = 6,
    instruction = '',
  } = params;

  const normalizedContent = _normalizeWhitespace(content);
  const normalizedMode = (mode || 'polish').trim().toLowerCase();
  const normalizedInstruction = typeof instruction === 'string' ? instruction : '';

  if (!_ALLOWED_MODES.has(normalizedMode)) {
    throw new Error('mode must be one of: polish, summarize, outline, rewrite, expand');
  }

  if (normalizedMode === 'polish') {
    const polished = _polishText(normalizedContent, normalizedInstruction);
    return {
      mode: 'polish',
      processed_text: polished,
      stats: {
        input_chars: content.length,
        output_chars: polished.length,
      },
    };
  }

  if (normalizedMode === 'rewrite') {
    const rewritten = _rewriteText(normalizedContent, normalizedInstruction);
    return {
      mode: 'rewrite',
      processed_text: rewritten,
      stats: {
        input_chars: content.length,
        output_chars: rewritten.length,
      },
    };
  }

  if (normalizedMode === 'expand') {
    const expanded = _expandText(normalizedContent, normalizedInstruction);
    return {
      mode: 'expand',
      processed_text: expanded,
      stats: {
        input_chars: content.length,
        output_chars: expanded.length,
      },
    };
  }

  if (normalizedMode === 'summarize') {
    const summary = _summarizeText(normalizedContent, maxSentences);
    return {
      mode: 'summarize',
      processed_text: summary,
      stats: {
        input_chars: content.length,
        output_chars: summary.length,
        max_sentences: Math.max(1, maxSentences),
      },
    };
  }

  // outline mode
  const outline = _outlineText(normalizedContent, maxItems);
  return {
    mode: 'outline',
    outline,
    stats: {
      input_chars: content.length,
      items: outline.length,
      max_items: Math.max(1, maxItems),
    },
  };
}
