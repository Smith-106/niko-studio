/**
 * Novel Domain Adapter
 *
 * Implements novel-specific workflow:
 * Commander -> Architect -> Writer -> Distillation -> Critic -> HumanReview -> Finalize
 *
 * Migrated from src/workflow/adapters/novel_adapter.py
 *
 * Key changes from Python:
 * - LangGraph StateGraph replaced with async pipeline (executePipeline method)
 * - LangChain LLM calls replaced with IAgentLLMService interface
 * - Python dataclass model_dump() replaced with plain object spread
 */

import type { BaseState } from '../state.js';
import type {
  BaseEvaluationResult,
  NodeFunction,
  IWorkflowGraph,
} from './base-adapter.js';
import { BaseDomainAdapter, AdapterRegistry } from './base-adapter.js';
import { DomainType } from '../state.js';
import type {
  WritingState,
  SceneCard,
  CritiqueResult,
} from '../novel-state.js';
import { DEFAULT_NOVEL_CONFIG } from '../novel-state.js';
import { RevisionLoop } from '../revision-loop.js';
import { ContentType, SessionManager } from '../session/session-manager.js';

// ============================================================
// Novel adapter config defaults (mirror Python DEFAULT_CONFIG)
// ============================================================

const DEFAULT_CONFIG = DEFAULT_NOVEL_CONFIG;

// ============================================================
// NovelAdapter class
// ============================================================

// Registered at end of file
export class NovelAdapter extends BaseDomainAdapter {

  // ========================================
  // Abstract method implementations
  // ========================================

  getDomainType(): string {
    return DomainType.NOVEL;
  }

  getStateClass(): new (...args: unknown[]) => BaseState {
    // WritingState is an interface, not a class; return a no-op constructor
    return function WritingStateStub() {} as unknown as new (...args: unknown[]) => BaseState;
  }

  createInitialState(userRequest: string, extra?: Record<string, unknown>): BaseState {
    const metadata = (extra?.metadata as Record<string, unknown>) ?? {};
    const resumeDecision = extra?.resume_decision;
    if (resumeDecision) {
      (metadata as Record<string, unknown>)['resume_decision'] = resumeDecision;
    }

    return {
      session_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      user_request: userRequest,
      domain: DomainType.NOVEL,
      metadata,
    } as BaseState;
  }

  evaluate(state: BaseState): BaseEvaluationResult {
    const critique = (state as unknown as WritingState).critique_result ?? {};
    const lockAnalysis = (critique as Record<string, unknown>).lock_analysis as Record<string, unknown> | undefined;

    return {
      decision: (critique as Record<string, unknown>).decision as string ?? 'REVISE',
      decision_reason: (critique as Record<string, unknown>).decision_reason as string ?? '',
      total_score: (critique as Record<string, unknown>).total_score as number ?? 0,
      dimension_scores: (lockAnalysis?.scores as Record<string, number>) ?? {},
      feedback: (critique as Record<string, unknown>).actionable_feedback as string ?? '',
      revision_instructions:
        ((critique as Record<string, unknown>).revision_instructions as Array<Record<string, string>>) ?? [],
    };
  }

  /**
   * Build novel pipeline graph (LangGraph replacement).
   * In TypeScript, we return a simple IWorkflowGraph stub.
   * The actual execution happens via executePipeline().
   */
  createGraph(): IWorkflowGraph {
    const nodes: Record<string, NodeFunction> = {};
    const edges: Array<{ from: string; to: string }> = [];
    const conditionalEdges: Array<{
      from: string;
      router: (state: BaseState) => string;
      mapping: Record<string, string>;
    }> = [];
    let entryPoint = '';

    return {
      addNode(name: string, fn: NodeFunction): void {
        nodes[name] = fn;
      },
      addEdge(fromNode: string, toNode: string): void {
        edges.push({ from: fromNode, to: toNode });
      },
      addConditionalEdge(
        fromNode: string,
        router: (state: BaseState) => string,
        mapping: Record<string, string>,
      ): void {
        conditionalEdges.push({ from: fromNode, router, mapping });
      },
      compile(): { invoke(state: BaseState): Promise<BaseState> } {
        return {
          async invoke(state: BaseState): Promise<BaseState> {
            // Simple pipeline execution (no conditional edges for this stub)
            let current = { ...state };
            for (const [name, fn] of Object.entries(nodes)) {
              const result = await fn(current);
              current = { ...current, ...result };
            }
            return current;
          },
        };
      },
    };
  }

