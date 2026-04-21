/**
 * Worldview Coherence Validator
 *
 * Validates world-building consistency across chapters:
 * - Uses knowledge graph data to load established world rules
 * - Checks each chapter against known world rules (geography, magic systems,
 *   character abilities, etc.)
 * - Detects rule violations and contradictions
 *
 * Output: WorldviewConflict[] with rule violated, chapters involved,
 *         expected vs actual
 */

import type { INarrativeLLMClient } from './types.js';

// ============================================================
// Types
// ============================================================

export enum WorldviewConflictType {
  GEOGRAPHY_VIOLATION = 'geography_violation',
  MAGIC_SYSTEM_VIOLATION = 'magic_system_violation',
  ABILITY_VIOLATION = 'ability_violation',
  TECHNOLOGY_ANACHRONISM = 'technology_anachronism',
  CULTURAL_INCONSISTENCY = 'cultural_inconsistency',
  PHYSICS_VIOLATION = 'physics_violation',
  LORE_CONTRADICTION = 'lore_contradiction',
  NAMING_INCONSISTENCY = 'naming_inconsistency',
}

export enum WorldviewSeverity {
  CRITICAL = 'critical',
  MAJOR = 'major',
  MINOR = 'minor',
  INFO = 'info',
}

export interface ChapterMeta {
  chapterNumber: number;
  title: string;
}

export interface WorldRule {
  id: string;
  category: string;
  name: string;
  description: string;
  constraints: string[];
  establishedIn: number; // chapter number
}

export interface WorldviewConflict {
  id: string;
  type: WorldviewConflictType;
  severity: WorldviewSeverity;
  ruleId: string | null;
  ruleName: string;
  chaptersInvolved: number[];
  description: string;
  expected: string;
  actual: string;
  evidence: string[];
  suggestion: string;
}

export interface ChapterWorldviewProfile {
  chapterNumber: number;
  chapterTitle: string;
  locationsMentioned: string[];
  characterAbilities: Map<string, string[]>;
  culturalReferences: string[];
  technologyReferences: string[];
  magicReferences: string[];
  potentialViolations: WorldviewConflict[];
}

export interface WorldviewReport {
  totalConflicts: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  infoCount: number;
  conflicts: WorldviewConflict[];
  chapterProfiles: ChapterWorldviewProfile[];
  worldRules: WorldRule[];
  coherenceScore: number;
  summary: string;
  analyzedAt: string;
}

// ============================================================
// Rule violation patterns
// ============================================================

interface RuleCheckPattern {
  category: string;
  conflictType: WorldviewConflictType;
  patterns: Array<{
    violation: RegExp;
    label: string;
    severity: WorldviewSeverity;
    suggestion: string;
  }>;
}

const BUILTIN_RULE_PATTERNS: RuleCheckPattern[] = [
  {
    category: 'physics',
    conflictType: WorldviewConflictType.PHYSICS_VIOLATION,
    patterns: [
      {
        violation: /从.{1,6}楼跳下.*安然无恙|从.{1,6}楼跳下.*没事|跳下.*楼.*安然无恙|跳下.*楼.*没事/,
        label: 'implausible_fall_survival',
        severity: WorldviewSeverity.MAJOR,
        suggestion: 'Add explanation for surviving the fall (e.g., special ability, cushioned landing)',
      },
      {
        violation: /同时出现在.{2,10}和.{2,10}/,
        label: 'simultaneous_presence',
        severity: WorldviewSeverity.CRITICAL,
        suggestion: 'Character cannot be in two places at once - verify timeline',
      },
    ],
  },
  {
    category: 'naming',
    conflictType: WorldviewConflictType.NAMING_INCONSISTENCY,
    patterns: [
      {
        violation: /(?:名叫|名为|叫做)\s*([\u4e00-\u9fa5]{2,4})/,
        label: 'name_introduction',
        severity: WorldviewSeverity.INFO,
        suggestion: 'Track character name introductions for consistency',
      },
    ],
  },
];

// Geography-related keywords
const GEOGRAPHY_MARKERS = [
  '山', '河', '湖', '海', '岛', '城', '镇', '村', '省', '国',
  '路', '桥', '港', '谷', '林', '原', '漠', '崖', '洞', '塔',
  '宫殿', '城堡', '寺庙', '教堂', '市场', '广场', '花园',
  '北方', '南方', '东方', '西方', '北面', '南面', '东面', '西面',
];

