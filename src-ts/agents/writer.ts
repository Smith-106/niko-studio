/**
 * writer.ts - Writer agent for scene-level content generation.
 *
 * Migrated from src/agents/writer.py
 * Uses Prompt Chaining with 4 stages: Setup, Character Entry, Conflict, Resolution.
 */

import type { IAgentLLMService } from './base';
import { SkillRouter, SKILL_REGISTRY } from './skill-router';

// ============================================================
// Interfaces (Pydantic models -> TS interfaces)
// ============================================================

export interface WriterInput {
  scene_card?: Record<string, unknown>;

  scene_id: string;
  chapter_num: number;
  pov_character: string;
  objective: string;
  conflict: string;
  outcome: string;

  plot_beat: string;
  emotional_arc: string;
  sensory_guidance: Record<string, string>;

  character_profiles: Record<string, unknown>[];
  world_settings: Record<string, unknown>;
  previous_content?: string;

  foreshadows_to_plant: string[];
  foreshadows_to_harvest: string[];

  word_target: number;
}

/** Create a WriterInput with defaults, supporting scene_card normalization */
export function createWriterInput(partial: Partial<WriterInput> & { scene_card?: Record<string, unknown> }): WriterInput {
  const card = partial.scene_card ?? {};
  return {
    scene_id: partial.scene_id || (card['scene_id'] as string) || 'scene-001',
    chapter_num: partial.chapter_num ?? (card['chapter_num'] as number) ?? 1,
    pov_character: partial.pov_character || (card['pov_character'] as string) || 'protagonist',
    objective: partial.objective || (card['objective'] as string) || 'advance plot',
    conflict: partial.conflict || (card['conflict'] as string) || 'encounter obstacle',
    outcome: partial.outcome || (card['outcome'] as string) || '+',
    plot_beat: partial.plot_beat || (card['plot_beat'] as string) || 'scene progression',
    emotional_arc: partial.emotional_arc || (card['emotional_arc'] as string) || 'calm->change',
    sensory_guidance: partial.sensory_guidance || (card['sensory_guidance'] as Record<string, string>) || {},
    character_profiles: partial.character_profiles ?? [],
    world_settings: partial.world_settings ?? {},
    previous_content: partial.previous_content,
    foreshadows_to_plant: partial.foreshadows_to_plant ?? [],
    foreshadows_to_harvest: partial.foreshadows_to_harvest ?? [],
    word_target: partial.word_target ?? 2000,
  };
}

export interface WriterOutput {
  content: string;
  wordcount: number;
  characters_appeared: string[];
  locations: string[];
  metadata?: Record<string, unknown>;

  foreshadows_planted: string[];
  foreshadows_harvested: string[];

  sensory_types_used: string[];
  forbidden_words_found: string[];
  sections_needing_review: string[];
}

export type WriterWarningCode =
  | 'knowledge_retrieval_failed'
  | 'knowledge_sync_failed'
  | 'openai_proxy_fallback_failed'
  | 'skill_load_failed'
  | 'skill_injection_failed';

// ============================================================
// System Prompts
// ============================================================

const WRITER_SYSTEM_PROMPT = `
You are a novelist skilled in the Victorian fantasy style, adept at emulating Dickens and Lord of the Mysteries.

## Core Style Guide

### 1. Translationese
- Use long attributive clauses and subordinate sentences
- Strictly use Western-style address forms
- Use interjections like "oh", "hm", "ah"

### 2. Animism
- Never directly describe character psychology; show through environmental reactions
- Example: "The gas lamp's flame flinched" instead of "He felt afraid"

### 3. Sensory Immersion
- Visual 50%, Auditory 20%, Tactile 15%, Olfactory 10%, Gustatory 5%
- Victorian atmosphere: gas lamp glow, fog-damp air, carriage clatter

### 4. Narrative Rhythm
- Setup: long sentences, layered details
- Payoff: short sentences, quickened pace

### 5. Dialogue Rules
- Must be colloquial and natural
- Must contain subtext
- Accompanied by actions and expressions

### 6. Forbidden Words
- "suddenly" -> use specific action instead
- "couldn't help but" -> describe reaction directly
- Never use expository dialogue

## Output Requirements
1. Output novel text directly, no explanations
2. Use Markdown format
3. Follow emotional arc from beginning to end
`;