  // ========================================
  // Pipeline execution (replaces LangGraph StateGraph)
  // ========================================

  /**
   * Execute the full novel pipeline.
   * This is the TypeScript equivalent of compiling and invoking the LangGraph graph.
   */
  async executePipeline(state: WritingState): Promise<WritingState> {
    let current: WritingState = { ...state };

    // Step 1: Commander
    const commanderResult = await this.commanderNode(current);
    current = { ...current, ...commanderResult };

    // Step 2: Route after commander
    const route1 = this.routeAfterCommander(current);
    if (route1 === 'architect') {
      const architectResult = await this.architectNode(current);
      current = { ...current, ...architectResult };
    }

    // Step 3: Writer
    const writerResult = await this.writerNode(current);
    current = { ...current, ...writerResult };

    // Step 4: Route after writer (distillation or critic)
    const route2 = this.routeAfterWriter(current);
    if (route2 === 'distillation') {
      const distillResult = await this.distillationNode(current);
      current = { ...current, ...distillResult };
    }

    // Step 5: Critic
    const criticResult = await this.criticNode(current);
    current = { ...current, ...criticResult };

    // Step 6: Route after critic (loop back to writer, human review, or finalize)
    const route3 = this.routeAfterCritic(current);
    if (route3 === 'human_reviewer') {
      const humanResult = this.humanReviewNode(current);
      current = { ...current, ...humanResult };
    }

    // Step 7: Finalize
    const finalizeResult = this.finalizeNode(current);
    current = { ...current, ...finalizeResult };

    return current;
  }

  // ========================================
  // Node functions
  // ========================================

  async commanderNode(state: WritingState): Promise<Partial<WritingState>> {
    console.log('\n' + '='.repeat(50));
    console.log('Commander Agent: Analyzing task and routing...');
    console.log('='.repeat(50));

    // In TypeScript, the Commander agent's routing is handled internally
    // by the WorkflowEngine's route() method. This node records the
    // routing decision in the state.
    const userIdea = state.user_idea ?? '';

    // Simple keyword-based routing (mirrors Python CommanderAgent)
    const rapidKeywords = ['回答', '解释', '什么是', '告诉我', '简单'];
    const isRapid = rapidKeywords.some(kw => userIdea.includes(kw));
    const workflowLevel = isRapid ? 'rapid' : 'standard';

    console.log(`Workflow level: ${workflowLevel}`);

    return {
      workflow_level: isRapid ? 1 : 3,
      metadata: {
        ...(state.metadata as Record<string, unknown>),
        workflow_level: workflowLevel,
      },
    };
  }

  routeAfterCommander(state: WritingState): string {
    const level = state.workflow_level;
    if (level === 1) {
      console.log('L1 rapid mode: going directly to Writer');
      return 'writer';
    } else {
      console.log('Standard mode: entering Architect for structure planning');
      return 'architect';
    }
  }

