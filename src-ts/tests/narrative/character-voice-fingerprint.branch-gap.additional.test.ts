import { afterEach, describe, expect, it, vi } from 'vitest';

type MockDialogueLine = {
  speaker: string;
  content: string;
  charPosition: number;
};

async function loadCharacterVoiceModule(lines: MockDialogueLine[]) {
  vi.resetModules();
  vi.doMock('../../narrative/dialogue-analyzer', () => ({
    DialogueAnalyzer: class {
      analyzeDialogue() {
        return { lines };
      }
    },
  }));
  return import('../../narrative/character-voice-fingerprint');
}

describe('character voice fingerprint branch gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('flags low distinctness and missing catchphrases for similar voices', async () => {
    const { extractVoiceFingerprints } = await loadCharacterVoiceModule([
      { speaker: 'Alpha', content: 'trace clue', charPosition: 0 },
      { speaker: 'Alpha', content: 'review proof', charPosition: 1 },
      { speaker: 'Beta', content: 'trace clue', charPosition: 2 },
      { speaker: 'Beta', content: 'review proof', charPosition: 3 },
    ]);

    const result = extractVoiceFingerprints('ignored');

    expect(result.fingerprints).toHaveLength(2);
    expect(result.voiceDistinctness).toBeLessThan(0.3);
    expect(result.fingerprints.every((fp) => fp.catchphrases.length === 0)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
    expect(result.suggestions.some((entry) => entry.includes('Alpha'))).toBe(true);
    expect(result.suggestions.some((entry) => entry.includes('Beta'))).toBe(true);
  });

  it('emits the completion suggestion when voices are distinct and each character has catchphrases', async () => {
    const { extractVoiceFingerprints } = await loadCharacterVoiceModule([
      { speaker: 'Alpha', content: '老子 老子 上', charPosition: 0 },
      { speaker: 'Alpha', content: '老子 老子 撤', charPosition: 1 },
      { speaker: 'Beta', content: '在下 在下 恳请阁下三思，天哪此事绝非儿戏，无论如何请先退后', charPosition: 2 },
      { speaker: 'Beta', content: '在下 在下 敬请尊驾留步，哎呀此局牵连甚广，无论如何请先退后', charPosition: 3 },
    ]);

    const result = extractVoiceFingerprints('ignored');

    expect(result.fingerprints).toHaveLength(2);
    expect(result.voiceDistinctness).toBeGreaterThanOrEqual(0.3);
    expect(result.fingerprints.every((fp) => fp.catchphrases.length > 0)).toBe(true);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toContain('完成');
  });

  it('raises high severity when formality drift is extreme', async () => {
    const { checkVoiceConsistency } = await loadCharacterVoiceModule([]);

    const warning = checkVoiceConsistency({
      character: 'Lead',
      dialogueCount: 5,
      sentenceLengthPreference: 12,
      catchphrases: ['老子'],
      formalityLevel: 0,
      emotionalExpressionTendency: 0.2,
      rhetoricalHabits: [],
      sampleDialogues: ['sample'],
    }, '请 您 贵 敬 恳请 诚 在下');

    expect(warning).not.toBeNull();
    expect(warning?.severity).toBe('high');
  });

  it('keeps severity below high when formality drift is noticeable but not extreme', async () => {
    const { checkVoiceConsistency } = await loadCharacterVoiceModule([]);

    const warning = checkVoiceConsistency({
      character: 'Lead',
      dialogueCount: 5,
      sentenceLengthPreference: 12,
      catchphrases: ['老子'],
      formalityLevel: 0,
      emotionalExpressionTendency: 0.2,
      rhetoricalHabits: [],
      sampleDialogues: ['sample'],
    }, '请 您 在下 老子 老娘');

    expect(warning).not.toBeNull();
    expect(warning?.severity).not.toBe('high');
  });
});
