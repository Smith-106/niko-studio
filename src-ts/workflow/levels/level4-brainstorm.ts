/**
 * level4-brainstorm.ts - L4 Brainstorm mode
 *
 * Multi-role parallel analysis, guidance-specification generation, synthesis.
 * Suitable for: plot planning, conflict design, creative divergence, multi-angle analysis.
 *
 * Command chain:
 * brainstorm -> synthesize -> specification -> verify
 *
 * Migrated from src/workflow/levels/level4_brainstorm.py
 */

import type { BaseState } from '../state.js';
import { AgentType } from '../../agents/base.js';
import type { IServiceContainer } from './level1-rapid.js';

// ============================================================
// BrainstormRole enum
// ============================================================

export enum BrainstormRole {
  // Core roles
  PRODUCT_MANAGER = 'product_manager',
  SYSTEM_ARCHITECT = 'system_architect',
  UX_EXPERT = 'ux_expert',
  DATA_ARCHITECT = 'data_architect',
  // Creative roles
  CREATIVE_DIRECTOR = 'creative_director',
  STORYTELLER = 'storyteller',
  WORLD_BUILDER = 'world_builder',
  // Critical roles
  DEVIL_ADVOCATE = 'devil_advocate',
  RISK_ANALYST = 'risk_analyst',
  // Balance roles
  OPTIMIST = 'optimist',
  REALIST = 'realist',
  PRAGMATIST = 'pragmatist',
  // Specialist roles
  DOMAIN_EXPERT = 'domain_expert',
  TECHNICAL_WRITER = 'technical_writer',
}

const ROLE_DISPLAY_NAMES: Record<BrainstormRole, string> = {
  [BrainstormRole.PRODUCT_MANAGER]: '产品经理',
  [BrainstormRole.SYSTEM_ARCHITECT]: '系统架构师',
  [BrainstormRole.UX_EXPERT]: '用户体验专家',
  [BrainstormRole.DATA_ARCHITECT]: '数据架构师',
  [BrainstormRole.CREATIVE_DIRECTOR]: '创意总监',
  [BrainstormRole.STORYTELLER]: '故事讲述者',
  [BrainstormRole.WORLD_BUILDER]: '世界构建者',
  [BrainstormRole.DEVIL_ADVOCATE]: '魔鬼代言人',
  [BrainstormRole.RISK_ANALYST]: '风险分析师',
  [BrainstormRole.OPTIMIST]: '乐观主义者',
  [BrainstormRole.REALIST]: '现实主义者',
  [BrainstormRole.PRAGMATIST]: '实用主义者',
  [BrainstormRole.DOMAIN_EXPERT]: '领域专家',
  [BrainstormRole.TECHNICAL_WRITER]: '技术写作者',
};

const ROLE_PERSPECTIVES: Record<BrainstormRole, string> = {
  [BrainstormRole.PRODUCT_MANAGER]: '从产品价值、用户需求、市场定位角度分析',
  [BrainstormRole.SYSTEM_ARCHITECT]: '从系统设计、技术架构、可扩展性角度分析',
  [BrainstormRole.UX_EXPERT]: '从用户体验、交互设计、可用性角度分析',
  [BrainstormRole.DATA_ARCHITECT]: '从数据结构、信息流、存储策略角度分析',
  [BrainstormRole.CREATIVE_DIRECTOR]: '从创意表达、艺术风格、情感共鸣角度分析',
  [BrainstormRole.STORYTELLER]: '从叙事结构、角色发展、情节张力角度分析',
  [BrainstormRole.WORLD_BUILDER]: '从世界观、设定一致性、背景深度角度分析',
  [BrainstormRole.DEVIL_ADVOCATE]: '从反面论证、潜在问题、挑战假设角度分析',
  [BrainstormRole.RISK_ANALYST]: '从风险识别、影响评估、缓解策略角度分析',
  [BrainstormRole.OPTIMIST]: '从积极可能性、机会发掘、正面影响角度分析',
  [BrainstormRole.REALIST]: '从实际约束、可行性、资源限制角度分析',
  [BrainstormRole.PRAGMATIST]: '从实用性、效率、投入产出比角度分析',
  [BrainstormRole.DOMAIN_EXPERT]: '从专业领域知识、行业最佳实践角度分析',
  [BrainstormRole.TECHNICAL_WRITER]: '从文档清晰度、表达准确性、可读性角度分析',
};

