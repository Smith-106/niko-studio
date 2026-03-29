/**
 * AgentFactory - Dependency Injection Factory for Agent Instantiation
 *
 * Provides centralized agent creation with lazy initialization and caching.
 * Enables decoupling of agent instantiation from workflow levels.
 */

import type { IAgentLLMService } from './base';
import { AgentType } from './base';

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
        const { CommanderAgent } = require('./commander');
        return new CommanderAgent(llmService);
      }
      case AgentType.ARCHITECT: {
        const { ArchitectAgent } = require('./architect');
        return new ArchitectAgent(llmService);
      }
      case AgentType.WRITER: {
        const { WriterAgent } = require('./writer');
        return new WriterAgent(llmService);
      }
      case AgentType.CRITIC: {
        const { CriticAgent } = require('./critic');
        return new CriticAgent(llmService);
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
