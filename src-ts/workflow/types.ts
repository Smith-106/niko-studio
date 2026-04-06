// WorkflowLevel as const object (NOT enum, because Python has value aliases like L5_BRAINSTORM = 4)
export const WorkflowLevel = {
  L1_RAPID: 1,
  L2_LITE: 2,
  L3_STANDARD: 3,
  L4_BRAINSTORM: 4,
  L5_COORDINATOR: 5,
} as const;

export type WorkflowLevelValue = typeof WorkflowLevel[keyof typeof WorkflowLevel];

// WorkflowDecision enum
export enum WorkflowDecision {
  GO = 'go',
  SOFT_GO = 'soft_go',
  NO_GO = 'no_go',
}

// Constants
export const ANALYSIS_SCHEMA_VERSION = '2026-02';

/**
 * Bounded migration-era compatibility aliases retained for existing clients.
 * Keep this surface minimal and explicitly tested.
 */
export const LEGACY_CONTRACT_FIELD_MAP: Readonly<Record<string, string>> = Object.freeze({
  contract_version: 'analysis_schema_version',
  workflowLevel: 'workflow_level',
  level: 'workflow_level',
  decision_result: 'decision',
});

export const LEGACY_DECISION_MAP: Readonly<Record<string, string>> = Object.freeze({
  approved: WorkflowDecision.GO,
  pass: WorkflowDecision.GO,
  go: WorkflowDecision.GO,
  revise: WorkflowDecision.SOFT_GO,
  soft_go: WorkflowDecision.SOFT_GO,
  rewrite: WorkflowDecision.NO_GO,
  human_review: WorkflowDecision.NO_GO,
  no_go: WorkflowDecision.NO_GO,
});

export const CONTRACT_NULLABLE_DEFAULTS: Record<string, unknown> = {
  compatibility: {},
  diagnostics: {},
  legacy_contract_fields: {},
};

// LevelConfig interface
export interface LevelConfig {
  level: WorkflowLevelValue;
  requiredAgents: string[];
  optionalAgents: string[];
  maxRevisions: number;
  passScore: number;
  timeoutSeconds: number;
  persistState: boolean;
  persistArtifacts: boolean;
  checkpointEnabled: boolean;
  parallelExecution: boolean;
  maxParallelTasks: number;
  humanReviewThreshold: number;
  autoApprove: boolean;
  verbose: boolean;
  saveIntermediate: boolean;
}

// Pre-defined level configs (L1-L5)
export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  [WorkflowLevel.L1_RAPID]: {
    level: WorkflowLevel.L1_RAPID,
    requiredAgents: ['writer'],
    optionalAgents: [],
    maxRevisions: 0,
    passScore: 0,
    timeoutSeconds: 60,
    persistState: false,
    persistArtifacts: false,
    checkpointEnabled: false,
    parallelExecution: false,
    maxParallelTasks: 1,
    humanReviewThreshold: 0,
    autoApprove: true,
    verbose: false,
    saveIntermediate: false,
  },
  [WorkflowLevel.L2_LITE]: {
    level: WorkflowLevel.L2_LITE,
    requiredAgents: ['writer', 'critic'],
    optionalAgents: ['architect'],
    maxRevisions: 1,
    passScore: 70,
    timeoutSeconds: 120,
    persistState: true,
    persistArtifacts: false,
    checkpointEnabled: false,
    parallelExecution: false,
    maxParallelTasks: 1,
    humanReviewThreshold: 60,
    autoApprove: true,
    verbose: true,
    saveIntermediate: false,
  },
  [WorkflowLevel.L3_STANDARD]: {
    level: WorkflowLevel.L3_STANDARD,
    requiredAgents: ['architect', 'writer', 'critic'],
    optionalAgents: ['researcher'],
    maxRevisions: 3,
    passScore: 80,
    timeoutSeconds: 300,
    persistState: true,
    persistArtifacts: true,
    checkpointEnabled: true,
    parallelExecution: false,
    maxParallelTasks: 1,
    humanReviewThreshold: 70,
    autoApprove: false,
    verbose: true,
    saveIntermediate: true,
  },
  [WorkflowLevel.L4_BRAINSTORM]: {
    level: WorkflowLevel.L4_BRAINSTORM,
    requiredAgents: ['architect', 'writer', 'critic'],
    optionalAgents: ['researcher', 'devil_advocate', 'optimist', 'realist'],
    maxRevisions: 5,
    passScore: 85,
    timeoutSeconds: 600,
    persistState: true,
    persistArtifacts: true,
    checkpointEnabled: true,
    parallelExecution: true,
    maxParallelTasks: 4,
    humanReviewThreshold: 75,
    autoApprove: false,
    verbose: true,
    saveIntermediate: true,
  },
  [WorkflowLevel.L5_COORDINATOR]: {
    level: WorkflowLevel.L5_COORDINATOR,
    requiredAgents: ['coordinator', 'architect', 'writer', 'critic'],
    optionalAgents: ['researcher', 'devil_advocate', 'optimist', 'realist', 'specialist'],
    maxRevisions: 10,
    passScore: 90,
    timeoutSeconds: 1800,
    persistState: true,
    persistArtifacts: true,
    checkpointEnabled: true,
    parallelExecution: true,
    maxParallelTasks: 8,
    humanReviewThreshold: 80,
    autoApprove: false,
    verbose: true,
    saveIntermediate: true,
  },
};

