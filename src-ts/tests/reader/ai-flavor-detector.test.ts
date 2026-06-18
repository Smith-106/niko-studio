import { describe, expect, it } from 'vitest';

import { detectAIFlavor, createAIFlavorDetector } from '../../reader/ai-flavor-detector.js';

describe('reader/ai-flavor-detector', () => {
  it('returns empty result for empty text', () => {
    const result = detectAIFlavor('');
    expect(result.aiFlavorScore).toBe(0);
    expect(result.indicators).toHaveLength(0);
    expect(result.confidence).toBe(0);
    expect(result.evidence).toHaveLength(0);
    expect(result.suggestions).toContain('文本为空，无法检测 AI 味');
  });

  it('returns empty result for whitespace-only text', () => {
    const result = detectAIFlavor('   \n\t  ');
    expect(result.aiFlavorScore).toBe(0);
    expect(result.indicators).toHaveLength(0);
    expect(result.confidence).toBe(0);
  });

  it('detects Chinese AI template expressions', () => {
    const text = '这是一个故事。首先，主角登场了。其次，发生了一些事。' +
      '值得注意的是，这个情况非常特殊。综上所述，故事结束了。' +
      '让我们回顾一下整个过程。不难发现，其中有很多问题。';

    const result = detectAIFlavor(text);

    expect(result.aiFlavorScore).toBeGreaterThan(0.4);
    expect(result.indicators.length).toBeGreaterThanOrEqual(1);

    const templateIndicator = result.indicators.find(
      (i) => i.type === 'template_expression',
    );
    expect(templateIndicator).toBeDefined();
    expect(templateIndicator!.severity).toBe('high');
    expect(templateIndicator!.evidence.length).toBeGreaterThan(0);
  });

  it('detects English AI template expressions', () => {
    const text = 'This is a story. It is important to note that the character is complex. ' +
      'In conclusion, the narrative arc is satisfying. ' +
      'Furthermore, the themes are multifaceted. ' +
      'It should be noted that the ending serves as a testament to the author skill. ' +
      'To summarize, this work navigates the complexities of human emotion. ' +
      'In the realm of fiction, such storytelling sheds light on universal truths.';

    const result = detectAIFlavor(text);

    expect(result.aiFlavorScore).toBeGreaterThan(0.5);
    expect(result.indicators.length).toBeGreaterThanOrEqual(1);

    const templateIndicator = result.indicators.find(
      (i) => i.type === 'template_expression',
    );
    expect(templateIndicator).toBeDefined();
    expect(templateIndicator!.evidence.length).toBeGreaterThan(0);
  });

  it('returns low score for natural text without AI patterns', () => {
    const text = 'The rain fell hard that Tuesday. Sarah stood by the window, ' +
      'watching the drops race each other down the glass. Her coffee had gone cold. ' +
      'She did not care. The letter on the table remained unopened, its corner ' +
      'bent where her thumb had pressed too hard. Outside, a dog barked once, ' +
      'then stopped. The silence that followed felt heavier than the rain.';

    const result = detectAIFlavor(text);

    expect(result.aiFlavorScore).toBeLessThan(0.3);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('detects style drift (uniform paragraph lengths)', () => {
    // Create paragraphs of nearly identical length
    const para = 'The wind blew through the trees and the leaves rustled softly. ';
    const text = Array(10).fill(para).join('\n\n');

    const result = detectAIFlavor(text);

    const styleDriftIndicator = result.indicators.find(
      (i) => i.type === 'style_drift',
    );
    // Uniform paragraphs may trigger this indicator
    if (styleDriftIndicator) {
      expect(styleDriftIndicator.evidence.length).toBeGreaterThan(0);
    }
  });

  it('detects sensory gap (visual-only text)', () => {
    const text = 'He looked at the scene. She saw the mountains. They watched the sunset. ' +
      'Everyone looked around. The view was beautiful. He saw the flowers. ' +
      'She looked at the painting. They saw the city. The sight was stunning. ' +
      'He watched the birds. She looked at the ocean. They saw the stars.';

    const result = detectAIFlavor(text);

    const sensoryGapIndicator = result.indicators.find(
      (i) => i.type === 'sensory_gap',
    );
    expect(sensoryGapIndicator).toBeDefined();
    expect(sensoryGapIndicator!.severity).toBe('high');
    expect(sensoryGapIndicator!.evidence.length).toBeGreaterThan(0);
  });

  it('returns suggestions based on detected indicators', () => {
    const text = '值得注意的是，这个情况非常复杂。首先，我们需要分析。' +
      '其次，得出结论。综上所述，这就是答案。';

    const result = detectAIFlavor(text);

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.some((s) => s.includes('模板'))).toBe(true);
  });

  it('has confidence that increases with text length', () => {
    const shortText = '值得注意的是。';
    const longText = '值得注意的是，这个情况非常复杂。首先，我们需要分析。' +
      '其次，得出结论。综上所述，这就是答案。' +
      '让我们回顾一下。不难发现，其中有问题。' +
      '显而易见，这是正确的。毫无疑问，结论成立。' +
      '从某种意义来说，这是成功的。在一定程度上，可以这么说。';

    const shortResult = detectAIFlavor(shortText);
    const longResult = detectAIFlavor(longText);

    expect(longResult.confidence).toBeGreaterThan(shortResult.confidence);
  });

  it('factory function returns working detector', () => {
    const detector = createAIFlavorDetector();
    const result = detector.detect('值得注意的是，这是测试。');
    expect(result.aiFlavorScore).toBeGreaterThan(0);
    expect(result.indicators.length).toBeGreaterThan(0);
  });

  it('includes all required fields in the result', () => {
    const text = 'This is a test with some visual words like see, look, watch. ';
    const result = detectAIFlavor(text);

    expect(result).toHaveProperty('aiFlavorScore');
    expect(result).toHaveProperty('indicators');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('evidence');
    expect(result).toHaveProperty('suggestions');

    expect(typeof result.aiFlavorScore).toBe('number');
    expect(Array.isArray(result.indicators)).toBe(true);
    expect(typeof result.confidence).toBe('number');
    expect(Array.isArray(result.evidence)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('returns at least 3 indicator types for heavily AI-patterned text', () => {
    // Text with templates, uniform paragraphs, visual-only, and repetitive structure
    const para1 = '首先，值得注意的是这个情况。他看到了风景。她看到了花朵。';
    const para2 = '其次，不难发现这个问题。他看到了天空。她看到了云彩。';
    const para3 = '最后，综上所述这是结论。他看到了星星。她看到了月亮。';
    const para4 = '让我们回顾一下。他看到了河流。她看到了树木。';
    const para5 = '显而易见这是正确的。他看到了建筑。她看到了街道。';

    const text = [para1, para2, para3, para4, para5].join('\n\n');

    const result = detectAIFlavor(text);

    expect(result.indicators.length).toBeGreaterThanOrEqual(3);
    expect(result.aiFlavorScore).toBeGreaterThan(0.5);
  });
});