export function getRoleDisplayName(role: BrainstormRole): string {
  return ROLE_DISPLAY_NAMES[role] ?? role;
}

export function getRolePerspective(role: BrainstormRole): string {
  return ROLE_PERSPECTIVES[role] ?? '从专业角度分析';
}

export function getDefaultRoles(): BrainstormRole[] {
  return [
    BrainstormRole.PRODUCT_MANAGER,
    BrainstormRole.SYSTEM_ARCHITECT,
    BrainstormRole.CREATIVE_DIRECTOR,
    BrainstormRole.DEVIL_ADVOCATE,
    BrainstormRole.REALIST,
  ];
}

export function getCreativeRoles(): BrainstormRole[] {
  return [
    BrainstormRole.CREATIVE_DIRECTOR,
    BrainstormRole.STORYTELLER,
    BrainstormRole.WORLD_BUILDER,
    BrainstormRole.OPTIMIST,
    BrainstormRole.DEVIL_ADVOCATE,
  ];
}

export function getTechnicalRoles(): BrainstormRole[] {
  return [
    BrainstormRole.SYSTEM_ARCHITECT,
    BrainstormRole.DATA_ARCHITECT,
    BrainstormRole.RISK_ANALYST,
    BrainstormRole.REALIST,
    BrainstormRole.PRAGMATIST,
  ];
}

// ============================================================
// Data types
// ============================================================

export interface RoleAnalysis {
  role: BrainstormRole;
  analysisContent: string;
  keyPoints: string[];
  recommendations: string[];
  concerns: string[];
  score: number;
  metadata: Record<string, unknown>;
}

export function roleAnalysisToDict(a: RoleAnalysis): Record<string, unknown> {
  return {
    role: a.role,
    role_name: getRoleDisplayName(a.role),
    analysis_content: a.analysisContent,
    key_points: a.keyPoints,
    recommendations: a.recommendations,
    concerns: a.concerns,
    score: a.score,
    metadata: a.metadata,
  };
}

export interface BrainstormSynthesis {
  summary: string;
  consensusPoints: string[];
  divergentPoints: string[];
  prioritizedRecommendations: string[];
  riskAssessment: string;
  nextSteps: string[];
  confidenceScore: number;
}

export function brainstormSynthesisToDict(s: BrainstormSynthesis): Record<string, unknown> {
  return {
    summary: s.summary,
    consensus_points: s.consensusPoints,
    divergent_points: s.divergentPoints,
    prioritized_recommendations: s.prioritizedRecommendations,
    risk_assessment: s.riskAssessment,
    next_steps: s.nextSteps,
    confidence_score: s.confidenceScore,
  };
}

export interface GuidanceSpecification {
  title: string;
  objective: string;
  scope: string;
  guidelines: string[];
  constraints: string[];
  successCriteria: string[];
  qualityStandards: string[];
  deliverables: string[];
}

export function guidanceSpecToDict(spec: GuidanceSpecification): Record<string, unknown> {
  return {
    title: spec.title,
    objective: spec.objective,
    scope: spec.scope,
    guidelines: spec.guidelines,
    constraints: spec.constraints,
    success_criteria: spec.successCriteria,
    quality_standards: spec.qualityStandards,
    deliverables: spec.deliverables,
  };
}

