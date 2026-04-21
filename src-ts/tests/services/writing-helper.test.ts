/**
 * WritingHelper Tests
 *
 * Tests processWritingHelper for polish, summarize, outline, rewrite, expand modes,
 * instruction tone hints, deduplication, and edge cases.
 */

import { describe, expect, it } from 'vitest';

import { processWritingHelper } from '../../services/writing-helper';

// ---------------------------------------------------------------------------
// polish mode
// ---------------------------------------------------------------------------

describe('processWritingHelper - polish', () => {
  it('polishes text with default settings', () => {
    const result = processWritingHelper({
      content: 'Hello  world.   This   has    extra spaces.',
      mode: 'polish',
    });
    expect(result.mode).toBe('polish');
    expect(result.processed_text).toContain('Hello world.');
    expect(result.stats.input_chars).toBeGreaterThan(0);
    expect(result.stats.output_chars).toBeGreaterThan(0);
  });

  it('normalizes CRLF to LF', () => {
    const result = processWritingHelper({
      content: 'Line one\r\nLine two\r\nLine three',
      mode: 'polish',
    });
    expect(result.processed_text).not.toContain('\r');
    expect(result.processed_text).toContain('Line one\nLine two\nLine three');
  });

  it('compresses redundant phrases', () => {
    const result = processWritingHelper({
      content: 'In order to succeed, we must try. Due to the fact that time is short.',
      mode: 'polish',
    });
    expect(result.processed_text).toContain('to succeed');
    expect(result.processed_text).toContain('because');
    expect(result.processed_text).not.toContain('In order to');
    expect(result.processed_text).not.toContain('Due to the fact that');
  });

  it('compresses Chinese redundant phrases', () => {
    const result = processWritingHelper({
      content: '为了能够完成任务，我们要加油。为了可以成功，继续努力。',
      mode: 'polish',
    });
    expect(result.processed_text).not.toContain('为了能够');
    expect(result.processed_text).not.toContain('为了可以');
  });

  it('deduplicates adjacent duplicate sentences', () => {
    const result = processWritingHelper({
      content: 'This is a sentence. This is a sentence. Another sentence.',
      mode: 'polish',
    });
    // Should not have the duplicate sentence repeated
    const sentences = result.processed_text.split(/(?<=[.!?])\s*/).filter((s) => s.length > 0);
    const deduped = new Set(sentences.map((s) => s.replace(/\s+/g, '').toLowerCase()));
    expect(sentences.length).toBe(deduped.size);
  });

  it('applies concise tone hints', () => {
    const result = processWritingHelper({
      content: 'Actually, the basic premise is clear. Basically, it works.',
      mode: 'polish',
      instruction: 'please make it concise',
    });
    // Fillers should be removed
    expect(result.processed_text).not.toContain('actually');
    expect(result.processed_text).not.toContain('basically');
  });

  it('applies formal tone hints', () => {
    const result = processWritingHelper({
      content: "it's a good approach. don't forget this.",
      mode: 'polish',
      instruction: 'formal tone',
    });
    // Formal replacements are case-sensitive; input must match exact case
    expect(result.processed_text).toContain('it is');
    expect(result.processed_text).toContain('do not');
  });

  it('applies casual tone hints', () => {
    const result = processWritingHelper({
      content: 'therefore, the result is clear. furthermore, it is confirmed.',
      mode: 'polish',
      instruction: 'casual style',
    });
    // Casual replacements are case-sensitive
    expect(result.processed_text).toContain('so');
    expect(result.processed_text).toContain('also');
  });

  it('neither formal nor casual applied when both hints present', () => {
    const result = processWritingHelper({
      content: "it's confirmed.",
      mode: 'polish',
      instruction: 'formal and casual',
    });
    // Both hints present means neither block activates (both require !other)
    expect(result.processed_text).toContain("it's");
  });
});

// ---------------------------------------------------------------------------
// summarize mode
// ---------------------------------------------------------------------------