// RoutingRule interface
export interface RoutingRule {
  name: string;
  description: string;
  targetLevel: WorkflowLevelValue;
  keywords: string[];
  minComplexity: number;
  maxComplexity: number;
  requiresPersistence: boolean;
  requiresCollaboration: boolean;
  priority: number;
}

// Helper: check if a routing rule matches a task context
export function routingRuleMatches(rule: RoutingRule, taskContext: Record<string, unknown>): boolean {
  const taskText = String(taskContext.text ?? '').toLowerCase();
  if (rule.keywords.length > 0) {
    if (!rule.keywords.some(kw => taskText.includes(kw.toLowerCase()))) {
      return false;
    }
  }
  const complexity = Number(taskContext.complexity ?? 50);
  if (!(rule.minComplexity <= complexity && complexity <= rule.maxComplexity)) {
    return false;
  }
  if (rule.requiresPersistence && !taskContext.persist) {
    return false;
  }
  if (rule.requiresCollaboration && !taskContext.collaborate) {
    return false;
  }
  return true;
}

// Pre-defined routing rules (L1-L5)
export const ROUTING_RULES: RoutingRule[] = [
  // L1 fast tasks
  { name: 'typo_fix', description: '错字修正', targetLevel: WorkflowLevel.L1_RAPID, keywords: ['错字', 'typo', '拼写', '修正', '纠错'], minComplexity: 0, maxComplexity: 20, requiresPersistence: false, requiresCollaboration: false, priority: 100 },
  { name: 'format_adjust', description: '格式调整', targetLevel: WorkflowLevel.L1_RAPID, keywords: ['格式', '排版', '缩进', '对齐'], minComplexity: 0, maxComplexity: 30, requiresPersistence: false, requiresCollaboration: false, priority: 90 },
  { name: 'quick_polish', description: '快速润色', targetLevel: WorkflowLevel.L1_RAPID, keywords: ['润色', 'polish', '简单修改'], minComplexity: 0, maxComplexity: 25, requiresPersistence: false, requiresCollaboration: false, priority: 85 },
  // L2 lite tasks
  { name: 'single_scene', description: '单场景写作', targetLevel: WorkflowLevel.L2_LITE, keywords: ['场景', '片段', '短文'], minComplexity: 20, maxComplexity: 50, requiresPersistence: false, requiresCollaboration: false, priority: 70 },
  { name: 'dialogue_write', description: '对话写作', targetLevel: WorkflowLevel.L2_LITE, keywords: ['对话', '对白', '台词'], minComplexity: 25, maxComplexity: 55, requiresPersistence: false, requiresCollaboration: false, priority: 65 },
  // L3 standard tasks
  { name: 'chapter_write', description: '章节写作', targetLevel: WorkflowLevel.L3_STANDARD, keywords: ['章节', 'chapter', '完整'], minComplexity: 40, maxComplexity: 75, requiresPersistence: true, requiresCollaboration: false, priority: 50 },
  { name: 'character_develop', description: '角色发展', targetLevel: WorkflowLevel.L3_STANDARD, keywords: ['角色', '人物', '塑造', '发展'], minComplexity: 45, maxComplexity: 80, requiresPersistence: false, requiresCollaboration: false, priority: 45 },
  // L4 brainstorm
  { name: 'plot_brainstorm', description: '剧情头脑风暴', targetLevel: WorkflowLevel.L4_BRAINSTORM, keywords: ['头脑风暴', 'brainstorm', '创意', '多角度'], minComplexity: 60, maxComplexity: 100, requiresPersistence: false, requiresCollaboration: true, priority: 40 },
  { name: 'conflict_design', description: '冲突设计', targetLevel: WorkflowLevel.L4_BRAINSTORM, keywords: ['冲突', '矛盾', '对立', '张力'], minComplexity: 55, maxComplexity: 100, requiresPersistence: false, requiresCollaboration: true, priority: 35 },
  // L5 coordinator
  { name: 'full_novel', description: '完整小说创作', targetLevel: WorkflowLevel.L5_COORDINATOR, keywords: ['小说', 'novel', '长篇', '完整'], minComplexity: 80, maxComplexity: 100, requiresPersistence: true, requiresCollaboration: true, priority: 20 },
  { name: 'complex_revision', description: '复杂修订', targetLevel: WorkflowLevel.L5_COORDINATOR, keywords: ['大修', '重构', '全面修改'], minComplexity: 75, maxComplexity: 100, requiresPersistence: true, requiresCollaboration: false, priority: 25 },
];

