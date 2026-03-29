/**
 * skill-router.ts - Skill routing based on task type.
 *
 * Migrated from src/agents/skill_router.py
 */

// ============================================================
// Enums
// ============================================================

export enum TaskType {
  // Character related
  CHARACTER_CREATION = "character_creation",
  CHARACTER_DEVELOPMENT = "character_development",
  CHARACTER_DIALOGUE = "character_dialogue",
  // Structure related
  STORY_OUTLINE = "story_outline",
  SCENE_DESIGN = "scene_design",
  CHAPTER_WRITING = "chapter_writing",
  // Technique related
  SUSPENSE_BUILD = "suspense_build",
  TWIST_DESIGN = "twist_design",
  CLIMAX_WRITING = "climax_writing",
  // Fix related
  DIALOGUE_FIX = "dialogue_fix",
  DESCRIPTION_FIX = "description_fix",
  LOGIC_FIX = "logic_fix",
  // Evaluation related
  QUALITY_REVIEW = "quality_review",
  CLICHE_CHECK = "cliche_check",
}

// ============================================================
// Interfaces
// ============================================================

export interface SkillRecommendation {
  skillId: string;
  skillName: string;
  /** 0-1 relevance score */
  relevance: number;
  reason: string;
  /** 1 = highest priority */
  priority: number;
}

// ============================================================
// Internal types for skill registry entries
// ============================================================

interface SkillRegistryEntry {
  name: string;
  description: string;
  taskTypes: TaskType[];
  keywords: string[];
}

// ============================================================
// Skill Registry (21 skills)
// ============================================================

