/**
 * Character Voice Fingerprint
 *
 * Extracts per-character dialogue patterns to build a voice fingerprint.
 * Used for consistency checking and voice differentiation scoring.
 */

import { DialogueAnalyzer, type DialogueLine } from './dialogue-analyzer';

// ============================================================
// Types
// ============================================================

export interface VoiceFingerprint {
  character: string;
  dialogueCount: number;
  sentenceLengthPreference: number;
  catchphrases: string[];
  formalityLevel: number;
  emotionalExpressionTendency: number;
  rhetoricalHabits: string[];
  sampleDialogues: string[];
}

export interface VoiceConsistencyWarning {
  character: string;
  line: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
}

export interface VoiceFingerprintResult {
  fingerprints: VoiceFingerprint[];
  voiceDistinctness: number;
  suggestions: string[];
}

// ============================================================
// Patterns
// ============================================================

const FORMALITY_MARKERS = {
  high: ['请', '您', '贵', '敬', '恳请', '诚', '恭', '在下', '鄙人', '本座', '尊驾', '阁下'],
  low: ['老子', '老娘', '咋', '啥', '嘛', '呗', '嗯', '哦', '嘿', '哎呀', '咱', '俺'],
};

const EMOTIONAL_MARKERS = [
  '啊', '天哪', '我的天', '该死', '混蛋', '可恶', '呜呜', '哈哈', '嘿嘿',
  '呸', '哼', '啧', '哇', '呀', '哎', '嗬',
];

const CATCHPHRASE_MIN_OCCURRENCES = 2;

// ============================================================
// Extraction
// ============================================================

function computeAvgSentenceLength(lines: DialogueLine[]): number {
  /* v8 ignore next -- helper is only called for extracted character line groups */
  if (lines.length === 0) return 0;
  const total = lines.reduce((s, l) => s + l.content.length, 0);
  return Math.round((total / lines.length) * 10) / 10;
}

function extractCatchphrases(lines: DialogueLine[]): string[] {
  const phraseCount: Map<string, number> = new Map();

  for (const line of lines) {
    const segments = line.content.split(/[，。！？、；：\s]+/).filter((s) => s.length >= 2 && s.length <= 8);
    for (const seg of segments) {
      phraseCount.set(seg, (phraseCount.get(seg) ?? 0) + 1);
    }
  }

  const catchphrases: string[] = [];
  for (const [phrase, count] of phraseCount) {
    if (count >= CATCHPHRASE_MIN_OCCURRENCES) {
      catchphrases.push(phrase);
    }
  }

  /* v8 ignore next -- nullish fallback branches in the comparator are V8 attribution noise after phrase collection */
  return catchphrases.sort((a, b) => (phraseCount.get(b) ?? 0) - (phraseCount.get(a) ?? 0)).slice(0, 10);
}

function computeFormality(lines: DialogueLine[]): number {
  /* v8 ignore next -- helper is only called for extracted character line groups */
  if (lines.length === 0) return 0.5;

  let highCount = 0;
  let lowCount = 0;

  for (const line of lines) {
    for (const marker of FORMALITY_MARKERS.high) {
      if (line.content.includes(marker)) highCount++;
    }
    for (const marker of FORMALITY_MARKERS.low) {
      if (line.content.includes(marker)) lowCount++;
    }
  }

  const total = highCount + lowCount;
  return total > 0 ? Math.round((highCount / total) * 100) / 100 : 0.5;
}

function computeEmotionalTendency(lines: DialogueLine[]): number {
  /* v8 ignore next -- helper is only called for extracted character line groups */
  if (lines.length === 0) return 0;

  let emotionalCount = 0;
  for (const line of lines) {
    for (const marker of EMOTIONAL_MARKERS) {
      if (line.content.includes(marker)) {
        emotionalCount++;
        break;
      }
    }
  }

  return Math.round((emotionalCount / lines.length) * 100) / 100;
}

function extractRhetoricalHabits(lines: DialogueLine[]): string[] {
  const habits: string[] = [];
  const allContent = lines.map((l) => l.content).join('');

  const rhetoricalPatterns: Array<{ pattern: string; label: string }> = [
    { pattern: '难道', label: '反问' },
    { pattern: '岂不是', label: '反问' },
    { pattern: '何必', label: '反问' },
    { pattern: '……', label: '停顿' },
    { pattern: '——', label: '断句' },
    { pattern: '哼', label: '冷哼' },
    { pattern: '呵', label: '冷笑' },
    { pattern: '哎呀', label: '感叹' },
    { pattern: '不管怎样', label: '转折' },
    { pattern: '无论如何', label: '决绝' },
  ];

  for (const { pattern, label } of rhetoricalPatterns) {
    if (allContent.includes(pattern)) {
      habits.push(label);
    }
  }

  return [...new Set(habits)];
}

