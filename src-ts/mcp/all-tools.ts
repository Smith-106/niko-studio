import type { NarrativeEngine } from '../services/narrative-engine'
import type { KnowledgeBridgeV2 } from '../services/knowledge-bridge-v2'
import type { NarrativeAnalyzer } from '../services/narrative-analyzer'
import type { NarrativeBrainstorm } from '../services/narrative-brainstorm'
import type { AdversarialScorer } from '../services/adversarial-scorer'
import type { QualityGateLoop, GateLevel } from '../services/quality-gate-loop'
import type { NarrativeAgent } from '../services/narrative-agent'
import { registerNarrativeTools } from './narrative-tools'

export interface NarrativeServices {
  engine: NarrativeEngine
  bridge: KnowledgeBridgeV2
  analyzer: NarrativeAnalyzer
  brainstorm: NarrativeBrainstorm
  adversarialScorer: AdversarialScorer
  qualityGate: QualityGateLoop
  agent: NarrativeAgent
}

export function createMCPTools(services: NarrativeServices) {
  const baseTools = registerNarrativeTools(services.engine, services.bridge, services.analyzer)

  return {
    ...baseTools,

    // === 多Agent头脑风暴 ===
    'brainstorm.analyze_roles': async (params: { text: string }) => {
      return services.brainstorm.analyzeWithRoles(params.text)
    },

    'brainstorm.cross_review': async (params: { text: string }) => {
      const analyses = services.brainstorm.analyzeWithRoles(params.text)
      return services.brainstorm.crossReview(analyses)
    },

    // === 对抗评分 ===
    'adversarial.score': async (params: { text: string; maxIterations?: number }) => {
      return services.adversarialScorer.score(params.text, { maxIterations: params.maxIterations })
    },

    // === 质量门禁 ===
    'quality.evaluate': async (params: { text: string; level?: GateLevel }) => {
      return services.qualityGate.evaluate(params.text, params.level ?? 'standard')
    },

    'quality.revision_loop': async (params: { text: string; level?: GateLevel; revisions: string[] }) => {
      let current = params.text
      const reviseFn = async (_t: string, _report: any) => {
        const next = params.revisions.shift()
        return next ?? _t
      }
      return services.qualityGate.revisionLoop(current, params.level ?? 'standard', reviseFn)
    },

    'quality.quick_scan': async (params: { text: string }) => {
      return services.qualityGate.quickScan(params.text)
    },

    // === 写作Agent ===
    'agent.suggest_plot': async (params: { action: string; chapter: number }) => {
      return services.agent.suggestPlot(params.action, params.chapter)
    },

    'agent.check_continuity': async (params: { chapter: number }) => {
      return services.agent.checkContinuity(params.chapter)
    },

    'agent.writing_context': async (params: { chapter: number; lastText?: string }) => {
      return services.agent.getWritingContext(params.chapter, params.lastText)
    },
  }
}

export type AllMCPTools = ReturnType<typeof createMCPTools>
