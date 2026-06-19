/**
 * Graph Factory - Unified creation of configured workflow graphs
 *
 * Migrated from src/workflow/graph_factory.py
 */

import { workflowLevelFromLabel, type WorkflowLevelValue } from './types';
import { AdapterRegistry, type BaseDomainAdapter } from './adapters/base-adapter';
import { determineResumeStrategy, type ResumeDecision } from './session/resume-strategy';

// ============================================================
// Helper functions
// ============================================================

function buildResumeDecision(
  config: Record<string, unknown> | null,
  tool: string,
  resumeIds?: string[],
  customId?: string | null,
): ResumeDecision | null {
  if (!config || !resumeIds) return null;

  return determineResumeStrategy(
    tool,
    resumeIds,
    customId ?? undefined,
  );
}

function mergeResumeMetadata(
  metadata: Record<string, unknown>,
  resumeDecision: ResumeDecision | null,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...metadata };
  if (resumeDecision) {
    if (!merged['resume_decision']) {
      merged['resume_decision'] = resumeDecision;
    }
  }
  return merged;
}

// ============================================================
// WorkflowFactory
// ============================================================

export class WorkflowFactory {
  static create(
    domain: string,
    level: WorkflowLevelValue | string | number = 3,
    config?: Record<string, unknown> | null,
  ): unknown {
    let workflowLevel: WorkflowLevelValue;
    if (typeof level === 'string' || typeof level === 'number') {
      workflowLevel = workflowLevelFromLabel(level);
    } else {
      workflowLevel = level;
    }

    const adapter = AdapterRegistry.createAdapter(domain, config ?? null);
    if (!adapter) {
      const available = AdapterRegistry.listDomains();
      throw new Error(
        `Unknown domain: '${domain}'. Available domains: ${available.join(', ')}`,
      );
    }

    const mergedConfig = adapter.mergeConfig(config ?? null) as Record<string, unknown>;
    mergedConfig['workflow_level'] = typeof workflowLevel === 'number' ? workflowLevel : 3;

    const configuredAdapter = AdapterRegistry.createAdapter(domain, mergedConfig);
    return (configuredAdapter ?? adapter).createGraph();
  }

  static createAdapter(
    domain: string,
    config?: Record<string, unknown> | null,
  ): BaseDomainAdapter | null {
    return AdapterRegistry.createAdapter(domain, config ?? null);
  }

  static listDomains(): string[] {
    return AdapterRegistry.listDomains();
  }

  static registerAdapter(
    domain: string,
    adapterClass: new (...args: unknown[]) => BaseDomainAdapter,
    capabilities?: string[] | null,
  ): void {
    AdapterRegistry.registerAdapter(domain, adapterClass, capabilities ?? undefined);
  }

  static listDomainsByCapability(capability: string): string[] {
    return AdapterRegistry.listDomainsByCapability(capability);
  }

  static getAdapterCapabilities(domain: string): string[] {
    return AdapterRegistry.getCapabilities(domain);
  }

  static getLevelDescription(level: number): Record<string, string> {
    const descriptions: Record<number, Record<string, string>> = {
      1: {
        name: 'Rapid',
        description: '快速模式 - 无状态、无工件、直接输出',
        novel_use: '错字修正、格式调整、快速润色',
        code_use: 'typo 修复、格式化、简单重命名',
      },
      2: {
        name: 'Lightweight',
        description: '轻量模式 - 内存计划、轻量持久化',
        novel_use: '单章节写作、情节调整',
        code_use: '单文件修改、简单功能添加',
      },
      3: {
        name: 'Standard',
        description: '标准模式 - 完整会话、验证步骤',
        novel_use: '多章节开发、角色塑造',
        code_use: '功能开发 + 测试、代码审查',
      },
      4: {
        name: 'Brainstorm',
        description: '头脑风暴 - 多角色并行分析',
        novel_use: '世界观设计、剧情构思',
        code_use: '架构设计、技术选型',
      },
      5: {
        name: 'Coordinator',
        description: '智能编排 - 自动规划命令链',
        novel_use: '完整小说创作、长期项目',
        code_use: '完整项目开发、多模块协调',
      },
    };
    return descriptions[level] ?? {};
  }
}

// ============================================================
// Convenience function
// ============================================================

export function createWorkflow(
  domain: string,
  userRequest: string,
  level: number = 3,
  config?: Record<string, unknown> | null,
): { graph: unknown; initialState: Record<string, unknown> } {
  const cfg: Record<string, unknown> = { ...(config ?? {}) };
  if (!('workflow_level' in cfg)) {
    cfg['workflow_level'] = level;
  }

  const adapter = WorkflowFactory.createAdapter(domain, cfg);
  if (!adapter) {
    throw new Error(`Unknown domain: ${domain}`);
  }

  const graph = adapter.createGraph();

  const resumeDecision = buildResumeDecision(
    cfg,
    (cfg['tool'] as string) ?? 'gemini',
    cfg['resume_ids'] as string[] | undefined,
    (cfg['custom_id'] as string) ?? null,
  );

  const baseMetadata =
    typeof cfg['metadata'] === 'object' && cfg['metadata'] !== null
      ? (cfg['metadata'] as Record<string, unknown>)
      : {};
  const metadata = mergeResumeMetadata(baseMetadata, resumeDecision);

  const initialState = adapter.createInitialState(userRequest, {
    metadata,
    resume_decision: resumeDecision,
  });

  return { graph, initialState: initialState as unknown as Record<string, unknown> };
}