  async architectNode(state: WritingState): Promise<Partial<WritingState>> {
    console.log('\n' + '='.repeat(50));
    console.log('Architect Agent: Planning story structure...');
    console.log('='.repeat(50));

    // In the TypeScript version, the architect node produces a blueprint
    // based on the user's input. This would normally call the ArchitectAgent
    // via IAgentLLMService, but here we produce a structured placeholder
    // that preserves the same state shape.
    const sceneCards: SceneCard[] = [
      {
        scene_id: 'CH01-SC01',
        chapter_num: 1,
        scene_num: 1,
        pov_character: '',
        objective: 'open',
        conflict: '',
        outcome: '+',
        plot_beat: '',
        emotional_arc: 'calm->change',
        sensory_guidance: {},
        foreshadows_to_plant: [],
        foreshadows_to_harvest: [],
      },
    ];

    const firstScene: SceneCard = sceneCards[0] ?? {};

    console.log(`Generated ${sceneCards.length} scene cards`);

    return {
      story_blueprint: { user_idea: state.user_idea, genre: state.genre },
      lock_analysis: { L: { score: 8 }, O: { score: 8 }, C: { score: 8 }, K: { score: 8 }, total_score: 32 },
      scene_cards: sceneCards,
      current_scene: firstScene,
      current_scene_index: 0,
      revision_count: 0,
      draft_version: 0,
    };
  }

  async writerNode(state: WritingState): Promise<Partial<WritingState>> {
    const revisionCount = state.revision_count ?? 0;
    const version = (state.draft_version ?? 0) + 1;

    console.log('\n' + '='.repeat(50));
    console.log(`Writer Agent: Writing version ${version} draft...`);
    console.log('='.repeat(50));

    const scene = state.current_scene ?? {};
    const feedback = state.feedback_context ?? '';

    if (revisionCount > 0 && feedback) {
      console.log(`   Revising based on Critic feedback (revision ${revisionCount})`);
    }

    this.injectPlaybookIntoWriterInput(state);

    // In the TypeScript version, the actual writing is done via
    // IAgentLLMService. Here we produce the state shape.
    const draft = `[Draft v${version}] Content for scene ${scene.scene_id ?? 'CH01-SC01'}`;
    const wordcount = draft.length;

    console.log(`Generated draft: ${wordcount} characters`);

    return {
      draft_content: draft,
      draft_version: version,
      draft_wordcount: wordcount,
      writer_self_check: {},
    };
  }

  async distillationNode(state: WritingState): Promise<Partial<WritingState>> {
    console.log('\n' + '='.repeat(50));
    console.log('Distillation Node: Running knowledge distillation...');
    console.log('='.repeat(50));

    // In TypeScript, the DistillationNode from graph.ts is used.
    // Here we produce a simplified result preserving state shape.
    const result: Record<string, unknown> = {
      entities_count: 0,
      relations_count: 0,
      events_count: 0,
      template: 'full',
    };

    console.log(`Distillation complete: entities=${result.entities_count}`);

    return {
      distillation_result: result as WritingState['distillation_result'],
      distillation_state: {},
    };
  }

