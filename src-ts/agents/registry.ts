import { AgentType } from './base';
import type { AgentConstructor } from './factory';

export class AgentRegistry {
  private readonly constructors = new Map<AgentType, AgentConstructor>();

  register(type: AgentType, ctor: AgentConstructor): void {
    this.constructors.set(type, ctor);
  }

  resolve(type: AgentType): AgentConstructor | undefined {
    return this.constructors.get(type);
  }

  has(type: AgentType): boolean {
    return this.constructors.has(type);
  }

  types(): AgentType[] {
    return [...this.constructors.keys()];
  }

  /** Convert registry entries to a plain Map for AgentFactoryAdapter consumption */
  toMap(): Map<AgentType, AgentConstructor> {
    return new Map(this.constructors);
  }
}