export const SKILL_REGISTRY: Record<string, SkillRegistryEntry> = {
  // ---- Character ----
  "character-forge": {
    name: "\u89D2\u8272\u7194\u7089",
    description: "\u57FA\u7840\u4EBA\u7269\u521B\u5EFA\u4E0E\u8BBE\u5B9A",
    taskTypes: [TaskType.CHARACTER_CREATION],
    keywords: ["\u89D2\u8272", "\u4EBA\u7269", "\u521B\u5EFA", "\u8BBE\u5B9A", "\u80CC\u666F"],
  },
  "four-selves": {
    name: "\u56DB\u4E2A\u81EA\u6211",
    description: "\u9EA6\u57FA\u56DB\u4E2A\u81EA\u6211\u6A21\u578B\uFF1A\u793E\u4F1A/\u4E2A\u4EBA/\u79C1\u5BC6/\u9690\u85CF",
    taskTypes: [TaskType.CHARACTER_CREATION, TaskType.CHARACTER_DEVELOPMENT],
    keywords: ["\u5185\u5FC3", "\u77DB\u76FE", "\u5C42\u6B21", "\u81EA\u6211", "\u9762\u5177", "\u79D8\u5BC6"],
  },
  "true-character": {
    name: "\u4EBA\u7269\u771F\u76F8",
    description: "\u901A\u8FC7\u4E24\u96BE\u9009\u62E9\u63ED\u793A\u89D2\u8272\u5185\u6838",
    taskTypes: [TaskType.CHARACTER_DEVELOPMENT, TaskType.CLIMAX_WRITING],
    keywords: ["\u9009\u62E9", "\u4E24\u96BE", "\u6289\u62E9", "\u771F\u76F8", "\u672C\u6027", "\u538B\u529B"],
  },
  "mirror-foil": {
    name: "\u955C\u50CF\u966A\u886C",
    description: "\u8BBE\u8BA1\u914D\u89D2\u7F51\u7EDC\u5F62\u6210\u56DB\u89D2\u5BF9\u7ACB",
    taskTypes: [TaskType.CHARACTER_CREATION, TaskType.SCENE_DESIGN],
    keywords: ["\u914D\u89D2", "\u5BF9\u6BD4", "\u955C\u50CF", "\u966A\u886C", "\u5BF9\u7ACB", "\u7F51\u7EDC"],
  },
  "self-knowledge-eval": {
    name: "\u81EA\u77E5\u4E4B\u660E\u8BC4\u4F30",
    description: "\u8BC4\u4F30\u89D2\u8272\u8BA4\u77E5\u88C2\u75D5\u4E0E\u5F27\u5149\u5B8C\u6210\u5EA6",
    taskTypes: [TaskType.CHARACTER_DEVELOPMENT, TaskType.QUALITY_REVIEW],
    keywords: ["\u5F27\u5149", "\u6210\u957F", "\u8BA4\u77E5", "\u8F6C\u53D8", "\u5B8C\u6210\u5EA6"],
  },

  // ---- Dialogue ----
  "subtext-dialogue": {
    name: "\u6F5C\u53F0\u8BCD\u5BF9\u8BDD",
    description: "CoT\u53CC\u8F68\u751F\u6210\u6CD5\u5236\u9020\u6F5C\u53F0\u8BCD",
    taskTypes: [TaskType.CHARACTER_DIALOGUE],
    keywords: ["\u6F5C\u53F0\u8BCD", "\u5BF9\u8BDD", "\u8A00\u5916\u4E4B\u610F", "\u6697\u793A", "\u9690\u85CF"],
  },
  "on-the-nose-fix": {
    name: "\u76F4\u767D\u4FEE\u590D",
    description: "\u8BC6\u522B\u5E76\u8F6C\u5316\u76F4\u767D\u5BF9\u767D\u4E3A\u542B\u84C4\u8868\u8FBE",
    taskTypes: [TaskType.DIALOGUE_FIX],
    keywords: ["\u76F4\u767D", "\u4FEE\u590D", "\u542B\u84C4", "\u9690\u6666", "\u4F18\u5316"],
  },

  // ---- Structure ----
  "22-steps-outline": {
    name: "22\u6B65\u9AA4\u5927\u7EB2",
    description: "\u7279\u9C81\u6BD422\u6B65\u9AA4\u6709\u673A\u6545\u4E8B\u7ED3\u6784",
    taskTypes: [TaskType.STORY_OUTLINE],
    keywords: ["\u5927\u7EB2", "\u7ED3\u6784", "\u6B65\u9AA4", "\u9AA8\u67B6", "\u89C4\u5212"],
  },
  "pyramid-structure": {
    name: "\u91D1\u5B57\u5854\u7ED3\u6784",
    description: "\u903B\u8F91\u9AA8\u67B6\u6784\u5EFA",
    taskTypes: [TaskType.STORY_OUTLINE, TaskType.SCENE_DESIGN],
    keywords: ["\u903B\u8F91", "\u91D1\u5B57\u5854", "\u8BBA\u8BC1", "\u5C42\u6B21"],
  },
  "novel-chapter": {
    name: "\u5C0F\u8BF4\u7AE0\u8282",
    description: "\u7AE0\u8282\u7EA7\u5199\u4F5C\u6280\u5DE7",
    taskTypes: [TaskType.CHAPTER_WRITING],
    keywords: ["\u7AE0\u8282", "\u6BB5\u843D", "\u8282\u594F", "\u627F\u63A5"],
  },

  // ---- Suspense & Twist ----
  "suspense-craft": {
    name: "\u60AC\u5FF5\u6280\u5DE7",
    description: "\u60AC\u5FF5\u6784\u5EFA\u4E0E\u7EF4\u6301",
    taskTypes: [TaskType.SUSPENSE_BUILD],
    keywords: ["\u60AC\u5FF5", "\u7D27\u5F20", "\u671F\u5F85", "\u672A\u77E5"],
  },
  "misdirection-twist": {
    name: "\u53CD\u8F6C\u8BBE\u8BA1",
    description: "\u6CE8\u610F\u529B\u8F6C\u79FB+\u9006\u5411\u5DE5\u7A0B\u8BBE\u8BA1\u53CD\u8F6C",
    taskTypes: [TaskType.TWIST_DESIGN, TaskType.SUSPENSE_BUILD],
    keywords: ["\u53CD\u8F6C", "\u610F\u5916", "\u9006\u8F6C", "\u8BEF\u5BFC", "\u63ED\u793A"],
  },
  "deus-ex-machina": {
    name: "\u673A\u68B0\u964D\u795E\u68C0\u6D4B",
    description: "\u8BC6\u522B\u5DE7\u5408\u89E3\u51B3\u5E76\u690D\u5165\u4F0F\u7B14",
    taskTypes: [TaskType.LOGIC_FIX, TaskType.QUALITY_REVIEW],
    keywords: ["\u5DE7\u5408", "\u4F0F\u7B14", "\u673A\u68B0\u964D\u795E", "\u5408\u7406\u6027"],
  },

  // ---- Description ----
  "show-dont-tell": {
    name: "\u5C55\u793A\u6027\u63CF\u5199",
    description: "\u56DB\u7EF4\u611F\u5B98\u5316\u63CF\u5199\u6280\u6CD5",
    taskTypes: [TaskType.DESCRIPTION_FIX, TaskType.CHAPTER_WRITING],
    keywords: ["\u5C55\u793A", "\u63CF\u5199", "\u611F\u5B98", "\u7EC6\u8282", "\u5177\u4F53"],
  },
  "object-symbolism": {
    name: "\u7269\u54C1\u8C61\u5F81",
    description: "\u5951\u8BC3\u592B\u4E4B\u67AA+\u7B2C\u4E09\u97F3\u8F68\u8BBE\u8BA1",
    taskTypes: [TaskType.SCENE_DESIGN, TaskType.SUSPENSE_BUILD],
    keywords: ["\u8C61\u5F81", "\u7269\u54C1", "\u9053\u5177", "\u9690\u55BB", "\u4F0F\u7B14"],
  },
  "fictional-dream": {
    name: "\u865A\u6784\u4E4B\u68A6",
    description: "\u6C89\u6D78\u5F0F\u53D9\u4E8B\u4F53\u9A8C",
    taskTypes: [TaskType.CHAPTER_WRITING],
    keywords: ["\u6C89\u6D78", "\u68A6\u5883", "\u4F53\u9A8C", "\u4EE3\u5165"],
  },
  "voice-workshop": {
    name: "\u53D9\u4E8B\u58F0\u97F3",
    description: "\u53D9\u4E8B\u8005\u58F0\u97F3\u5851\u9020",
    taskTypes: [TaskType.CHAPTER_WRITING],
    keywords: ["\u58F0\u97F3", "\u53D9\u4E8B\u8005", "\u98CE\u683C", "\u8BED\u8C03"],
  },

  // ---- Evaluation ----
  "script-doctor": {
    name: "\u5267\u672C\u533B\u751F",
    description: "\u7EFC\u5408\u8BCA\u65AD\u6846\u67B6",
    taskTypes: [TaskType.QUALITY_REVIEW, TaskType.CLICHE_CHECK],
    keywords: ["\u8BCA\u65AD", "\u8BC4\u4F30", "\u95EE\u9898", "\u4FEE\u590D", "\u8D28\u91CF"],
  },

  // ---- Other ----
  "premise-magic": {
    name: "\u524D\u63D0\u9B54\u6CD5",
    description: "\u6545\u4E8B\u524D\u63D0\u8BBE\u8BA1",
    taskTypes: [TaskType.STORY_OUTLINE],
    keywords: ["\u524D\u63D0", "\u6982\u5FF5", "\u70B9\u5B50", "\u6838\u5FC3"],
  },
  "presentation": {
    name: "\u6F14\u793A\u6587\u7A3F",
    description: "\u6F14\u793A\u5185\u5BB9\u521B\u4F5C",
    taskTypes: [],
    keywords: ["\u6F14\u793A", "PPT", "\u5C55\u793A"],
  },
};

