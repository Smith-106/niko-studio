import { describe, expect, it } from 'vitest';

import {
  LearningCapability,
  PipelineStatus,
  ExtractionTier,
  type ReadingSession,
  type StyleFeatureVector,
} from '../../learning/learning-types';
import {
  extractEntities,
  calculateStyleFeatures,
  detectWorldviewElements,
  extractBasicInsights,
  parseDocument,
  segmentText,
} from '../../learning/extraction-utils';
import { determineExtractionTier } from '../../learning/spoiler-gate';
import { distillInsights } from '../../learning/insight-distiller';
import { RuleEvolver } from '../../learning/rule-evolver';
import { PreferenceTracker } from '../../learning/preference-tracker';
import { LearningOrchestrator } from '../../learning/learning-orchestrator';
import { ImportLearningPipeline } from '../../learning/import-pipeline';
import { SelfEvolvingAgent } from '../../learning/self-evolving-agent';
import { ReadingLearningPipeline } from '../../learning/reading-pipeline';

const SAMPLE_TEXT = `在遥远的东方，有一座被云雾缭绕的古城。城中最有名的剑客林风，手持一柄名为"破晓"的长剑，行走江湖已有十年。

林风的师父曾告诉他："真正的剑道，不在于剑本身，而在于心中那份对正义的执着。"这句话，他始终铭记于心。

古城的夜晚总是很安静，只有偶尔传来的更夫梆子声。林风站在城墙上，望着远方的星空，心中充满了对未来的期待。`;

function makeOrchestrator(): LearningOrchestrator {
  const ks = { addEntity: async () => {}, addDocument: async () => {} } as any;
  const ge = { addRelationship: async () => {} } as any;
  const orchestrator = new LearningOrchestrator({
    knowledgeService: ks,
    graphEngine: ge,
  });
  orchestrator.registerPipeline(new ImportLearningPipeline({ knowledgeService: ks, graphEngine: ge }));
  orchestrator.registerPipeline(new SelfEvolvingAgent({
    ruleEvolver: new RuleEvolver(),
    preferenceTracker: new PreferenceTracker(),
  }));
  orchestrator.registerPipeline(new ReadingLearningPipeline({ knowledgeService: ks, graphEngine: ge }));
  return orchestrator;
}

