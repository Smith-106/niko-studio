/**
 * architect.ts - Story planning agent with LOCK system and distillation.
 *
 * Migrated from src/agents/architect.py
 */

import type { IAgentLLMService } from './base';
import {
  DistillationService,
  type LegacyDistillationData,
} from '../services/distill-service';

// ============================================================
// Interfaces (Pydantic models -> TS interfaces)
// ============================================================

export interface LOCKAnalysis {
  L_score: number;
  L_protagonist: string;
  L_desire: string;
  L_pain_point: string;
  L_unique_trait: string;

  O_score: number;
  O_short_term: string;
  O_long_term: string;
  O_measurable: boolean;

  C_score: number;
  C_external: string;
  C_internal: string;
  C_escalation: string;

  K_score: number;
  K_hooks: string[];
  K_transformation: string;
}

/** Computed helpers for LOCKAnalysis */
export function lockTotalScore(a: LOCKAnalysis): number {
  return a.L_score + a.O_score + a.C_score + a.K_score;
}

export function lockIsValid(a: LOCKAnalysis): boolean {
  return lockTotalScore(a) >= 28;
}

export interface TwoDoorsStructure {
  disturbance: Record<string, unknown>;
  door_1: Record<string, unknown>;
  midpoint: Record<string, unknown>;
  door_2: Record<string, unknown>;
  climax: Record<string, unknown>;
  resolution?: Record<string, unknown>;
}

export type SceneOutcome = '+' | '-';

export interface SceneCard {
  scene_id: string;
  chapter_num: number;
  scene_num: number;
  pov_character: string;
  objective: string;
  conflict: string;
  outcome: SceneOutcome;
  structural_function: string;
  emotional_arc: string;
  sensory_guidance: Record<string, unknown>;
  plot_beat: string;
  hook?: string;
  foreshadows_to_plant: string[];
  foreshadows_to_harvest: string[];
}

export interface RhythmAnalysis {
  positive_scenes: number;
  negative_scenes: number;
  balance_score: number;
  warnings: string[];
}

export interface StoryBlueprint {
  title: string;
  genre: string;
  logline: string;
  lock_analysis: LOCKAnalysis;
  two_doors: TwoDoorsStructure;
  scene_cards: SceneCard[];
  rhythm_analysis: RhythmAnalysis;
  target_chapters: number;
  target_wordcount: number;
}

// ============================================================
// Distillation stub interface
// ============================================================

export interface IDistillService {
  distillChapter(content: string): Promise<LegacyDistillationData>;
  applyToGraph(knowledgeLayer: unknown, data: LegacyDistillationData): void;
  getDistillationPrompt(taskType: string, content?: string): string;
}

interface GraphKnowledgeLayer {
  addEntity?: (
    id: string,
    name: string,
    type: string,
    description?: string
  ) => void;
  addRelation?: (
    source: string,
    target: string,
    type: string,
    props?: Record<string, unknown>
  ) => void;
}

type DistilledBlueprintData = LegacyDistillationData & {
  status?: string;
};

// ============================================================
// SequentialThinking stub (minimal interface used by architect)
// ============================================================

interface ThinkingEngine {
  reset(): void;
  think(content: string, options: { thoughtType: string; metadata?: Record<string, unknown>; confidence?: number }): void;
  branch(options: { name: string; description: string; priority: number }): { id: string };
  switchBranch(id: string): void;
  conclude(content: string, options: { confidence: number }): void;
  toMarkdown(): string;
  toDict(): Record<string, unknown>;
}

const THOUGHT_TYPES = {
  INITIAL: 'initial',
  ANALYSIS: 'analysis',
  HYPOTHESIS: 'hypothesis',
  VERIFICATION: 'verification',
  CONCLUSION: 'conclusion',
  BRANCH: 'branch',
  REVISION: 'revision',
  BACKTRACK: 'backtrack',
} as const;

// ============================================================
// System Prompt
// ============================================================

