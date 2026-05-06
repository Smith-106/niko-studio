/**
 * character.ts - Character context agent
 *
 * Migrated from src/agents/character.py
 *
 * Responsible for character profile queries, relationship analysis,
 * and behavioral consistency checks.
 */

import { BaseAgent } from './base';
import type { IAgentGraphEngine } from './base';
import { LifecycleStage } from './lifecycle-hooks';
import type { DynamicCharacterState } from '../narrative/character-depth';
import { createEmptyDynamicState, mergeDynamicState } from '../narrative/character-depth';

const STM_CAPACITY = 20;

// ── Interfaces (Pydantic BaseModel -> TS interface) ────────

export interface CharacterProfile {
  name: string;
  role: string;

  // Four selves model
  socialSelf: string;
  personalSelf: string;
  privateSelf: string;
  hiddenSelf: string;

  // Core attributes
  desire: string;
  fear: string;
  flaw: string;
  strength: string;

  // External traits
  appearance: string;
  speechPattern: string;
  mannerisms: string[];

  // Relationships
  relationships: Record<string, string>;
}

export interface CharacterContext {
  mainCharacter: CharacterProfile | null;
  presentCharacters: CharacterProfile[];
  relationshipDynamics: string[];
  dialogueGuidelines: Record<string, string>;
}

// ── Agent ──────────────────────────────────────────────────

export class CharacterAgent extends BaseAgent {
  private _graphEngine: IAgentGraphEngine | null;
  private _shortTermMemory: string[] = [];
  private _longTermMemory: string[] = [];
  private _dynamicState: DynamicCharacterState = createEmptyDynamicState();

  constructor(
    deps?: {
      graphEngine?: IAgentGraphEngine;
      config?: Record<string, unknown>;
    },
  ) {
    super('Character', deps?.config);
    this._graphEngine = deps?.graphEngine ?? null;

    // Register lifecycle hooks for structured reasoning
    this.addHook(LifecycleStage.PERCEPTION, async (ctx) => {
      ctx.memoryContext = this.getMemoryContext();
      ctx.dynamicState = this._dynamicState;
      return ctx;
    });

    this.addHook(LifecycleStage.REFLECTION, async (ctx) => {
      if (ctx.lastAction) {
        this.pushMemory(ctx.lastAction as string);
      }
      if (ctx.newGoals || ctx.newStates) {
        this._dynamicState = mergeDynamicState(
          this._dynamicState,
          (ctx.newGoals as string[]) ?? [],
          (ctx.newStates as string[]) ?? [],
          (ctx.lastAction as string) ?? '',
        );
      }
      return ctx;
    });
  }

  // ── STM / LTM Memory Management ───────────────────────────

  pushMemory(event: string): void {
    this._shortTermMemory.push(event);
    if (this._shortTermMemory.length > STM_CAPACITY) {
      const oldest = this._shortTermMemory.shift();
      if (oldest) {
        const summary = oldest.length > 100
          ? oldest.slice(0, 97) + '...'
          : oldest;
        this._longTermMemory.push(`[LTM] ${summary}`);
      }
    }
  }

