import { describe, expect, it } from 'vitest';

import {
  extractEntities,
  calculateStyleFeatures,
  detectWorldviewElements,
  extractBasicInsights,
  parseDocument,
  segmentText,
} from '../../learning/extraction-utils';

describe('extraction-utils', () => {
  describe('parseDocument', () => {
    it('returns stripped text for txt format', () => {
      const doc = parseDocument('Hello world', 'txt');
      expect(doc).toBe('Hello world');
    });

    it('strips YAML frontmatter for md format', () => {
      const md = '---\ntitle: test\n---\nContent here';
      const doc = parseDocument(md, 'md');
      expect(doc).toBe('Content here');
    });

    it('returns raw text for unknown format', () => {
      expect(parseDocument('raw text', 'unknown')).toBe('raw text');
    });
  });

  describe('segmentText', () => {
    it('segments text by paragraph mode', () => {
      const text = 'Para one\n\nPara two\n\nPara three';
      const segments = segmentText(text, 'paragraph');
      expect(segments.length).toBe(3);
      expect(segments[0].content).toBe('Para one');
    });

    it('segments text by chapter mode with chapter headings', () => {
      const text = 'Intro\n第一章 开始\nContent of chapter 1\n第二章 发展\nContent of chapter 2';
      const segments = segmentText(text, 'chapter');
      expect(segments.length).toBeGreaterThanOrEqual(2);
    });

    it('returns single segment for short text', () => {
      const segments = segmentText('short text', 'paragraph');
      expect(segments.length).toBe(1);
    });
  });

  describe('extractEntities', () => {
    it('extracts named entities from dialogue patterns', () => {
      // Names must appear 2+ times in dialogue attribution patterns
      const text = `「来吧。」林风说道。「走。」陈墨说道。「好。」林风说道。`;
      const entities = extractEntities(text);
      expect(entities.length).toBeGreaterThan(0);
    });

    it('returns empty array for empty text', () => {
      expect(extractEntities('')).toEqual([]);
    });
  });

  describe('calculateStyleFeatures', () => {
    it('produces dimension values between 0 and 1', () => {
      const features = calculateStyleFeatures('这是一段测试文本。短句子。还有更长的句子用来测试风格特征计算。');
      for (const [key, val] of Object.entries(features.dimensions)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
      expect(features.summary).toBeTruthy();
      expect(features.confidence).toBeGreaterThanOrEqual(0);
    });

    it('produces consistent results for same input', () => {
      const text = '重复文本重复文本重复文本。';
      const a = calculateStyleFeatures(text);
      const b = calculateStyleFeatures(text);
      expect(a.dimensions).toEqual(b.dimensions);
    });
  });

  describe('detectWorldviewElements', () => {
    it('detects cultural concepts', () => {
      const text = '在这个世界中，所有魔法都源自元素之力。火元素代表热情，水元素代表智慧。';
      const elements = detectWorldviewElements(text);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('returns empty for generic text', () => {
      const elements = detectWorldviewElements('今天天气很好，出门散步。');
      expect(elements.length).toBe(0);
    });
  });

  describe('extractBasicInsights', () => {
    it('extracts insights with source metadata', () => {
      const insights = extractBasicInsights('师父告诉他真正的剑道在于正义。', 'book-1', 'ch1');
      for (const insight of insights) {
        expect(insight.source).toBe('book-1');
        expect(insight.chapter).toBe('ch1');
      }
    });
  });
});