const ARCHITECT_SYSTEM_PROMPT = `
You are an expert story architect, versed in LOCK system theory and web novel golden chapter principles.
Your goal is to generate a rigorous story blueprint based on the user's inspiration, conforming to the LOCK system.

## Core Theoretical Framework

### LOCK System

**L - Lead**
- Must have a strong desire (not vague "want to be strong", but specific "find the murderer")
- Must have a clear pain point (readers can empathize with the flaw or trauma)
- Must have a unique skill or perspective (reason for readers to follow)

**O - Objective**
- Goal must be concrete and visualizable (can be filmed)
- Must have clear success/failure criteria
- Must be directly related to the protagonist's desire

**C - Confrontation**
- Must have a clear opponent (person/organization/nature/inner self)
- Conflict must continuously escalate
- Every scene must have obstacles (no conflict = no story)

**K - Knockout**
- Must have emotional impact or satisfaction
- Protagonist must undergo real change
- Each chapter must end with a hook

### Two Doors Structure

**Door 1 (20-25%)**
- Protagonist crosses an irreversible threshold
- Enters a "new world" (literal or metaphorical)

**Door 2 (75%)**
- Everything seems lost
- Darkest moment
- Gateway to the final showdown

## Output Requirements

Generate a complete StoryBlueprint JSON containing:
- LOCK analysis (each item with specific content and scores)
- Two doors structure (clear chapter positions and event descriptions)
- Scene card sequence (each scene with objective-conflict-outcome)
- Rhythm analysis (positive/negative scene statistics and warnings)
`;

const ARCHITECT_USER_PROMPT_TEMPLATE = `
## User Inspiration

{user_idea}

## Genre

{genre}

## Targets

- Target chapters: {target_chapters}
- Target word count: {target_wordcount}

## Requirements

Generate the complete story blueprint based on the LOCK system.

1. Analyze the protagonist's desire and pain points, evaluate L score
2. Clarify story objectives, evaluate O score
3. Design conflict escalation path and two doors positions, evaluate C score
4. Plan chapter hooks and ending, evaluate K score
5. Generate scene card sequence
`;

// ============================================================
// ArchitectAgent
// ============================================================

export class ArchitectAgent {
  private llmService: IAgentLLMService | null;
  private goldenDataset: Record<string, unknown>[];
  private enableSequentialThinking: boolean;
  private enableDistillation: boolean;
  private knowledgeLayer: unknown;
  private thinkingEngine: ThinkingEngine | null;
  private distillService: IDistillService | null;

  constructor(options: {
    llmService: IAgentLLMService;
    goldenDatasetPath?: string;
    enableSequentialThinking?: boolean;
    thinkingMaxDepth?: number;
    enableDistillation?: boolean;
    knowledgeLayer?: unknown;
  } | IAgentLLMService | null) {
    const normalizedOptions = this.normalizeOptions(options);

    this.llmService = normalizedOptions.llmService;
    this.goldenDataset = [];
    this.enableSequentialThinking = normalizedOptions.enableSequentialThinking ?? true;
    this.enableDistillation = normalizedOptions.enableDistillation ?? true;
    this.knowledgeLayer = normalizedOptions.knowledgeLayer ?? null;

    // SequentialThinking stub (full implementation to be migrated separately)
    if (this.enableSequentialThinking) {
      this.thinkingEngine = this.createThinkingEngine(normalizedOptions.thinkingMaxDepth ?? 10);
    } else {
      this.thinkingEngine = null;
    }

    this.distillService = this.enableDistillation ? this.createDistillService() : null;
  }

  private createDistillService(): IDistillService {
    const service = new DistillationService();
    return {
      distillChapter: (content: string) => service.distillChapter(content),
      applyToGraph: (knowledgeLayer: unknown, data: LegacyDistillationData) => {
        service.applyToGraph(
          this.asKnowledgeLayer(knowledgeLayer),
          data,
        );
      },
      getDistillationPrompt: (taskType: string, content: string = '') =>
        service.getDistillationPrompt(taskType, content),
    };
  }

  private asKnowledgeLayer(knowledgeLayer: unknown): GraphKnowledgeLayer {
    if (typeof knowledgeLayer === 'object' && knowledgeLayer !== null) {
      return knowledgeLayer as GraphKnowledgeLayer;
    }
    return {};
  }