describe('Learning Integration', () => {
  describe('CAP-001: Import Learning pipeline utilities', () => {
    it('calculates style features', () => {
      const features = calculateStyleFeatures(SAMPLE_TEXT);
      expect(features.dimensions).toBeDefined();
      expect(Object.keys(features.dimensions).length).toBeGreaterThan(0);
    });

    it('detects worldview elements', () => {
      const elements = detectWorldviewElements(SAMPLE_TEXT);
      expect(Array.isArray(elements)).toBe(true);
      for (const el of elements) {
        expect(el.category).toBeTruthy();
        expect(el.description).toBeTruthy();
      }
    });

    it('extracts basic insights', () => {
      const insights = extractBasicInsights(SAMPLE_TEXT, 'test-book', 'ch1');
      expect(Array.isArray(insights)).toBe(true);
      for (const insight of insights) {
        expect(insight.content).toBeTruthy();
        expect(insight.source).toBe('test-book');
      }
    });

    it('parses and segments document', () => {
      const doc = parseDocument(SAMPLE_TEXT, 'txt');
      expect(doc.length).toBeGreaterThan(0);

      const segments = segmentText(SAMPLE_TEXT, 'paragraph');
      expect(segments.length).toBeGreaterThan(0);
      for (const seg of segments) {
        expect(seg.content).toBeTruthy();
      }
    });
  });

  describe('CAP-002: Self-Evolving Writing components', () => {
    it('PreferenceTracker records and aggregates feedback', () => {
      const tracker = new PreferenceTracker();

      tracker.recordFeedback({
        dimension: 'vocabulary_richness',
        action: 'accept',
        value: 0.8,
        timestamp: new Date().toISOString(),
        source: 'test',
      });
      tracker.recordFeedback({
        dimension: 'vocabulary_richness',
        action: 'reject',
        value: 0.3,
        timestamp: new Date().toISOString(),
        source: 'test',
      });
      tracker.recordFeedback({
        dimension: 'dialogue_ratio',
        action: 'accept',
        value: 0.6,
        timestamp: new Date().toISOString(),
        source: 'test',
      });

      expect(tracker.getSignalCount()).toBe(3);

      const profile = tracker.getPreferenceProfile();
      expect(profile.vocabulary_richness).toBeDefined();
      expect(profile.vocabulary_richness.accept).toBe(1);
      expect(profile.vocabulary_richness.reject).toBe(1);
      expect(profile.dialogue_ratio.accept).toBe(1);
    });

    it('RuleEvolver evolves rules from accumulated evidence', () => {
      const evolver = new RuleEvolver({ evidenceThreshold: 3 });

      for (let i = 0; i < 3; i++) {
        evolver.addEvidence({
          dimension: 'vocabulary_richness',
          action: 'accept',
          value: 0.7 + i * 0.05,
          timestamp: new Date().toISOString(),
          source: 'test',
        });
      }

      const rules = evolver.getActiveRules();
      expect(rules.length).toBe(1);
      expect(rules[0].dimensions.vocabulary_richness).toBeCloseTo(0.75, 1);
    });

    it('RuleEvolver detects style drift', () => {
      const evolver = new RuleEvolver({ evidenceThreshold: 2, driftThreshold: 0.3 });

      for (let i = 0; i < 2; i++) {
        evolver.addEvidence({
          dimension: 'vocabulary_richness',
          action: 'accept',
          value: 0.8,
          timestamp: new Date().toISOString(),
          source: 'test',
        });
      }

      const vector: StyleFeatureVector = {
        dimensions: { vocabulary_richness: 0.2 },
        summary: 'test',
        confidence: 0.5,
      };

      const report = evolver.detectDrift(vector);
      expect(report.severity).toBe('high');
      expect(report.overallDrift).toBeGreaterThan(0.3);
      expect(report.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('CAP-003: Reading Learning components', () => {
    it('determines extraction tier based on reading progress', () => {
      const earlySession: ReadingSession = {
        bookId: 'book-1',
        currentChapter: 2,
        totalChapters: 50,
        lastPosition: '',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const early = determineExtractionTier(earlySession);
      expect(early.tier).toBe(ExtractionTier.BLOCKED);

      const midSession: ReadingSession = {
        bookId: 'book-1',
        currentChapter: 20,
        totalChapters: 50,
        lastPosition: '',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const mid = determineExtractionTier(midSession);
      expect(mid.tier).toBe(ExtractionTier.LIGHT);
      expect(mid.allowedCategories).toContain('character');

      const lateSession: ReadingSession = {
        bookId: 'book-1',
        currentChapter: 45,
        totalChapters: 50,
        lastPosition: '',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const late = determineExtractionTier(lateSession);
      expect(late.tier).toBe(ExtractionTier.HEAVY);
      expect(late.allowedCategories).toContain('event');
    });

    it('distills insights through 6-stage pipeline', () => {
      const rawInsights = extractBasicInsights(SAMPLE_TEXT, 'test-book', 'ch1');
      const distilled = distillInsights(rawInsights);

      const stages = ['capture', 'annotate', 'connect', 'question', 'synthesize', 'distill'];
      for (const stage of stages) {
        const stageResults = distilled.filter(d => d.stage === stage);
        expect(stageResults.length).toBeGreaterThan(0);
      }

      // Each raw insight produces 6 distilled insights
      expect(distilled.length).toBe(rawInsights.length * 6);
    });
  });

  describe('LearningOrchestrator', () => {
    it('registers and retrieves pipelines by capability', () => {
      const orchestrator = makeOrchestrator();

      const importPipeline = orchestrator.getPipeline(LearningCapability.IMPORT);
      const selfEvolving = orchestrator.getPipeline(LearningCapability.SELF_EVOLVING);
      const reading = orchestrator.getPipeline(LearningCapability.READING);

      expect(importPipeline).toBeDefined();
      expect(selfEvolving).toBeDefined();
      expect(reading).toBeDefined();
    });

    it('provides status for all pipelines', () => {
      const orchestrator = makeOrchestrator();

      const status = orchestrator.getStatus();
      expect(status[LearningCapability.IMPORT]).toBeDefined();
      expect(status[LearningCapability.SELF_EVOLVING]).toBeDefined();
      expect(status[LearningCapability.READING]).toBeDefined();
      expect(status[LearningCapability.IMPORT]!.status).toBe(PipelineStatus.IDLE);

      const summary = orchestrator.getStatusSummary();
      expect(summary.totalPipelines).toBe(3);
      expect(summary.activePipelines).toBe(3);
    });

    it('enables and disables pipelines', () => {
      const orchestrator = makeOrchestrator();

      expect(orchestrator.isEnabled(LearningCapability.IMPORT)).toBe(true);
      orchestrator.disable(LearningCapability.IMPORT);
      expect(orchestrator.isEnabled(LearningCapability.IMPORT)).toBe(false);
      orchestrator.enable(LearningCapability.IMPORT);
      expect(orchestrator.isEnabled(LearningCapability.IMPORT)).toBe(true);
    });
  });
});
