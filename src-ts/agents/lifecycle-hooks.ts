/**
 * Agent Lifecycle Hooks
 *
 * Opt-in middleware for BaseAgent enabling structured reasoning via
 * perception → planning → execution → reflection pipeline.
 * Inspired by OpenStory's Agent-Kernel lifecycle plugin architecture.
 */

export enum LifecycleStage {
  PERCEPTION = 'perception',
  PLANNING = 'planning',
  EXECUTION = 'execution',
  REFLECTION = 'reflection',
}

export interface AgentContext {
  [key: string]: unknown;
}

export type AgentLifecycleHook = (
  context: AgentContext,
) => Promise<AgentContext>;

export class LifecycleHookRegistry {
  private hooks = new Map<LifecycleStage, AgentLifecycleHook[]>();

  register(stage: LifecycleStage, hook: AgentLifecycleHook): void {
    const existing = this.hooks.get(stage) ?? [];
    existing.push(hook);
    this.hooks.set(stage, existing);
  }

  async execute(
    stage: LifecycleStage,
    context: AgentContext,
  ): Promise<AgentContext> {
    const stageHooks = this.hooks.get(stage);
    if (!stageHooks || stageHooks.length === 0) return context;

    let current = context;
    for (const hook of stageHooks) {
      current = await hook(current);
    }
    return current;
  }

  getHooks(stage: LifecycleStage): AgentLifecycleHook[] {
    return this.hooks.get(stage) ?? [];
  }

  clear(stage?: LifecycleStage): void {
    if (stage) {
      this.hooks.delete(stage);
    } else {
      this.hooks.clear();
    }
  }
}