  async criticNode(state: WritingState): Promise<Partial<WritingState>> {
    const revisionCount = state.revision_count ?? 0;

    console.log('\n' + '='.repeat(50));
    console.log(`Critic Agent: Reviewing draft (review ${revisionCount + 1})...`);
    console.log('='.repeat(50));

    // In the TypeScript version, the actual critic review is done via
    // IAgentLLMService. Here we produce the state shape.
    const critiquePayload: CritiqueResult = {
      decision: 'REVISE',
      decision_reason: '',
      total_score: 70,
      lock_score: 28,
      style_score: 24,
      logic_score: 18,
      lock_analysis: {
        L: { score: 7 },
        O: { score: 7 },
        C: { score: 7 },
        K: { score: 7 },
        total_score: 28,
      },
      actionable_feedback: 'Improve conflict tension and sensory details.',
      revision_instructions: [],
    };

    const historyEntry = {
      version: state.draft_version ?? 1,
      score: critiquePayload.total_score ?? 0,
      decision: critiquePayload.decision,
      feedback: (critiquePayload.actionable_feedback ?? '').substring(0, 200),
    };
    const revisionHistory = [...(state.revision_history ?? []), historyEntry];

    const roundIdentifier = `round-${revisionCount + 1}`;
    const checkpointId = `revision-${roundIdentifier}`;
    const checkpointEntry = {
      checkpoint_id: checkpointId,
      round_identifier: roundIdentifier,
      step_id: roundIdentifier,
      stage: 'critic',
    };
    const checkpointTrace = [...(state.checkpoint_trace ?? []), checkpointEntry];

    const revisionLoop = new RevisionLoop();
    const feedbackArtifacts = revisionLoop['_buildFeedbackArtifacts'](
      roundIdentifier,
      critiquePayload as unknown as Record<string, unknown>,
    );

    const response: Partial<WritingState> = {
      critique_result: critiquePayload,
      revision_count: revisionCount + 1,
      revision_history: revisionHistory,
      feedback_context: critiquePayload.actionable_feedback,
      revision_instructions: critiquePayload.revision_instructions ?? [],
      feedback_artifacts: feedbackArtifacts,
      checkpoint_trace: checkpointTrace,
      last_checkpoint_id: checkpointId,
    };

    // Self-learning integration
    if (this.isSelfLearningEnabled()) {
      try {
        let selfLearningState = this.getSelfLearningState(state);
        const reflection = this.buildReflectionFromCritic(
          critiquePayload as unknown as Record<string, unknown>,
          revisionCount + 1,
          revisionHistory,
        );
        selfLearningState = { ...selfLearningState, reflector: reflection };

        if (this.shouldCuratePlaybook(state, critiquePayload as unknown as Record<string, unknown>)) {
          const curated = this.curatePlaybookCandidates(
            { ...state, self_learning: selfLearningState },
            critiquePayload as unknown as Record<string, unknown>,
            reflection,
          );
          if (curated.curator) {
            selfLearningState = { ...selfLearningState, curator: curated.curator };
          }
          if (curated.playbook) {
            selfLearningState = { ...selfLearningState, playbook: curated.playbook };
          }
        }
        (response as Record<string, unknown>).self_learning = selfLearningState;
      } catch (exc) {
        console.warn(`Self-learning skipped (non-blocking): ${exc}`);
      }
    }

    // Session checkpoint persistence
    const sessionId = state.session_id ?? '';
    if (sessionId) {
      try {
        const sessionManager = new SessionManager();
        const checkpointPayload = {
          checkpoint_id: checkpointId,
          session_id: sessionId,
          revision_count: revisionCount + 1,
          round_identifier: roundIdentifier,
          step_id: roundIdentifier,
          stage: 'critic',
          decision: critiquePayload.decision ?? 'REVISE',
          score: critiquePayload.total_score ?? 0,
          trace: {
            revision_checkpoint_id: checkpointId,
            state_trace_id: `${sessionId}:${roundIdentifier}`,
          },
        };
        sessionManager.write(
          sessionId,
          ContentType.REVISION_CHECKPOINT,
          JSON.stringify(checkpointPayload, null, 2),
          { id: checkpointId },
        );
      } catch {
        // Non-blocking
      }
    }

    console.log(`Score: ${critiquePayload.total_score ?? 0}`);
    console.log(`Decision: ${critiquePayload.decision}`);

    return response;
  }

  humanReviewNode(state: WritingState): Partial<WritingState> {
    console.log('\n' + '='.repeat(50));
    console.log('Human Review: Requires manual review');
    console.log('='.repeat(50));

    const critique = state.critique_result ?? ({} as CritiqueResult);

    console.log(`   Score: ${critique.total_score ?? 'N/A'}`);
    console.log(`   Decision: ${critique.decision ?? 'N/A'}`);
    console.log(`   Reason: ${critique.decision_reason ?? 'N/A'}`);
    console.log(`   Revisions: ${state.revision_count ?? 0}`);
    console.log('   [Human Review] Needs manual confirmation to continue');

    return {
      requires_human_intervention: true,
      metadata: {
        ...(state.metadata as Record<string, unknown>),
        human_review_status: 'review_required',
        human_review_notes: critique.decision_reason ?? '',
      },
      final_content: state.draft_content ?? '',
      final_score: critique.total_score ?? 0,
    };
  }