const CHAIN_SCENE_SETUP = `
## Task: Scene Opening

Based on the following scene information, generate a scene opening (about 300 words).
Goal: Establish environment and atmosphere, immerse the reader.

### Scene Information
- Location: {location}
- Time: {time}
- Atmosphere: {atmosphere}
- Sensory guidance: {sensory_guidance}
- Emotional starting point: {emotional_start}

### Requirements
1. Use animism technique
2. Include at least 3 types of sensory description
3. Hint at upcoming emotion through environment
4. Do not introduce characters yet

Generate scene opening:
`;

const CHAIN_CHARACTER_ENTRY = `
## Task: Character Entry

Continue from the existing content, write character entrance and initial interaction (about 500 words).

### Existing Content
{previous_content}

### Entering Characters
{character_profiles}

### POV Character
{pov_character}

### Scene Objective
{objective}

### Requirements
1. Show character personality without stating "he is a XX person"
2. Dialogue must contain subtext
3. Each dialogue paired with action and expression
4. Show personality through behavior, not narration

Continue with character entrance:
`;

const CHAIN_CONFLICT_DEVELOPMENT = `
## Task: Conflict Development

Continue from the existing content, develop the conflict (about 800 words).

### Existing Content
{previous_content}

### Core Conflict
{conflict}

### Emotional Arc
From {emotional_start} to {emotional_end}

### Requirements
1. Conflict gradually escalates, emotional tension increases
2. Use short sentences to accelerate pace before climax
3. Maintain tense environmental description
4. Character reactions must fit their personality

Continue with conflict development:
`;

const CHAIN_RESOLUTION = `
## Task: Scene Resolution

Continue from the existing content, write scene resolution (about 400 words).

### Existing Content
{previous_content}

### Scene Outcome
Outcome type: {outcome} (positive +/negative -)

### Hook Requirement
{hook_requirement}

### Foreshadowing Tasks
- Plant: {foreshadows_to_plant}
- Harvest: {foreshadows_to_harvest}

### Requirements
1. Echo opening environmental description
2. Complete emotional transition
3. If chapter end, must have hook for reader
4. Plant or harvest specified foreshadowing

Continue with scene resolution:
`;

// ============================================================
// WriterAgent
// ============================================================

export class WriterAgent {
  private llmService: IAgentLLMService;
  private skillRouter: SkillRouter | null;
  private knowledgeLayer: unknown;
  private enableKnowledgeRetrieval: boolean;
  private injectedSkills: string[];
  private injectedSkillGuidance: string;

  static readonly FORBIDDEN_WORDS = ['suddenly', 'involuntarily', 'surprisingly', 'unexpectedly', 'uncontrollably'];

  constructor(options: {
    llmService: IAgentLLMService;
    skillRouter?: SkillRouter | null;
    knowledgeLayer?: unknown;
    enableKnowledgeRetrieval?: boolean;
  }) {
    this.llmService = options.llmService;
    this.skillRouter = options.skillRouter ?? null;
    this.knowledgeLayer = options.knowledgeLayer ?? null;
    this.enableKnowledgeRetrieval = options.enableKnowledgeRetrieval ?? true;
    this.injectedSkills = [];
    this.injectedSkillGuidance = '';
  }

  // ---------- Knowledge retrieval ----------

  async retrieveContext(
    query: string,
    contextTypes?: string[],
    limit: number = 10,
    warnings?: string[],
  ): Promise<Record<string, unknown>> {
    if (!this.knowledgeLayer || !this.enableKnowledgeRetrieval) {
      return { entities: [], relations: [], memories: [] };
    }

    const context: Record<string, unknown> = { entities: [], relations: [], memories: [] };
    const kl = this.knowledgeLayer as Record<string, unknown>;

    try {
      if (typeof kl['search_entities'] === 'function') {
        let entities = await this.safeCall(kl['search_entities'] as (...args: unknown[]) => Promise<unknown[]>, query, { limit }) as Record<string, unknown>[];
        if (contextTypes) {
          entities = entities.filter(e => contextTypes.includes(e['type'] as string));
        }
        context['entities'] = entities;
      }

      if (typeof kl['get_related_entities'] === 'function') {
        const entities = context['entities'] as Record<string, unknown>[];
        for (const entity of entities.slice(0, 3)) {
          const relations = await this.safeCall(
            kl['get_related_entities'] as (...args: unknown[]) => Promise<unknown[]>,
            entity['id'],
          ) as Record<string, unknown>[];
          (context['relations'] as Record<string, unknown>[]).push(...relations);
        }
      }

      if (typeof kl['search_memories'] === 'function') {
        const memories = await this.safeCall(
          kl['search_memories'] as (...args: unknown[]) => Promise<unknown[]>,
          query,
          { limit },
        ) as Record<string, unknown>[];
        context['memories'] = memories;
      }
    } catch (e) {
      this.appendWarning(warnings, `knowledge_retrieval_failed: ${e}`);
    }

    return context;
  }