describe('processWritingHelper - summarize', () => {
  it('summarizes text to max sentences', () => {
    const content = 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.';
    const result = processWritingHelper({
      content,
      mode: 'summarize',
      maxSentences: 2,
    });
    expect(result.mode).toBe('summarize');
    expect(result.processed_text).toBeTruthy();
    expect(result.stats.max_sentences).toBe(2);
    const sentences = result.processed_text.split(/(?<=[.!?])\s*/).filter((s) => s.length > 0);
    expect(sentences.length).toBeLessThanOrEqual(2);
  });

  it('summarizes to at least 1 sentence when maxSentences is 0', () => {
    const result = processWritingHelper({
      content: 'Only sentence here.',
      mode: 'summarize',
      maxSentences: 0,
    });
    expect(result.processed_text).toBeTruthy();
  });

  it('returns empty string for empty content', () => {
    const result = processWritingHelper({
      content: '',
      mode: 'summarize',
    });
    expect(result.processed_text).toBe('');
  });

  it('handles Chinese sentence splitting', () => {
    const result = processWritingHelper({
      content: 'This is the first sentence. The second sentence follows.',
      mode: 'summarize',
      maxSentences: 1,
    });
    expect(result.processed_text).toBeTruthy();
    const sentences = result.processed_text.split(/(?<=[.!?])\s*/).filter((s) => s.length > 0);
    expect(sentences.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// outline mode
// ---------------------------------------------------------------------------

describe('processWritingHelper - outline', () => {
  it('generates outline from paragraphs', () => {
    const content = 'First paragraph with some detailed description here.\n\nSecond paragraph with more info.\n\nThird paragraph.';
    const result = processWritingHelper({
      content,
      mode: 'outline',
      maxItems: 3,
    });
    expect(result.mode).toBe('outline');
    expect(result.outline).toBeDefined();
    expect(Array.isArray(result.outline)).toBe(true);
    expect(result.outline.length).toBeLessThanOrEqual(3);
    expect(result.stats.items).toBe(result.outline.length);
    expect(result.stats.max_items).toBe(3);
  });

  it('returns empty outline for empty content', () => {
    const result = processWritingHelper({
      content: '',
      mode: 'outline',
    });
    expect(result.outline).toEqual([]);
  });

  it('returns at least 1 item when maxItems is 0', () => {
    const result = processWritingHelper({
      content: 'Single paragraph content.',
      mode: 'outline',
      maxItems: 0,
    });
    expect(result.outline.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// rewrite mode
// ---------------------------------------------------------------------------

describe('processWritingHelper - rewrite', () => {
  it('rewrites text by joining polished sentences', () => {
    const content = 'First sentence. Second sentence. Third sentence.';
    const result = processWritingHelper({
      content,
      mode: 'rewrite',
    });
    expect(result.mode).toBe('rewrite');
    expect(result.processed_text).toBeTruthy();
    expect(result.stats.input_chars).toBeGreaterThan(0);
  });

  it('applies instruction hints during rewrite', () => {
    const result = processWritingHelper({
      content: 'Actually, this works. Basically, it is fine.',
      mode: 'rewrite',
      instruction: 'concise',
    });
    expect(result.processed_text).not.toContain('actually');
  });
});

// ---------------------------------------------------------------------------
// expand mode
// ---------------------------------------------------------------------------

describe('processWritingHelper - expand', () => {
  it('expands text with expansion hint', () => {
    const content = 'A short sentence to expand upon.';
    const result = processWritingHelper({
      content,
      mode: 'expand',
    });
    expect(result.mode).toBe('expand');
    expect(result.processed_text).toContain('A short sentence to expand upon');
    expect(result.processed_text).toContain('\u8fdb\u4e00\u6b65\u5c55\u5f00'); // Further expand
  });

  it('appends period when anchor sentence lacks ending', () => {
    const result = processWritingHelper({
      content: 'No ending punctuation here',
      mode: 'expand',
    });
    // Adds Chinese period for sentence without ending punctuation
    expect(result.processed_text).toContain('No ending punctuation here\u3002');
  });
});

// ---------------------------------------------------------------------------
// error handling
// ---------------------------------------------------------------------------

describe('processWritingHelper - error handling', () => {
  it('throws for invalid mode', () => {
    expect(() =>
      processWritingHelper({ content: 'test', mode: 'invalid' }),
    ).toThrow('mode must be one of: polish, summarize, outline, rewrite, expand');
  });

  it('defaults to polish when mode is null', () => {
    const result = processWritingHelper({ content: 'test', mode: null as any });
    expect(result.mode).toBe('polish');
  });

  it('handles non-string instruction', () => {
    const result = processWritingHelper({
      content: 'Test content.',
      mode: 'polish',
      instruction: undefined as any,
    });
    expect(result.processed_text).toBeTruthy();
  });

  it('trims leading and trailing whitespace', () => {
    const result = processWritingHelper({
      content: '   Trimmed content.   ',
      mode: 'polish',
    });
    expect(result.processed_text).toBe('Trimmed content.');
    expect(result.processed_text).not.toMatch(/^\s/);
    expect(result.processed_text).not.toMatch(/\s$/);
  });

  it('collapses multiple newlines to double newline', () => {
    const result = processWritingHelper({
      content: 'Line one.\n\n\n\n\nLine two.',
      mode: 'polish',
    });
    expect(result.processed_text).not.toContain('\n\n\n');
  });
});
