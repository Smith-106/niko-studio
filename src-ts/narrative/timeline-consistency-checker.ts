/**
 * Timeline Consistency Checker
 *
 * Checks temporal consistency across chapters:
 * - Extracts time references from each chapter (seasons, days, ages, event sequences)
 * - Builds a global timeline across all chapters
 * - Detects contradictions: wrong season progression, age inconsistencies,
 *   impossible event ordering
 *
 * Output: TimelineConflict[] with conflict details, chapters involved, suggested fix
 */

import type { INarrativeLLMClient } from './types.js';

// ============================================================
// Enums & Types
// ============================================================

export enum TimelineConflictType {
  SEASON_PROGRESSION = 'season_progression',
  AGE_INCONSISTENCY = 'age_inconsistency',
  EVENT_ORDER = 'event_order',
  TIME_REFERENCE_CONFLICT = 'time_reference_conflict',
  DATE_CONTRADICTION = 'date_contradiction',
  DURATION_CONTRADICTION = 'duration_contradiction',
}

export enum TimelineSeverity {
  CRITICAL = 'critical',
  MAJOR = 'major',
  MINOR = 'minor',
  INFO = 'info',
}

export interface ChapterMeta {
  chapterNumber: number;
  title: string;
}

export interface TimeReference {
  type: TimeRefType;
  value: string;
  raw: string;
  confidence: number;
  context: string;
}

export enum TimeRefType {
  SEASON = 'season',
  TIME_OF_DAY = 'time_of_day',
  DATE = 'date',
  DURATION = 'duration',
  AGE = 'age',
  RELATIVE_TIME = 'relative_time',
  YEAR = 'year',
  MONTH = 'month',
}

export interface TimelineConflict {
  id: string;
  type: TimelineConflictType;
  severity: TimelineSeverity;
  chaptersInvolved: number[];
  description: string;
  evidence: string[];
  suggestedFix: string;
}

export interface ChapterTimeProfile {
  chapterNumber: number;
  chapterTitle: string;
  timeReferences: TimeReference[];
  inferredSeason: string | null;
  inferredYear: string | null;
  inferredAge: string | null;
  inferredTimeOfDay: string | null;
  dayOffset: number | null;
}

export interface TimelineReport {
  totalConflicts: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  infoCount: number;
  conflicts: TimelineConflict[];
  chapterProfiles: ChapterTimeProfile[];
  globalTimeline: string[];
  consistencyScore: number;
  summary: string;
  analyzedAt: string;
}

// ============================================================
// Keyword dictionaries
// ============================================================

const SEASON_KEYWORDS: Record<string, string[]> = {
  spring: ['春天', '春季', '春日', '春暖花开', '春雨', '三月', '四月'],
  summer: ['夏天', '夏季', '夏日', '酷暑', '盛夏', '炎夏', '六月', '七月', '八月'],
  autumn: ['秋天', '秋季', '秋日', '金秋', '深秋', '秋风', '九月', '十月', '十一月'],
  winter: ['冬天', '冬季', '冬日', '寒冬', '严冬', '隆冬', '十二月', '一月', '二月'],
};

const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];

const TIME_OF_DAY_KEYWORDS: Record<string, string[]> = {
  morning: ['早上', '早晨', '清晨', '上午', '黎明', '拂晓'],
  afternoon: ['中午', '下午', '午后', '正午'],
  evening: ['傍晚', '黄昏', '薄暮', '日暮'],
  night: ['夜晚', '晚上', '深夜', '夜里', '半夜', '午夜', '凌晨'],
};

const AGE_PATTERNS = [
  /(\d{1,3})\s*岁/,
  /年方(\d{1,2})/,
  /(?:已经|将近|快|才|刚|不过)\s*(\d{1,3})\s*岁/,
];

const DURATION_PATTERNS = [
  { pattern: /(\d+)\s*(?:年|年后|年多|年半)/, unit: 'year' },
  { pattern: /(\d+)\s*(?:个)?月(?:后)?/, unit: 'month' },
  { pattern: /(\d+)\s*(?:天|日)(?:后)?/, unit: 'day' },
  { pattern: /(\d+)\s*(?:周|星期)(?:后)?/, unit: 'week' },
  { pattern: /(\d+)\s*(?:小时|钟头)(?:后|后)?/, unit: 'hour' },
  { pattern: /半个(?:月|月)/, unit: 'half_month' },
  { pattern: /(?:几天|数日|数天)/, unit: 'few_days' },
  { pattern: /(?:几个月|数月)/, unit: 'few_months' },
  { pattern: /(?:几年|数年)/, unit: 'few_years' },
];