// ============================================================
// Task-to-skill mapping
// ============================================================

type SkillMapping = [skillId: string, relevance: number, priority: number];

export const TASK_SKILL_MAP: Record<TaskType, SkillMapping[]> = {
  [TaskType.CHARACTER_CREATION]: [
    ["four-selves", 1.0, 1],
    ["character-forge", 0.9, 2],
    ["mirror-foil", 0.7, 3],
  ],
  [TaskType.CHARACTER_DEVELOPMENT]: [
    ["true-character", 1.0, 1],
    ["four-selves", 0.9, 2],
    ["self-knowledge-eval", 0.8, 3],
  ],
  [TaskType.CHARACTER_DIALOGUE]: [
    ["subtext-dialogue", 1.0, 1],
    ["on-the-nose-fix", 0.8, 2],
  ],
  [TaskType.STORY_OUTLINE]: [
    ["22-steps-outline", 1.0, 1],
    ["pyramid-structure", 0.8, 2],
    ["premise-magic", 0.7, 3],
  ],
  [TaskType.SCENE_DESIGN]: [
    ["object-symbolism", 0.9, 1],
    ["mirror-foil", 0.8, 2],
    ["suspense-craft", 0.7, 3],
  ],
  [TaskType.CHAPTER_WRITING]: [
    ["novel-chapter", 1.0, 1],
    ["show-dont-tell", 0.9, 2],
    ["fictional-dream", 0.8, 3],
    ["voice-workshop", 0.7, 4],
  ],
  [TaskType.SUSPENSE_BUILD]: [
    ["suspense-craft", 1.0, 1],
    ["misdirection-twist", 0.9, 2],
    ["object-symbolism", 0.7, 3],
  ],
  [TaskType.TWIST_DESIGN]: [
    ["misdirection-twist", 1.0, 1],
    ["deus-ex-machina", 0.8, 2],
  ],
  [TaskType.CLIMAX_WRITING]: [
    ["true-character", 1.0, 1],
    ["show-dont-tell", 0.9, 2],
    ["misdirection-twist", 0.7, 3],
  ],
  [TaskType.DIALOGUE_FIX]: [
    ["on-the-nose-fix", 1.0, 1],
    ["subtext-dialogue", 0.9, 2],
  ],
  [TaskType.DESCRIPTION_FIX]: [
    ["show-dont-tell", 1.0, 1],
    ["fictional-dream", 0.7, 2],
  ],
  [TaskType.LOGIC_FIX]: [
    ["deus-ex-machina", 1.0, 1],
    ["pyramid-structure", 0.7, 2],
  ],
  [TaskType.QUALITY_REVIEW]: [
    ["script-doctor", 1.0, 1],
    ["self-knowledge-eval", 0.8, 2],
    ["deus-ex-machina", 0.7, 3],
  ],
  [TaskType.CLICHE_CHECK]: [
    ["script-doctor", 1.0, 1],
  ],
};