  finalizeNode(state: WritingState): Partial<WritingState> {
    console.log('\n' + '='.repeat(50));
    console.log('Writing complete!');
    console.log('='.repeat(50));

    const critique = state.critique_result ?? ({} as CritiqueResult);

    return {
      final_content: state.draft_content ?? '',
      final_score: critique.total_score ?? 0,
    };
  }

  // ========================================
  // Routing functions
  // ========================================

  routeAfterWriter(state: WritingState): string {
    const hasDraft = Boolean(state.draft_content);
    const notDistilled = !state.distillation_result;
    const config = this.config as Record<string, unknown> ?? {};
    const distillEnabled = (config.enable_distillation as boolean) ?? true;

    if (hasDraft && notDistilled && distillEnabled) {
      console.log('Entering distillation node...');
      return 'distillation';
    } else {
      console.log('Skipping distillation, going directly to Critic');
      return 'critic';
    }
  }

  routeAfterCritic(state: WritingState): string {
    const critique = state.critique_result ?? ({} as CritiqueResult);
    const revisionCount = state.revision_count ?? 0;

    const totalScore = critique.total_score ?? 0;
    const decision = critique.decision ?? 'REVISE';

    const lockAnalysis = (critique as unknown as Record<string, unknown>).lock_analysis as Record<string, unknown> | undefined;
    const cScore = (lockAnalysis?.C as Record<string, unknown> | undefined)?.score as number ?? 0;

    const config = this.config as Record<string, unknown> ?? {};
    const passScore = (config.pass_score as number) ?? (DEFAULT_CONFIG.pass_score as number);
    const minCScore = (config.min_c_score as number) ?? (DEFAULT_CONFIG.min_c_score as number);
    const maxRevisions = (config.max_revisions as number) ?? (DEFAULT_CONFIG.max_revisions as number);
    const humanReviewScore = (config.human_review_score as number) ?? (DEFAULT_CONFIG.human_review_score as number);

    if (decision === 'APPROVED' || (totalScore >= passScore && cScore >= minCScore)) {
      if (!this.contextGovernancePassed(state)) {
        if (revisionCount >= maxRevisions) {
          console.log('Quality passed but context governance failed, and revision limit reached, sending to human review');
          return 'human_reviewer';
        }
        console.log('Quality passed but context governance failed, sending back to Writer');
        return 'writer';
      }

      console.log(`Review passed! (Score: ${totalScore}, C: ${cScore})`);
      return 'finalize';
    }

    if (revisionCount >= maxRevisions) {
      console.log(`Max revisions reached (${maxRevisions}), requires human intervention`);
      return 'human_reviewer';
    }

    if (decision === 'REWRITE') {
      console.log(`Quality too low (${totalScore}), requires human intervention`);
      return 'human_reviewer';
    }

    if (decision === 'HUMAN_REVIEW' || totalScore >= humanReviewScore) {
      console.log(`Score ${totalScore} suggests human review`);
      return 'human_reviewer';
    }

    console.log(`Score ${totalScore} not met, sending back to Writer (revision ${revisionCount}/${maxRevisions})...`);
    return 'writer';
  }

  // ========================================
  // Self-learning helpers
  // ========================================

  private isSelfLearningEnabled(): boolean {
    const config = this.config as Record<string, unknown> ?? {};
    return Boolean(
      config.enable_self_learning_loop ?? DEFAULT_CONFIG.enable_self_learning_loop,
    );
  }

  private getSelfLearningState(state: WritingState): Record<string, unknown> {
    const existing = state.self_learning;
    const normalized: Record<string, unknown> = existing
      ? { ...existing as Record<string, unknown> }
      : {};

    let reflector = normalized.reflector as Record<string, unknown> | undefined;
    let curator = normalized.curator as Record<string, unknown> | undefined;
    let playbook = normalized.playbook as Record<string, unknown> | undefined;

    if (typeof reflector !== 'object' || reflector == null) reflector = {};
    if (typeof curator !== 'object' || curator == null) curator = {};
    if (typeof playbook !== 'object' || playbook == null) playbook = {};

    let rules = playbook['rules'];
    if (!Array.isArray(rules)) rules = [];

    playbook = { ...playbook, rules };
    return { reflector, curator, playbook };
  }