export function guidanceSpecToMarkdown(spec: GuidanceSpecification): string {
  let md = `# ${spec.title}\n\n`;
  md += `## 目标\n${spec.objective}\n\n`;
  md += `## 范围\n${spec.scope}\n\n`;

  if (spec.guidelines.length > 0) {
    md += '## 指导原则\n';
    for (const g of spec.guidelines) md += `- ${g}\n`;
    md += '\n';
  }

  if (spec.constraints.length > 0) {
    md += '## 约束条件\n';
    for (const c of spec.constraints) md += `- ${c}\n`;
    md += '\n';
  }

  if (spec.successCriteria.length > 0) {
    md += '## 成功标准\n';
    for (const s of spec.successCriteria) md += `- ${s}\n`;
    md += '\n';
  }

  if (spec.qualityStandards.length > 0) {
    md += '## 质量标准\n';
    for (const q of spec.qualityStandards) md += `- ${q}\n`;
    md += '\n';
  }

  if (spec.deliverables.length > 0) {
    md += '## 交付物\n';
    for (const d of spec.deliverables) md += `- ${d}\n`;
    md += '\n';
  }

  return md;
}

// ============================================================
// Level4Brainstorm
// ============================================================

const DEFAULT_MAX_PARALLEL = 4;
const DEFAULT_ROLES = getDefaultRoles();

export class Level4Brainstorm {
  readonly level = 4;
  readonly name = 'brainstorm';
  readonly description = '头脑风暴模式 - 多角色并行分析';

  protected config: Record<string, unknown>;
  protected _container: IServiceContainer | null;
  private maxParallel: number;

  constructor(
    config?: Record<string, unknown> | null,
    container?: IServiceContainer | null,
  ) {
    this.config = config ?? {};
    this._container = container ?? null;
    this.maxParallel = (this.config.max_parallel as number) ?? DEFAULT_MAX_PARALLEL;
  }

  protected get container(): IServiceContainer {
    if (this._container == null) {
      throw new Error('ServiceContainer not available.');
    }
    return this._container;
  }

  /**
   * Execute brainstorm workflow
   *
   * Flow:
   * 1. Prepare: parse topic and roles
   * 2. Parallel analysis: multi-role simultaneous analysis
   * 3. Synthesis: integrate all role perspectives
   * 4. Specification: generate guidance-specification
   * 5. Verify: verify specification completeness
   */
  async execute(state: BaseState, kwargs?: Record<string, unknown>): Promise<BaseState> {
    const config = { ...this.getDefaultConfig(), ...this.config };

    // Resolve roles
    let roles: BrainstormRole[] =
      (kwargs?.roles as BrainstormRole[]) ??
      (this.config.roles as BrainstormRole[]) ??
      DEFAULT_ROLES;

    if (roles.length > 0 && typeof roles[0] === 'string') {
      roles = (roles as string[]).map(r => r as BrainstormRole);
    }

    const topic = state.user_request ?? '';
    const context = state.context ?? '';

    try {
      // Phase 1: parallel role analysis (async, with per-role timeout)
      state.current_step = 'brainstorm';
      const analyses = await this.generateArtifactsAsync(topic, roles, context);
      (state as Record<string, unknown>).role_analyses = analyses.map(roleAnalysisToDict);

      // Phase 2: synthesis
      state.current_step = 'synthesize';
      const synthesis = this.synthesize(analyses);
      (state as Record<string, unknown>).synthesis = brainstormSynthesisToDict(synthesis);

      // Phase 3: generate specification
      state.current_step = 'specification';
      const specification = this.generateSpecification(synthesis, topic);
      (state as Record<string, unknown>).specification = guidanceSpecToDict(specification);
      (state as Record<string, unknown>).specification_markdown = guidanceSpecToMarkdown(specification);

      // Phase 4: verify
      state.current_step = 'verify';
      const verification = this._verifySpecification(specification);
      (state as Record<string, unknown>).verification = verification;

      // Set final output
      state.final_output = guidanceSpecToMarkdown(specification);
      state.decision = verification.valid ? 'APPROVED' : 'HUMAN_REVIEW';
      state.score = (verification.score as number) ?? 85;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`Brainstorm execution failed: ${errorMsg}`);
      state.errors = [...(state.errors ?? []), `头脑风暴执行失败: ${errorMsg}`];
      state.decision = 'FAILED';
    }