  private async safeCall(fn: (...args: unknown[]) => Promise<unknown>, ...args: unknown[]): Promise<unknown> {
    return fn(...args);
  }

  private buildKnowledgeContext(retrieved: Record<string, unknown>): string {
    const entities = (retrieved['entities'] ?? []) as Record<string, unknown>[];
    const memories = (retrieved['memories'] ?? []) as Record<string, unknown>[];

    if (entities.length === 0 && memories.length === 0) return '';

    const parts: string[] = ['## Knowledge Context\n'];

    if (entities.length > 0) {
      parts.push('### Related Characters/Locations');
      for (const ent of entities.slice(0, 5)) {
        const name = (ent['name'] ?? ent['id'] ?? 'unknown') as string;
        const type = (ent['type'] ?? '') as string;
        const desc = (ent['description'] ?? '') as string;
        parts.push(`- **${name}** (${type}): ${desc}`);
      }
      parts.push('');
    }

    const relations = (retrieved['relations'] ?? []) as Record<string, unknown>[];
    if (relations.length > 0) {
      parts.push('### Character Relations');
      for (const rel of relations.slice(0, 5)) {
        const source = (rel['source'] ?? '') as string;
        const target = (rel['target'] ?? '') as string;
        const type = (rel['type'] ?? '') as string;
        parts.push(`- ${source} --[${type}]--> ${target}`);
      }
      parts.push('');
    }

    if (memories.length > 0) {
      parts.push('### Related History');
      for (const mem of memories.slice(0, 3)) {
        const content = typeof mem === 'object' && mem !== null ? String(mem['content'] ?? JSON.stringify(mem)).slice(0, 200) : String(mem).slice(0, 200);
        parts.push(`- ${content}`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  // ---------- Knowledge-enhanced writing ----------

  async writeWithKnowledge(input: WriterInput, allowLlmFallback: boolean = true): Promise<WriterOutput> {
    const warnings: string[] = [];

    const queryParts = [input.pov_character, input.objective, input.conflict].filter(Boolean);
    const query = queryParts.join(' ');

    const retrieved = await this.retrieveContext(query, ['character', 'location', 'event'], 10, warnings);

    const knowledgeContext = this.buildKnowledgeContext(retrieved);
    if (knowledgeContext && Array.isArray(retrieved['entities'])) {
      const enhancedProfiles = [...input.character_profiles];
      for (const ent of (retrieved['entities'] as Record<string, unknown>[])) {
        if (ent['type'] === 'character') {
          const exists = enhancedProfiles.some(p => p['name'] === ent['name']);
          if (!exists) {
            enhancedProfiles.push({
              name: ent['name'],
              description: ent['description'] ?? '',
              source: 'knowledge_layer',
            });
          }
        }
      }
      input.character_profiles = enhancedProfiles;
    }

    const output = await this.write(input, allowLlmFallback);

    const priorWarnings: string[] = [];
    if (output.metadata && Array.isArray(output.metadata['warnings'])) {
      output.metadata['warnings'].forEach((w: unknown) => priorWarnings.push(String(w)));
    }
    const merged = [...priorWarnings, ...warnings];
    this.attachMetadata(output, merged, this.buildKnowledgeSummary(retrieved));

    return output;
  }

  async syncToKnowledgeLayer(output: WriterOutput, sceneId: string, warnings?: string[]): Promise<void> {
    if (!this.knowledgeLayer) return;
    const kl = this.knowledgeLayer as Record<string, unknown>;

    try {
      if (typeof kl['add_entity'] === 'function') {
        const addEntity = kl['add_entity'] as (...args: unknown[]) => Promise<void>;
        for (const charName of output.characters_appeared) {
          await this.safeCall(addEntity, charName.toLowerCase().replace(/ /g, '_'), charName, 'character', `Appeared in scene ${sceneId}`);
        }
        for (const location of output.locations) {
          await this.safeCall(addEntity, location.toLowerCase().replace(/ /g, '_'), location, 'location', `Featured in scene ${sceneId}`);
        }
        for (const fs of output.foreshadows_planted) {
          await this.safeCall(addEntity, `foreshadow_${sceneId}_${this.simpleHash(fs)}`, fs, 'foreshadow', `Planted in scene ${sceneId}`);
        }
      }
    } catch (e) {
      this.appendWarning(warnings, `knowledge_sync_failed: ${e}`);
    }
  }

  private simpleHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 10000;
  }

  // ---------- Skill injection ----------

  injectSkills(skillIds: string[], warnings?: string[]): string {
    if (!this.skillRouter) {
      this.injectedSkills = [];
      this.injectedSkillGuidance = '';
      return '';
    }

    this.injectedSkills = [...skillIds];
    const contents: string[] = [];

    for (const skillId of this.injectedSkills) {
      try {
        const skillEntry = SKILL_REGISTRY[skillId];
        if (skillEntry) {
          contents.push(`### ${skillEntry.name}\n${skillEntry.description}`);
        }
      } catch (e) {
        this.appendWarning(warnings, `skill_load_failed: ${skillId}: ${e}`);
      }
    }

    this.injectedSkillGuidance = contents.join('\n\n');
    return this.injectedSkillGuidance;
  }

  // ---------- Main write method ----------

  async write(inputData: WriterInput, _allowLlmFallback: boolean = true): Promise<WriterOutput> {
    const warnings: string[] = [];

    const skillIds = this.collectEffectiveSkillIds(inputData);
    const previousSkillState = this.enterSkillScope(skillIds, warnings);

    try {
      const emotionalParts = inputData.emotional_arc.split('->');
      const emotionalStart = emotionalParts[0]?.trim() ?? 'calm';
      const emotionalEnd = emotionalParts[1]?.trim() ?? 'change';

      const location = inputData.sensory_guidance['location'] ?? 'unknown location';
      const time = inputData.sensory_guidance['time'] ?? 'some moment';
      const atmosphere = inputData.sensory_guidance['atmosphere'] ?? emotionalStart;

      // Chain 1: Scene Setup
      const sceneSetup = await this.runChain(
        CHAIN_SCENE_SETUP,
        {
          location,
          time,
          atmosphere,
          sensory_guidance: JSON.stringify(inputData.sensory_guidance),
          emotional_start: emotionalStart,
        },
        warnings,
      );

      // Chain 2: Character Entry
      const characterEntry = await this.runChain(
        CHAIN_CHARACTER_ENTRY,
        {
          previous_content: sceneSetup,
          character_profiles: JSON.stringify(inputData.character_profiles),
          pov_character: inputData.pov_character,
          objective: inputData.objective,
        },
        warnings,
      );

      // Chain 3: Conflict Development
      const conflictDev = await this.runChain(
        CHAIN_CONFLICT_DEVELOPMENT,
        {
          previous_content: `${sceneSetup}\n\n${characterEntry}`,
          conflict: inputData.conflict,
          emotional_start: emotionalStart,
          emotional_end: emotionalEnd,
        },
        warnings,
      );

      // Chain 4: Resolution
      const isChapterEnd = this.isChapterEnd(inputData);
      const hookRequirement = isChapterEnd ? 'Must have a strong hook (Cliffhanger)' : 'Complete emotional transition';

      const resolution = await this.runChain(
        CHAIN_RESOLUTION,
        {
          previous_content: `${sceneSetup}\n\n${characterEntry}\n\n${conflictDev}`,
          outcome: inputData.outcome,
          hook_requirement: hookRequirement,
          foreshadows_to_plant: inputData.foreshadows_to_plant.join(', ') || 'none',
          foreshadows_to_harvest: inputData.foreshadows_to_harvest.join(', ') || 'none',
        },
        warnings,
      );

      const fullContent = `${sceneSetup}\n\n${characterEntry}\n\n${conflictDev}\n\n${resolution}`;
      const output = this.postProcess(fullContent, inputData);
      this.attachMetadata(output, warnings);
      return output;
    } finally {
      this.safeExitSkillScope(previousSkillState, warnings);
    }
  }

  private async runChain(
    promptTemplate: string,
    variables: Record<string, string>,
    _warnings?: string[],
  ): Promise<string> {
    let systemPrompt = WRITER_SYSTEM_PROMPT;
    if (this.injectedSkillGuidance) {
      systemPrompt = `${WRITER_SYSTEM_PROMPT}\n\n## Skill Guidance\n\n${this.injectedSkillGuidance}\n\nPlease incorporate the above skill points in your writing.`;
    }

    // Replace template variables
    let userPrompt = promptTemplate;
    for (const [key, value] of Object.entries(variables)) {
      userPrompt = userPrompt.replace(`{${key}}`, value);
    }

    return this.llmService.generate(userPrompt, {
      systemPrompt,
      temperature: 0.7,
    });
  }

  // ---------- Continue writing ----------

  async continueWriting(
    existingContent: string,
    continuationHint: string,
    wordTarget: number = 500,
  ): Promise<string> {
    const userPrompt = `
## Task: Continue Writing

### Existing Content
${existingContent}

### Continuation Direction
${continuationHint}

### Target Word Count
About ${wordTarget} words

Please continue naturally, maintaining consistent style:
`;
    return this.llmService.generate(userPrompt, {
      systemPrompt: WRITER_SYSTEM_PROMPT,
      temperature: 0.7,
    });
  }

  // ---------- Rewrite section ----------

  async rewriteSection(original: string, instruction: string, rewriteType: string = 'general'): Promise<string> {
    const typeGuidance: Record<string, string> = {
      sensory: 'Add sensory descriptions using animism technique',
      dialogue: 'Improve dialogue quality, add subtext and action',
      rhythm: 'Adjust rhythm: short sentences for tension, long for calm',
      style: 'Strengthen translationese style',
      general: 'Rewrite according to instructions',
    };

    const userPrompt = `
## Task: Rewrite

### Original
${original}

### Rewrite Requirements
${instruction}

### Rewrite Type Guidance
${typeGuidance[rewriteType] ?? typeGuidance['general']}

Please rewrite this content, preserving meaning but improving quality:
`;

    return this.llmService.generate(userPrompt, {
      systemPrompt: WRITER_SYSTEM_PROMPT,
      temperature: 0.7,
    });
  }

  // ---------- Revise ----------

  async revise(
    draft: string,
    feedback: Record<string, unknown>,
    _allowLlmFallback: boolean = true,
    qualityGoals?: Record<string, unknown>,
  ): Promise<WriterOutput> {
    const issues = (feedback['issues'] ?? []) as string[];
    const suggestions = (feedback['suggestions'] ?? []) as string[];
    const dimensionScores = (feedback['dimension_scores'] ?? {}) as Record<string, number>;

    const goals = qualityGoals ?? {};
    const preset = String(goals['humanization_preset'] ?? '').trim().toLowerCase();
    const customInstruction = String(goals['custom_humanization_instruction'] ?? '').trim();

    const styleGuidance: string[] = [];
    if (preset === 'human_writing') {
      styleGuidance.push('Enhance human writing quality: avoid mechanical repetition, allow natural long-short sentence mixing.');
      styleGuidance.push('Prioritize concrete details and contextual cohesion over vague adjectives.');
    } else if (preset === 'ai_edit_guidance') {
      styleGuidance.push('Optimize text from an editing perspective: preserve original meaning, then refine structure and expression.');
    } else if (preset === 'custom' && customInstruction) {
      styleGuidance.push(`Follow custom revision instruction: ${customInstruction}`);
    }

    const revisionInstructions: string[] = [];
    const lowScoreDims = Object.entries(dimensionScores).filter(([, score]) => score < 7).map(([dim]) => dim);

    if (lowScoreDims.length > 0) {
      revisionInstructions.push(`Focus on improving: ${lowScoreDims.join(', ')}`);
    }
    if (issues.length > 0) {
      revisionInstructions.push('Fix the following issues:');
      issues.slice(0, 5).forEach(issue => revisionInstructions.push(`  - ${issue}`));
    }
    if (suggestions.length > 0) {
      revisionInstructions.push('Adopt the following suggestions:');
      suggestions.slice(0, 3).forEach(s => revisionInstructions.push(`  - ${s}`));
    }
    if (styleGuidance.length > 0) {
      revisionInstructions.push('Style optimization goals:');
      styleGuidance.forEach(g => revisionInstructions.push(`  - ${g}`));
    }

    const userPrompt = `
## Task: Revise Draft

### Original Draft
${draft}

### Revision Requirements
${revisionInstructions.join('\n')}

### Notes
1. Preserve the good parts of the original
2. Fix identified issues specifically
3. Maintain consistent overall style
4. Revised word count should be similar to original

Please output the complete revised content:
`;

    const revisedContent = await this.llmService.generate(userPrompt, {
      systemPrompt: WRITER_SYSTEM_PROMPT,
      temperature: 0.7,
    });

    const forbiddenFound = WriterAgent.FORBIDDEN_WORDS.filter(w => revisedContent.includes(w));

    return {
      content: revisedContent,
      wordcount: revisedContent.length,
      characters_appeared: [],
      locations: [],
      foreshadows_planted: [],
      foreshadows_harvested: [],
      sensory_types_used: [],
      forbidden_words_found: forbiddenFound,
      sections_needing_review: [],
    };
  }

  // ---------- Helpers ----------

  private postProcess(content: string, inputData: WriterInput): WriterOutput {
    const wordcount = content.length;

    const forbiddenFound = WriterAgent.FORBIDDEN_WORDS.filter(w => content.includes(w));

    const sensoryTypes: string[] = [];
    const visualKws = ['light', 'shadow', 'color', 'look', 'pupil', 'eye', 'bright', 'dark'];
    const auditoryKws = ['sound', 'noise', 'listen', 'silence', 'tone'];
    const tactileKws = ['touch', 'cold', 'hot', 'warm', 'soft', 'hard', 'pain'];
    const olfactoryKws = ['smell', 'fragrance', 'stink', 'scent', 'breath'];

    if (visualKws.some(kw => content.includes(kw))) sensoryTypes.push('visual');
    if (auditoryKws.some(kw => content.includes(kw))) sensoryTypes.push('auditory');
    if (tactileKws.some(kw => content.includes(kw))) sensoryTypes.push('tactile');
    if (olfactoryKws.some(kw => content.includes(kw))) sensoryTypes.push('olfactory');

    const charactersAppeared: string[] = [];
    for (const profile of inputData.character_profiles) {
      const name = profile['name'] as string;
      if (name && content.includes(name)) {
        charactersAppeared.push(name);
      }
    }

    const sectionsNeedingReview: string[] = [];
    if (forbiddenFound.length > 0) {
      sectionsNeedingReview.push(`Contains forbidden words: ${forbiddenFound.join(', ')}`);
    }
    if (sensoryTypes.length < 3) {
      sectionsNeedingReview.push(`Insufficient sensory description: ${sensoryTypes.join(', ')}`);
    }

    return {
      content,
      wordcount,
      characters_appeared: charactersAppeared,
      locations: [],
      foreshadows_planted: inputData.foreshadows_to_plant,
      foreshadows_harvested: inputData.foreshadows_to_harvest,
      sensory_types_used: sensoryTypes,
      forbidden_words_found: forbiddenFound,
      sections_needing_review: sectionsNeedingReview,
    };
  }

  private collectEffectiveSkillIds(inputData: WriterInput): string[] {
    const ws = inputData.world_settings;
    if (typeof ws !== 'object' || ws === null) return [];
    const candidate = (ws['recommended_skills'] ?? ws['skill_ids']) as string[] | undefined;
    if (!Array.isArray(candidate)) return [];
    const seen = new Set<string>();
    return candidate.filter(s => typeof s === 'string' && s && !seen.has(s) && seen.add(s));
  }

  private enterSkillScope(skillIds: string[], warnings?: string[]): Record<string, unknown> {
    const previous = {
      skills: [...this.injectedSkills],
      guidance: this.injectedSkillGuidance,
    };
    this.injectedSkills = [];
    this.injectedSkillGuidance = '';
    if (skillIds.length > 0) {
      try {
        this.injectSkills(skillIds);
      } catch (e) {
        this.appendWarning(warnings, `skill_injection_failed: ${e}`);
        this.injectedSkills = [];
        this.injectedSkillGuidance = '';
      }
    }
    return previous;
  }

  private safeExitSkillScope(previous: Record<string, unknown>, warnings?: string[]): void {
    try {
      this.injectedSkills = [...(previous['skills'] as string[] ?? [])];
      this.injectedSkillGuidance = (previous['guidance'] as string) ?? '';
    } catch (e) {
      this.appendWarning(warnings, `skill_injection_failed: scope_exit: ${e}`);
      this.injectedSkills = [];
      this.injectedSkillGuidance = '';
    }
  }

  private isChapterEnd(inputData: WriterInput): boolean {
    const ws = inputData.world_settings;
    if (typeof ws === 'object' && ws !== null) {
      const explicit = ws['is_chapter_end'];
      if (typeof explicit === 'boolean') return explicit;
    }
    const sceneId = (inputData.scene_id ?? '').trim().toUpperCase();
    if (!sceneId) return false;
    const match = sceneId.match(/SC(\d+)$/);
    if (!match) return false;
    return parseInt(match[1], 10) === 1;
  }

  private buildKnowledgeSummary(retrieved: Record<string, unknown>): Record<string, number> {
    return {
      entities_count: Array.isArray(retrieved['entities']) ? retrieved['entities'].length : 0,
      relations_count: Array.isArray(retrieved['relations']) ? retrieved['relations'].length : 0,
      memories_count: Array.isArray(retrieved['memories']) ? retrieved['memories'].length : 0,
    };
  }

  private attachMetadata(output: WriterOutput, warnings: string[], knowledgeSummary?: Record<string, number>): void {
    const metadata: Record<string, unknown> = { ...(output.metadata ?? {}) };
    if (warnings.length > 0) metadata['warnings'] = warnings;
    if (knowledgeSummary) metadata['knowledge_retrieved'] = knowledgeSummary;
    output.metadata = Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private appendWarning(warnings: string[] | undefined, message: string): void {
    if (warnings) warnings.push(message);
  }
}

// ============================================================
// LangGraph Node
// ============================================================

export function createWriterNode(
  llmService: IAgentLLMService,
): (state: Record<string, unknown>) => Promise<Record<string, unknown>> {
  const agent = new WriterAgent({ llmService });

  return async function writerNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
    const sceneCard = (state['current_scene_card'] ?? {}) as Record<string, unknown>;

    const input = createWriterInput({
      scene_card: sceneCard,
      scene_id: (sceneCard['scene_id'] as string) ?? 'CH01-SC01',
      chapter_num: (sceneCard['chapter_num'] as number) ?? 1,
      pov_character: (sceneCard['pov_character'] as string) ?? '',
      objective: (sceneCard['objective'] as string) ?? '',
      conflict: (sceneCard['conflict'] as string) ?? '',
      outcome: (sceneCard['outcome'] as string) ?? '+',
      plot_beat: (sceneCard['plot_beat'] as string) ?? '',
      emotional_arc: (sceneCard['emotional_arc'] as string) ?? 'calm->change',
      sensory_guidance: (sceneCard['sensory_guidance'] as Record<string, string>) ?? {},
      character_profiles: (state['character_profiles'] ?? []) as Record<string, unknown>[],
      world_settings: (state['world_settings'] ?? {}) as Record<string, unknown>,
      foreshadows_to_plant: (sceneCard['foreshadows_to_plant'] ?? []) as string[],
      foreshadows_to_harvest: (sceneCard['foreshadows_to_harvest'] ?? []) as string[],
      word_target: (state['word_target'] as number) ?? 2000,
    });

    const result = await agent.write(input, (state['allow_llm_fallback'] as boolean) ?? true);

    return {
      ...state,
      draft_content: result.content,
      draft_wordcount: result.wordcount,
      writer_self_check: {
        sensory_types: result.sensory_types_used,
        forbidden_words: result.forbidden_words_found,
        needs_review: result.sections_needing_review,
      },
    };
  };
}

/** Test helper */
export function createWriterChain(llmService: IAgentLLMService): {
  invoke(sceneCardJson: string, wordTarget: number): Promise<string>;
} {
  return {
    async invoke(sceneCardJson: string, wordTarget: number): Promise<string> {
      const userPrompt = `Write based on the following scene card:\n\n${sceneCardJson}\n\nTarget: about ${wordTarget} words`;
      return llmService.generate(userPrompt, {
        systemPrompt: WRITER_SYSTEM_PROMPT,
        temperature: 0.7,
      });
    },
  };
}