  getMemoryContext(): string {
    const stmPart = this._shortTermMemory.length > 0
      ? `Recent events:\n${this._shortTermMemory.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
      : '';
    const ltmPart = this._longTermMemory.length > 0
      ? `\nLong-term memories:\n${this._longTermMemory.slice(-10).join('\n')}`
      : '';
    return stmPart + ltmPart;
  }

  get dynamicState(): DynamicCharacterState {
    return this._dynamicState;
  }

  // ── Lazy graph engine access ─────────────────────────────

  get graphEngine(): IAgentGraphEngine | null {
    return this._graphEngine;
  }

  set graphEngine(engine: IAgentGraphEngine | null) {
    this._graphEngine = engine;
  }

  // ── Public API ───────────────────────────────────────────

  /**
   * Build the character context needed for a given scene.
   */
  async getContext(sceneInfo: Record<string, unknown>): Promise<CharacterContext> {
    const povCharacter = (sceneInfo['pov_character'] as string) ?? '';
    const characterNames = (sceneInfo['characters'] as string[]) ?? [];

    let mainCharacter: CharacterProfile | null = null;
    const presentCharacters: CharacterProfile[] = [];
    const relationshipDynamics: string[] = [];
    const dialogueGuidelines: Record<string, string> = {};

    // Fetch POV character profile
    if (povCharacter) {
      mainCharacter = await this.getCharacterProfile(povCharacter);
      if (mainCharacter) {
        dialogueGuidelines[povCharacter] = this.generateDialogueGuide(mainCharacter);
      }
    }

    // Fetch other present characters
    for (const name of characterNames) {
      if (name !== povCharacter) {
        const profile = await this.getCharacterProfile(name);
        if (profile) {
          presentCharacters.push(profile);
          dialogueGuidelines[name] = this.generateDialogueGuide(profile);
        }
      }
    }

    // Analyze relationship dynamics
    if (mainCharacter && presentCharacters.length > 0) {
      const dynamics = await this.analyzeRelationships(mainCharacter, presentCharacters);
      relationshipDynamics.push(...dynamics);
    }

    const context: CharacterContext = {
      mainCharacter,
      presentCharacters,
      relationshipDynamics,
      dialogueGuidelines,
    };

    this.logActivity(
      `Generated character context: ${povCharacter}, ${presentCharacters.length} others`
    );
    return context;
  }

  /**
   * Validate whether a character action is consistent with their profile.
   */
  async validateBehavior(
    characterName: string,
    action: string,
    context: CharacterContext,
  ): Promise<{ isValid: boolean; issues: string[]; suggestions: string[] }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Find the matching profile
    let profile: CharacterProfile | null = null;
    if (context.mainCharacter && context.mainCharacter.name === characterName) {
      profile = context.mainCharacter;
    } else {
      profile = context.presentCharacters.find(c => c.name === characterName) ?? null;
    }

    if (!profile) {
      return {
        isValid: true,
        issues: [],
        suggestions: ['Character profile not found, skipping validation'],
      };
    }

    // Check for conflicts between action and personality
    if (profile.fear && action.toLowerCase().includes(profile.fear.toLowerCase())) {
      issues.push(
        `${characterName}'s fear is '${profile.fear}', but the action seems to overcome it -- needs buildup`
      );
    }

    if (profile.flaw && action.includes('\u5B8C\u7F8E')) {
      issues.push(
        `${characterName} has the flaw '${profile.flaw}', actions should not be overly perfect`
      );
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Synchronous entry point (mirrors Python `run`).
   */
  run(inputData: unknown): Promise<CharacterContext> {
    return this.getContext(inputData as Record<string, unknown>);
  }

  // ── Private helpers ──────────────────────────────────────

  private async getCharacterProfile(name: string): Promise<CharacterProfile | null> {
    if (!this._graphEngine?.query) {
      return { ...EMPTY_PROFILE, name };
    }

    const query = [
      `MATCH (c:Character {name: '${name}'})`,
      'OPTIONAL MATCH (c)-[r]->(other:Character)',
      'RETURN c, collect({type: type(r), target: other.name}) as relationships',
    ].join('\n');

    try {
      const result = await this._graphEngine.query(query);
      if (result && result.length > 0) {
        const node = result[0] as Record<string, unknown>;
        const charData = (node['c'] as Record<string, unknown>) ?? {};
        const rels = (node['relationships'] as Array<Record<string, unknown>>) ?? [];

        const relationships: Record<string, string> = {};
        for (const rel of rels) {
          const target = rel['target'] as string;
          if (target) {
            relationships[target] = (rel['type'] as string) ?? 'KNOWS';
          }
        }

        return {
          name,
          role: (charData['role'] as string) ?? 'supporting',
          socialSelf: (charData['social_self'] as string) ?? '',
          personalSelf: (charData['personal_self'] as string) ?? '',
          privateSelf: (charData['private_self'] as string) ?? '',
          hiddenSelf: (charData['hidden_self'] as string) ?? '',
          desire: (charData['desire'] as string) ?? '',
          fear: (charData['fear'] as string) ?? '',
          flaw: (charData['flaw'] as string) ?? '',
          strength: (charData['strength'] as string) ?? '',
          appearance: (charData['appearance'] as string) ?? '',
          speechPattern: (charData['speech_pattern'] as string) ?? '',
          mannerisms: (charData['mannerisms'] as string[]) ?? [],
          relationships,
        };
      }
    } catch (e) {
      this.logActivity(`Character query failed: ${e}`, 'WARNING');
    }

    return { ...EMPTY_PROFILE, name };
  }

  private async analyzeRelationships(
    main: CharacterProfile,
    others: CharacterProfile[],
  ): Promise<string[]> {
    const dynamics: string[] = [];

    for (const other of others) {
      const relType = main.relationships[other.name] ?? 'NEUTRAL';

      if (['ENEMY', 'RIVAL', 'ANTAGONIST'].includes(relType)) {
        dynamics.push(`${main.name} and ${other.name} have an antagonistic relationship; dialogue should be tense`);
      } else if (['FRIEND', 'ALLY', 'LOVER'].includes(relType)) {
        dynamics.push(`${main.name} and ${other.name} are close; dialogue can be more relaxed`);
      } else if (['MENTOR', 'STUDENT'].includes(relType)) {
        dynamics.push(`${main.name} and ${other.name} share a mentor-student bond with guidance and learning`);
      } else {
        dynamics.push(`${main.name} and ${other.name} maintain a neutral, polite distance`);
      }
    }

    return dynamics;
  }

  private generateDialogueGuide(profile: CharacterProfile): string {
    const guides: string[] = [];

    if (profile.speechPattern) {
      guides.push(`Speech pattern: ${profile.speechPattern}`);
    }
    if (profile.mannerisms.length > 0) {
      guides.push(`Mannerisms: ${profile.mannerisms.slice(0, 3).join(', ')}`);
    }
    if (profile.socialSelf) {
      guides.push(`Public persona: ${profile.socialSelf}`);
    }
    if (profile.privateSelf) {
      guides.push(`Inner thoughts: ${profile.privateSelf}`);
    }

    return guides.length > 0 ? guides.join('; ') : 'No specific guidelines';
  }
}

// ── Empty profile constant ─────────────────────────────────

const EMPTY_PROFILE: Omit<CharacterProfile, 'name'> = {
  role: '',
  socialSelf: '',
  personalSelf: '',
  privateSelf: '',
  hiddenSelf: '',
  desire: '',
  fear: '',
  flaw: '',
  strength: '',
  appearance: '',
  speechPattern: '',
  mannerisms: [],
  relationships: {},
};
