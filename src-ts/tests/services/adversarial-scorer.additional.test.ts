import { describe, expect, it } from 'vitest';

import type { QualityReport } from '../../services/narrative-analyzer.js';
import { AdversarialScorer } from '../../services/adversarial-scorer.js';

function makeReport(): QualityReport {
  return {
    overall: 72,
    criticalIssues: [],
    suggestions: [],
    dimensions: {
      emotion_craft: 45,
      suspense: 45,
      hook: 70,
    },
  };
}

describe('services/adversarial-scorer additional coverage', () => {
  it('defends emotion craft findings when the text contains explicit emotion cues', () => {
    const scorer = new AdversarialScorer({
      generateQualityReport: () => makeReport(),
    } as never);

    const result = scorer.score('她感到胸口发紧，呼吸乱了半拍。');
    const defended = result.defenseResults.find((entry) => entry.defect.includes('emotion_craft'));

    expect(defended).toMatchObject({
      upheld: false,
      reason: '文本包含情感描写，工艺并非完全缺失',
    });
  });

  it('defends suspense findings when dialogue markers are present', () => {
    const scorer = new AdversarialScorer({
      generateQualityReport: () => makeReport(),
    } as never);

    const result = scorer.score('「你确定要现在进去吗？」她压低声音问。');
    const defended = result.defenseResults.find((entry) => entry.defect.includes('suspense'));

    expect(defended).toMatchObject({
      upheld: false,
      reason: '对话可能隐含悬念元素',
    });
  });

  it('uses explicit maxIterations and defends hook findings for long conflict-heavy text', () => {
    const scorer = new AdversarialScorer({
      generateQualityReport: () => ({
        overall: 68,
        criticalIssues: [],
        suggestions: [],
        dimensions: {
          hook: 45,
        },
      }),
    } as never);

    const text = `${'然而，他还是推开了门。'.repeat(30)}但是答案依旧躲在更深的阴影里。`;
    const result = scorer.score(text, { maxIterations: 3 });
    const defended = result.defenseResults.find((entry) => entry.defect.includes('hook'));

    expect(result.iterations).toBe(3);
    expect(defended).toMatchObject({
      upheld: false,
      reason: '文本包含冲突标记，钩子并非完全缺失',
    });
  });
});