// Magic / supernatural markers
const MAGIC_MARKERS = [
  '法术', '魔法', '咒语', '灵力', '内力', '真气', '仙术',
  '符咒', '阵法', '禁术', '秘术', '幻术', '巫术',
  '修炼', '突破', '境界', '元神', '灵兽', '法宝', '仙器',
  '传送', '瞬移', '隐身', '飞行', '治愈', '复活',
  '诅咒', '封印', '解封', '结界', '护盾',
];

// Technology markers
const TECHNOLOGY_MARKERS = [
  '手机', '电脑', '网络', '互联网', '电梯', '汽车', '火车',
  '飞机', '电视', '收音机', '电话', '电灯', '电报',
  '枪', '炮', '炸弹', '导弹', '雷达', '卫星',
  '芯片', '机器人', '人工智能', 'AI', '基因',
];

// ============================================================
// WorldviewCoherenceValidator
// ============================================================

export class WorldviewCoherenceValidator {
  private llmClient: INarrativeLLMClient | null;
  private worldRules: WorldRule[] = [];
  private conflictCounter = 0;

  // Knowledge graph integration interface
  private graphAdapter: IWorldviewGraphAdapter | null;

  constructor(options?: {
    llmClient?: INarrativeLLMClient;
    graphAdapter?: IWorldviewGraphAdapter;
  }) {
    this.llmClient = options?.llmClient ?? null;
    this.graphAdapter = options?.graphAdapter ?? null;
  }

  // ========================================
  // World rule management
  // ========================================

  addRule(rule: WorldRule): void {
    this.worldRules.push(rule);
  }

  addRules(rules: WorldRule[]): void {
    this.worldRules.push(...rules);
  }

  getRules(): WorldRule[] {
    return [...this.worldRules];
  }

  clearRules(): void {
    this.worldRules = [];
  }

  /**
   * Load world rules from the knowledge graph via adapter
   */
  async loadRulesFromGraph(): Promise<WorldRule[]> {
    if (!this.graphAdapter) return [];

    try {
      const graphRules = await this.graphAdapter.getWorldRules();
      this.worldRules.push(...graphRules);
      return graphRules;
    } catch {
      return [];
    }
  }

  // ========================================
  // Main analysis method
  // ========================================

  async analyze(
    chapters: string[],
    chapterMeta: ChapterMeta[],
  ): Promise<WorldviewReport> {
    if (chapters.length === 0) {
      return this.emptyReport();
    }

    const profiles = this.buildChapterProfiles(chapters, chapterMeta);
    const conflicts: WorldviewConflict[] = [];

    // Check each chapter profile against world rules
    for (const profile of profiles) {
      const ruleViolations = this.checkAgainstRules(profile);
      conflicts.push(...ruleViolations);

      // Check against built-in patterns
      const patternViolations = this.checkAgainstPatterns(profile, chapters[profile.chapterNumber - 1]);
      conflicts.push(...patternViolations);

      // Check cross-chapter worldview consistency
      const crossChapterIssues = this.checkCrossChapterConsistency(profile, profiles);
      conflicts.push(...crossChapterIssues);
    }

    return this.buildReport(conflicts, profiles);
  }

  /**
   * Synchronous version for testing without LLM
   */
  quickAnalyze(
    chapters: string[],
    chapterMeta: ChapterMeta[],
  ): WorldviewReport {
    if (chapters.length === 0) {
      return this.emptyReport();
    }

    const profiles = this.buildChapterProfiles(chapters, chapterMeta);
    const conflicts: WorldviewConflict[] = [];

    for (const profile of profiles) {
      const ruleViolations = this.checkAgainstRules(profile);
      conflicts.push(...ruleViolations);

      const patternViolations = this.checkAgainstPatterns(profile, chapters[profile.chapterNumber - 1]);
      conflicts.push(...patternViolations);

      const crossChapterIssues = this.checkCrossChapterConsistency(profile, profiles);
      conflicts.push(...crossChapterIssues);
    }

    return this.buildReport(conflicts, profiles);
  }

  // ========================================
  // Chapter profile building
  // ========================================

  private buildChapterProfiles(
    chapters: string[],
    chapterMeta: ChapterMeta[],
  ): ChapterWorldviewProfile[] {
    const profiles: ChapterWorldviewProfile[] = [];

    for (let i = 0; i < chapters.length; i++) {
      const meta = chapterMeta[i] ?? { chapterNumber: i + 1, title: `Chapter ${i + 1}` };
      const content = chapters[i];

      const locationsMentioned = this.extractLocations(content);
      const characterAbilities = this.extractCharacterAbilities(content);
      const culturalReferences = this.extractCulturalReferences(content);
      const technologyReferences = this.extractTechnologyReferences(content);
      const magicReferences = this.extractMagicReferences(content);

      profiles.push({
        chapterNumber: meta.chapterNumber,
        chapterTitle: meta.title,
        locationsMentioned,
        characterAbilities,
        culturalReferences,
        technologyReferences,
        magicReferences,
        potentialViolations: [],
      });
    }

    return profiles;
  }