  private createThinkingEngine(_maxDepth: number): ThinkingEngine {
    const thoughts: Array<{ content: string; type: string; metadata?: Record<string, unknown>; confidence?: number }> = [];
    const branches = new Map<string, string>();
    let currentBranch = 'main';
    let branchCounter = 0;
    return {
      reset: () => {
        thoughts.length = 0;
        branches.clear();
        currentBranch = 'main';
        branchCounter = 0;
      },
      think: (content, opts) => {
        thoughts.push({
          content,
          type: opts.thoughtType,
          metadata: { branch: currentBranch, ...(opts.metadata ?? {}) },
          confidence: opts.confidence,
        });
      },
      branch: ({ name }) => {
        branchCounter += 1;
        const id = `branch-${branchCounter}`;
        branches.set(id, name);
        return { id };
      },
      switchBranch: (id: string) => {
        currentBranch = id === 'main' ? 'main' : (branches.get(id) ?? currentBranch);
      },
      conclude: (content, opts) => {
        thoughts.push({ content, type: 'conclusion', metadata: { branch: currentBranch }, confidence: opts.confidence });
      },
      toMarkdown: () => thoughts.map((t, i) => `${i + 1}. [${t.type}] ${t.content}`).join('\n'),
      toDict: () => ({ thoughts }),
    };
  }

  // ---------- Main planning method ----------

  async plan(
    userIdea: string,
    genre: string,
    targetChapters: number = 30,
    targetWordcount: number = 600000,
  ): Promise<StoryBlueprint> {
    // Sequential thinking pre-analysis
    if (this.thinkingEngine) {
      this.sequentialThinkingPlan(userIdea, genre, targetChapters, targetWordcount);
    }

    const userPrompt = ARCHITECT_USER_PROMPT_TEMPLATE
      .replace('{user_idea}', userIdea)
      .replace('{genre}', genre)
      .replace('{target_chapters}', String(targetChapters))
      .replace('{target_wordcount}', String(targetWordcount));

    let result: StoryBlueprint;
    try {
      if (!this.llmService) {
        throw new Error('ArchitectAgent requires llmService or heuristic fallback');
      }
      result = await this.llmService.generateJson<StoryBlueprint>(
        userPrompt,
        { systemPrompt: ARCHITECT_SYSTEM_PROMPT },
      );
    } catch {
      result = this.buildFallbackBlueprint(userIdea, genre, targetChapters, targetWordcount);
    }

    // Validation
    this.validate(result);

    // Record conclusion in thinking engine
    if (this.thinkingEngine) {
      this.thinkingEngine.conclude(
        `Generated story blueprint: ${result.title} (LOCK score: ${lockTotalScore(result.lock_analysis)})`,
        { confidence: Math.min(lockTotalScore(result.lock_analysis) / 40, 1.0) },
      );
    }

    return result;
  }

  /** Backward-compatible wrapper */
  async generateStoryBlueprint(
    request: string,
    chapterCount: number = 30,
    genre: string = 'general',
  ): Promise<StoryBlueprint | Record<string, unknown>> {
    try {
      return await this.plan(request, genre, chapterCount);
    } catch {
      return {
        request,
        chapter_count: chapterCount,
        genre,
        fallback: true,
      };
    }
  }

  // ---------- Sequential thinking ----------

  private sequentialThinkingPlan(
    userIdea: string,
    genre: string,
    targetChapters: number,
    _targetWordcount: number,
  ): void {
    const engine = this.thinkingEngine!;
    engine.reset();

    engine.think(`Received user inspiration: ${userIdea.slice(0, 100)}...`, {
      thoughtType: THOUGHT_TYPES.INITIAL,
      metadata: { genre, target_chapters: targetChapters },
    });

    engine.think('Analyzing protagonist: identifying desire, pain point, uniqueness', {
      thoughtType: THOUGHT_TYPES.ANALYSIS,
      metadata: { lock_element: 'L' },
    });

    engine.think('Analyzing story objectives: determining short/long term goals, measurability', {
      thoughtType: THOUGHT_TYPES.ANALYSIS,
      metadata: { lock_element: 'O' },
    });

    engine.think('Designing conflict system: external, internal, escalation path', {
      thoughtType: THOUGHT_TYPES.ANALYSIS,
      metadata: { lock_element: 'C' },
    });

    engine.think('Planning ending design: chapter hooks, protagonist transformation, emotional impact', {
      thoughtType: THOUGHT_TYPES.ANALYSIS,
      metadata: { lock_element: 'K' },
    });

    engine.think('Validating two doors structure: Door 1 (20-25%), Door 2 (75%)', {
      thoughtType: THOUGHT_TYPES.VERIFICATION,
      metadata: { structure: 'two_doors' },
    });

    // Explore genre-specific openings
    if (['fantasy', 'urban', 'xianxia', 'xuanhuan'].includes(genre.toLowerCase())) {
      const branch = engine.branch({ name: 'opening_style', description: 'Explore opening styles', priority: 1 });
      engine.switchBranch(branch.id);
      engine.think(`Consider common ${genre} openings: regression/system/counterattack`, {
        thoughtType: THOUGHT_TYPES.HYPOTHESIS,
        confidence: 0.8,
      });
      engine.switchBranch('main');
    }

    engine.think(`Planning scene card sequence for ${targetChapters} chapters`, {
      thoughtType: THOUGHT_TYPES.ANALYSIS,
      metadata: { target_chapters: targetChapters },
    });
  }

