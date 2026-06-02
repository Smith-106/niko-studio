/**
 * Model Router — selects LLM by task type for the Co-Writing Engine
 *
 * Routes to appropriate model based on co-writing mode:
 * - auto mode → default creative model
 * - guided mode → analytical + creative model (generates options)
 * - directed mode → instruction-following model
 *
 * Context size check: if context exceeds model's maxTokens, route to fallback
 * with truncation warning.
 *
 * @module cowriting/ModelRouter
 */

import { createLogger } from '../logger';

const _log = createLogger('model-router');

// ============================================================
// Model Configuration Types
// ============================================================

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'claude' | 'openai' | 'local';
  maxTokens: number;
  supportsStreaming: boolean;
}

export interface ModelRouterConfig {
  defaultModel: ModelConfig;
  guidedModel: ModelConfig;
  directedModel: ModelConfig;
  fallbackModel: ModelConfig;
}

export interface RoutingDecision {
  model: ModelConfig;
  reason: string;
  estimatedLatency: 'low' | 'medium' | 'high';
}

// ============================================================
// Default Configuration
// ============================================================

const DEFAULT_CLAUDE_MODEL: ModelConfig = {
  id: 'claude-sonnet-4-6',
  name: 'Claude Sonnet 4.6',
  provider: 'claude',
  maxTokens: 200000,
  supportsStreaming: true,
};

const DEFAULT_CONFIG: ModelRouterConfig = {
  defaultModel: DEFAULT_CLAUDE_MODEL,
  guidedModel: DEFAULT_CLAUDE_MODEL,
  directedModel: DEFAULT_CLAUDE_MODEL,
  fallbackModel: DEFAULT_CLAUDE_MODEL,
};

// ============================================================
// ModelRouter Class
// ============================================================

export class ModelRouter {
  private readonly config: ModelRouterConfig;

  constructor(config?: Partial<ModelRouterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    _log.info('ModelRouter initialized', {
      defaultModel: this.config.defaultModel.id,
      guidedModel: this.config.guidedModel.id,
      directedModel: this.config.directedModel.id,
      fallbackModel: this.config.fallbackModel.id,
    });
  }

  /**
   * Route to appropriate model based on co-writing mode and context size.
   *
   * @param mode - Co-writing mode: 'auto' | 'guided' | 'directed'
   * @param contextSize - Estimated context size in tokens
   * @returns RoutingDecision with selected model, reason, and latency estimate
   */
  route(mode: string, contextSize: number): RoutingDecision {
    _log.debug('Routing request', { mode, contextSize });

    // Step 1: Select base model by mode
    let selectedModel: ModelConfig;
    let reason: string;

    switch (mode) {
      case 'auto':
        selectedModel = this.config.defaultModel;
        reason = `Auto mode: using default creative model (${selectedModel.name})`;
        break;

      case 'guided':
        selectedModel = this.config.guidedModel;
        reason = `Guided mode: using analytical + creative model (${selectedModel.name}) for option generation`;
        break;

      case 'directed':
        selectedModel = this.config.directedModel;
        reason = `Directed mode: using instruction-following model (${selectedModel.name})`;
        break;

      default:
        _log.warn('Unknown mode, falling back to default model', { mode });
        selectedModel = this.config.defaultModel;
        reason = `Unknown mode '${mode}': using default model (${selectedModel.name})`;
    }

    // Step 2: Check context size against model's maxTokens
    if (contextSize > selectedModel.maxTokens) {
      _log.warn('Context exceeds model maxTokens, routing to fallback', {
        contextSize,
        modelMaxTokens: selectedModel.maxTokens,
        fallbackModel: this.config.fallbackModel.name,
      });

      selectedModel = this.config.fallbackModel;
      reason = `Context size (${contextSize} tokens) exceeds ${selectedModel.name} max tokens (${selectedModel.maxTokens}), routing to fallback with truncation warning`;
    }

    // Step 3: Estimate latency based on provider and context size
    const estimatedLatency = this.estimateLatency(selectedModel, contextSize);

    const decision: RoutingDecision = {
      model: selectedModel,
      reason,
      estimatedLatency,
    };

    _log.info('Routing decision', {
      model: selectedModel.id,
      reason,
      estimatedLatency,
      contextSize,
    });

    return decision;
  }

  /**
   * Estimate latency based on provider and context size.
   *
   * Latency factors:
   * - Local models: low latency (no network)
   * - Cloud models: medium latency for small context, high for large context
   *
   * @param model - Selected model configuration
   * @param contextSize - Estimated context size in tokens
   * @returns Latency estimate: 'low' | 'medium' | 'high'
   */
  private estimateLatency(
    model: ModelConfig,
    contextSize: number,
  ): 'low' | 'medium' | 'high' {
    // Local models have low latency regardless of context size
    if (model.provider === 'local') {
      return 'low';
    }

    // Cloud models: latency scales with context size
    const largeContextThreshold = 50000; // 50k tokens
    const mediumContextThreshold = 10000; // 10k tokens

    if (contextSize > largeContextThreshold) {
      return 'high';
    } else if (contextSize > mediumContextThreshold) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get current configuration.
   */
  getConfig(): ModelRouterConfig {
    return { ...this.config };
  }
}

// ============================================================
// Factory
// ============================================================

export function createModelRouter(config?: Partial<ModelRouterConfig>): ModelRouter {
  return new ModelRouter(config);
}
