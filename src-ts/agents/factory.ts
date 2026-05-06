/**
 * AgentFactory - Dependency Injection Factory for Agent Instantiation
 *
 * Provides centralized agent creation with lazy initialization and caching.
 * Enables decoupling of agent instantiation from workflow levels.
 */

import type { IAgentLLMService } from './base';
import { AgentType } from './base';
import type { AgentLifecycleHook } from './lifecycle-hooks';
import { LifecycleStage } from './lifecycle-hooks';
import { CommanderAgent } from './commander';
import { ArchitectAgent } from './architect';
import { WriterAgent } from './writer';
import { CriticAgent } from './critic';
import { PlotAgent } from './plot';

export class AgentFactory {
  private instances: Map<AgentType, unknown> = new Map();
  private mocks: Map<AgentType, unknown> = new Map();
  private defaultLlmService?: IAgentLLMService;

  constructor(defaultLlmService?: IAgentLLMService) {
    this.defaultLlmService = defaultLlmService;
  }

  /** Register a mock instance for testing */
  registerMock(agentType: AgentType, mock: unknown): void {
    this.mocks.set(agentType, mock);
  }

  /** Get or create agent instance with lazy initialization */
  getAgent(
    agentType: AgentType,
    options?: {
      name?: string;
      config?: Record<string, unknown>;
      llmService?: IAgentLLMService;
      lifecycleHooks?: Array<{ stage: LifecycleStage; handler: AgentLifecycleHook }>;
    },
  ): unknown {
    // Check for mock first
    const mock = this.mocks.get(agentType);
    if (mock !== undefined) return mock;

    // Return cached instance if available
    const cached = this.instances.get(agentType);
    if (cached !== undefined) return cached;

    // Create new instance
    const agent = this.createAgent(agentType, options);
    this.instances.set(agentType, agent);

    // Register lifecycle hooks if provided
    if (options?.lifecycleHooks) {
      const { BaseAgent } = require('./base');
      if (agent instanceof BaseAgent) {
        for (const { stage, handler } of options.lifecycleHooks) {
          (agent as InstanceType<typeof BaseAgent>).addHook(stage, handler);
        }
      }
    }

    return agent;
  }

  private createAgent(
    agentType: AgentType,
    options?: {
      name?: string;
      config?: Record<string, unknown>;
      llmService?: IAgentLLMService;
    },
  ): unknown {
    const llmService = options?.llmService ?? this.defaultLlmService ?? null;

    switch (agentType) {
      case AgentType.COMMANDER: {
        return new CommanderAgent(llmService);
      }
      case AgentType.ARCHITECT: {
        return new ArchitectAgent(llmService);
      }
      case AgentType.WRITER: {
        return new WriterAgent({ llmService: llmService as IAgentLLMService });
      }
      case AgentType.CRITIC: {
        return new CriticAgent({ llmService: llmService as IAgentLLMService });
      }
      case AgentType.PLOT: {
        return new PlotAgent();
      }
      default:
        throw new Error(`Unsupported agent type: ${agentType}`);
    }
  }

  /** Clear all cached instances (for testing) */
  reset(): void {
    this.instances.clear();
    this.mocks.clear();
  }

  /** Get list of currently cached agent types */
  getCachedTypes(): AgentType[] {
    return Array.from(this.instances.keys());
  }
}