  getThinkingChain(): string {
    return this.thinkingEngine ? this.thinkingEngine.toMarkdown() : 'SequentialThinking not enabled';
  }

  getThinkingData(): Record<string, unknown> {
    return this.thinkingEngine ? this.thinkingEngine.toDict() : {};
  }

  // ---------- Distillation ----------

  async distillBlueprint(blueprint: StoryBlueprint): Promise<DistilledBlueprintData> {
    if (!this.distillService) {
      return { entities: [], relations: [], status: 'distillation_disabled' };
    }

    const content = this.buildDistillContent(blueprint);
    const distilledData = await this.distillService.distillChapter(content);

    if (this.knowledgeLayer) {
      this.distillService.applyToGraph(this.knowledgeLayer, distilledData);
    }

    if (this.thinkingEngine) {
      const entityCount = Array.isArray(distilledData.entities) ? distilledData.entities.length : 0;
      const relationCount = Array.isArray(distilledData.relations) ? distilledData.relations.length : 0;
      this.thinkingEngine.think(
        `Knowledge distillation complete: ${entityCount} entities, ${relationCount} relations`,
        { thoughtType: THOUGHT_TYPES.CONCLUSION, metadata: { distilled: true } },
      );
    }

    return distilledData;
  }

  private buildDistillContent(blueprint: StoryBlueprint): string {
    const parts: string[] = [
      `# Story Blueprint: ${blueprint.title}`,
      `Genre: ${blueprint.genre}`,
      `Logline: ${blueprint.logline}`,
      '',
      '## Protagonist Analysis (LOCK-L)',
      `Protagonist: ${blueprint.lock_analysis.L_protagonist}`,
      `Desire: ${blueprint.lock_analysis.L_desire}`,
      `Pain point: ${blueprint.lock_analysis.L_pain_point}`,
      `Unique trait: ${blueprint.lock_analysis.L_unique_trait}`,
      '',
      '## Objective Analysis (LOCK-O)',
      `Short term: ${blueprint.lock_analysis.O_short_term}`,
      `Long term: ${blueprint.lock_analysis.O_long_term}`,
      '',
      '## Conflict Design (LOCK-C)',
      `External: ${blueprint.lock_analysis.C_external}`,
      `Internal: ${blueprint.lock_analysis.C_internal}`,
      `Escalation: ${blueprint.lock_analysis.C_escalation}`,
      '',
      '## Structure Nodes',
      `Door 1: ${JSON.stringify(blueprint.two_doors.door_1)}`,
      `Midpoint: ${JSON.stringify(blueprint.two_doors.midpoint)}`,
      `Door 2: ${JSON.stringify(blueprint.two_doors.door_2)}`,
      '',
      '## Scene Sequence',
    ];

    for (const sc of blueprint.scene_cards.slice(0, 10)) {
      parts.push(`- ${sc.scene_id}: ${sc.pov_character} - ${sc.objective} (conflict: ${sc.conflict})`);
    }

    return parts.join('\n');
  }

  async planWithDistillation(
    userIdea: string,
    genre: string,
    targetChapters: number = 30,
    targetWordcount: number = 600000,
  ): Promise<[StoryBlueprint, DistilledBlueprintData]> {
    const blueprint = await this.plan(userIdea, genre, targetChapters, targetWordcount);
    const distilledData = await this.distillBlueprint(blueprint);
    return [blueprint, distilledData];
  }

  getDistillationPrompts(content: string): Record<string, string> {
    if (!this.distillService) return {};
    return {
      'extract-facts': this.distillService.getDistillationPrompt('extract-facts', content),
      'extract-relationships': this.distillService.getDistillationPrompt('extract-relationships', content),
    };
  }

  // ---------- Validation ----------

