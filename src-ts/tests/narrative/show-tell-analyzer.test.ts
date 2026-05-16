import { describe, expect, it } from 'vitest';
import { analyzeShowTell } from '../../narrative/show-tell-analyzer';

const SHOW_HEAVY_TEXT = `他攥紧了拳头，咬紧牙关，一拳砸在桌上。眼眶泛红，转过头去。手指颤抖着，呼吸急促。冰凉的夜风吹过，他闻到了焦味和血腥味。刺耳的嘶吼声回荡在走廊里，他尝到了苦涩的滋味。那把刀在昏暗中闪着寒光。`;
const TELL_HEAVY_TEXT = `他很生气，非常愤怒，心里特别难过。她是一个美丽善良的女孩，让人觉得十分温暖。他的心情复杂，感到无比绝望。这是一种让人觉得非常恐惧的感觉。`;
const BALANCED_TEXT = `他攥紧了拳头，心里很不是滋味。眼眶泛红，但她只是淡淡地说了一句。冰凉的指尖触碰到那张陈旧的信纸，上面模糊的字迹让人心里五味杂陈。`;

describe('Show vs Tell Analyzer', () => {
  it('detects show-heavy text', () => {
    const result = analyzeShowTell(SHOW_HEAVY_TEXT);

    expect(result.showTellRatio).toBeGreaterThan(0.5);
    expect(result.showCount).toBeGreaterThan(0);
  });

  it('detects tell-heavy text', () => {
    const result = analyzeShowTell(TELL_HEAVY_TEXT);

    expect(result.showTellRatio).toBeLessThan(0.5);
    expect(result.tellCount).toBeGreaterThan(0);
  });

  it('analyzes sensory coverage', () => {
    const result = analyzeShowTell(SHOW_HEAVY_TEXT);

    expect(result.sensoryCoverage.visual).toBeGreaterThan(0);
    expect(result.sensoryCoverage.auditory).toBeGreaterThan(0);
    expect(result.sensoryCoverage.tactile).toBeGreaterThan(0);
    expect(result.sensoryCoverage.olfactory).toBeGreaterThan(0);
    expect(result.sensoryCoverage.gustatory).toBeGreaterThan(0);
    expect(result.sensoryCoverage.overall).toBeGreaterThan(0);
  });

  it('generates paragraph-level heat map', () => {
    const multiPara = `${SHOW_HEAVY_TEXT}\n\n${TELL_HEAVY_TEXT}\n\n${BALANCED_TEXT}`;
    const result = analyzeShowTell(multiPara);

    expect(result.heatMap.length).toBeGreaterThanOrEqual(3);
    expect(result.heatMap[0].showCount).toBeGreaterThan(0);
    expect(result.heatMap[0]).toHaveProperty('ratio');
    expect(result.heatMap[0]).toHaveProperty('dominantSense');
  });

  it('computes abstract vs concrete ratio', () => {
    const result = analyzeShowTell(TELL_HEAVY_TEXT);
    expect(result.abstractVsConcrete).toBeGreaterThanOrEqual(0);
    expect(result.abstractVsConcrete).toBeLessThanOrEqual(1);
  });

  it('provides suggestions for low show ratio', () => {
    const result = analyzeShowTell(TELL_HEAVY_TEXT);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('handles empty text', () => {
    const result = analyzeShowTell('');
    expect(result.showTellRatio).toBe(0);
    expect(result.heatMap).toHaveLength(0);
  });
});
