import { describe, expect, it } from 'vitest';

import { styleConsistency } from '../../plugins/builtins/style-consistency.js';

describe('plugins/builtins/style-consistency', () => {
  it('flags mixed narration perspective and excessive exclamations', () => {
    const result = styleConsistency.detect(
      '我盯着他！你盯着她！我又想起他！你还在看她！',
    );

    expect(result.pluginId).toBe('builtin-style-consistency');
    expect(result.pluginName).toBe('风格一致性检测器');
    expect(result.evidence.some((item) => item.includes('人称混用'))).toBe(true);
    expect(result.evidence.some((item) => item.includes('感叹号密度偏高'))).toBe(true);
    expect(result.suggestions).toContain('保持人称一致，避免第一人称和第三人称混用');
    expect(result.suggestions).toContain('减少感叹号使用，用描写代替感叹');
    expect(result.score).toBeLessThan(8);
  });

  it('recognizes mostly consistent perspective and warns when sentence lengths are too uniform', () => {
    const result = styleConsistency.detect(
      '我慢慢向前走去。我轻轻推开木门。我悄悄看见灯火。我安静翻开纸页。你只是站在门边。我又回头看向走廊。',
    );

    expect(result.evidence).toContain('人称基本统一（第一人称为主）');
    expect(result.suggestions).toContain('句式长度过于均匀，尝试长短句交替');
    expect(result.details).toMatchObject({
      avgSentenceLength: expect.any(Number),
      sentenceCount: 6,
    });
    expect(result.score).toBe(10);
  });

  it('rewards varied sentence structure when no perspective markers are present', () => {
    const result = styleConsistency.detect(
      '夜风穿过空巷，带着潮湿铁锈味，沿着剥落砖墙一点点挤进昏暗门厅。门忽然响了一下。远处又传来急促脚步声。窗玻璃在冷意里细细颤抖着。',
    );

    expect(result.evidence.some((item) => item.includes('句式有变化'))).toBe(true);
    expect(result.suggestions).not.toContain('句式长度过于均匀，尝试长短句交替');
    expect(result.suggestions).not.toContain('减少感叹号使用，用描写代替感叹');
    expect(result.score).toBe(9);
  });
});