  private extractLocations(content: string): string[] {
    const locations: string[] = [];
    const seen = new Set<string>();

    for (const marker of GEOGRAPHY_MARKERS) {
      const pattern = new RegExp(`([\u4e00-\u9fa5]{1,3}${marker})`, 'g');
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const location = match[1];
        if (!seen.has(location) && location.length >= 2 && location.length <= 5) {
          seen.add(location);
          locations.push(location);
        }
      }
    }

    return locations;
  }

  private extractCharacterAbilities(content: string): Map<string, string[]> {
    const abilities = new Map<string, string[]>();

    // Find character names and their associated abilities
    const sentences = content.split(/[。！？\n]/).filter(Boolean);
    for (const sentence of sentences) {
      const nameMatch = sentence.match(/^([\u4e00-\u9fa5]{2,4})/);
      if (!nameMatch) continue;
      const name = nameMatch[1];

      // Filter out common non-name starters
      const nonNames = new Set(['但是', '因为', '所以', '虽然', '不过', '然而', '已经', '正在', '突然', '终于', '只是', '仍然', '同时', '地方', '时候', '事情', '问题', '办法', '消息', '我们', '他们', '她们', '自己', '什么', '这个', '那个']);
      if (nonNames.has(name)) continue;

      const charAbilities: string[] = [];

      for (const marker of MAGIC_MARKERS) {
        if (sentence.includes(marker)) {
          charAbilities.push(marker);
        }
      }

      for (const marker of TECHNOLOGY_MARKERS) {
        if (sentence.includes(marker)) {
          charAbilities.push(marker);
        }
      }

      if (charAbilities.length > 0) {
        const existing = abilities.get(name) ?? [];
        abilities.set(name, [...new Set([...existing, ...charAbilities])]);
      }
    }

    return abilities;
  }

  private extractCulturalReferences(content: string): string[] {
    const references: string[] = [];
    const patterns = [
      /([\u4e00-\u9fa5]{2,6}(?:风俗|习惯|传统|礼仪|节日|庆典|仪式))/,
      /([\u4e00-\u9fa5]{2,6}(?:朝代|帝国|王国|共和国|王朝))/,
      /([\u4e00-\u9fa5]{2,6}(?:宗教|信仰|教派|门派|宗族|家族))/,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(content);
      if (match) {
        references.push(match[1]);
      }
    }

    return references;
  }

  private extractTechnologyReferences(content: string): string[] {
    const refs: string[] = [];
    for (const marker of TECHNOLOGY_MARKERS) {
      if (content.includes(marker)) {
        refs.push(marker);
      }
    }
    return [...new Set(refs)];
  }

  private extractMagicReferences(content: string): string[] {
    const refs: string[] = [];
    for (const marker of MAGIC_MARKERS) {
      if (content.includes(marker)) {
        refs.push(marker);
      }
    }
    return [...new Set(refs)];
  }

  // ========================================
  // Rule checking
  // ========================================

  private checkAgainstRules(profile: ChapterWorldviewProfile): WorldviewConflict[] {
    const conflicts: WorldviewConflict[] = [];

    for (const rule of this.worldRules) {
      // Only check rules established before this chapter
      if (rule.establishedIn > profile.chapterNumber) continue;

      const violation = this.evaluateRuleAgainstProfile(rule, profile);
      if (violation) {
        conflicts.push(violation);
      }
    }

    return conflicts;
  }

  private evaluateRuleAgainstProfile(
    rule: WorldRule,
    profile: ChapterWorldviewProfile,
  ): WorldviewConflict | null {
    const contentFeatures = [
      ...profile.magicReferences,
      ...profile.technologyReferences,
      ...profile.culturalReferences,
      ...profile.locationsMentioned,
    ].join(',');

    for (const constraint of rule.constraints) {
      // Simple keyword-based constraint checking
      if (contentFeatures.includes(constraint) && rule.category === 'forbidden') {
        return {
          id: this.generateConflictId(),
          type: this.categoryToConflictType(rule.category),
          severity: WorldviewSeverity.MAJOR,
          ruleId: rule.id,
          ruleName: rule.name,
          chaptersInvolved: [profile.chapterNumber],
          description: `Rule "${rule.name}" violated: forbidden element "${constraint}" found`,
          expected: rule.description,
          actual: `Found "${constraint}" in chapter ${profile.chapterNumber}`,
          evidence: [`Chapter ${profile.chapterNumber}: contains "${constraint}"`],
          suggestion: `Remove or replace the forbidden element, or revise the world rule if appropriate`,
        };
      }
    }

    return null;
  }

  private checkAgainstPatterns(
    profile: ChapterWorldviewProfile,
    content: string,
  ): WorldviewConflict[] {
    const conflicts: WorldviewConflict[] = [];

    for (const rulePattern of BUILTIN_RULE_PATTERNS) {
      for (const patternDef of rulePattern.patterns) {
        const match = patternDef.violation.exec(content);
        if (match) {
          conflicts.push({
            id: this.generateConflictId(),
            type: rulePattern.conflictType,
            severity: patternDef.severity,
            ruleId: null,
            ruleName: `builtin:${patternDef.label}`,
            chaptersInvolved: [profile.chapterNumber],
            description: `Built-in pattern violation: ${patternDef.label}`,
            expected: patternDef.suggestion,
            actual: `Matched: "${match[0].slice(0, 50)}"`,
            evidence: [`Chapter ${profile.chapterNumber}: "${match[0].slice(0, 80)}"`],
            suggestion: patternDef.suggestion,
          });
        }
      }
    }

    return conflicts;
  }

  private checkCrossChapterConsistency(
    current: ChapterWorldviewProfile,
    allProfiles: ChapterWorldviewProfile[],
  ): WorldviewConflict[] {
    const conflicts: WorldviewConflict[] = [];
    const earlierProfiles = allProfiles.filter(
      (p) => p.chapterNumber < current.chapterNumber,
    );

    // Check for technology anachronisms: if no technology was present in early chapters
    // but suddenly appears without explanation
    if (earlierProfiles.length > 0) {
      const prevTechPresent = earlierProfiles.some((p) => p.technologyReferences.length > 0);
      const currTechPresent = current.technologyReferences.length > 0;

      if (!prevTechPresent && currTechPresent) {
        // Check if the first chapter or second chapter introduces tech - could be normal worldbuilding
        if (current.chapterNumber > 2) {
          conflicts.push({
            id: this.generateConflictId(),
            type: WorldviewConflictType.TECHNOLOGY_ANACHRONISM,
            severity: WorldviewSeverity.INFO,
            ruleId: null,
            ruleName: 'cross_chapter:tech_appearance',
            chaptersInvolved: [earlierProfiles[0].chapterNumber, current.chapterNumber],
            description: `Technology elements (${current.technologyReferences.slice(0, 3).join(', ')}) appear for the first time in chapter ${current.chapterNumber}`,
            expected: 'Consistent technology level throughout',
            actual: `New technology in chapter ${current.chapterNumber}: ${current.technologyReferences.slice(0, 3).join(', ')}`,
            evidence: [
              `Earlier chapters: no technology references`,
              `Chapter ${current.chapterNumber}: ${current.technologyReferences.slice(0, 3).join(', ')}`,
            ],
            suggestion: 'Establish technology level early in the story or explain the new technology introduction',
          });
        }
      }
    }

    // Check for naming inconsistencies in locations
    const allLocations = new Map<string, number[]>();
    for (const p of allProfiles) {
      for (const loc of p.locationsMentioned) {
        const chapters = allLocations.get(loc) ?? [];
        chapters.push(p.chapterNumber);
        allLocations.set(loc, chapters);
      }
    }

    // Look for similar location names that might be the same place with different names
    const locationNames = [...allLocations.keys()];
    for (let i = 0; i < locationNames.length; i++) {
      for (let j = i + 1; j < locationNames.length; j++) {
        const a = locationNames[i];
        const b = locationNames[j];
        // Check if one name is a substring of the other (possible abbreviation)
        if (a.length > 2 && b.length > 2 && (a.includes(b) || b.includes(a)) && a !== b) {
          const chaptersA = allLocations.get(a) ?? [];
          const chaptersB = allLocations.get(b) ?? [];

          // Only flag if they appear in similar chapters (likely the same location)
          const overlap = chaptersA.some((ch) => chaptersB.includes(ch));
          if (overlap) {
            conflicts.push({
              id: this.generateConflictId(),
              type: WorldviewConflictType.NAMING_INCONSISTENCY,
              severity: WorldviewSeverity.MINOR,
              ruleId: null,
              ruleName: 'cross_chapter:location_naming',
              chaptersInvolved: [...new Set([...chaptersA, ...chaptersB])].sort().slice(0, 4),
              description: `Possible location naming inconsistency: "${a}" and "${b}" may refer to the same place`,
              expected: 'Consistent location names',
              actual: `Found "${a}" and "${b}" in overlapping chapters`,
              evidence: [`"${a}": chapters ${chaptersA.join(', ')}`, `"${b}": chapters ${chaptersB.join(', ')}`],
              suggestion: `Standardize location names: choose either "${a}" or "${b}" consistently`,
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
    conflicts: WorldviewConflict[],
    profiles: ChapterWorldviewProfile[],
  ): WorldviewReport {
    // Deduplicate
    const seen = new Set<string>();
    const uniqueConflicts = conflicts.filter((c) => {
      const key = `${c.type}:${c.ruleName}:${c.chaptersInvolved.join('-')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by severity
    uniqueConflicts.sort((a, b) => worldviewSeverityCompare(a.severity, b.severity));

    const criticalCount = uniqueConflicts.filter((c) => c.severity === WorldviewSeverity.CRITICAL).length;
    const majorCount = uniqueConflicts.filter((c) => c.severity === WorldviewSeverity.MAJOR).length;
    const minorCount = uniqueConflicts.filter((c) => c.severity === WorldviewSeverity.MINOR).length;
    const infoCount = uniqueConflicts.filter((c) => c.severity === WorldviewSeverity.INFO).length;

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
      worldRules: this.worldRules,
      coherenceScore: score,
      summary,
      analyzedAt: new Date().toISOString(),
    };
  }

  private emptyReport(): WorldviewReport {
    return {
      totalConflicts: 0,
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      infoCount: 0,
      conflicts: [],
      chapterProfiles: [],
      worldRules: [],
      coherenceScore: 100,
      summary: 'No chapters provided for analysis.',
      analyzedAt: new Date().toISOString(),
    };
  }

  private generateSummary(conflicts: WorldviewConflict[], score: number): string {
    if (conflicts.length === 0) {
      return 'No worldview inconsistencies detected across chapters.';
    }

    const critical = conflicts.filter((c) => c.severity === WorldviewSeverity.CRITICAL).length;
    const major = conflicts.filter((c) => c.severity === WorldviewSeverity.MAJOR).length;

    if (critical > 0) {
      return `Detected ${critical} critical worldview violations. Score: ${score}.`;
    }
    if (major > 0) {
      return `Detected ${major} major worldview inconsistencies. Score: ${score}.`;
    }
    return `Detected ${conflicts.length} minor worldview issues. Score: ${score}.`;
  }

  private categoryToConflictType(category: string): WorldviewConflictType {
    const mapping: Record<string, WorldviewConflictType> = {
      forbidden: WorldviewConflictType.LORE_CONTRADICTION,
      magic: WorldviewConflictType.MAGIC_SYSTEM_VIOLATION,
      geography: WorldviewConflictType.GEOGRAPHY_VIOLATION,
      ability: WorldviewConflictType.ABILITY_VIOLATION,
      technology: WorldviewConflictType.TECHNOLOGY_ANACHRONISM,
      culture: WorldviewConflictType.CULTURAL_INCONSISTENCY,
    };
    return mapping[category] ?? WorldviewConflictType.LORE_CONTRADICTION;
  }

  private generateConflictId(): string {
    this.conflictCounter++;
    return `WCV-${String(this.conflictCounter).padStart(4, '0')}`;
  }
}

// ============================================================
// Graph adapter interface
// ============================================================

/**
 * Adapter interface for knowledge graph integration.
 * Implementations can wrap GraphEngine, KnowledgeService, or
 * provide in-memory data for testing.
 */
export interface IWorldviewGraphAdapter {
  getWorldRules(): Promise<WorldRule[]>;
}

// ============================================================
// Utility functions
// ============================================================

function worldviewSeverityCompare(a: WorldviewSeverity, b: WorldviewSeverity): number {
  const order: Record<WorldviewSeverity, number> = {
    [WorldviewSeverity.CRITICAL]: 0,
    [WorldviewSeverity.MAJOR]: 1,
    [WorldviewSeverity.MINOR]: 2,
    [WorldviewSeverity.INFO]: 3,
  };
  return (order[a] ?? 4) - (order[b] ?? 4);
}