const RELATIVE_TIME_PATTERNS = [
  { pattern: /第二天|次日|翌日/, offset: { days: 1 } },
  { pattern: /第三天/, offset: { days: 2 } },
  { pattern: /几天后|数日后|几日后/, offset: { days: 3 } },
  { pattern: /一周后|一星期后/, offset: { days: 7 } },
  { pattern: /半个月后/, offset: { days: 15 } },
  { pattern: /一个月后|一月后/, offset: { days: 30 } },
  { pattern: /半年后|六个月后/, offset: { days: 180 } },
  { pattern: /一年后|一年多后/, offset: { days: 365 } },
  { pattern: /数年后|几年后/, offset: { days: 1095 } },
];

const EVENT_DEPENDENCY_PATTERNS: Array<{ prereq: RegExp; dependent: RegExp; label: string }> = [
  { prereq: /到达|抵达|来到|抵达了/, dependent: /离开|离去|出发/, label: 'departure_before_arrival' },
  { prereq: /开始|启动|着手|开始了/, dependent: /完成|结束|告终|完成了/, label: 'end_before_start' },
  { prereq: /认识|相遇|遇见|见到了/, dependent: /重逢|再见|再次相见/, label: 'reunion_before_meeting' },
  { prereq: /出生|诞生/, dependent: /死亡|去世|离世/, label: 'death_before_birth' },
  { prereq: /结婚|成婚|婚礼/, dependent: /离婚|分手|分开/, label: 'divorce_before_marriage' },
];

// ============================================================
// TimelineConsistencyChecker
// ============================================================

export class TimelineConsistencyChecker {
  private llmClient: INarrativeLLMClient | null;
  private conflictCounter = 0;

  constructor(llmClient?: INarrativeLLMClient) {
    this.llmClient = llmClient ?? null;
  }

  // ========================================
  // Main analysis method
  // ========================================

  async analyze(
    chapters: string[],
    chapterMeta: ChapterMeta[],
  ): Promise<TimelineReport> {
    if (chapters.length === 0) {
      return this.emptyReport();
    }

    const profiles = this.buildChapterTimeProfiles(chapters, chapterMeta);
    const conflicts = this.detectConflicts(profiles);

    return this.buildReport(conflicts, profiles);
  }

  /**
   * Synchronous version for testing without LLM
   */
  quickAnalyze(
    chapters: string[],
    chapterMeta: ChapterMeta[],
  ): TimelineReport {
    if (chapters.length === 0) {
      return this.emptyReport();
    }

    const profiles = this.buildChapterTimeProfiles(chapters, chapterMeta);
    const conflicts = this.detectConflicts(profiles);

    return this.buildReport(conflicts, profiles);
  }

  // ========================================
  // Time profile extraction
  // ========================================

  private buildChapterTimeProfiles(
    chapters: string[],
    chapterMeta: ChapterMeta[],
  ): ChapterTimeProfile[] {
    const profiles: ChapterTimeProfile[] = [];
    let currentDayOffset = 0;

    for (let i = 0; i < chapters.length; i++) {
      const meta = chapterMeta[i] ?? { chapterNumber: i + 1, title: `Chapter ${i + 1}` };
      const content = chapters[i];
      const timeRefs = this.extractTimeReferences(content);

      const season = this.inferSeason(timeRefs);
      const timeOfDay = this.inferTimeOfDay(timeRefs);
      const age = this.inferAge(timeRefs);
      const year = this.inferYear(content, timeRefs);
      const relativeTime = this.findRelativeTime(content);

      if (relativeTime !== null) {
        currentDayOffset += relativeTime;
      }

      profiles.push({
        chapterNumber: meta.chapterNumber,
        chapterTitle: meta.title,
        timeReferences: timeRefs,
        inferredSeason: season,
        inferredYear: year,
        inferredAge: age,
        inferredTimeOfDay: timeOfDay,
        dayOffset: currentDayOffset,
      });
    }

    return profiles;
  }