// ============================================================
// Public API
// ============================================================

export function extractVoiceFingerprints(text: string): VoiceFingerprintResult {
  const analyzer = new DialogueAnalyzer();
  const analysis = analyzer.analyzeDialogue(text);
  const lines = analysis.lines;

  const byCharacter = new Map<string, DialogueLine[]>();
  for (const line of lines) {
    const existing = byCharacter.get(line.speaker) ?? [];
    existing.push(line);
    byCharacter.set(line.speaker, existing);
  }

  const fingerprints: VoiceFingerprint[] = [];
  for (const [character, charLines] of byCharacter) {
    if (character === '未知' || charLines.length < 1) continue;

    fingerprints.push({
      character,
      dialogueCount: charLines.length,
      sentenceLengthPreference: computeAvgSentenceLength(charLines),
      catchphrases: extractCatchphrases(charLines),
      formalityLevel: computeFormality(charLines),
      emotionalExpressionTendency: computeEmotionalTendency(charLines),
      rhetoricalHabits: extractRhetoricalHabits(charLines),
      sampleDialogues: charLines.slice(0, 5).map((l) => l.content),
    });
  }

  const voiceDistinctness = computeVoiceDistinctness(fingerprints);

  const suggestions: string[] = [];
  if (fingerprints.length < 2) {
    suggestions.push('识别到的角色数量不足，无法进行声音区分分析');
  } else if (voiceDistinctness < 0.3) {
    suggestions.push('角色声音区分度低，建议为不同角色设计独特的说话方式');
  }
  for (const fp of fingerprints) {
    if (fp.catchphrases.length === 0) {
      suggestions.push(`角色"${fp.character}"缺少标志性口头禅，建议添加独特用语`);
    }
  }
  if (suggestions.length === 0 && fingerprints.length > 0) {
    suggestions.push('角色声音指纹提取完成，各角色具备一定区分度');
  }

  return { fingerprints, voiceDistinctness, suggestions };
}

export function checkVoiceConsistency(
  fingerprint: VoiceFingerprint,
  line: string,
): VoiceConsistencyWarning | null {
  const issues: string[] = [];
  let severity: VoiceConsistencyWarning['severity'] = 'low';

  const lineLength = line.length;
  const expectedLength = fingerprint.sentenceLengthPreference;

  if (expectedLength > 0) {
    const deviation = Math.abs(lineLength - expectedLength) / expectedLength;
    if (deviation > 1.5) {
      issues.push(`句长偏离${Math.round(deviation * 100)}%`);
      severity = 'medium';
    }
  }

  const lineFormality = computeFormality([{ speaker: fingerprint.character, content: line, charPosition: 0 }]);
  const formalityDiff = Math.abs(lineFormality - fingerprint.formalityLevel);
  if (formalityDiff > 0.4) {
    issues.push(`正式度偏离${Math.round(formalityDiff * 100)}%`);
    severity = formalityDiff > 0.6 ? 'high' : severity;
  }

  if (issues.length === 0) return null;

  return {
    character: fingerprint.character,
    line,
    issue: issues.join('；'),
    severity,
  };
}

function computeVoiceDistinctness(fingerprints: VoiceFingerprint[]): number {
  if (fingerprints.length < 2) return 0;

  let totalDiff = 0;
  let pairs = 0;

  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 1; j < fingerprints.length; j++) {
      const a = fingerprints[i];
      const b = fingerprints[j];

      const lengthDiff = Math.abs(a.sentenceLengthPreference - b.sentenceLengthPreference) / 50;
      const formalityDiff = Math.abs(a.formalityLevel - b.formalityLevel);
      const emotionDiff = Math.abs(a.emotionalExpressionTendency - b.emotionalExpressionTendency);

      const overlap = new Set([...a.catchphrases, ...b.catchphrases]);
      const uniqueA = new Set(a.catchphrases);
      const uniqueB = new Set(b.catchphrases);
      const unionSize = new Set([...uniqueA, ...uniqueB]).size;
      const jaccard = unionSize > 0 ? 1 - overlap.size / unionSize : 0;

      const distance = (Math.min(lengthDiff, 1) + formalityDiff + emotionDiff + jaccard) / 4;
      totalDiff += distance;
      pairs++;
    }
  }

  return Math.round((totalDiff / pairs) * 100) / 100;
}
