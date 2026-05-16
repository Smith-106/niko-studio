import { describe, expect, it } from 'vitest';
import {
  extractVoiceFingerprints,
  checkVoiceConsistency,
  type VoiceFingerprint,
} from '../../narrative/character-voice-fingerprint';

const DIALOGUE_TEXT = `
林岚冷冷地说"你确定要查下去？老子劝你别多管闲事。"
老陈叹了口气"在下只是提醒阁下，这条路不好走啊。"
林岚冷哼道"哼，不管怎样，我都要找到真相。"
林岚攥紧了拳头"老子说了，不管怎样都要查到底。"
老陈微微一笑"阁下何必如此执着？有时候放下也是一种智慧。"
`;

const NO_DIALOGUE_TEXT = '这是一段没有对话的文本，只有叙述。';

describe('Character Voice Fingerprint', () => {
  describe('extractVoiceFingerprints', () => {
    it('extracts fingerprints from dialogue text', () => {
      const result = extractVoiceFingerprints(DIALOGUE_TEXT);

      expect(result.fingerprints.length).toBeGreaterThan(0);
      expect(result.voiceDistinctness).toBeGreaterThanOrEqual(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('returns empty fingerprints for text without dialogue', () => {
      const result = extractVoiceFingerprints(NO_DIALOGUE_TEXT);
      expect(result.fingerprints).toHaveLength(0);
    });

    it('each fingerprint has required fields', () => {
      const result = extractVoiceFingerprints(DIALOGUE_TEXT);

      for (const fp of result.fingerprints) {
        expect(fp).toHaveProperty('character');
        expect(fp).toHaveProperty('dialogueCount');
        expect(fp).toHaveProperty('sentenceLengthPreference');
        expect(fp).toHaveProperty('catchphrases');
        expect(fp).toHaveProperty('formalityLevel');
        expect(fp).toHaveProperty('emotionalExpressionTendency');
        expect(fp).toHaveProperty('rhetoricalHabits');
        expect(fp).toHaveProperty('sampleDialogues');
        expect(fp.dialogueCount).toBeGreaterThan(0);
        expect(fp.formalityLevel).toBeGreaterThanOrEqual(0);
        expect(fp.formalityLevel).toBeLessThanOrEqual(1);
      }
    });

    it('detects formality differences between characters', () => {
      const result = extractVoiceFingerprints(DIALOGUE_TEXT);
      if (result.fingerprints.length >= 2) {
        const formalityValues = result.fingerprints.map((fp) => fp.formalityLevel);
        const hasVariety = new Set(formalityValues.map((v) => Math.round(v * 10))).size > 1;
        expect(hasVariety).toBe(true);
      }
    });
  });

  describe('checkVoiceConsistency', () => {
    it('returns null for consistent dialogue', () => {
      const fingerprint: VoiceFingerprint = {
        character: '林岚',
        dialogueCount: 5,
        sentenceLengthPreference: 20,
        catchphrases: ['老子'],
        formalityLevel: 0.2,
        emotionalExpressionTendency: 0.6,
        rhetoricalHabits: ['冷哼'],
        sampleDialogues: ['老子说了算'],
      };

      const warning = checkVoiceConsistency(fingerprint, '老子说了，不管怎样都要查到底。');
      expect(warning).toBeNull();
    });

    it('detects length deviation', () => {
      const fingerprint: VoiceFingerprint = {
        character: '林岚',
        dialogueCount: 5,
        sentenceLengthPreference: 10,
        catchphrases: [],
        formalityLevel: 0.5,
        emotionalExpressionTendency: 0.5,
        rhetoricalHabits: [],
        sampleDialogues: [],
      };

      const warning = checkVoiceConsistency(fingerprint, '这是一段非常非常长的对话内容，远远超过了角色通常的对话长度偏好，这样会造成角色声音不一致的感觉。');
      expect(warning).not.toBeNull();
      expect(warning!.severity).toBe('medium');
    });

    it('detects formality deviation', () => {
      const fingerprint: VoiceFingerprint = {
        character: '林岚',
        dialogueCount: 5,
        sentenceLengthPreference: 20,
        catchphrases: [],
        formalityLevel: 0.1,
        emotionalExpressionTendency: 0.5,
        rhetoricalHabits: [],
        sampleDialogues: [],
      };

      const warning = checkVoiceConsistency(fingerprint, '在下恳请您三思，此事关乎大局，不可轻举妄动啊。');
      expect(warning).not.toBeNull();
    });
  });
});
