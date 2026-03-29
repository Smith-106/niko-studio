/**
 * Base Domain Adapter - Abstract interface for domain adapters
 * and adapter registry.
 *
 * Merged from:
 *   src/workflow/base_adapter.py
 *   src/workflow/adapters/base_adapter.py
 *
 * Design principles:
 * - Abstract common interface
 * - Force implementation of required methods
 * - Provide default implementations that can be overridden
 */

import type { BaseState, BaseWorkflowConfig } from '../state.js';

// ============================================================
// Evaluation result interface
// ============================================================

export interface BaseEvaluationResult {
  /** APPROVED | REVISE | HUMAN_REVIEW | REWRITE */
  decision: string;
  decision_reason: string;
  total_score: number;
  /** Per-dimension scores */
  dimension_scores: Record<string, number>;
  /** Actionable feedback */
  feedback: string;
  /** Revision instructions */
  revision_instructions: Array<Record<string, string>>;
}

// ============================================================
// Node function type
// ============================================================

export type NodeFunction = (state: BaseState) => BaseState | Promise<BaseState>;
export type RoutingFunction = (state: BaseState) => string;

// ============================================================
// Stub interface for graph engine (replaces LangGraph StateGraph)
// ============================================================

export interface IWorkflowGraph {
  addNode(name: string, fn: NodeFunction): void;
  addEdge(fromNode: string, toNode: string): void;
  addConditionalEdge(fromNode: string, router: RoutingFunction, mapping: Record<string, string>): void;
  compile(): { invoke(state: BaseState): Promise<BaseState> };
}

// ============================================================
// Base domain adapter abstract class
// ============================================================

export abstract class BaseDomainAdapter {
  protected config: BaseWorkflowConfig;
  protected domain: string;

  constructor(config?: BaseWorkflowConfig | null) {
    this.config = config ?? {};
    this.domain = this.getDomainType();
  }

  // ========================================
  // Abstract methods - subclasses must implement
  // ========================================

  /** Return domain type identifier string. */
  abstract getDomainType(): string;

  /** Return the state class constructor for this domain. */
  abstract getStateClass(): new (...args: unknown[]) => BaseState;

  /** Create the initial state for this domain. */
  abstract createInitialState(userRequest: string, extra?: Record<string, unknown>): BaseState;

  /**
   * Evaluate current state quality.
   *
   * Dimensions differ per domain:
   * - Novel: LOCK (Lead, Objective, Conflict, Knockout)
   * - Code:  Tests, Lint, Build, Coverage
   * - Knowledge: Accuracy, Completeness, Relevance
   */
  abstract evaluate(state: BaseState): BaseEvaluationResult;

  /**
   * Create a workflow graph (LangGraph replacement).
   * Returns an IWorkflowGraph that can be compiled and invoked.
   */
  abstract createGraph(): IWorkflowGraph;

  // ========================================
  // Overridable methods - default implementations
  // ========================================

  /**
   * Get workflow node function mapping.
   * Returns: node name -> node function
   */
  getNodes(): Record<string, NodeFunction> {
    return {};
  }

  /**
   * Get routing rule mapping.
   * Returns: edge name -> routing function
   */
  getRoutingRules(): Record<string, RoutingFunction> {
    return {};
  }

  /**
   * Default continue/terminate logic.
   * Can be overridden by subclasses for domain-specific logic.
   */
  shouldContinue(state: BaseState): string {
    if ((state.revision_count ?? 0) >= (state.max_revisions ?? 3)) {
      return 'human_review';
    }

    const decision = state.decision ?? '';
    if (decision === 'APPROVED') {
      return 'finalize';
    } else if (decision === 'HUMAN_REVIEW') {
      return 'human_review';
    } else if (decision === 'REVISE' || decision === 'REWRITE') {
      return 'revise';
    } else {
      return 'continue';
    }
  }

  /**
   * Get default configuration (base-layer fallback;
   * specific domains should override).
   */
  getDefaultConfig(): BaseWorkflowConfig {
    return {
      pass_score: 80,
      human_review_score: 70,
      max_revisions: 3,
      auto_approve_timeout: 300,
      verbose: true,
      save_intermediate: true,
      domain: this.domain,
      domain_config: {},
    };
  }

  // ========================================
  // Utility methods
  // ========================================

  /** Merge custom config on top of defaults. */
  mergeConfig(customConfig?: Record<string, unknown> | null): BaseWorkflowConfig {
    const defaults = this.getDefaultConfig();
    if (customConfig) {
      Object.assign(defaults, customConfig);
    }
    return defaults;
  }
}

// ============================================================
// Adapter Registry
// ============================================================

type DomainAdapterConstructor = new (config?: BaseWorkflowConfig | null) => BaseDomainAdapter;

export class AdapterRegistry {
  private static _adapters: Record<string, DomainAdapterConstructor> = {};
  private static _adapterCapabilities: Record<string, Set<string>> = {};

  private static _normalizeCapabilities(capabilities: unknown): Set<string> {
    if (capabilities == null) return new Set();
    if (typeof capabilities === 'string') {
      const trimmed = capabilities.trim();
      return trimmed ? new Set([trimmed]) : new Set();
    }
    if (Array.isArray(capabilities)) {
      const result = new Set<string>();
      for (const value of capabilities as Iterable<unknown>) {
        const str = String(value).trim();
        if (str) result.add(str);
      }
      return result;
    }
    return new Set();
  }

  /**
   * Decorator-like: register an adapter class for a domain.
   * Usage: AdapterRegistry.registerAdapter('novel', NovelAdapter, ['writing'])
   */
  static registerAdapter(
    domain: string,
    adapterClass: DomainAdapterConstructor,
    capabilities?: unknown,
  ): void {
    AdapterRegistry._adapters[domain] = adapterClass;
    AdapterRegistry._adapterCapabilities[domain] = AdapterRegistry._normalizeCapabilities(capabilities);
  }

  /** Get the adapter class for a domain. */
  static get(domain: string): DomainAdapterConstructor | undefined {
    return AdapterRegistry._adapters[domain];
  }

  /** Get capability tags for a domain. */
  static getCapabilities(domain: string): string[] {
    const capabilities = AdapterRegistry._adapterCapabilities[domain] ?? new Set();
    return Array.from(capabilities).sort();
  }

  /** List all registered domains. */
  static listDomains(): string[] {
    return Object.keys(AdapterRegistry._adapters);
  }

  /** List domains that have a specific capability. */
  static listDomainsByCapability(capability: string): string[] {
    const needle = (capability ?? '').trim();
    if (!needle) return [];
    return AdapterRegistry.listDomains().filter(
      domain => AdapterRegistry._adapterCapabilities[domain]?.has(needle),
    );
  }

  /** Create an adapter instance for a domain. */
  static createAdapter(
    domain: string,
    config?: Record<string, unknown> | null,
  ): BaseDomainAdapter | null {
    const AdapterClass = AdapterRegistry.get(domain);
    if (AdapterClass) {
      return new AdapterClass(config as BaseWorkflowConfig);
    }
    return null;
  }
}