  private buildReflectionFromCritic(
    critiqueResult: Record<string, unknown>,
    revisionCount: number,
    revisionHistory: unknown,
  ): Record<string, unknown> {
    const decision = String(critiqueResult['decision'] ?? 'REVISE');
    const totalScore = Number(critiqueResult['total_score'] ?? 0);
    const actionableFeedback = String(critiqueResult['actionable_feedback'] ?? '');

    const lockAnalysis = critiqueResult['lock_analysis'] as Record<string, unknown> | undefined;
    let cScore = 0;
    if (lockAnalysis && typeof lockAnalysis === 'object') {
      const cNode = lockAnalysis['C'] as Record<string, unknown> | undefined;
      if (cNode && typeof cNode === 'object') {
        cScore = Number(cNode['score'] ?? 0);
      }
    }

    const failedDimensions: string[] = [];
    if (lockAnalysis && typeof lockAnalysis === 'object') {
      for (const dim of ['L', 'O', 'C', 'K']) {
        const dimPayload = lockAnalysis[dim] as Record<string, unknown> | undefined;
        if (dimPayload && typeof dimPayload === 'object') {
          const score = dimPayload['score'];
          if (typeof score === 'number' && score < 7) {
            failedDimensions.push(dim);
          }
        }
      }
    }

    let failureType = 'approved';
    if (decision === 'REWRITE' || decision === 'HUMAN_REVIEW') {
      failureType = decision.toLowerCase();
    } else if (decision === 'REVISE') {
      failureType = 'revision_required';
    }

    const rootCauses: string[] = [];
    if (failureType !== 'approved') {
      if (failedDimensions.length > 0) {
        rootCauses.push(`low_lock_dimensions=${failedDimensions.join(',')}`);
      }
      if (typeof actionableFeedback === 'string' && actionableFeedback.trim()) {
        rootCauses.push(actionableFeedback.trim().substring(0, 200));
      }
    }

    const avoidNextRound: string[] = [];
    if (failedDimensions.length > 0) {
      avoidNextRound.push(`Do not miss LOCK dimensions: ${failedDimensions.join(', ')}`);
    }

    const config = this.config as Record<string, unknown> ?? {};
    const minCScoreConfig = Number(config.min_c_score ?? DEFAULT_CONFIG.min_c_score);
    if (cScore < minCScoreConfig) {
      avoidNextRound.push('Do not weaken confrontation (C) in key beats');
    }

    const historySize = Array.isArray(revisionHistory) ? revisionHistory.length : 0;

    return {
      triggered: true,
      revision_count: revisionCount,
      failure_type: failureType,
      root_causes: rootCauses,
      avoid_next_round: avoidNextRound,
      decision,
      total_score: totalScore,
      history_size: historySize,
    };
  }

  private shouldCuratePlaybook(
    state: WritingState,
    critiqueResult: Record<string, unknown>,
  ): boolean {
    const revisions = state.revision_count ?? 0;
    const config = this.config as Record<string, unknown> ?? {};
    const everyN = Math.max(1, Number(
      config.self_learning_curate_every_n_revisions ?? DEFAULT_CONFIG.self_learning_curate_every_n_revisions,
    ));
    const decision = String(critiqueResult['decision'] ?? 'REVISE');

    return (revisions > 0 && revisions % everyN === 0) || ['REVISE', 'REWRITE', 'HUMAN_REVIEW'].includes(decision);
  }