    return state;
  }

  getRequiredAgents(): string[] {
    return ['architect', 'writer', 'critic'];
  }

  getDefaultConfig(): Record<string, unknown> {
    return {
      max_revisions: 5,
      pass_score: 85,
      verbose: true,
      max_parallel: this.maxParallel,
      timeout_per_role: 60,
      retrieval_profile: 'brainstorm_quality',
    };
  }

  // ========================================
  // Core methods
  // ========================================

  /**
   * Generate role analysis artifacts
   *
   * Calls multiple roles for analysis sequentially (in TS we use Promise.all
   * in the async variant). This sync version runs them in sequence.
   */
  generateArtifacts(
    topic: string,
    roles: BrainstormRole[],
    context: string = '',
  ): RoleAnalysis[] {
    const analyses: RoleAnalysis[] = [];
    const timeoutPerRole = (this.config.timeout_per_role as number) ?? 60;

    for (const role of roles) {
      try {
        const analysis = this._analyzeAsRole(role, topic, context);
        analyses.push(analysis);
        console.log(`Role ${getRoleDisplayName(role)} analysis completed`);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.warn(`Role ${getRoleDisplayName(role)} analysis failed: ${errorMsg}`);
        analyses.push({
          role,
          analysisContent: `分析失败: ${errorMsg}`,
          keyPoints: [],
          recommendations: [],
          concerns: [],
          score: 0.0,
          metadata: {},
        });
      }
    }

    return analyses;
  }

  /**
   * Async variant: generate role analysis artifacts in parallel.
   *
   * Each role analysis is raced against a per-role timeout
   * (`config.timeout_per_role` seconds, default 60). On timeout the role's
   * promise rejects and Promise.allSettled records the failure, producing
   * a placeholder analysis identical to the synchronous catch path.
   */
  async generateArtifactsAsync(
    topic: string,
    roles: BrainstormRole[],
    context: string = '',
  ): Promise<RoleAnalysis[]> {
    const timeoutMs = ((this.config.timeout_per_role as number) ?? 60) * 1000;

    const tasks = roles.map(role => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<RoleAnalysis>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Role ${role} timeout after ${timeoutMs}ms`)),
          timeoutMs,
        );
      });
      const analysisPromise = this._analyzeAsRoleAsync(role, topic, context);
      return Promise.race([analysisPromise, timeoutPromise]).finally(() => {
        if (timer != null) clearTimeout(timer);
      });
    });

    const results = await Promise.allSettled(tasks);

    const analyses: RoleAnalysis[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        analyses.push(result.value);
      } else {
        const role = roles[i];
        const reasonMsg = result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
        console.warn(`Role ${getRoleDisplayName(role)} analysis failed: ${reasonMsg}`);
        analyses.push({
          role,
          analysisContent: `分析失败: ${reasonMsg}`,
          keyPoints: [],
          recommendations: [],
          concerns: [],
          score: 0.0,
          metadata: {},
        });
      }
    }

    return analyses;
  }

  /**
   * Synthesize multi-role analysis results
   *
   * Identify consensus points, divergent points, and generate prioritized recommendations.
   */
  synthesize(analyses: RoleAnalysis[]): BrainstormSynthesis {
    if (analyses.length === 0) {
      return {
        summary: '无可用分析结果',
        consensusPoints: [],
        divergentPoints: [],
        prioritizedRecommendations: [],
        riskAssessment: '',
        nextSteps: [],
        confidenceScore: 0.0,
      };
    }

    // Collect all key points, recommendations, and concerns
    const allKeyPoints: string[] = [];
    const allRecommendations: string[] = [];
    const allConcerns: string[] = [];

    for (const analysis of analyses) {
      allKeyPoints.push(...analysis.keyPoints);
      allRecommendations.push(...analysis.recommendations);
      allConcerns.push(...analysis.concerns);
    }

    // Identify consensus points (views appearing multiple times)
    const consensusPoints = this._findConsensus(allKeyPoints);

    // Identify divergent points (contradictory views)
    const divergentPoints = this._findDivergence(analyses);

    // Prioritize recommendations
    const prioritizedRecommendations = this._prioritizeRecommendations(
      allRecommendations, analyses,
    );

    // Risk assessment
    const riskAssessment = this._assessRisks(allConcerns);

    // Generate next steps
    const nextSteps = this._generateNextSteps(consensusPoints, prioritizedRecommendations);

    // Calculate confidence
    const validAnalyses = analyses.filter(a => a.score > 0);
    const confidenceScore = validAnalyses.length > 0
      ? validAnalyses.reduce((sum, a) => sum + a.score, 0) / validAnalyses.length
      : 0.0;

    // Generate summary
    const summary = this._generateSummary(analyses, consensusPoints, divergentPoints);

    return {
      summary,
      consensusPoints,
      divergentPoints,
      prioritizedRecommendations,
      riskAssessment,
      nextSteps,
      confidenceScore,
    };
  }

  /**
   * Generate guidance-specification based on synthesis results
   */
  generateSpecification(synthesis: BrainstormSynthesis, topic: string = ''): GuidanceSpecification {
    // Extract guidelines from consensus
    const guidelines = synthesis.consensusPoints.slice(0, 5).map(p => `遵循共识: ${p}`);

    // Extract constraints from divergent points
    const constraints = synthesis.divergentPoints.slice(0, 3).map(d => `注意分歧: ${d}`);

    // Success criteria based on prioritized recommendations
    const successCriteria = synthesis.prioritizedRecommendations.slice(0, 5);

    // Quality standards
    const qualityStandards = [
      '确保内容一致性和连贯性',
      '符合所有共识指导原则',
      '妥善处理已识别的分歧点',
      '满足风险缓解要求',
    ];

    // Deliverables
    const deliverables = synthesis.nextSteps.length > 0
      ? synthesis.nextSteps.slice(0, 5)
      : ['完成初始草案', '完成审查和修订', '生成最终输出'];

    const titleSuffix = topic.length > 50 ? `${topic.slice(0, 50)}...` : topic;

    return {
      title: `头脑风暴规范: ${titleSuffix}`,
      objective: synthesis.summary ? synthesis.summary.slice(0, 200) : '基于多角色分析制定执行规范',
      scope: `基于 ${synthesis.consensusPoints.length} 个共识点和 ${synthesis.prioritizedRecommendations.length} 条建议`,
      guidelines,
      constraints,
      successCriteria,
      qualityStandards,
      deliverables,
    };
  }

  // ========================================
  // Private methods
  // ========================================

  private _analyzeAsRole(role: BrainstormRole, topic: string, context: string): RoleAnalysis {
    const prompt = this._buildRolePrompt(role, topic, context);

    try {
      const writer = this.container.getAgent(AgentType.WRITER, { name: `brainstorm_${role}` });
      const result = writer.run({
        prompt,
        mode: 'analysis',
        role,
      });

      const content = (result.content as string) ?? '';
      return this._parseAnalysisResult(role, content);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`Analysis failed for role ${getRoleDisplayName(role)}: ${errorMsg}`);
      return {
        role,
        analysisContent: `分析过程中出错: ${errorMsg}`,
        keyPoints: [],
        recommendations: [],
        concerns: [],
        score: 0.0,
        metadata: {},
      };
    }
  }

  private async _analyzeAsRoleAsync(
    role: BrainstormRole,
    topic: string,
    context: string,
  ): Promise<RoleAnalysis> {
    const prompt = this._buildRolePrompt(role, topic, context);

    try {
      const writer = this.container.getAgent(AgentType.WRITER, { name: `brainstorm_${role}` }) as
        & { run(input: Record<string, unknown>): Record<string, unknown> }
        & {
          generate?: (
            prompt: string,
            options?: Record<string, unknown>,
          ) => Promise<string | { content?: string }>;
        };

      // Prefer the async writer API when available so role analyses can
      // truly overlap under Promise.allSettled. Fall back to the sync
      // run() path for writers that only expose the synchronous
      // interface — preserves backward compatibility.
      if (typeof writer.generate === 'function') {
        const generated = await writer.generate(prompt, { mode: 'analysis', role });
        const content =
          typeof generated === 'string'
            ? generated
            : (generated?.content ?? '');
        return this._parseAnalysisResult(role, content);
      }
      return this._analyzeAsRole(role, topic, context);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`Analysis failed for role ${getRoleDisplayName(role)}: ${errorMsg}`);
      return {
        role,
        analysisContent: `分析过程中出错: ${errorMsg}`,
        keyPoints: [],
        recommendations: [],
        concerns: [],
        score: 0.0,
        metadata: {},
      };
    }
  }

  private _buildRolePrompt(role: BrainstormRole, topic: string, context: string): string {
    let prompt = `你是一位 ${getRoleDisplayName(role)}，请从你的专业角度分析以下主题。

## 你的视角
${getRolePerspective(role)}

## 分析主题
${topic}

`;

    if (context) {
      prompt += `## 背景上下文
${context}

`;
    }

    prompt += `## 输出要求
请提供以下内容:

1. **分析内容**: 从你的角度对主题进行深入分析 (200-500字)

2. **关键要点**: 列出 3-5 个最重要的观点
   - 要点 1
   - 要点 2
   - ...

3. **建议**: 列出 2-4 条可行建议
   - 建议 1
   - 建议 2
   - ...

4. **关注点/风险**: 列出需要注意的问题 (如有)
   - 关注点 1
   - ...

请保持专业客观，并明确标注各部分。
`;

    return prompt;
  }

  private _parseAnalysisResult(role: BrainstormRole, content: string): RoleAnalysis {
    const keyPoints: string[] = [];
    const recommendations: string[] = [];
    const concerns: string[] = [];

    const lines = content.split('\n');
    let currentSection: string | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Detect section headers
      if (/关键要点|关键点|要点/.test(line)) {
        currentSection = 'key_points';
      } else if (/建议/.test(line)) {
        currentSection = 'recommendations';
      } else if (/关注|风险|问题/.test(line)) {
        currentSection = 'concerns';
      } else if (/[：:]$/.test(line)) {
        // Avoid unknown sections inheriting the previous section
        currentSection = 'unknown';
      } else if (/^[-*1-9]/.test(line)) {
        // Extract list item
        const item = line.replace(/^[-*\d.]+\s*/, '');
        if (item && currentSection) {
          if (currentSection === 'key_points') keyPoints.push(item);
          else if (currentSection === 'recommendations') recommendations.push(item);
          else if (currentSection === 'concerns') concerns.push(item);
        }
      }
    }

    return {
      role,
      analysisContent: content,
      keyPoints: keyPoints.slice(0, 5),
      recommendations: recommendations.slice(0, 4),
      concerns: concerns.slice(0, 3),
      score: content ? 80.0 : 0.0,
      metadata: {},
    };
  }

  private _findConsensus(points: string[]): string[] {
    if (points.length === 0) return [];

    // Simple word frequency approach
    const wordCount: Record<string, number> = {};
    for (const point of points) {
      const words = new Set(point.toLowerCase().split(/\s+/));
      for (const word of words) {
        if (word.length > 2) {
          wordCount[word] = (wordCount[word] ?? 0) + 1;
        }
      }
    }

    const threshold = Math.max(2, Math.floor(points.length / 3));
    const highFreqWords = new Set(
      Object.entries(wordCount)
        .filter(([, count]) => count >= threshold)
        .map(([word]) => word),
    );

    const consensus: string[] = [];
    for (const point of points) {
      const words = new Set(point.toLowerCase().split(/\s+/));
      if ([...words].some(w => highFreqWords.has(w))) {
        if (!consensus.includes(point)) {
          consensus.push(point);
        }
      }
    }

    return consensus.slice(0, 5);
  }

  private _findDivergence(analyses: RoleAnalysis[]): string[] {
    const divergent: string[] = [];

    for (let i = 0; i < analyses.length; i++) {
      for (let j = i + 1; j < analyses.length; j++) {
        const a1 = analyses[i];
        const a2 = analyses[j];
        for (const c1 of a1.concerns) {
          for (const r2 of a2.recommendations) {
            if (this._areConflicting(c1, r2)) {
              divergent.push(
                `${getRoleDisplayName(a1.role)} 关注 '${c1.slice(0, 30)}...' vs ` +
                `${getRoleDisplayName(a2.role)} 建议 '${r2.slice(0, 30)}...'`,
              );
            }
          }
        }
      }
    }

    return divergent.slice(0, 5);
  }

  private _areConflicting(text1: string, text2: string): boolean {
    const negativeWords = new Set(['不', '避免', '禁止', '风险', '问题', '担心']);
    const positiveWords = new Set(['应该', '建议', '推荐', '可以', '需要']);

    const t1HasNeg = [...negativeWords].some(w => text1.includes(w));
    const t2HasPos = [...positiveWords].some(w => text2.includes(w));

    if (t1HasNeg && t2HasPos) {
      const words1 = new Set(text1.split(/\s+/));
      const words2 = new Set(text2.split(/\s+/));
      const common = [...words1].filter(w => words2.has(w));
      if (common.length >= 2) return true;
    }

    return false;
  }

  private _prioritizeRecommendations(
    recommendations: string[],
    analyses: RoleAnalysis[],
  ): string[] {
    if (recommendations.length === 0) return [];

    const recScores: Record<string, number> = {};

    for (const rec of recommendations) {
      let score = 1.0;
      for (const analysis of analyses) {
        if (analysis.recommendations.includes(rec)) {
          score += analysis.score / 100;
        }
      }
      recScores[rec] = score;
    }

    return Object.keys(recScores)
      .sort((a, b) => recScores[b] - recScores[a])
      .slice(0, 10);
  }

  private _assessRisks(concerns: string[]): string {
    if (concerns.length === 0) return '未识别到显著风险。';

    let level: string;
    let desc: string;

    if (concerns.length <= 2) {
      level = '低';
      desc = '已识别少量潜在关注点，建议在执行过程中注意。';
    } else if (concerns.length <= 5) {
      level = '中';
      desc = '存在多个需要关注的风险点，建议制定缓解策略。';
    } else {
      level = '高';
      desc = '识别到大量风险因素，建议在继续之前进行详细风险分析。';
    }

    return `风险等级: ${level}。${desc} 主要关注点: ${concerns.slice(0, 3).join('; ')}`;
  }

  private _generateNextSteps(consensus: string[], recommendations: string[]): string[] {
    const steps: string[] = [];

    if (consensus.length > 0) {
      steps.push(`确认并落实 ${consensus.length} 个共识点`);
    }

    if (recommendations.length > 0) {
      steps.push(`实施优先建议: ${recommendations[0].slice(0, 50)}...`);
    }

    steps.push(
      '制定详细执行计划',
      '分配责任和时间节点',
      '建立进度跟踪机制',
    );

    return steps.slice(0, 5);
  }

  private _generateSummary(
    analyses: RoleAnalysis[],
    consensus: string[],
    divergent: string[],
  ): string {
    const roleNames = analyses
      .filter(a => a.score > 0)
      .map(a => getRoleDisplayName(a.role));

    const rolesStr = roleNames.length > 3
      ? `${roleNames.slice(0, 3).join(', ')}等`
      : roleNames.join(', ');

    let summary = `基于 ${roleNames.length} 位专家角色的分析 (${rolesStr})，共识别 ${consensus.length} 个共识点`;

    if (divergent.length > 0) {
      summary += `和 ${divergent.length} 个分歧点。`;
    } else {
      summary += '，各方观点高度一致。';
    }

    return summary;
  }

  private _verifySpecification(spec: GuidanceSpecification): Record<string, unknown> {
    const issues: string[] = [];

    if (!spec.objective) issues.push('缺少目标描述');
    if (spec.guidelines.length === 0) issues.push('缺少指导原则');
    if (spec.successCriteria.length === 0) issues.push('缺少成功标准');
    if (spec.guidelines.length < 2) issues.push('指导原则不足 (建议至少 2 条)');

    const valid = issues.length === 0;
    const score = Math.max(0, 100 - issues.length * 15);

    return {
      valid,
      score,
      issues,
      suggestions: [issues.length > 0 ? '补充缺失的规范内容' : '规范内容完整'],
    };
  }
}