  private normalizeOptions(
    options: {
      llmService: IAgentLLMService;
      goldenDatasetPath?: string;
      enableSequentialThinking?: boolean;
      thinkingMaxDepth?: number;
      enableDistillation?: boolean;
      knowledgeLayer?: unknown;
    } | IAgentLLMService | null,
  ): {
    llmService: IAgentLLMService | null;
    goldenDatasetPath?: string;
    enableSequentialThinking?: boolean;
    thinkingMaxDepth?: number;
    enableDistillation?: boolean;
    knowledgeLayer?: unknown;
  } {
    if (options == null) {
      return { llmService: null };
    }
    if (typeof options === 'object' && 'generateJson' in options) {
      return { llmService: options as IAgentLLMService };
    }
    return {
      llmService: (options as { llmService: IAgentLLMService }).llmService ?? null,
      goldenDatasetPath: (options as { goldenDatasetPath?: string }).goldenDatasetPath,
      enableSequentialThinking: (options as { enableSequentialThinking?: boolean }).enableSequentialThinking,
      thinkingMaxDepth: (options as { thinkingMaxDepth?: number }).thinkingMaxDepth,
      enableDistillation: (options as { enableDistillation?: boolean }).enableDistillation,
      knowledgeLayer: (options as { knowledgeLayer?: unknown }).knowledgeLayer,
    };
  }

  private buildFallbackBlueprint(
    userIdea: string,
    genre: string,
    targetChapters: number,
    targetWordcount: number,
  ): StoryBlueprint {
    const protagonist = this.extractProtagonist(userIdea);
    const desire = this.extractDesire(userIdea);
    const conflict = `${desire}的过程中遭遇持续升级的阻力`;
    const hooks = [
      `${protagonist}发现第一个异常线索`,
      `${protagonist}意识到信任对象并不可靠`,
      `${protagonist}必须在代价与真相之间二选一`,
    ];
    const sceneCount = Math.max(3, Math.min(targetChapters, 12));
    const sceneCards: SceneCard[] = Array.from({ length: sceneCount }, (_, index) => ({
      scene_id: `CH${String(Math.floor(index / 3) + 1).padStart(2, '0')}-SC${String((index % 3) + 1).padStart(2, '0')}`,
      chapter_num: Math.floor(index / 3) + 1,
      scene_num: (index % 3) + 1,
      pov_character: protagonist,
      objective: index === 0 ? desire : `推进${desire}`,
      conflict,
      outcome: index % 2 === 0 ? '+' : '-',
      structural_function: index === 0 ? 'setup' : index >= sceneCount - 2 ? 'payoff' : 'escalation',
      emotional_arc: index === 0 ? 'curious->uneasy' : 'pressure->resolve',
      sensory_guidance: {
        visual: genre === '悬疑' ? '阴影、封闭空间、细微动作' : '明确场景锚点',
        sound: '突兀声响、对话停顿、环境噪声',
      },
      plot_beat: hooks[Math.min(index, hooks.length - 1)] ?? hooks[0],
      hook: hooks[Math.min(index, hooks.length - 1)] ?? hooks[0],
      foreshadows_to_plant: index === 0 ? ['异常细节'] : [],
      foreshadows_to_harvest: index >= sceneCount - 2 ? ['异常细节'] : [],
    }));

    const lockAnalysis: LOCKAnalysis = {
      L_score: 8,
      L_protagonist: protagonist,
      L_desire: desire,
      L_pain_point: `${protagonist}无法承受再次失败`,
      L_unique_trait: `${protagonist}能注意到别人忽视的细节`,
      O_score: 8,
      O_short_term: `找到与${desire}相关的第一条关键线索`,
      O_long_term: `完成${desire}`,
      O_measurable: true,
      C_score: 8,
      C_external: conflict,
      C_internal: `${protagonist}怀疑自己的判断`,
      C_escalation: '每推进一步，代价和误导同时增加',
      K_score: 8,
      K_hooks: hooks,
      K_transformation: `${protagonist}从被动追随转向主动承担后果`,
    };

    return {
      title: `${protagonist}的${genre}计划`,
      genre,
      logline: `${protagonist}为了${desire}，被迫穿过层层升级的冲突并完成自我转变。`,
      lock_analysis: lockAnalysis,
      two_doors: {
        disturbance: { trigger: hooks[0] },
        door_1: { chapter: Math.max(1, Math.round(targetChapters * 0.25)), event: '第一次不可逆选择' },
        midpoint: { chapter: Math.max(2, Math.round(targetChapters * 0.5)), event: '真相出现反转' },
        door_2: { chapter: Math.max(3, Math.round(targetChapters * 0.75)), event: '主角失去退路' },
        climax: { chapter: targetChapters, event: '主角承担最终代价' },
        resolution: { chapter: targetChapters, state: '新的平衡建立' },
      },
      scene_cards: sceneCards,
      rhythm_analysis: {
        positive_scenes: sceneCards.filter(scene => scene.outcome === '+').length,
        negative_scenes: sceneCards.filter(scene => scene.outcome === '-').length,
        balance_score: 0.8,
        warnings: [],
      },
      target_chapters: targetChapters,
      target_wordcount: targetWordcount,
    };
  }