// LevelRouter class
export class LevelRouter {
  private rules: RoutingRule[];

  constructor(rules?: RoutingRule[]) {
    this.rules = rules ?? ROUTING_RULES;
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  route(taskContext: Record<string, unknown>): WorkflowLevelValue {
    for (const rule of this.rules) {
      if (routingRuleMatches(rule, taskContext)) {
        return rule.targetLevel;
      }
    }
    return WorkflowLevel.L3_STANDARD;
  }

  getConfig(level: WorkflowLevelValue): LevelConfig {
    return LEVEL_CONFIGS[level] ?? LEVEL_CONFIGS[WorkflowLevel.L3_STANDARD];
  }

  estimateComplexity(text: string): number {
    let complexity = 50;
    const textLen = text.length;
    if (textLen < 50) complexity -= 20;
    else if (textLen > 500) complexity += 20;
    else if (textLen > 200) complexity += 10;
    const complexKws = ['完整', '详细', '深入', '全面', '系统', '多角度'];
    for (const kw of complexKws) {
      if (text.includes(kw)) complexity += 5;
    }
    const simpleKws = ['简单', '快速', '直接', '仅', '只'];
    for (const kw of simpleKws) {
      if (text.includes(kw)) complexity -= 5;
    }
    return Math.max(0, Math.min(100, complexity));
  }
}

// Helper functions
export function workflowLevelFromLabel(label: string | number | null | undefined): WorkflowLevelValue {
  if (label == null) return WorkflowLevel.L3_STANDARD;
  const normalized = String(label).trim().toLowerCase();
  const mapping: Record<string, WorkflowLevelValue> = {
    rapid: WorkflowLevel.L1_RAPID,
    lite: WorkflowLevel.L2_LITE,
    standard: WorkflowLevel.L3_STANDARD,
    brainstorm: WorkflowLevel.L4_BRAINSTORM,
    storm: WorkflowLevel.L4_BRAINSTORM,
    coordinator: WorkflowLevel.L5_COORDINATOR,
    l1: WorkflowLevel.L1_RAPID,
    l2: WorkflowLevel.L2_LITE,
    l3: WorkflowLevel.L3_STANDARD,
    l4: WorkflowLevel.L4_BRAINSTORM,
    l5: WorkflowLevel.L5_COORDINATOR,
  };
  if (!normalized) return WorkflowLevel.L3_STANDARD;
  if (normalized.startsWith('l') && /^\d+$/.test(normalized.slice(1))) {
    const v = parseInt(normalized.slice(1), 10);
    if (v >= 1 && v <= 5) return v as WorkflowLevelValue;
  }
  return mapping[normalized] ?? WorkflowLevel.L3_STANDARD;
}

export function isValidWorkflowLevel(label: unknown): boolean {
  if (label == null) return false;
  if (typeof label === 'number') return label >= 1 && label <= 5;
  if (typeof label === 'boolean') return false;
  if (typeof label !== 'string') return false;
  const n = label.trim().toLowerCase();
  if (!n) return false;
  if (n.startsWith('l') && /^\d+$/.test(n.slice(1))) {
    const v = parseInt(n.slice(1), 10);
    return v >= 1 && v <= 5;
  }
  return ['rapid', 'lite', 'standard', 'brainstorm', 'coordinator'].includes(n);
}

export function getLevelConfig(level: WorkflowLevelValue | string | number): LevelConfig {
  const resolved = typeof level === 'number' ? level : workflowLevelFromLabel(level);
  return LEVEL_CONFIGS[resolved] ?? LEVEL_CONFIGS[WorkflowLevel.L3_STANDARD];
}

export function routeTask(taskText: string, extra?: Record<string, unknown>): WorkflowLevelValue {
  const router = new LevelRouter();
  const complexity = router.estimateComplexity(taskText);
  return router.route({ text: taskText, complexity, ...extra });
}

export function toWorkflowLabel(level: WorkflowLevelValue | string | number): string {
  const v = typeof level === 'number' ? level : workflowLevelFromLabel(level);
  return `L${v}`;
}

export function toWorkflowSlug(level: WorkflowLevelValue | string | number): string {
  const v = typeof level === 'number' ? level : workflowLevelFromLabel(level);
  const slugs: Record<number, string> = { 1: 'rapid', 2: 'lite', 3: 'standard', 4: 'brainstorm', 5: 'coordinator' };
  return slugs[v] ?? 'standard';
}

export function workflowLevelNameZh(level: WorkflowLevelValue): string {
  const names: Record<number, string> = { 1: '快速模式', 2: '轻量模式', 3: '标准模式', 4: '头脑风暴', 5: '协调者模式' };
  return names[level] ?? '未知';
}

export function workflowLevelDescription(level: WorkflowLevelValue): string {
  const descs: Record<number, string> = { 1: '无状态、无工件、直接输出', 2: '内存计划、轻量持久化', 3: '完整会话、验证步骤', 4: '多角色并行分析', 5: '智能链推荐、状态持久化' };
  return descs[level] ?? '';
}

// Contract helpers
export function buildLegacyContractFields(payload: Record<string, unknown>): Record<string, unknown> {
  const legacyFields: Record<string, unknown> = {};
  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_CONTRACT_FIELD_MAP)) {
    let value = payload[canonicalKey];
    if (value === undefined) value = payload[legacyKey];
    legacyFields[legacyKey] = value;
  }
  return legacyFields;
}

