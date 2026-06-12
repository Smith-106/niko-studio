import { describe, expect, it, vi } from 'vitest';

import {
  computeOverallAssessment,
  getOverallStrength,
  getStrengthLevel,
  NarrativeVoiceManager,
  VoiceStrength,
} from '../../narrative/narrative-voice';

describe('NarrativeVoiceManager', () => {
  it('computes overall voice strength and assessment helpers deterministically', () => {
    const metrics = {
      detailSpecificity: 8,
      sensoryRichness: 7,
      voiceConfidence: 8,
      authorPresence: 9,
    };

    expect(getOverallStrength(metrics)).toBe(7.95);
    expect(getStrengthLevel(metrics)).toBe(VoiceStrength.STRONG);
    expect(computeOverallAssessment(metrics)).toContain('较强');
  });

  it('analyzes detail specificity, sensory richness, confidence, and presence without llm', async () => {
    const manager = new NarrativeVoiceManager();
    const content =
      '金斯顿的丝质窗帘在昏暗灯光里泛着冷光，他听到低语，指尖触到粗糙墙面，显然这里不再安全。';

    const metrics = await manager.analyzeVoice(content);

    expect(metrics.detailSpecificity).toBeGreaterThan(5);
    expect(metrics.sensoryRichness).toBeGreaterThanOrEqual(4);
    expect(metrics.voiceConfidence).toBeLessThanOrEqual(8);
    expect(metrics.authorPresence).toBeGreaterThanOrEqual(6);
  });

  it('uses mock weak or strong passages and suggestion priorities when llm is absent', async () => {
    const manager = new NarrativeVoiceManager();

    const weak = await manager.identifyWeakPassages('他是一个好人。');
    const strong = await manager.extractStrongPassages('她看见光，听见雨，闻到焦味。');
    const suggestions = await manager.suggestVoiceStrengthening('text', {
      detailSpecificity: 6,
      sensoryRichness: 5,
      voiceConfidence: 6,
      authorPresence: 5,
    });

    expect(weak.length).toBeGreaterThan(0);
    expect(strong.length).toBeGreaterThan(0);
    expect(suggestions).toHaveLength(4);
  });

  it('maps llm voice analysis and weak passage detection into full public output', async () => {
    const llmClient = {
      generateJson: vi
        .fn()
        .mockResolvedValueOnce({
          detail_specificity: 8.5,
          sensory_richness: 7.5,
          voice_confidence: 8.0,
          author_presence: 8.5,
        })
        .mockResolvedValueOnce({
          weak_passages: [
            {
              location: '第二段',
              original_text: '他很好',
              issue: '过于抽象',
              suggestion: '增加具体动作',
              improved_example: '他把帽檐压低，侧身让路。',
            },
          ],
          strong_passages: ['雾气沿街灯爬行'],
        }),
    };
    const manager = new NarrativeVoiceManager(llmClient as never);

    const result = await manager.analyzeFull('雾气沿街灯爬行，他很好。');

    expect(llmClient.generateJson).toHaveBeenCalledTimes(2);
    expect(result.metrics.detailSpecificity).toBe(8.5);
    expect(result.weakPassages[0]).toMatchObject({
      location: '第二段',
      improvedExample: '他把帽檐压低，侧身让路。',
    });
    expect(result.strongPassages).toEqual(['雾气沿街灯爬行']);
    expect(result.overallAssessment.length).toBeGreaterThan(0);
  });

  it('maps every strength level to a concrete overall assessment', () => {
    expect(computeOverallAssessment({
      detailSpecificity: 9,
      sensoryRichness: 9,
      voiceConfidence: 9,
      authorPresence: 9,
    })).toContain('权威');
    expect(computeOverallAssessment({
      detailSpecificity: 7,
      sensoryRichness: 7,
      voiceConfidence: 7,
      authorPresence: 7,
    })).toContain('较强');
    expect(computeOverallAssessment({
      detailSpecificity: 5,
      sensoryRichness: 5,
      voiceConfidence: 5,
      authorPresence: 5,
    })).toContain('中等');
    expect(computeOverallAssessment({
      detailSpecificity: 1,
      sensoryRichness: 1,
      voiceConfidence: 1,
      authorPresence: 1,
    })).toContain('薄弱');
  });

  it('extracts strong passages through the llm path when no cached weak-passages response exists', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValueOnce({
        strong_passages: ['standalone strong passage'],
      }),
    };
    const manager = new NarrativeVoiceManager(llmClient as never);

    await expect(manager.extractStrongPassages('content')).resolves.toEqual([
      'standalone strong passage',
    ]);
    expect(llmClient.generateJson).toHaveBeenCalledTimes(1);
  });
});