  private extractProtagonist(userIdea: string): string {
    const trimmed = (userIdea ?? '').trim();
    const match = trimmed.match(/关于(.+?)(?:在|的|，|。|$)/);
    if (match?.[1]) return match[1];
    return '主角';
  }

  private extractDesire(userIdea: string): string {
    const trimmed = (userIdea ?? '').trim();
    if (!trimmed) return '完成目标';
    return trimmed.slice(0, 30);
  }

  private validate(blueprint: StoryBlueprint): void {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (lockTotalScore(blueprint.lock_analysis) < 28) {
      errors.push(`LOCK total score ${lockTotalScore(blueprint.lock_analysis)} < 28, story structure needs strengthening`);
    }

    if (!blueprint.lock_analysis.L_desire) {
      errors.push('Protagonist lacks a clear desire');
    }

    if (blueprint.scene_cards.length < blueprint.target_chapters) {
      warnings.push(`Scene card count ${blueprint.scene_cards.length} < target chapters ${blueprint.target_chapters}`);
    }

    const scenesWithoutConflict = blueprint.scene_cards.filter(sc => !sc.conflict).map(sc => sc.scene_id);
    if (scenesWithoutConflict.length > 0) {
      errors.push(`Scenes lacking conflict: ${scenesWithoutConflict.join(', ')}`);
    }

    if (!blueprint.two_doors.door_1 || Object.keys(blueprint.two_doors.door_1).length === 0) {
      errors.push('Missing Door 1 definition');
    }
    if (!blueprint.two_doors.door_2 || Object.keys(blueprint.two_doors.door_2).length === 0) {
      errors.push('Missing Door 2 definition');
    }

    if (blueprint.rhythm_analysis.warnings) {
      warnings.push(...blueprint.rhythm_analysis.warnings);
    }

    if (errors.length > 0) {
      throw new Error(`Story blueprint validation failed:\n${errors.map(e => `- ${e}`).join('\n')}`);
    }

    if (warnings.length > 0) {
      console.warn('Validation warnings:');
      for (const w of warnings) {
        console.warn(`  - ${w}`);
      }
    }
  }
}

// ============================================================
// LangGraph Node
// ============================================================

export function createArchitectNode(
  llmService: IAgentLLMService,
  goldenDatasetPath?: string,
): (state: Record<string, unknown>) => Promise<Record<string, unknown>> {
  const agent = new ArchitectAgent({ llmService, goldenDatasetPath });

  return async function architectNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
    const blueprint = await agent.plan(
      (state['user_idea'] as string) ?? '',
      (state['genre'] as string) ?? 'fantasy',
      (state['target_chapters'] as number) ?? 30,
      (state['target_wordcount'] as number) ?? 600000,
    );

    return {
      ...state,
      story_blueprint: blueprint,
      lock_score: lockTotalScore(blueprint.lock_analysis),
      scene_cards: blueprint.scene_cards,
    };
  };
}

/** Test helper */
export function createArchitectChain(llmService: IAgentLLMService): {
  invoke(vars: Record<string, unknown>): Promise<StoryBlueprint>;
} {
  const agent = new ArchitectAgent({ llmService });
  return {
    async invoke(vars: Record<string, unknown>): Promise<StoryBlueprint> {
      return agent.plan(
        (vars['user_idea'] as string) ?? '',
        (vars['genre'] as string) ?? 'fantasy',
        (vars['target_chapters'] as number) ?? 30,
        (vars['target_wordcount'] as number) ?? 600000,
      );
    },
  };
}