// ============================================================
// SkillRouter class
// ============================================================

export class SkillRouter {
  routeByTaskType(taskType: TaskType, maxSkills: number = 3): SkillRecommendation[] {
    const mappings = TASK_SKILL_MAP[taskType];
    if (!mappings) return [];

    const recommendations: SkillRecommendation[] = [];
    for (const [skillId, relevance, priority] of mappings.slice(0, maxSkills)) {
      const info = SKILL_REGISTRY[skillId];
      recommendations.push({
        skillId,
        skillName: info?.name ?? skillId,
        relevance,
        reason: info?.description ?? "",
        priority,
      });
    }

    return recommendations;
  }

  routeByKeywords(keywords: string[], maxSkills: number = 5): SkillRecommendation[] {
    const keywordSet = new Set(keywords.map((kw) => kw.toLowerCase()));

    type ScoreEntry = { skillId: string; info: SkillRegistryEntry; relevance: number };
    const scores: ScoreEntry[] = [];

    for (const [skillId, info] of Object.entries(SKILL_REGISTRY)) {
      const skillKeywords = new Set(info.keywords.map((kw) => kw.toLowerCase()));

      let overlap = 0;
      for (const kw of keywordSet) {
        if (skillKeywords.has(kw)) overlap++;
      }

      if (overlap > 0) {
        const relevance = overlap / Math.max(keywordSet.size, skillKeywords.size);
        scores.push({ skillId, info, relevance });
      }
    }

    // Sort by relevance descending
    scores.sort((a, b) => b.relevance - a.relevance);

    const recommendations: SkillRecommendation[] = [];
    for (let i = 0; i < Math.min(scores.length, maxSkills); i++) {
      const { skillId, info, relevance } = scores[i]!;
      recommendations.push({
        skillId,
        skillName: info.name,
        relevance,
        reason: info.description,
        priority: i + 1,
      });
    }

    return recommendations;
  }

