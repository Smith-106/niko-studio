/**
 * Workflow graph - lightweight node execution engine
 *
 * Replaces LangGraph with a simple pipeline runner.
 * Nodes execute sequentially, conditional routing is supported.
 *
 * Migrated from src/workflow/graph.py
 */

import type { BaseState } from './state';
import type { IWorkflowGraph } from './adapters/base-adapter';
import { type NodeFunction, type RoutingFunction } from './adapters/base-adapter';
import { DistillationManager } from '../memory/distillation-manager.js';

// ============================================================
// Distillation Types
// ============================================================

export enum DistillationTemplate {
  ENTITY_EXTRACTION = 'entity_extraction',
  RELATION_EXTRACTION = 'relation_extraction',
  EVENT_EXTRACTION = 'event_extraction',
  SUMMARY = 'summary',
  CHARACTER_ARC = 'character_arc',
  PLOT_STRUCTURE = 'plot_structure',
  FULL = 'full',
}

const TEMPLATE_ALIASES: Record<string, DistillationTemplate> = {
  entity: DistillationTemplate.ENTITY_EXTRACTION,
  entities: DistillationTemplate.ENTITY_EXTRACTION,
  relation: DistillationTemplate.RELATION_EXTRACTION,
  relations: DistillationTemplate.RELATION_EXTRACTION,
  event: DistillationTemplate.EVENT_EXTRACTION,
  events: DistillationTemplate.EVENT_EXTRACTION,
  summary: DistillationTemplate.SUMMARY,
  character: DistillationTemplate.CHARACTER_ARC,
  character_arc: DistillationTemplate.CHARACTER_ARC,
  plot: DistillationTemplate.PLOT_STRUCTURE,
  plot_structure: DistillationTemplate.PLOT_STRUCTURE,
  full: DistillationTemplate.FULL,
  all: DistillationTemplate.FULL,
};

export function distillationTemplateFromString(name: string): DistillationTemplate {
  const lower = (name || '').trim().toLowerCase();
  return TEMPLATE_ALIASES[lower] ?? DistillationTemplate.FULL;
}

// ============================================================
// Distillation state
// ============================================================

export interface DistillationState {
  sources: string[];
  template: DistillationTemplate;
  result: Record<string, unknown>;
  scene_id: string;
  chapter_num: number;
  is_completed: boolean;
  error: string | null;
}

export function distillationStateFromDict(data: Record<string, unknown>): DistillationState {
  return {
    sources: (data['sources'] as string[]) ?? [],
    template: distillationTemplateFromString((data['template'] as string) ?? 'full'),
    result: (data['result'] as Record<string, unknown>) ?? {},
    scene_id: (data['scene_id'] as string) ?? '',
    chapter_num: (data['chapter_num'] as number) ?? 0,
    is_completed: (data['is_completed'] as boolean) ?? false,
    error: (data['error'] as string | null) ?? null,
  };
}

export function distillationStateToDict(state: DistillationState): Record<string, unknown> {
  return {
    sources: state.sources,
    template: state.template,
    result: state.result,
    scene_id: state.scene_id,
    chapter_num: state.chapter_num,
    is_completed: state.is_completed,
    error: state.error,
  };
}

// ============================================================
// Simple graph implementation
// ============================================================

export class SimpleWorkflowGraph implements IWorkflowGraph {
  private nodes: Map<string, NodeFunction> = new Map();
  private edges: Array<{ from: string; to: string | null; routing?: RoutingFunction | null }> = [];
  private entryPoint: string = '';

  addNode(name: string, fn: NodeFunction): void {
    this.nodes.set(name, fn);
  }

  addEdge(fromNode: string, toNode: string): void {
    this.edges.push({ from: fromNode, to: toNode, routing: null });
  }

  addConditionalEdge(
    fromNode: string,
    router: RoutingFunction,
    _mapping: Record<string, string>,
  ): void {
    this.edges.push({ from: fromNode, to: null, routing: router });
  }

  setEntryPoint(name: string): void {
    this.entryPoint = name;
  }

