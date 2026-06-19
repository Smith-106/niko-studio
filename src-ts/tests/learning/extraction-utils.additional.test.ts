import { describe, expect, it } from 'vitest';

import {
  calculateStyleFeatures,
  detectWorldviewElements,
  extractEntities,
  parseDocument,
  segmentText,
} from '../../learning/extraction-utils';
import { EntityType, WorldviewCategory } from '../../learning/learning-types';

describe('extraction-utils additional coverage', () => {
  it('covers raw document formats and chapter segmentation fallback edges', () => {
    expect(parseDocument('raw pdf text', 'pdf')).toBe('raw pdf text');
    expect(parseDocument('raw docx text', 'docx')).toBe('raw docx text');

    const brokenFrontmatter = '---\ntitle: broken\nsummary: missing closer';
    expect(parseDocument(brokenFrontmatter, 'md')).toBe(brokenFrontmatter);

    expect(segmentText('Plain body only', 'chapter')).toEqual([
      {
        index: 0,
        content: 'Plain body only',
      },
    ]);
    expect(segmentText('   ', 'chapter')).toEqual([]);
  });

  it('covers repeated location extraction and empty style-feature fallbacks', () => {
    const entities = extractEntities(
      '\u4ed6\u5728\u661f\u6e2f\u3002\u5979\u5230\u661f\u6e2f\u3002\u540e\u6765\u53c8\u53bb\u661f\u6e2f\u3002',
    );

    expect(entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '\u661f\u6e2f',
          type: EntityType.LOCATION,
          mentions: 2,
        }),
      ]),
    );

    const features = calculateStyleFeatures('');
    expect(features).toMatchObject({
      summary: '0 words, 0 sentences, 0 paragraphs',
      confidence: 0,
    });
    expect(features.dimensions).toMatchObject({
      vocabulary_richness: 0,
      avg_word_length: 0,
      avg_sentence_length: 0,
      dialogue_ratio: 0,
      emotional_valence: 0,
    });
  });

  it('covers long-sentence complexity branches for style features', () => {
    const mediumSentence = `${Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ')}.`;
    const highSentence = `${Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ')}.`;

    const mediumFeatures = calculateStyleFeatures(mediumSentence);
    const highFeatures = calculateStyleFeatures(highSentence);

    expect(mediumFeatures.dimensions.sentence_complexity).toBe(0.5);
    expect(highFeatures.dimensions.sentence_complexity).toBe(0.8);
  });

  it('covers worldview evidence accumulation for repeated keywords', () => {
    const elements = detectWorldviewElements(
      '\u9b54\u6cd5\u5728\u738b\u56fd\u4e2d\u6d41\u4f20\uff0c\u53e4\u8001\u7684\u9b54\u6cd5\u4ecd\u88ab\u9b54\u6cd5\u5b66\u9662\u5b88\u62a4\u3002',
    );

    expect(elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '\u9b54\u6cd5',
          category: WorldviewCategory.MAGIC_SYSTEM,
          confidence: 0.8,
          evidence: expect.arrayContaining([expect.any(String)]),
        }),
      ]),
    );
  });
});
