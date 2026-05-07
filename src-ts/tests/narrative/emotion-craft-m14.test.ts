import { describe, expect, it } from 'vitest';

import {
  EmotionLayer,
  EmotionMode,
  EmotionCraftResult,
  LayerDetectionPattern,
  LayerDetection,
  EmotionLayerResult,
  LAYER_DETECTION_PATTERNS,
  analyzeEmotionCraft,
  analyzeEmotionLayers,
} from '../../narrative/writing-craft/emotion-craft';

describe('EmotionCraft — M14 emotion layers', () => {
  describe('EmotionLayer enum', () => {
    it('has exactly 5 entries', () => {
      const values = Object.values(EmotionLayer);
      expect(values).toHaveLength(5);
    });

    it('contains all 5 layer types', () => {
      expect(EmotionLayer.PHYSICAL_SENSATION).toBe('physical_sensation');
      expect(EmotionLayer.BEHAVIORAL_EXPRESSION).toBe('behavioral_expression');
      expect(EmotionLayer.INTERNAL_MONOLOGUE).toBe('internal_monologue');
      expect(EmotionLayer.METAPHORICAL).toBe('metaphorical');
      expect(EmotionLayer.SUBTEXT_UNDERSTATEMENT).toBe('subtext_understatement');
    });
  });

  describe('LAYER_DETECTION_PATTERNS', () => {
    it('has exactly 5 entries matching EmotionLayer', () => {
      const keys = Object.keys(LAYER_DETECTION_PATTERNS);
      const enumValues = Object.values(EmotionLayer);
      expect(keys.sort()).toEqual(enumValues.sort());
    });

    it('each pattern entry has required fields with valid values', () => {
      for (const [key, entry] of Object.entries(LAYER_DETECTION_PATTERNS)) {
        expect(entry.layer).toBe(key as EmotionLayer);
        expect(entry.label).toBeTruthy();
        expect(entry.patterns.length).toBeGreaterThan(0);
        expect(entry.examplePhrases.length).toBeGreaterThan(0);
        expect(entry.difficultyWeight).toBeGreaterThan(0);
      }
    });

    it('all difficultyWeights are positive numbers', () => {
      for (const entry of Object.values(LAYER_DETECTION_PATTERNS)) {
        expect(typeof entry.difficultyWeight).toBe('number');
        expect(entry.difficultyWeight).toBeGreaterThan(0);
      }
    });
  });

  describe('LayerDetection interface', () => {
    it('can be constructed with all fields', () => {
      const detection: LayerDetection = {
        layer: EmotionLayer.PHYSICAL_SENSATION,
        label: '生理感受',
        hitCount: 5,
        evidence: ['心跳', '呼吸'],
        score: 7,
        richness: 3.5,
      };
      expect(detection.layer).toBe(EmotionLayer.PHYSICAL_SENSATION);
      expect(detection.hitCount).toBe(5);
    });
  });

  describe('EmotionLayerResult interface', () => {
    it('can be constructed with all fields', () => {
      const result: EmotionLayerResult = {
        detections: [],
        totalLayersUsed: 3,
        layerDiversityScore: 6,
        overallRichness: 4.5,
        depthLevel: '中',
        suggestions: ['缺少生理感受描写'],
      };
      expect(result.totalLayersUsed).toBe(3);
      expect(result.depthLevel).toBe('中');
    });
  });

  describe('analyzeEmotionLayers()', () => {
    it('detects all 5 layers in richly layered emotional text', () => {
      const text = '她心跳加速，呼吸变得急促。他攥紧拳头，后退了一步。'
        + '她心想，难道这一切都是徒劳？'
        + '仿佛整个世界都安静了下来，如同坠入冰窟。'
        + '他只是微微一笑，淡淡地说了一句"嗯"。';

      const result = analyzeEmotionLayers(text);

      expect(result.detections).toHaveLength(5);
      // 每个层至少应该有一些命中
      const layersWithHits = result.detections.filter((d) => d.hitCount > 0);
      expect(layersWithHits.length).toBeGreaterThanOrEqual(4);
    });

    it('returns low scores for plain factual text without emotional layers', () => {
      const text = '他走到门前，打开了锁，推门进去。房间里有一张桌子和两把椅子。';
      const result = analyzeEmotionLayers(text);

      expect(result.overallRichness).toBeLessThan(5);
      expect(result.depthLevel).toBe('浅');
    });

    it('detects physical sensation layer via body keywords', () => {
      const text = '她的心跳得厉害，双手冰凉，头皮发麻';
      const result = analyzeEmotionLayers(text);

      const physicalDetection = result.detections.find(
        (d) => d.layer === EmotionLayer.PHYSICAL_SENSATION
      );
      expect(physicalDetection).toBeDefined();
      expect(physicalDetection!.hitCount).toBeGreaterThanOrEqual(2);
    });

    it('detects behavioral expression layer via action keywords', () => {
      const text = '他攥紧了拳头，低声吼了一句，然后转头避开对方的目光';
      const result = analyzeEmotionLayers(text);

      const behavioralDetection = result.detections.find(
        (d) => d.layer === EmotionLayer.BEHAVIORAL_EXPRESSION
      );
      expect(behavioralDetection).toBeDefined();
      expect(behavioralDetection!.hitCount).toBeGreaterThanOrEqual(2);
    });

    it('detects internal monologue via thought keywords', () => {
      const text = '他心想，难道我真的做错了？他质问自己，为什么总是这样';
      const result = analyzeEmotionLayers(text);

      const monologueDetection = result.detections.find(
        (d) => d.layer === EmotionLayer.INTERNAL_MONOLOGUE
      );
      expect(monologueDetection).toBeDefined();
      expect(monologueDetection!.hitCount).toBeGreaterThanOrEqual(1);
    });

    it('detects metaphorical layer via comparison keywords', () => {
      const text = '他的心像被撕裂了一般，仿佛坠入无底深渊，如同被世界遗弃';
      const result = analyzeEmotionLayers(text);

      const metaphoricalDetection = result.detections.find(
        (d) => d.layer === EmotionLayer.METAPHORICAL
      );
      expect(metaphoricalDetection).toBeDefined();
      expect(metaphoricalDetection!.hitCount).toBeGreaterThanOrEqual(1);
    });

    it('detects subtext/understatement layer via subtle keywords', () => {
      const text = '她只是微微一笑了之，轻轻地说了一声哦，然后装作没听见，不再说话';
      const result = analyzeEmotionLayers(text);

      const subtextDetection = result.detections.find(
        (d) => d.layer === EmotionLayer.SUBTEXT_UNDERSTATEMENT
      );
      expect(subtextDetection).toBeDefined();
      expect(subtextDetection!.hitCount).toBeGreaterThanOrEqual(1);
    });

    it('generates suggestions for missing layers', () => {
      // 纯行为文本缺少生理感受、内心独白、隐喻、潜台词
      const text = '他攥紧拳头，后退了一步';
      const result = analyzeEmotionLayers(text);

      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('computes layerDiversityScore correctly', () => {
      const text = '她心跳加速，他攥紧拳头，她心想这不对，仿佛天塌了，他只是微微一笑';
      const result = analyzeEmotionLayers(text);

      expect(result.layerDiversityScore).toBeGreaterThanOrEqual(0);
      expect(result.layerDiversityScore).toBeLessThanOrEqual(10);
    });

    it('returns depthLevel of 浅/中/深', () => {
      const richText = '她心跳加速呼吸急促，他攥紧拳头后退一步，她心想难道这一切都是徒劳，'
        + '仿佛整个世界都安静了如同坠入冰窟，他只是微微一笑淡淡说了一句嗯';

      const result = analyzeEmotionLayers(richText);
      expect(['浅', '中', '深']).toContain(result.depthLevel);
    });
  });

  describe('EmotionCraftResult with layer fields', () => {
    it('includes layerRichness in analyzeEmotionCraft result', () => {
      const text = '她心跳加速，呼吸变得急促。他攥紧拳头，后退了一步。'
        + '她心想，难道这一切都是徒劳？仿佛整个世界都安静了下来。'
        + '他只是微微一笑，淡淡地说了一句"嗯"。';

      const result = analyzeEmotionCraft(text);

      expect(result.layerRichness).toBeDefined();
      expect(typeof result.layerRichness).toBe('number');
    });

    it('includes layerBreakdown in analyzeEmotionCraft result', () => {
      const text = '她心跳加速，他攥紧了拳头，她心想这不对，仿佛天塌了，他只是微微一笑';

      const result = analyzeEmotionCraft(text);

      expect(result.layerBreakdown).toBeDefined();
      expect(typeof result.layerBreakdown).toBe('object');
    });

    it('layerRichness matches overallRichness from analyzeEmotionLayers', () => {
      const text = '她心跳加速，呼吸变得急促。他攥紧拳头，后退了一步。'
        + '她心想，难道这一切都是徒劳？仿佛整个世界都安静了下来。'
        + '他只是微微一笑，淡淡地说了一句"嗯"。';

      const craftResult = analyzeEmotionCraft(text);
      const layerResult = analyzeEmotionLayers(text);

      expect(craftResult.layerRichness).toBe(layerResult.overallRichness);
    });

    it('backward compatible — old callers still work without new fields', () => {
      const result = analyzeEmotionCraft('她很生气，拳头攥紧');

      // 原有字段仍然存在
      expect(result.totalDetections).toBeDefined();
      expect(result.tellCount).toBeDefined();
      expect(result.showCount).toBeDefined();
      expect(result.showRatio).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.detections).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });
  });
});