  private extractTimeReferences(content: string): TimeReference[] {
    const refs: TimeReference[] = [];

    // Extract seasons
    for (const [season, keywords] of Object.entries(SEASON_KEYWORDS)) {
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          refs.push({
            type: TimeRefType.SEASON,
            value: season,
            raw: keyword,
            confidence: 0.8,
            context: this.getContextAround(content, content.indexOf(keyword)),
          });
        }
      }
    }

    // Extract time of day
    for (const [period, keywords] of Object.entries(TIME_OF_DAY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          refs.push({
            type: TimeRefType.TIME_OF_DAY,
            value: period,
            raw: keyword,
            confidence: 0.9,
            context: this.getContextAround(content, content.indexOf(keyword)),
          });
        }
      }
    }

    // Extract ages
    for (const pattern of AGE_PATTERNS) {
      const match = pattern.exec(content);
      if (match) {
        refs.push({
          type: TimeRefType.AGE,
          value: match[1],
          raw: match[0],
          confidence: 0.7,
          context: this.getContextAround(content, match.index),
        });
      }
    }

    // Extract durations
    for (const { pattern, unit } of DURATION_PATTERNS) {
      const match = pattern.exec(content);
      if (match) {
        refs.push({
          type: TimeRefType.DURATION,
          value: `${match[0]} (${unit})`,
          raw: match[0],
          confidence: 0.8,
          context: this.getContextAround(content, match.index),
        });
      }
    }

    // Extract dates (simple pattern)
    const datePattern = /(\d{4})\s*年|((?:正|一|二|三|四|五|六|七|八|九|十|十一|十二)月)/g;
    let dateMatch;
    while ((dateMatch = datePattern.exec(content)) !== null) {
      refs.push({
        type: TimeRefType.DATE,
        value: dateMatch[0],
        raw: dateMatch[0],
        confidence: 0.9,
        context: this.getContextAround(content, dateMatch.index),
      });
    }

    return refs;
  }

  private inferSeason(timeRefs: TimeReference[]): string | null {
    const seasonRefs = timeRefs.filter((r) => r.type === TimeRefType.SEASON);
    if (seasonRefs.length === 0) return null;
    // Return the most frequently mentioned season
    const counts = new Map<string, number>();
    for (const ref of seasonRefs) {
      counts.set(ref.value, (counts.get(ref.value) ?? 0) + 1);
    }
    let maxSeason = seasonRefs[0].value;
    let maxCount = 0;
    for (const [season, count] of counts) {
      if (count > maxCount) {
        maxSeason = season;
        maxCount = count;
      }
    }
    return maxSeason;
  }

  private inferTimeOfDay(timeRefs: TimeReference[]): string | null {
    const todRefs = timeRefs.filter((r) => r.type === TimeRefType.TIME_OF_DAY);
    if (todRefs.length === 0) return null;
    return todRefs[0].value;
  }

  private inferAge(timeRefs: TimeReference[]): string | null {
    const ageRefs = timeRefs.filter((r) => r.type === TimeRefType.AGE);
    if (ageRefs.length === 0) return null;
    return ageRefs[0].value;
  }

  private inferYear(content: string, timeRefs: TimeReference[]): string | null {
    const dateRefs = timeRefs.filter((r) => r.type === TimeRefType.DATE);
    for (const ref of dateRefs) {
      const yearMatch = ref.raw.match(/(\d{4})\s*年/);
      if (yearMatch) return yearMatch[1];
    }
    return null;
  }

  private findRelativeTime(content: string): number | null {
    for (const { pattern, offset } of RELATIVE_TIME_PATTERNS) {
      if (pattern.test(content)) {
        return offset.days;
      }
    }
    return null;
  }

  // ========================================
  // Conflict detection
  // ========================================

  private detectConflicts(profiles: ChapterTimeProfile[]): TimelineConflict[] {
    const conflicts: TimelineConflict[] = [];

    const seasonConflicts = this.detectSeasonProgression(profiles);
    const ageConflicts = this.detectAgeInconsistencies(profiles);
    const eventConflicts = this.detectEventOrderIssues(profiles);

    conflicts.push(...seasonConflicts, ...ageConflicts, ...eventConflicts);

    return conflicts;
  }

  private detectSeasonProgression(
    profiles: ChapterTimeProfile[],
  ): TimelineConflict[] {
    const conflicts: TimelineConflict[] = [];
    const seasonSequence: Array<{ chapter: number; season: string }> = [];

    for (const profile of profiles) {
      if (profile.inferredSeason) {
        seasonSequence.push({
          chapter: profile.chapterNumber,
          season: profile.inferredSeason,
        });
      }
    }

    for (let i = 1; i < seasonSequence.length; i++) {
      const prev = seasonSequence[i - 1];
      const curr = seasonSequence[i];

      const prevIdx = SEASON_ORDER.indexOf(prev.season);
      const currIdx = SEASON_ORDER.indexOf(curr.season);

      if (prevIdx === -1 || currIdx === -1) continue;

      // Same season across many chapters is fine
      if (prevIdx === currIdx) continue;

      // Check if the season went backward without wrapping
      if (currIdx === prevIdx - 1 && prevIdx !== 0) {
        // Season went backward (e.g., autumn -> summer) - this is unusual
        conflicts.push({
          id: this.generateConflictId(),
          type: TimelineConflictType.SEASON_PROGRESSION,
          severity: TimelineSeverity.MAJOR,
          chaptersInvolved: [prev.chapter, curr.chapter],
          description: `Season regression: from ${prev.season} to ${curr.season}`,
          evidence: [
            `Chapter ${prev.chapter}: ${prev.season}`,
            `Chapter ${curr.chapter}: ${curr.season}`,
          ],
          suggestedFix: 'Verify the timeline progression or add a time skip explanation',
        });
      }

      // Check if multiple seasons were skipped in one chapter transition
      const seasonGap = (currIdx - prevIdx + 4) % 4;
      if (seasonGap > 2) {
        conflicts.push({
          id: this.generateConflictId(),
          type: TimelineConflictType.SEASON_PROGRESSION,
          severity: TimelineSeverity.MINOR,
          chaptersInvolved: [prev.chapter, curr.chapter],
          description: `Large season gap: from ${prev.season} to ${curr.season} across one chapter`,
          evidence: [
            `Chapter ${prev.chapter}: ${prev.season}`,
            `Chapter ${curr.chapter}: ${curr.season}`,
          ],
          suggestedFix: 'Consider adding transitional chapters or explaining the time skip',
        });
      }
    }

    return conflicts;
  }

  private detectAgeInconsistencies(
    profiles: ChapterTimeProfile[],
  ): TimelineConflict[] {
    const conflicts: TimelineConflict[] = [];
    const ageSequence: Array<{ chapter: number; age: number; raw: string }> = [];

    for (const profile of profiles) {
      if (profile.inferredAge) {
        const age = parseInt(profile.inferredAge, 10);
        if (!isNaN(age) && age > 0 && age < 200) {
          ageSequence.push({
            chapter: profile.chapterNumber,
            age,
            raw: profile.inferredAge,
          });
        }
      }
    }

    // Group by similar ages and check for inconsistencies
    if (ageSequence.length >= 2) {
      for (let i = 1; i < ageSequence.length; i++) {
        const prev = ageSequence[i - 1];
        const curr = ageSequence[i];

        if (curr.age < prev.age) {
          conflicts.push({
            id: this.generateConflictId(),
            type: TimelineConflictType.AGE_INCONSISTENCY,
            severity: TimelineSeverity.CRITICAL,
            chaptersInvolved: [prev.chapter, curr.chapter],
            description: `Age decreased from ${prev.age} to ${curr.age} across chapters`,
            evidence: [
              `Chapter ${prev.chapter}: age ${prev.age} (${prev.raw})`,
              `Chapter ${curr.chapter}: age ${curr.age} (${curr.raw})`,
            ],
            suggestedFix: 'Verify age references. Characters should not get younger unless in a flashback.',
          });
        } else if (curr.age === prev.age && curr.chapter > prev.chapter + 1) {
          // Same age across many chapters - mild warning
          conflicts.push({
            id: this.generateConflictId(),
            type: TimelineConflictType.AGE_INCONSISTENCY,
            severity: TimelineSeverity.INFO,
            chaptersInvolved: [prev.chapter, curr.chapter],
            description: `Character age remained at ${prev.age} across multiple chapters`,
            evidence: [
              `Chapter ${prev.chapter}: age ${prev.age}`,
              `Chapter ${curr.chapter}: age ${curr.age}`,
            ],
            suggestedFix: 'Consider if the character should age as time passes',
          });
        }
      }
    }

    return conflicts;
  }

  private detectEventOrderIssues(
    profiles: ChapterTimeProfile[],
  ): TimelineConflict[] {
    const conflicts: TimelineConflict[] = [];

    // This is a simplified check - we look for contradictory temporal markers
    // within the same chapter or across adjacent chapters
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      const durationRefs = profile.timeReferences.filter(
        (r) => r.type === TimeRefType.DURATION,
      );

      // Check for contradictory durations in the same chapter
      if (durationRefs.length >= 2) {
        for (let j = 1; j < durationRefs.length; j++) {
          const prevDur = durationRefs[j - 1];
          const currDur = durationRefs[j];

          if (prevDur.value !== currDur.value) {
            // Both refer to time elapsed but with different values
            conflicts.push({
              id: this.generateConflictId(),
              type: TimelineConflictType.DURATION_CONTRADICTION,
              severity: TimelineSeverity.MINOR,
              chaptersInvolved: [profile.chapterNumber],
              description: `Conflicting duration references in same chapter: "${prevDur.raw}" vs "${currDur.raw}"`,
              evidence: [prevDur.context, currDur.context],
              suggestedFix: 'Clarify the actual time duration that has passed',
            });
          }
        }
      }
    }

    return conflicts;
  }

  // ========================================
  // Report building
  // ========================================

  private buildReport(
    conflicts: TimelineConflict[],
    profiles: ChapterTimeProfile[],
  ): TimelineReport {
    // Deduplicate
    const seen = new Set<string>();
    const uniqueConflicts = conflicts.filter((c) => {
      const key = `${c.type}:${c.chaptersInvolved.join('-')}:${c.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by severity
    uniqueConflicts.sort((a, b) => timelineSeverityCompare(a.severity, b.severity));

    const criticalCount = uniqueConflicts.filter((c) => c.severity === TimelineSeverity.CRITICAL).length;
    const majorCount = uniqueConflicts.filter((c) => c.severity === TimelineSeverity.MAJOR).length;
    const minorCount = uniqueConflicts.filter((c) => c.severity === TimelineSeverity.MINOR).length;
    const infoCount = uniqueConflicts.filter((c) => c.severity === TimelineSeverity.INFO).length;

    const globalTimeline = profiles
      .filter((p) => p.inferredSeason || p.inferredYear || p.dayOffset)
      .map((p) => {
        const parts = [`Ch${p.chapterNumber}`];
        if (p.inferredSeason) parts.push(p.inferredSeason);
        if (p.inferredYear) parts.push(p.inferredYear);
        if (p.dayOffset !== null && p.dayOffset > 0) parts.push(`+${p.dayOffset}d`);
        return parts.join(' / ');
      });

    const penalty = criticalCount * 20 + majorCount * 10 + minorCount * 3 + infoCount * 1;
    const score = Math.max(0, Math.round((100 - penalty) * 10) / 10);

    const summary = this.generateSummary(uniqueConflicts, score);

    return {
      totalConflicts: uniqueConflicts.length,
      criticalCount,
      majorCount,
      minorCount,
      infoCount,
      conflicts: uniqueConflicts,
      chapterProfiles: profiles,
      globalTimeline,
      consistencyScore: score,
      summary,
      analyzedAt: new Date().toISOString(),
    };
  }

  private emptyReport(): TimelineReport {
    return {
      totalConflicts: 0,
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      infoCount: 0,
      conflicts: [],
      chapterProfiles: [],
      globalTimeline: [],
      consistencyScore: 100,
      summary: 'No chapters provided for analysis.',
      analyzedAt: new Date().toISOString(),
    };
  }

  private generateSummary(conflicts: TimelineConflict[], score: number): string {
    if (conflicts.length === 0) {
      return 'No timeline inconsistencies detected across chapters.';
    }

    const critical = conflicts.filter((c) => c.severity === TimelineSeverity.CRITICAL).length;
    const major = conflicts.filter((c) => c.severity === TimelineSeverity.MAJOR).length;

    if (critical > 0) {
      return `Detected ${critical} critical timeline issues. Score: ${score}.`;
    }
    if (major > 0) {
      return `Detected ${major} major timeline inconsistencies. Score: ${score}.`;
    }
    return `Detected ${conflicts.length} minor timeline issues. Score: ${score}.`;
  }

  private generateConflictId(): string {
    this.conflictCounter++;
    return `TCC-${String(this.conflictCounter).padStart(4, '0')}`;
  }

  private getContextAround(content: string, pos: number, window = 30): string {
    const start = Math.max(0, pos - window);
    const end = Math.min(content.length, pos + window);
    return content.slice(start, end);
  }
}

// ============================================================
// Utility functions
// ============================================================

function timelineSeverityCompare(a: TimelineSeverity, b: TimelineSeverity): number {
  const order: Record<TimelineSeverity, number> = {
    [TimelineSeverity.CRITICAL]: 0,
    [TimelineSeverity.MAJOR]: 1,
    [TimelineSeverity.MINOR]: 2,
    [TimelineSeverity.INFO]: 3,
  };
  return (order[a] ?? 4) - (order[b] ?? 4);
}
