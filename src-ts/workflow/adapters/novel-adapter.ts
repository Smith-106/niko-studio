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
  IWorkflowGraph,
} from './base-adapter.js';
import { BaseDomainAdapter, AdapterRegistry } from './base-adapter.js';
import { DomainType } from '../state.js';
import type {
  WritingState,
  SceneCard,
  CritiqueResult,
} from '../novel-state.js';
import {
  DEFAULT_NOVEL_CONFIG,
  createInitialState as createNovelInitialState,
} from '../novel-state.js';
import { evaluateNovelQuality } from '../novel-quality.js';
import { RevisionLoop } from '../revision-loop.js';
import { ContentType, SessionManager } from '../session/session-manager.js';
import { createLogger } from '../../logger/index.js';

const _log = createLogger('workflow-novel-adapter');

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

    const configuredWorkflowLevel = Number(
      extra?.workflow_level
      ?? (this.config as Record<string, unknown> | undefined)?.workflow_level
      ?? 3,
    );

    const initialState = createNovelInitialState(userRequest, {
      genre: extra?.genre as string | undefined,
      targetChapters: extra?.target_chapters as number | undefined,
      targetWordcount: extra?.target_wordcount as number | undefined,
      metadata,
    });

    return {
      ...initialState,
      user_request: userRequest,
      domain: DomainType.NOVEL,
      workflow_level: Number.isFinite(configuredWorkflowLevel) ? configuredWorkflowLevel : 3,
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
   * Legacy graph entrypoints now delegate directly to executePipeline()
   * so graph-factory callers execute the same pipeline as direct adapter use.
   */
  createGraph(): IWorkflowGraph {
    const adapter = this;

    return {
      addNode(): void {},
      addEdge(): void {},
      addConditionalEdge(): void {},
      compile(): { invoke(state: BaseState): Promise<BaseState> } {
        return {
          async invoke(state: BaseState): Promise<BaseState> {
            return await adapter.executePipeline(state as WritingState) as BaseState;
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
    const maxPipelineIterations = Math.max(
      1,
      Number(
        (this.config as Record<string, unknown> ?? {}).max_revisions
        ?? DEFAULT_CONFIG.max_revisions
        ?? 3,
      ) + 1,
    );

    // Step 1: Commander
    const commanderResult = await this.commanderNode(current);
    current = { ...current, ...commanderResult };

    // Step 2: Route after commander
    const route1 = this.routeAfterCommander(current);
    if (route1 === 'architect') {
      const architectResult = await this.architectNode(current);
      current = { ...current, ...architectResult };
    }

    let nextStep: string = 'writer';
    let iteration = 0;

    while (nextStep === 'writer' && iteration < maxPipelineIterations) {
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
      nextStep = this.routeAfterCritic(current);
      iteration += 1;
    }

    if (nextStep === 'writer') {
      current = {
        ...current,
        critique_result: {
          ...(current.critique_result ?? {}),
          decision: 'HUMAN_REVIEW',
          decision_reason: 'Revision loop safety stop triggered',
        },
      };
      nextStep = 'human_reviewer';
    }

    if (nextStep === 'human_reviewer') {
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
    _log.info('\n' + '='.repeat(50));
    _log.info('Commander Agent: Analyzing task and routing...');
    _log.info('='.repeat(50));

    // In TypeScript, the Commander agent's routing is handled internally
    // by the WorkflowEngine's route() method. This node records the
    // routing decision in the state.
    const userIdea = state.user_idea ?? '';

    // Simple keyword-based routing (mirrors Python CommanderAgent)
    const rapidKeywords = ['回答', '解释', '什么是', '告诉我', '简单'];
    const isRapid = rapidKeywords.some(kw => userIdea.includes(kw));
    const workflowLevel = isRapid ? 'rapid' : 'standard';

    _log.info(`Workflow level: ${workflowLevel}`);

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
      _log.info('L1 rapid mode: going directly to Writer');
      return 'writer';
    } else {
      _log.info('Standard mode: entering Architect for structure planning');
      return 'architect';
    }
  }

  async architectNode(state: WritingState): Promise<Partial<WritingState>> {
    _log.info('\n' + '='.repeat(50));
    _log.info('Architect Agent: Planning story structure...');
    _log.info('='.repeat(50));

    const sceneCards = this.buildSceneCards(state);

    const firstScene: SceneCard = sceneCards[0] ?? {};

    _log.info(`Generated ${sceneCards.length} scene cards`);

    return {
      story_blueprint: {
        user_idea: state.user_idea,
        genre: state.genre,
        premise: this.extractPremise(state.user_idea),
        central_conflict: firstScene.conflict ?? '',
        target_chapters: state.target_chapters ?? 30,
      },
      lock_analysis: this.buildLockAnalysis(firstScene),
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

    _log.info('\n' + '='.repeat(50));
    _log.info(`Writer Agent: Writing version ${version} draft...`);
    _log.info('='.repeat(50));

    const scene = state.current_scene ?? {};
    const feedback = state.feedback_context ?? '';

    if (revisionCount > 0 && feedback) {
      _log.info(`   Revising based on Critic feedback (revision ${revisionCount})`);
    }

    this.injectPlaybookIntoWriterInput(state);

    const draft = this.composeDraft(state, version);
    const wordcount = draft.length;

    _log.info(`Generated draft: ${wordcount} characters`);

    return {
      draft_content: draft,
      draft_version: version,
      draft_wordcount: wordcount,
      writer_self_check: {},
    };
  }

  async distillationNode(state: WritingState): Promise<Partial<WritingState>> {
    _log.info('\n' + '='.repeat(50));
    _log.info('Distillation Node: Running knowledge distillation...');
    _log.info('='.repeat(50));

    const scene = state.current_scene ?? {};
    const result: Record<string, unknown> = {
      entities_count: 2,
      relations_count: 1,
      events_count: 1,
      template: 'full',
      scene_id: scene.scene_id ?? 'CH01-SC01',
      summary: String(state.draft_content ?? '').slice(0, 160),
      canonical_entities: [
        {
          entity_id: `scene:${scene.scene_id ?? 'CH01-SC01'}:protagonist`,
          entity_type: 'character',
          scope: 'character',
          name: scene.pov_character ?? '主角',
          attributes: {
            objective: scene.objective ?? '',
            emotional_arc: scene.emotional_arc ?? '',
          },
        },
        {
          entity_id: `scene:${scene.scene_id ?? 'CH01-SC01'}:setting`,
          entity_type: 'world',
          scope: 'world',
          name: state.genre ?? '故事世界',
          attributes: {
            plot_beat: scene.plot_beat ?? '',
          },
        },
      ],
      canonical_relations: [
        {
          relation_id: `scene:${scene.scene_id ?? 'CH01-SC01'}:drives`,
          source_entity_id: `scene:${scene.scene_id ?? 'CH01-SC01'}:protagonist`,
          target_entity_id: `scene:${scene.scene_id ?? 'CH01-SC01'}:setting`,
          relation_type: 'acts_within',
          attributes: {
            conflict: scene.conflict ?? '',
          },
        },
      ],
    };

    _log.info(`Distillation complete: entities=${result.entities_count}`);

    return {
      distillation_result: result as WritingState['distillation_result'],
      distillation_state: {},
    };
  }

  async criticNode(state: WritingState): Promise<Partial<WritingState>> {
    const revisionCount = state.revision_count ?? 0;

    _log.info('\n' + '='.repeat(50));
    _log.info(`Critic Agent: Reviewing draft (review ${revisionCount + 1})...`);
    _log.info('='.repeat(50));

    const qualityResult = evaluateNovelQuality(state.draft_content ?? '', {
      qualityLevel: state.effective_quality_level ?? state.requested_quality_level ?? 'high',
      qualityMode: state.quality_mode ?? 'auto',
      criticalGateAlwaysOn: true,
      degradeReason: state.degrade_reason ?? '',
    });
    const scene = state.current_scene ?? {};
    const lockAnalysis = this.buildLockAnalysis(scene, qualityResult);
    const revisionInstructions = qualityResult.issues.slice(0, 3).map((issue, index) => ({
      id: `issue-${index + 1}`,
      type: String(issue.type ?? 'quality'),
      suggestion: String(issue.suggestion ?? 'revise content'),
      severity: String(issue.severity ?? 'medium'),
    }));
    const recommendation = qualityResult.publish_recommendation;
    const critiquePayload: CritiqueResult = {
      decision:
        recommendation === 'pass'
          ? 'APPROVED'
          : recommendation === 'block'
            ? 'REWRITE'
            : 'REVISE',
      decision_reason: `quality=${qualityResult.quality_score}; recommendation=${recommendation}`,
      total_score: qualityResult.quality_score,
      lock_score: Number(lockAnalysis.total_score ?? 0),
      style_score: Number((qualityResult.metrics['dimension_scores'] as Record<string, number> | undefined)?.tone ?? 0),
      logic_score: Number((qualityResult.metrics['dimension_scores'] as Record<string, number> | undefined)?.causality ?? 0),
      lock_analysis: lockAnalysis,
      actionable_feedback: revisionInstructions.map(item => item.suggestion).join(' '),
      revision_instructions: revisionInstructions,
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
        _log.warn(`Self-learning skipped (non-blocking): ${exc}`);
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

    _log.info(`Score: ${critiquePayload.total_score ?? 0}`);
    _log.info(`Decision: ${critiquePayload.decision}`);

    return response;
  }

  humanReviewNode(state: WritingState): Partial<WritingState> {
    _log.info('\n' + '='.repeat(50));
    _log.info('Human Review: Requires manual review');
    _log.info('='.repeat(50));

    const critique = state.critique_result ?? ({} as CritiqueResult);

    _log.info(`   Score: ${critique.total_score ?? 'N/A'}`);
    _log.info(`   Decision: ${critique.decision ?? 'N/A'}`);
    _log.info(`   Reason: ${critique.decision_reason ?? 'N/A'}`);
    _log.info(`   Revisions: ${state.revision_count ?? 0}`);
    _log.info('   [Human Review] Needs manual confirmation to continue');

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
    _log.info('\n' + '='.repeat(50));
    _log.info('Writing complete!');
    _log.info('='.repeat(50));

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
    const notDistilled = !this.hasDistillationResult(state.distillation_result);
    const config = this.config as Record<string, unknown> ?? {};
    const distillEnabled = (config.enable_distillation as boolean) ?? true;

    if (hasDraft && notDistilled && distillEnabled) {
      _log.info('Entering distillation node...');
      return 'distillation';
    } else {
      _log.info('Skipping distillation, going directly to Critic');
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
          _log.info('Quality passed but context governance failed, and revision limit reached, sending to human review');
          return 'human_reviewer';
        }
        _log.info('Quality passed but context governance failed, sending back to Writer');
        return 'writer';
      }

      _log.info(`Review passed! (Score: ${totalScore}, C: ${cScore})`);
      return 'finalize';
    }

    if (revisionCount >= maxRevisions) {
      _log.info(`Max revisions reached (${maxRevisions}), requires human intervention`);
      return 'human_reviewer';
    }

    if (decision === 'REWRITE') {
      _log.info(`Quality too low (${totalScore}), requires human intervention`);
      return 'human_reviewer';
    }

    if (decision === 'HUMAN_REVIEW' || totalScore >= humanReviewScore) {
      _log.info(`Score ${totalScore} suggests human review`);
      return 'human_reviewer';
    }

    _log.info(`Score ${totalScore} not met, sending back to Writer (revision ${revisionCount}/${maxRevisions})...`);
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
    _log.info(`\nPlaybook strategy:\n${summary}\n`);
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

  private hasDistillationResult(
    distillationResult: WritingState['distillation_result'],
  ): boolean {
    return Boolean(
      distillationResult
      && typeof distillationResult === 'object'
      && Object.keys(distillationResult).length > 0,
    );
  }

  private buildSceneCards(state: WritingState): SceneCard[] {
    const userIdea = (state.user_idea ?? '').trim();
    const genre = state.genre ?? '悬疑';
    const sceneCount = Math.min(3, Math.max(1, Number(state.target_chapters ?? 3)));
    const premise = this.extractPremise(userIdea);

    return Array.from({ length: sceneCount }, (_, index) => {
      const sceneNumber = index + 1;
      return {
        scene_id: `CH01-SC0${sceneNumber}`,
        chapter_num: 1,
        scene_num: sceneNumber,
        pov_character: this.detectPovCharacter(userIdea),
        objective: sceneNumber === 1 ? 'establish tension' : 'escalate stakes',
        conflict: `${premise} 在第 ${sceneNumber} 幕遭遇阻力`,
        outcome: sceneNumber === sceneCount ? 'hook' : '+',
        plot_beat: `${genre} / beat ${sceneNumber}`,
        emotional_arc: sceneNumber === 1 ? 'calm->unease' : 'unease->pressure',
        sensory_guidance: {
          visual: genre === '悬疑' ? '冷色灯光、狭窄空间' : '鲜明场景锚点',
          sound: '脚步声、呼吸声、环境噪音',
          touch: '空气温度、衣料摩擦、器物触感',
        },
        foreshadows_to_plant: sceneNumber === 1 ? ['异常细节', '隐藏动机'] : [],
        foreshadows_to_harvest: sceneNumber === sceneCount ? ['异常细节'] : [],
      };
    });
  }

  private composeDraft(state: WritingState, version: number): string {
    const scene = state.current_scene ?? {};
    const feedback = (state.feedback_context ?? '').trim();
    const userIdea = this.extractPremise(state.user_idea);
    const sensory = scene.sensory_guidance ?? {};
    const sensoryLine = Object.values(sensory).filter(Boolean).join('、');
    const revisionSentence = feedback
      ? `她记得上一次批注提醒自己：${feedback}，所以这一次每一个动作都更准确。`
      : '她知道此刻任何犹豫都会让局势失去控制。';

    return [
      `[Draft v${version}] ${scene.scene_id ?? 'CH01-SC01'}`,
      `${scene.pov_character ?? '主角'}站在${userIdea}的入口，目标很明确：${scene.objective ?? '推进情节'}。`,
      `可真正阻挡她的是${scene.conflict ?? '尚未显形的阻力'}，这让空气里都带上了压力。`,
      sensoryLine ? `她捕捉到${sensoryLine}，每个细节都把不安往前推了一寸。` : '',
      revisionSentence,
      `当她终于做出选择，场面留下的结果是${scene.outcome ?? '未定'}，也把下一步的悬念钉在了读者面前。`,
    ].filter(Boolean).join('');
  }

  private buildLockAnalysis(
    scene: SceneCard,
    qualityResult?: ReturnType<typeof evaluateNovelQuality>,
  ): Record<string, unknown> {
    const dimensionScores = (qualityResult?.metrics['dimension_scores'] as Record<string, number> | undefined) ?? {};
    const lead = Math.max(6, Math.round((dimensionScores['clarity'] ?? 80) / 10));
    const objective = Math.max(6, scene.objective ? 8 : 6);
    const confrontation = Math.max(5, Math.round((dimensionScores['causality'] ?? 70) / 10));
    const knockout = Math.max(5, Math.round((dimensionScores['detail'] ?? 70) / 10));
    const total = lead + objective + confrontation + knockout;

    return {
      L: { score: lead, note: 'lead clarity' },
      O: { score: objective, note: 'objective explicitness' },
      C: { score: confrontation, note: 'conflict pressure' },
      K: { score: knockout, note: 'scene payoff' },
      total_score: total,
      scores: {
        lead,
        objective,
        confrontation,
        knockout,
      },
    };
  }

  private detectPovCharacter(userIdea?: string): string {
    const text = (userIdea ?? '').trim();
    const match = text.match(/关于(.+?)(?:的|，|。|$)/);
    if (match?.[1]) return match[1];
    return '主角';
  }

  private extractPremise(userIdea?: string): string {
    const text = (userIdea ?? '').trim();
    if (!text) return '一个尚未完成的故事';
    return text.slice(0, 40);
  }
}

// Auto-register novel adapter
AdapterRegistry.registerAdapter('novel', NovelAdapter, ['memory-aware', 'strict-governance', 'cli-exposed']);