  routeByIssue(issueType: string): SkillRecommendation[] {
    const issueMapping: Record<string, TaskType[]> = {
      "\u76F4\u767D\u5BF9\u767D": [TaskType.DIALOGUE_FIX],
      "\u6F5C\u53F0\u8BCD\u4E0D\u8DB3": [TaskType.CHARACTER_DIALOGUE],
      "\u4EBA\u7269\u6241\u5E73": [TaskType.CHARACTER_CREATION, TaskType.CHARACTER_DEVELOPMENT],
      "\u673A\u68B0\u964D\u795E": [TaskType.LOGIC_FIX],
      "\u5DE7\u5408\u8FC7\u591A": [TaskType.LOGIC_FIX],
      "\u63CF\u5199\u62BD\u8C61": [TaskType.DESCRIPTION_FIX],
      "\u7F3A\u4E4F\u60AC\u5FF5": [TaskType.SUSPENSE_BUILD],
      "\u53CD\u8F6C\u65E0\u529B": [TaskType.TWIST_DESIGN],
      "\u9648\u8BCD\u6EE5\u8C03": [TaskType.CLICHE_CHECK],
      "\u89D2\u8272\u5F27\u5149\u4E0D\u5B8C\u6574": [TaskType.CHARACTER_DEVELOPMENT],
    };

    const allRecommendations: SkillRecommendation[] = [];
    for (const [issueKey, taskTypes] of Object.entries(issueMapping)) {
      if (issueType.includes(issueKey)) {
        for (const tt of taskTypes) {
          allRecommendations.push(...this.routeByTaskType(tt));
        }
      }
    }

    // Deduplicate by skillId
    const seen = new Set<string>();
    const unique: SkillRecommendation[] = [];
    for (const rec of allRecommendations) {
      if (!seen.has(rec.skillId)) {
        seen.add(rec.skillId);
        unique.push(rec);
      }
    }

    return unique.slice(0, 5);
  }

  getSkillChain(
    primaryTask: TaskType,
    _context?: Record<string, unknown>,
  ): SkillRecommendation[] {
    const SKILL_CHAINS: Record<string, string[]> = {
      [TaskType.CHARACTER_CREATION]: [
        "character-forge",
        "four-selves",
        "mirror-foil",
      ],
      [TaskType.CHAPTER_WRITING]: [
        "22-steps-outline",
        "subtext-dialogue",
        "show-dont-tell",
        "novel-chapter",
      ],
      [TaskType.CLIMAX_WRITING]: [
        "true-character",
        "misdirection-twist",
        "show-dont-tell",
      ],
      [TaskType.QUALITY_REVIEW]: [
        "script-doctor",
        "deus-ex-machina",
        "self-knowledge-eval",
      ],
    };

    const chainSkillIds = SKILL_CHAINS[primaryTask] ?? [];

    const recommendations: SkillRecommendation[] = [];
    for (let i = 0; i < chainSkillIds.length; i++) {
      const skillId = chainSkillIds[i]!;
      const info = SKILL_REGISTRY[skillId];
      recommendations.push({
        skillId,
        skillName: info?.name ?? skillId,
        relevance: 1.0,
        reason: `\u6280\u80FD\u94FE\u7B2C${i + 1}\u6B65: ${info?.description ?? ""}`,
        priority: i + 1,
      });
    }

    return recommendations;
  }

  listAllSkills(): Record<string, SkillRegistryEntry> {
    return { ...SKILL_REGISTRY };
  }
}

// ============================================================
// Standalone convenience functions
// ============================================================

export function getSkillsForTask(taskType: TaskType): SkillRecommendation[] {
  const router = new SkillRouter();
  return router.routeByTaskType(taskType);
}

export function getSkillsForIssue(issue: string): SkillRecommendation[] {
  const router = new SkillRouter();
  return router.routeByIssue(issue);
}