  private curatePlaybookCandidates(
    state: WritingState,
    critiqueResult: Record<string, unknown>,
    reflection: Record<string, unknown>,
  ): { curator?: Record<string, unknown>; playbook?: Record<string, unknown> } {
    const selfLearning = this.getSelfLearningState(state);
    const playbook = { ...(selfLearning.playbook as Record<string, unknown>) };
    const existingRulesRaw = playbook['rules'];
    let existingRules: unknown[] = Array.isArray(existingRulesRaw) ? existingRulesRaw : [];

    const candidates: string[] = [];
    const avoidNext = reflection['avoid_next_round'];
    if (Array.isArray(avoidNext)) {
      for (const item of avoidNext) {
        if (typeof item === 'string' && item.trim()) {
          candidates.push(item.trim());
        }
      }
    }

    const feedback = critiqueResult['actionable_feedback'];
    if (typeof feedback === 'string' && feedback.trim()) {
      candidates.push(`Apply feedback focus: ${feedback.trim().substring(0, 160)}`);
    }

    if (candidates.length === 0) {
      return {
        curator: { applied: false, reason: 'no_candidates' },
        playbook,
      };
    }

    const config = this.config as Record<string, unknown> ?? {};
    const maxRules = Math.max(1, Number(config.self_learning_max_rules ?? DEFAULT_CONFIG.self_learning_max_rules));

    const normalizedExisting: string[] = [];
    for (const rule of existingRules) {
      if (typeof rule === 'string' && rule.trim()) {
        normalizedExisting.push(rule.trim());
      }
    }

    const mergedRules = [...normalizedExisting];
    for (const candidate of candidates) {
      if (!mergedRules.includes(candidate)) {
        mergedRules.push(candidate);
      }
    }

    const finalRules = mergedRules.length > maxRules
      ? mergedRules.slice(-maxRules)
      : mergedRules;

    const updatedPlaybook = { ...playbook, rules: finalRules };

    return {
      curator: {
        applied: true,
        rule_count: finalRules.length,
        added: Math.max(0, finalRules.length - normalizedExisting.length),
      },
      playbook: updatedPlaybook,
    };
  }

  private injectPlaybookIntoWriterInput(state: WritingState): void {
    if (!this.isSelfLearningEnabled()) return;

    const selfLearning = this.getSelfLearningState(state);
    const playbook = selfLearning.playbook as Record<string, unknown> | undefined;
    const rules = playbook?.['rules'];
    if (!Array.isArray(rules) || rules.length === 0) return;

    const cappedRules: string[] = [];
    for (const rule of rules.slice(-3)) {
      if (typeof rule === 'string' && rule.trim()) {
        cappedRules.push(rule.trim().substring(0, 140));
      }
    }

    if (cappedRules.length === 0) return;

    const summary = cappedRules.map(r => `- ${r}`).join('\n');
    console.log(`\nPlaybook strategy:\n${summary}\n`);
  }

  private contextGovernancePassed(state: WritingState): boolean {
    const config = this.config as Record<string, unknown> ?? {};
    if (!(config.enable_context_governance ?? DEFAULT_CONFIG.enable_context_governance)) {
      return true;
    }

    const governance = state.context_governance;
    if (!governance) return true;

    if ('passed' in governance) {
      return Boolean(governance.passed);
    }

    const minRetrievalHitRate = Number(
      config.min_retrieval_hit_rate ?? DEFAULT_CONFIG.min_retrieval_hit_rate,
    );
    const minContextBudgetUtilization = Number(
      config.min_context_budget_utilization ?? DEFAULT_CONFIG.min_context_budget_utilization,
    );

    let retrievalPassed = governance.retrieval_passed;
    if (retrievalPassed == null) {
      const hitRate = governance.retrieval_hit_rate;
      retrievalPassed = hitRate == null ? true : hitRate >= minRetrievalHitRate;
    }

    let budgetPassed = governance.budget_passed;
    if (budgetPassed == null) {
      const utilization = governance.context_budget_utilization;
      budgetPassed = utilization == null ? true : utilization >= minContextBudgetUtilization;
    }

    return Boolean(retrievalPassed && budgetPassed);
  }
}

// Auto-register novel adapter
AdapterRegistry.registerAdapter('novel', NovelAdapter, ['memory-aware', 'strict-governance', 'cli-exposed']);