function normalizeDecisionValue(payload: Record<string, unknown>): string {
  let raw = payload.decision ?? payload.decision_result;
  const normalized = String(raw ?? WorkflowDecision.GO).trim().toLowerCase();
  return LEGACY_DECISION_MAP[normalized] ?? WorkflowDecision.GO;
}

export function applyContractDefaults(payload: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...payload };
  normalized.decision = normalizeDecisionValue(normalized);
  if (!normalized.analysis_schema_version) {
    normalized.analysis_schema_version = ANALYSIS_SCHEMA_VERSION;
  }
  let compatibility = normalized.compatibility;
  if (typeof compatibility !== 'object' || compatibility == null) compatibility = {};
  const compat = compatibility as Record<string, unknown>;
  compat.policy ??= 'incremental_fields';
  compat.soft_gate ??= true;
  compat.legacy_field_map ??= { ...LEGACY_CONTRACT_FIELD_MAP };
  normalized.compatibility = compat;

  let diagnostics = normalized.diagnostics;
  if (typeof diagnostics !== 'object' || diagnostics == null) diagnostics = {};
  (diagnostics as Record<string, unknown>).schema_version ??= normalized.analysis_schema_version;
  normalized.diagnostics = diagnostics;

  for (const [key, def] of Object.entries(CONTRACT_NULLABLE_DEFAULTS)) {
    if (normalized[key] == null) {
      normalized[key] = typeof def === 'object' && def !== null ? { ...def } : def;
    }
  }
  normalized.legacy_contract_fields = buildLegacyContractFields(normalized);
  for (const [lk, lv] of Object.entries(normalized.legacy_contract_fields as Record<string, unknown>)) {
    if (lv !== undefined) {
      normalized[lk] ??= lv;
    }
  }
  return normalized;
}

export function ensureContractPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return applyContractDefaults(payload);
}

// Alias for compatibility
export type WorkflowConfig = LevelConfig;