  compile(): { invoke(state: BaseState): Promise<BaseState> } {
    const nodes = this.nodes;
    const edges = this.edges;
    const entry = this.entryPoint;
    const maxIterations = 64;

    return {
      async invoke(initialState: BaseState): Promise<BaseState> {
        let currentState = { ...initialState };
        let iteration = 0;

        // Start from entry point
        let nextNode: string | null = entry;
        const visited = new Set<string>();

        while (nextNode && iteration < maxIterations) {
          if (visited.has(nextNode)) {
            console.error(`Graph cycle detected at node: ${nextNode}`);
            break;
          }
          visited.add(nextNode);

          const nodeFn = nodes.get(nextNode);
          if (!nodeFn) {
            console.error(`Node not found: ${nextNode}`);
            break;
          }

          const output = await nodeFn(currentState);
          if (output && typeof output === 'object') {
            currentState = { ...currentState, ...output };
          }

          // Find next edge
          const edge = edges.find(e => e.from === nextNode);
          if (!edge) break;

          if (edge.routing) {
            const routeResult = edge.routing(currentState);
            nextNode = routeResult ?? null;
          } else if (edge.to) {
            nextNode = edge.to;
          } else {
            break;
          }

          iteration++;
        }

        return currentState;
      },
    };
  }
}

// ============================================================
// Distillation Node
// ============================================================

export interface DistillService {
  distillChapter(content: string): Record<string, unknown>;
}

export interface KnowledgeLayer {
  applyToGraph(graph: KnowledgeLayer, result: Record<string, unknown>): void;
}

export class DistillationNode {
  private template: DistillationTemplate;
  private _knowledgeLayer: KnowledgeLayer | null;
  private _distillService: DistillService | null;

  constructor(
    template: DistillationTemplate = DistillationTemplate.FULL,
    knowledgeLayer?: KnowledgeLayer | null,
    distillService?: DistillService | null,
  ) {
    this.template = template;
    this._knowledgeLayer = knowledgeLayer ?? null;
    this._distillService = distillService ?? null;
  }

  process(state: BaseState): BaseState {
    const stateAny = state as Record<string, unknown>;
    const draftContent = (stateAny['draft_content'] as string) ?? '';
    if (!draftContent) return state;

    const currentScene = ((stateAny['current_scene'] ?? {}) as Record<string, unknown>);
    const distillState: DistillationState = {
      sources: [draftContent],
      template: this.template,
      result: {},
      scene_id: (currentScene['scene_id'] as string) ?? '',
      chapter_num: (currentScene['chapter_num'] as number) ?? 0,
      is_completed: false,
      error: null,
    };

    try {
      const result = this._executeDistillation(draftContent, this.template);
      distillState.result = result;
      distillState.is_completed = true;

      const errors = ((stateAny['errors'] as string[]) ?? []);
      return {
        ...state,
        distillation_result: {
          entities_count: (result['entities'] as unknown[])?.length ?? 0,
          relations_count: (result['relations'] as unknown[])?.length ?? 0,
          events_count: (result['events'] as unknown[])?.length ?? 0,
          entities: result['entities'] ?? [],
          relations: result['relations'] ?? [],
          events: result['events'] ?? [],
          template: this.template,
          scene_id: distillState.scene_id,
        },
        distillation_state: distillState,
        errors: [...errors, `Distillation completed: template=${this.template}`],
      } as unknown as BaseState;
    } catch (e) {
      const errors = ((stateAny['errors'] as string[]) ?? []);
      return {
        ...state,
        errors: [...errors, `Distillation warning: ${e}`],
        distillation_state: { ...distillState, error: String(e) },
      } as unknown as BaseState;
    }
  }

  private _executeDistillation(
    content: string,
    _template: DistillationTemplate,
  ): Record<string, unknown> {
    const distillationManager = new DistillationManager();
    return distillationManager.distillChapter(content);
  }
}

// ============================================================
// Graph helper functions
// ============================================================

export function shouldDistill(state: BaseState): boolean {
  const stateAny = state as Record<string, unknown>;
  const hasDraft = Boolean(stateAny['draft_content']);
  const notDistilled = !stateAny['distillation_result'];
  const config = (stateAny['config'] as Record<string, unknown>) ?? {};
  const distillEnabled = config['enable_distillation'] ?? true;
  return hasDraft && notDistilled && Boolean(distillEnabled);
}

export function createDistillationNode(
  template: string = 'full',
  knowledgeLayer?: KnowledgeLayer,
): DistillationNode {
  const templateEnum = distillationTemplateFromString(template);
  return new DistillationNode(templateEnum, knowledgeLayer);
}

// ============================================================
// Legacy compat entry points (warn on use)
// ============================================================

const LEGACY_WARNING =
  'Direct workflow graph/adapter entrypoints are deprecated. ' +
  'Use WorkflowEngine entry API as the single public authority.';

export function warnLegacyEntrypoint(source: string): void {
  console.warn(`${LEGACY_WARNING} source=${source}`);
}
