/**
 * Scene Coherence Detector
 *
 * Core features:
 * 1. Timeline contradiction detection
 * 2. Location contradiction detection
 * 3. State contradiction detection
 * 4. Cross-scene consistency validation
 *
 * Detection dimensions:
 * - Timeline: chronological order, duration, concurrent events
 * - Location: transitions, distance plausibility, environment consistency
 * - State: character state, object state, environment state
 * - Causality: cause-effect, event chains
 */

import type { INarrativeLLMClient } from './types.js';

// ============================================================
// Enums (LOCAL to scene-coherence)
// ============================================================

export enum ContradictionType {
  TIMELINE = 'timeline',
  LOCATION = 'location',
  CHARACTER_STATE = 'char_state',
  OBJECT_STATE = 'obj_state',
  ENVIRONMENT = 'environment',
  CAUSALITY = 'causality',
  KNOWLEDGE = 'knowledge',
  PHYSICS = 'physics',
}

/** Severity level - LOCAL to scene_coherence, distinct from evaluators/base */
export enum SceneSeverity {
  CRITICAL = 'critical',
  MAJOR = 'major',
  MINOR = 'minor',
  INFO = 'info',
}

export enum TimeUnit {
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

// ============================================================
// Data Types
// ============================================================

export interface TimeMarker {
  sceneId: string;
  timestamp: string | null;
  relativeTime: string | null;
  timeOfDay: string | null;
  duration: string | null;
  order: number;
}

export interface LocationMarker {
  sceneId: string;
  locationName: string;
  locationType: string;
  parentLocation: string;
  coordinates: [number, number] | null;
  travelTimeFromPrev: string | null;
}

export interface StateSnapshot {
  sceneId: string;
  entityId: string;
  entityType: string;
  entityName: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

export interface Contradiction {
  id: string;
  type: ContradictionType;
  severity: SceneSeverity;
  description: string;
  sceneA: string;
  sceneB: string;
  entityInvolved: string;
  expectedValue: string;
  actualValue: string;
  contextA: string;
  contextB: string;
  suggestion: string;
  detectedAt: string;
}

export interface Scene {
  id: string;
  title: string;
  content: string;
  order: number;
  timeMarker: TimeMarker | null;
  locationMarker: LocationMarker | null;
  stateSnapshots: StateSnapshot[];
  characters: string[];
  objects: string[];
  events: string[];
  chapter: string;
  createdAt: string;
}

export interface CoherenceReport {
  totalScenes: number;
  totalContradictions: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  infoCount: number;
  contradictions: Contradiction[];
  timelineIssues: Contradiction[];
  locationIssues: Contradiction[];
  stateIssues: Contradiction[];
  coherenceScore: number;
  summary: string;
  generatedAt: string;
}

// ============================================================
// Time keywords dictionary
// ============================================================

const TIME_KEYWORDS: Record<string, string[]> = {
  morning: ['\u65E9\u4E0A', '\u65E9\u6668', '\u6E05\u6668', '\u4E0A\u5348', 'dawn', 'morning'],
  afternoon: ['\u4E0B\u5348', '\u5348\u540E', 'afternoon'],
  evening: ['\u508D\u665A', '\u9EC4\u660F', 'evening', 'dusk'],
  night: ['\u591C\u665A', '\u6DF1\u591C', '\u665A\u4E0A', 'night', 'midnight'],
};

// State conflict patterns: [precondition, impossible action]
const STATE_CONFLICT_PATTERNS: [RegExp, RegExp][] = [
  [/\u6B7B\u4EA1|\u6B7B\u53BB|\u53BB\u4E16|\u8EAB\u4EA1|\u4E27\u547D|\u6BD9\u547D/, /\u8BF4\u9053|\u8BF4|\u505A|\u884C\u52A8|\u8D70|\u8DD1|\u7AD9|\u5750/],
  [/\u79BB\u5F00|\u79BB\u53BB|\u8D70\u4E86|\u8D70\u5F00/, /\u5728\u573A|\u51FA\u73B0|\u7AD9\u5728|\u5750\u5728/],
  [/\u5931\u53BB|\u4E22\u5931|\u5F04\u4E22|\u9057\u5931/, /\u4F7F\u7528|\u62FF\u7740|\u63E1\u7740|\u6301\u6709|\u6325\u821E/],
  [/\u660F\u8FF7|\u6655\u5012|\u5931\u53BB\u610F\u8BC6/, /\u8BF4|\u770B|\u542C|\u8D70|\u7AD9/],
  [/\u9501\u4E0A|\u9501\u4F4F|\u5C01\u95ED/, /\u6253\u5F00|\u8FDB\u5165|\u8D70\u8FDB/],
  [/\u50AC\u6BC1|\u6BC1\u574F|\u7834\u574F|\u7838\u788E/, /\u4F7F\u7528|\u62FF\u8D77|\u5B8C\u597D/],
];

const CAUSE_KEYWORDS = [
  '\u56E0\u4E3A', '\u7531\u4E8E', '\u65E2\u7136', '\u9274\u4E8E', '\u6B63\u56E0\u4E3A',
  '\u4E4B\u6240\u4EE5', '\u7F18\u4E8E', '\u6E90\u4E8E', '\u5F52\u56E0\u4E8E',
  'because', 'since', 'as', 'due to',
];

const EFFECT_KEYWORDS = [
  '\u6240\u4EE5', '\u56E0\u6B64', '\u4E8E\u662F', '\u5BFC\u81F4', '\u81F4\u4F7F',
  '\u7ED3\u679C', '\u4ECE\u800C', '\u4EE5\u81F4\u4E8E', '\u6545\u800C', '\u9042',
  'therefore', 'thus', 'hence', 'so',
];

const EVENT_DEPENDENCIES: [RegExp, RegExp][] = [
  [/\u51FA\u751F|\u8BDE\u751F/, /\u6B7B\u4EA1|\u53BB\u4E16/],
  [/\u7ED3\u5A5A|\u6210\u5A5A/, /\u79BB\u5A5A/],
  [/\u8D2D\u4E70|\u4E70\u4E0B/, /\u5356\u51FA|\u552E\u51FA/],
  [/\u5F00\u59CB|\u542F\u52A8/, /\u7ED3\u675F|\u5B8C\u6210/],
  [/\u5230\u8FBE|\u62B5\u8FBE/, /\u79BB\u5F00|\u51FA\u53D1/],
];

const DAY_CHANGE_PATTERNS = [
  /\u7B2C\u4E8C\u5929/, /\u6B21\u65E5/, /\u7FCA\u65E5/, /\u9694\u5929/,
  /\u51E0\u5929\u540E/, /\u4E00\u5468\u540E/, /\u6570\u65E5\u540E/,
  /\u8FC7\u4E86.*\u5929/, /.*\u5929\u4E4B?\u540E/,
  /next day/, /the following day/,
];

const PERIOD_PATTERNS: Record<string, RegExp[]> = {
  morning: [/\u65E9\u4E0A/, /\u65E9\u6668/, /\u6E05\u6668/, /\u4E0A\u5348/, /\u51CC\u6668/],
  afternoon: [/\u4E0B\u5348/, /\u5348\u540E/, /\u4E2D\u5348/],
  evening: [/\u508D\u665A/, /\u9EC4\u660F/, /\u65E5\u843D/],
  night: [/\u591C\u665A/, /\u6DF1\u591C/, /\u665A\u4E0A/, /\u591C\u91CC/, /\u534A\u591C/],
};

// ============================================================
// SceneCoherenceDetector
// ============================================================

export class SceneCoherenceDetector {
  private llmClient: INarrativeLLMClient | null;
  private scenes: Map<string, Scene> = new Map();
  private stateRegistry: Map<string, StateSnapshot[]> = new Map();
  private contradictions: Contradiction[] = [];
  private contradictionCounter = 0;
  private locationGraph: Map<string, Map<string, string>> = new Map();

  constructor(llmClient?: INarrativeLLMClient) {
    this.llmClient = llmClient ?? null;
  }

  // ========================================
  // Scene Management
  // ========================================

  addScene(scene: Scene): void {
    this.scenes.set(scene.id, scene);
  }

  createScene(
    sceneId: string,
    title: string,
    content: string,
    order: number,
    timeInfo?: { relativeTime?: string; timeOfDay?: string; duration?: string },
    locationInfo?: { name?: string; type?: string; parent?: string; travelTimeFromPrev?: string },
    characters?: string[],
    objects?: string[],
  ): Scene {
    const scene: Scene = {
      id: sceneId,
      title,
      content,
      order,
      timeMarker: null,
      locationMarker: null,
      stateSnapshots: [],
      characters: characters ?? [],
      objects: objects ?? [],
      events: [],
      chapter: '',
      createdAt: new Date().toISOString(),
    };

    if (timeInfo) {
      scene.timeMarker = {
        sceneId,
        timestamp: null,
        relativeTime: timeInfo.relativeTime ?? null,
        timeOfDay: timeInfo.timeOfDay ?? null,
        duration: timeInfo.duration ?? null,
        order,
      };
    }

    if (locationInfo) {
      scene.locationMarker = {
        sceneId,
        locationName: locationInfo.name ?? '',
        locationType: locationInfo.type ?? '',
        parentLocation: locationInfo.parent ?? '',
        coordinates: null,
        travelTimeFromPrev: locationInfo.travelTimeFromPrev ?? null,
      };
    }

    this.addScene(scene);
    return scene;
  }

  getScene(sceneId: string): Scene | undefined {
    return this.scenes.get(sceneId);
  }

  getOrderedScenes(): Scene[] {
    return [...this.scenes.values()].sort((a, b) => a.order - b.order);
  }

  // ========================================
  // State Tracking
  // ========================================

  recordState(
    sceneId: string,
    entityId: string,
    entityType: string,
    entityName: string,
    properties: Record<string, unknown>,
  ): StateSnapshot {
    const snapshot: StateSnapshot = {
      sceneId,
      entityId,
      entityType,
      entityName,
      properties,
      timestamp: new Date().toISOString(),
    };

    const existing = this.stateRegistry.get(entityId) ?? [];
    existing.push(snapshot);
    this.stateRegistry.set(entityId, existing);

    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.stateSnapshots.push(snapshot);
    }

    return snapshot;
  }

  getEntityStates(entityId: string): StateSnapshot[] {
    return this.stateRegistry.get(entityId) ?? [];
  }

  // ========================================
  // Location Graph
  // ========================================

  setTravelTime(
    locationA: string,
    locationB: string,
    travelTime: string,
    bidirectional = true,
  ): void {
    if (!this.locationGraph.has(locationA)) {
      this.locationGraph.set(locationA, new Map());
    }
    this.locationGraph.get(locationA)!.set(locationB, travelTime);

    if (bidirectional) {
      if (!this.locationGraph.has(locationB)) {
        this.locationGraph.set(locationB, new Map());
      }
      this.locationGraph.get(locationB)!.set(locationA, travelTime);
    }
  }

  getTravelTime(locationA: string, locationB: string): string | null {
    return this.locationGraph.get(locationA)?.get(locationB) ?? null;
  }

  // ========================================
  // Contradiction Detection
  // ========================================

  private generateContradictionId(): string {
    this.contradictionCounter++;
    return `CTD-${String(this.contradictionCounter).padStart(4, '0')}`;
  }

  detectAll(): CoherenceReport {
    this.contradictions = [];

    const timelineIssues = this.detectTimelineContradictions();
    const locationIssues = this.detectLocationContradictions();
    const stateIssues = this.detectStateContradictions();
    const causalityIssues = this.detectCausalityContradictions();

    const allIssues = [
      ...timelineIssues,
      ...locationIssues,
      ...stateIssues,
      ...causalityIssues,
    ];
    this.contradictions = allIssues;

    const critical = allIssues.filter(
      (c) => c.severity === SceneSeverity.CRITICAL,
    ).length;
    const major = allIssues.filter(
      (c) => c.severity === SceneSeverity.MAJOR,
    ).length;
    const minor = allIssues.filter(
      (c) => c.severity === SceneSeverity.MINOR,
    ).length;
    const info = allIssues.filter(
      (c) => c.severity === SceneSeverity.INFO,
    ).length;

    const score = this.calculateCoherenceScore(critical, major, minor, info);
    const summary = this.generateSummary(allIssues, score);

    return {
      totalScenes: this.scenes.size,
      totalContradictions: allIssues.length,
      criticalCount: critical,
      majorCount: major,
      minorCount: minor,
      infoCount: info,
      contradictions: allIssues,
      timelineIssues,
      locationIssues,
      stateIssues,
      coherenceScore: score,
      summary,
      generatedAt: new Date().toISOString(),
    };
  }

  detectTimelineContradictions(): Contradiction[] {
    const issues: Contradiction[] = [];
    const ordered = this.getOrderedScenes();

    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const curr = ordered[i];

      if (prev.timeMarker && curr.timeMarker) {
        const prevTime = prev.timeMarker;
        const currTime = curr.timeMarker;

        if (prevTime.timeOfDay && currTime.timeOfDay) {
          if (
            !this.isValidTimeProgression(
              prevTime.timeOfDay,
              currTime.timeOfDay,
            )
          ) {
            issues.push({
              id: this.generateContradictionId(),
              type: ContradictionType.TIMELINE,
              severity: SceneSeverity.MAJOR,
              description: `\u65F6\u6BB5\u8DF3\u8DC3\u4E0D\u5408\u7406: ${prevTime.timeOfDay} -> ${currTime.timeOfDay}`,
              sceneA: prev.id,
              sceneB: curr.id,
              entityInvolved: '',
              expectedValue: '\u5408\u7406\u7684\u65F6\u95F4\u8FC7\u6E21',
              actualValue: `${prevTime.timeOfDay} -> ${currTime.timeOfDay}`,
              contextA: '',
              contextB: '',
              suggestion: '\u68C0\u67E5\u65F6\u95F4\u6D41\u901D\u662F\u5426\u5408\u7406\uFF0C\u6216\u6DFB\u52A0\u8FC7\u6E21\u573A\u666F',
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }

      const timeContradiction = this.checkContentTimeContradiction(
        prev,
        curr,
      );
      if (timeContradiction) issues.push(timeContradiction);
    }

    return issues;
  }

  detectLocationContradictions(): Contradiction[] {
    const issues: Contradiction[] = [];
    const ordered = this.getOrderedScenes();

    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const curr = ordered[i];

      if (prev.locationMarker && curr.locationMarker) {
        const prevLoc = prev.locationMarker.locationName;
        const currLoc = curr.locationMarker.locationName;

        if (prevLoc !== currLoc) {
          const travelTime = this.getTravelTime(prevLoc, currLoc);
          if (travelTime && prev.timeMarker && curr.timeMarker) {
            const actualInterval =
              curr.locationMarker.travelTimeFromPrev ??
              prev.timeMarker.duration ??
              curr.timeMarker.relativeTime ??
              null;
            if (actualInterval && this.isTravelTimeInsufficient(actualInterval, travelTime)) {
              issues.push({
                id: this.generateContradictionId(),
                type: ContradictionType.LOCATION,
                severity: SceneSeverity.CRITICAL,
                description: `\u5730\u70B9\u4F20\u9001: \u4ECE${prevLoc}\u5230${currLoc}\u9700\u8981${travelTime}\uFF0C\u4F46\u573A\u666F\u95F4\u9694\u4E0D\u8DB3`,
                sceneA: prev.id,
                sceneB: curr.id,
                entityInvolved: '',
                expectedValue: `\u81F3\u5C11${travelTime}\u7684\u95F4\u9694`,
                actualValue: actualInterval,
                contextA: '',
                contextB: '',
                suggestion: '\u589E\u52A0\u8FC7\u6E21\u573A\u666F\u6216\u8C03\u6574\u65F6\u95F4\u7EBF',
                detectedAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    return issues;
  }

  detectStateContradictions(): Contradiction[] {
    const issues: Contradiction[] = [];

    for (const [entityId, snapshots] of this.stateRegistry) {
      if (snapshots.length < 2) continue;

      const sorted = [...snapshots].sort((a, b) => {
        const sceneA = this.scenes.get(a.sceneId);
        const sceneB = this.scenes.get(b.sceneId);
        return (sceneA?.order ?? 999) - (sceneB?.order ?? 999);
      });

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const issue = this.checkStateTransition(prev, curr);
        if (issue) issues.push(issue);
      }
    }

    return issues;
  }

  detectCausalityContradictions(): Contradiction[] {
    const issues: Contradiction[] = [];
    const ordered = this.getOrderedScenes();
    if (ordered.length < 2) return issues;

    // Check state conflict patterns
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const sceneA = ordered[i];
        const sceneB = ordered[j];

        for (const [preP, impossibleP] of STATE_CONFLICT_PATTERNS) {
          const preMatch = preP.exec(sceneA.content);
          if (!preMatch) continue;

          const entity = this.extractEntityNearMatch(
            sceneA.content,
            preMatch.index,
          );
          if (!entity) continue;

          if (sceneB.content.includes(entity)) {
            const entityContext = this.getEntityContext(
              sceneB.content,
              entity,
            );
            const actionMatch = impossibleP.exec(entityContext);
            if (actionMatch) {
              issues.push({
                id: this.generateContradictionId(),
                type: ContradictionType.CAUSALITY,
                severity: SceneSeverity.CRITICAL,
                description: `\u56E0\u679C\u77DB\u76FE: ${entity}\u5728\u573A\u666F${sceneA.order}\u4E2D"${preMatch[0]}"\uFF0C\u4F46\u5728\u573A\u666F${sceneB.order}\u4E2D"${actionMatch[0]}"`,
                sceneA: sceneA.id,
                sceneB: sceneB.id,
                entityInvolved: entity,
                expectedValue: `\u4E0D\u5E94\u51FA\u73B0: ${actionMatch[0]}`,
                actualValue: `\u51FA\u73B0\u4E86: ${actionMatch[0]}`,
                contextA: this.getContextAround(sceneA.content, preMatch.index),
                contextB: this.getContextAround(
                  sceneB.content,
                  sceneB.content.indexOf(actionMatch[0]),
                ),
                suggestion: `\u68C0\u67E5${entity}\u7684\u72B6\u6001\u53D8\u5316\u662F\u5426\u5408\u7406`,
                detectedAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    // Check event order contradictions
    const eventIssues = this.detectEventOrderContradictions(ordered);
    issues.push(...eventIssues);

    return issues;
  }

  // ========================================
  // Cross-Scene Validation
  // ========================================

  validateCharacterPresence(characterId: string): Contradiction[] {
    const issues: Contradiction[] = [];
    const states = this.getEntityStates(characterId);
    if (!states.length) return issues;

    const sorted = [...states].sort((a, b) => {
      const sceneA = this.scenes.get(a.sceneId);
      const sceneB = this.scenes.get(b.sceneId);
      return (sceneA?.order ?? 999) - (sceneB?.order ?? 999);
    });

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevScene = this.scenes.get(prev.sceneId);
      const currScene = this.scenes.get(curr.sceneId);
      if (!prevScene || !currScene) continue;

      if (prevScene.locationMarker && currScene.locationMarker) {
        if (
          prevScene.locationMarker.locationName !==
          currScene.locationMarker.locationName
        ) {
          const intermediateScenes = this.getOrderedScenes().filter(
            (s) => prevScene.order < s.order && s.order < currScene.order,
          );
          const charInIntermediate = intermediateScenes.some((s) =>
            s.characters.includes(characterId),
          );
          if (!charInIntermediate && intermediateScenes.length > 2) {
            issues.push({
              id: this.generateContradictionId(),
              type: ContradictionType.CHARACTER_STATE,
              severity: SceneSeverity.MINOR,
              description: `\u89D2\u8272${prev.entityName}\u5728\u591A\u4E2A\u573A\u666F\u4E2D\u7F3A\u5931\u540E\u7A81\u7136\u51FA\u73B0`,
              sceneA: prev.sceneId,
              sceneB: curr.sceneId,
              entityInvolved: prev.entityName,
              expectedValue: '',
              actualValue: '',
              contextA: '',
              contextB: '',
              suggestion:
                '\u8003\u8651\u6DFB\u52A0\u89D2\u8272\u5728\u4E2D\u95F4\u573A\u666F\u7684\u5B58\u5728\u6216\u89E3\u91CA\u5176\u884C\u8E2A',
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    return issues;
  }

  validateObjectTracking(objectId: string): Contradiction[] {
    const issues: Contradiction[] = [];
    const states = this.getEntityStates(objectId);
    if (!states.length) return issues;

    const sorted = [...states].sort((a, b) => {
      const sceneA = this.scenes.get(a.sceneId);
      const sceneB = this.scenes.get(b.sceneId);
      return (sceneA?.order ?? 999) - (sceneB?.order ?? 999);
    });

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevOwner = prev.properties['owner'] as string | undefined;
      const currOwner = curr.properties['owner'] as string | undefined;

      if (prevOwner && currOwner && prevOwner !== currOwner) {
        const prevScene = this.scenes.get(prev.sceneId);
        const currScene = this.scenes.get(curr.sceneId);
        if (prevScene && currScene) {
          const intermediate = this.getOrderedScenes().filter(
            (s) => prevScene.order < s.order && s.order < currScene.order,
          );
          const transferFound = intermediate.some((s) =>
            s.events.some(
              (e) =>
                e.includes('\u8F6C\u4EA4') ||
                e.includes('\u7ED9') ||
                e.includes('\u4EA4\u7ED9'),
            ),
          );
          if (!transferFound) {
            issues.push({
              id: this.generateContradictionId(),
              type: ContradictionType.OBJECT_STATE,
              severity: SceneSeverity.MAJOR,
              description: `\u7269\u54C1${prev.entityName}\u6240\u6709\u6743\u4ECE${prevOwner}\u53D8\u4E3A${currOwner}\uFF0C\u4F46\u65E0\u8F6C\u79FB\u573A\u666F`,
              sceneA: prev.sceneId,
              sceneB: curr.sceneId,
              entityInvolved: prev.entityName,
              expectedValue: '\u6240\u6709\u6743\u8F6C\u79FB\u4E8B\u4EF6',
              actualValue: '\u65E0\u8F6C\u79FB\u8BB0\u5F55',
              contextA: '',
              contextB: '',
              suggestion: '\u6DFB\u52A0\u7269\u54C1\u8F6C\u79FB\u7684\u573A\u666F\u6216\u4E8B\u4EF6',
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    return issues;
  }

  // ========================================
  // LLM-Assisted Detection
  // ========================================

  async deepAnalysis(
    sceneIds?: string[],
  ): Promise<Record<string, unknown>> {
    if (!this.llmClient) return this.mockDeepAnalysis();

    const ids = sceneIds ?? [...this.scenes.keys()];
    const scenesToAnalyze = ids
      .map((sid) => this.scenes.get(sid))
      .filter((s): s is Scene => s !== undefined);

    if (!scenesToAnalyze.length) {
      return { error: 'No scenes to analyze' };
    }

    const scenesContent = scenesToAnalyze
      .sort((a, b) => a.order - b.order)
      .map((s) => `\u573A\u666F${s.order}: ${s.title}\n${s.content.slice(0, 1000)}`)
      .join('\n\n---\n\n');

    const prompt = `\u8BF7\u5206\u6790\u4EE5\u4E0B\u573A\u666F\u5E8F\u5217\uFF0C\u68C0\u6D4B\u4EFB\u4F55\u53EF\u80FD\u7684\u77DB\u76FE\u6216\u4E0D\u4E00\u81F4\u3002\n\n\u573A\u666F\u5185\u5BB9:\n${scenesContent}`;

    return this.llmClient.generateJson<Record<string, unknown>>(prompt);
  }

  // ========================================
  // Export
  // ========================================

  exportData(): Record<string, unknown> {
    return {
      scenes: Object.fromEntries(this.scenes),
      stateRegistry: Object.fromEntries(this.stateRegistry),
      contradictions: this.contradictions,
      locationGraph: Object.fromEntries(
        [...this.locationGraph.entries()].map(([k, v]) => [
          k,
          Object.fromEntries(v),
        ]),
      ),
      exportedAt: new Date().toISOString(),
    };
  }

  // ========================================
  // Private Helpers
  // ========================================

  private isValidTimeProgression(prev: string, curr: string): boolean {
    const timeOrder = ['morning', 'afternoon', 'evening', 'night'];
    const prevNorm = this.normalizeTimeOfDay(prev);
    const currNorm = this.normalizeTimeOfDay(curr);
    if (!prevNorm || !currNorm) return true;

    const prevIdx = timeOrder.indexOf(prevNorm);
    const currIdx = timeOrder.indexOf(currNorm);
    if (prevIdx === -1 || currIdx === -1) return true;

    return (
      currIdx >= prevIdx ||
      (prevNorm === 'night' && currNorm === 'morning')
    );
  }

  private normalizeTimeOfDay(timeStr: string): string | null {
    const lower = timeStr.toLowerCase();
    for (const [period, keywords] of Object.entries(TIME_KEYWORDS)) {
      if (keywords.some((kw) => lower.includes(kw))) return period;
    }
    return null;
  }

  private isTravelTimeInsufficient(actualInterval: string, requiredInterval: string): boolean {
    const actualMinutes = this.parseDurationToMinutes(actualInterval);
    const requiredMinutes = this.parseDurationToMinutes(requiredInterval);
    if (actualMinutes == null || requiredMinutes == null) return false;
    return actualMinutes < requiredMinutes;
  }

  private parseDurationToMinutes(raw: string): number | null {
    const value = String(raw ?? '').trim().toLowerCase();
    if (!value) return null;

    const dayMatch = value.match(/(\d+(?:\.\d+)?)\s*(?:天|day|days|d)/);
    const hourMatch = value.match(/(\d+(?:\.\d+)?)\s*(?:小时|小時|hour|hours|h)/);
    const minuteMatch = value.match(/(\d+(?:\.\d+)?)\s*(?:分钟|分鐘|min|mins|minute|minutes|m)/);

    let total = 0;
    if (dayMatch) total += Number(dayMatch[1]) * 24 * 60;
    if (hourMatch) total += Number(hourMatch[1]) * 60;
    if (minuteMatch) total += Number(minuteMatch[1]);

    return total > 0 ? total : null;
  }

  private checkContentTimeContradiction(
    prevScene: Scene,
    currScene: Scene,
  ): Contradiction | null {
    const prevPeriod = this.extractTimePeriod(prevScene.content);
    const currPeriod = this.extractTimePeriod(currScene.content);

    if (prevPeriod && currPeriod) {
      const periodOrder: Record<string, number> = {
        morning: 0,
        afternoon: 1,
        evening: 2,
        night: 3,
      };
      const prevIdx = periodOrder[prevPeriod] ?? -1;
      const currIdx = periodOrder[currPeriod] ?? -1;

      if (prevIdx !== -1 && currIdx !== -1 && currIdx < prevIdx) {
        const hasDayChange = this.hasDayChangeIndicator(
          prevScene.content,
          currScene.content,
        );
        if (!hasDayChange) {
          return {
            id: this.generateContradictionId(),
            type: ContradictionType.TIMELINE,
            severity: SceneSeverity.MINOR,
            description: `\u65F6\u6BB5\u77DB\u76FE: \u4ECE${prevPeriod}\u5230${currPeriod}\uFF0C\u65E0\u8DE8\u5929\u8BF4\u660E`,
            sceneA: prevScene.id,
            sceneB: currScene.id,
            entityInvolved: '',
            expectedValue: '\u65F6\u6BB5\u5E94\u5411\u524D\u63A8\u8FDB',
            actualValue: `${prevPeriod} -> ${currPeriod}`,
            contextA: '',
            contextB: '',
            suggestion: '\u6DFB\u52A0\u8DE8\u5929\u8BF4\u660E\u6216\u8C03\u6574\u65F6\u6BB5\u63CF\u8FF0',
            detectedAt: new Date().toISOString(),
          };
        }
      }
    }

    return null;
  }

  private extractTimePeriod(content: string): string | null {
    for (const [period, patterns] of Object.entries(PERIOD_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) return period;
      }
    }
    return null;
  }

  private hasDayChangeIndicator(
    prevContent: string,
    currContent: string,
  ): boolean {
    const combined = prevContent + currContent;
    return DAY_CHANGE_PATTERNS.some((p) => p.test(combined));
  }

  private checkStateTransition(
    prev: StateSnapshot,
    curr: StateSnapshot,
  ): Contradiction | null {
    if (prev.entityType === 'character') {
      if (prev.properties['status'] === 'dead') {
        if (curr.properties['status'] !== 'dead') {
          return {
            id: this.generateContradictionId(),
            type: ContradictionType.CHARACTER_STATE,
            severity: SceneSeverity.CRITICAL,
            description: `\u89D2\u8272${prev.entityName}\u5DF2\u6B7B\u4EA1\u4F46\u5728\u540E\u7EED\u573A\u666F\u4E2D\u5B58\u6D3B`,
            sceneA: prev.sceneId,
            sceneB: curr.sceneId,
            entityInvolved: prev.entityName,
            expectedValue: 'dead',
            actualValue: String(curr.properties['status'] ?? 'unknown'),
            contextA: '',
            contextB: '',
            suggestion: '\u68C0\u67E5\u89D2\u8272\u6B7B\u4EA1\u903B\u8F91\u6216\u6DFB\u52A0\u590D\u6D3B\u5267\u60C5',
            detectedAt: new Date().toISOString(),
          };
        }
      }
    } else if (prev.entityType === 'object') {
      if (prev.properties['destroyed'] === true) {
        if (curr.properties['exists'] !== false) {
          return {
            id: this.generateContradictionId(),
            type: ContradictionType.OBJECT_STATE,
            severity: SceneSeverity.MAJOR,
            description: `\u7269\u54C1${prev.entityName}\u5DF2\u635F\u6BC1\u4F46\u5728\u540E\u7EED\u573A\u666F\u4E2D\u5B8C\u597D`,
            sceneA: prev.sceneId,
            sceneB: curr.sceneId,
            entityInvolved: prev.entityName,
            expectedValue: 'destroyed',
            actualValue: 'exists',
            contextA: '',
            contextB: '',
            suggestion: '\u68C0\u67E5\u7269\u54C1\u72B6\u6001\u6216\u6DFB\u52A0\u4FEE\u590D\u60C5\u8282',
            detectedAt: new Date().toISOString(),
          };
        }
      }
    }

    return null;
  }

  private extractEntityNearMatch(
    content: string,
    matchPos: number,
  ): string | null {
    const start = Math.max(0, matchPos - 20);
    const end = Math.min(content.length, matchPos + 20);
    const context = content.slice(start, end);

    const namePatterns: RegExp[] = [
      /[\u4e00-\u9fa5]{2,4}(?=\u6B7B|\u79BB|\u5931|\u660F|\u8D70|\u8DD1)/,
      /(?:\u4ED6|\u5979|\u5B83)\u4EEC?/,
      /[\u4e00-\u9fa5]{2,4}(?:\u5148\u751F|\u5973\u58EB|\u8001\u5E08|\u533B\u751F|\u7ECF\u7406)/,
    ];

    for (const pattern of namePatterns) {
      const match = pattern.exec(context);
      if (match) return match[0];
    }

    return null;
  }

  private getEntityContext(
    content: string,
    entity: string,
    window = 50,
  ): string {
    const pos = content.indexOf(entity);
    if (pos === -1) return '';
    const start = Math.max(0, pos - window);
    const end = Math.min(content.length, pos + entity.length + window);
    return content.slice(start, end);
  }

  private getContextAround(
    content: string,
    pos: number,
    window = 30,
  ): string {
    const start = Math.max(0, pos - window);
    const end = Math.min(content.length, pos + window);
    return content.slice(start, end);
  }

  private detectEventOrderContradictions(
    orderedScenes: Scene[],
  ): Contradiction[] {
    const issues: Contradiction[] = [];

    for (const scene of orderedScenes) {
      for (const [prereqP, dependentP] of EVENT_DEPENDENCIES) {
        const prereqMatch = prereqP.exec(scene.content);
        const dependentMatch = dependentP.exec(scene.content);

        if (prereqMatch && dependentMatch) {
          if (dependentMatch.index < prereqMatch.index) {
            issues.push({
              id: this.generateContradictionId(),
              type: ContradictionType.CAUSALITY,
              severity: SceneSeverity.MAJOR,
              description: `\u4E8B\u4EF6\u987A\u5E8F\u77DB\u76FE: "${dependentMatch[0]}"\u51FA\u73B0\u5728"${prereqMatch[0]}"\u4E4B\u524D`,
              sceneA: scene.id,
              sceneB: scene.id,
              entityInvolved: '',
              expectedValue: `\u5148${prereqMatch[0]}\uFF0C\u540E${dependentMatch[0]}`,
              actualValue: '\u987A\u5E8F\u76F8\u53CD',
              contextA: '',
              contextB: '',
              suggestion:
                '\u8C03\u6574\u4E8B\u4EF6\u63CF\u8FF0\u7684\u987A\u5E8F\uFF0C\u6216\u68C0\u67E5\u53D9\u4E8B\u7ED3\u6784',
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    return issues;
  }

  private calculateCoherenceScore(
    critical: number,
    major: number,
    minor: number,
    info: number,
  ): number {
    if (this.scenes.size === 0) return 100.0;
    const penalty = critical * 20 + major * 10 + minor * 3 + info * 1;
    const maxPenalty = this.scenes.size * 15;
    const score = Math.max(0, 100 - (penalty / maxPenalty) * 100);
    return Math.round(score * 10) / 10;
  }

  private generateSummary(
    issues: Contradiction[],
    score: number,
  ): string {
    if (!issues.length)
      return '\u672A\u68C0\u6D4B\u5230\u77DB\u76FE\uFF0C\u573A\u666F\u8FDE\u8D2F\u6027\u826F\u597D\u3002';

    const critical = issues.filter(
      (c) => c.severity === SceneSeverity.CRITICAL,
    ).length;
    const major = issues.filter(
      (c) => c.severity === SceneSeverity.MAJOR,
    ).length;

    if (critical > 0)
      return `\u68C0\u6D4B\u5230${critical}\u4E2A\u4E25\u91CD\u77DB\u76FE\uFF0C\u9700\u8981\u7ACB\u5373\u4FEE\u590D\u3002\u8FDE\u8D2F\u6027\u8BC4\u5206: ${score}\u5206\u3002`;
    if (major > 0)
      return `\u68C0\u6D4B\u5230${major}\u4E2A\u4E3B\u8981\u77DB\u76FE\uFF0C\u5EFA\u8BAE\u4FEE\u590D\u3002\u8FDE\u8D2F\u6027\u8BC4\u5206: ${score}\u5206\u3002`;
    return `\u68C0\u6D4B\u5230${issues.length}\u4E2A\u8F7B\u5FAE\u95EE\u9898\uFF0C\u53EF\u9009\u4FEE\u590D\u3002\u8FDE\u8D2F\u6027\u8BC4\u5206: ${score}\u5206\u3002`;
  }

  private mockDeepAnalysis(): Record<string, unknown> {
    return {
      contradictions_found: 2,
      timeline_issues: [
        '\u573A\u666F3\u548C\u573A\u666F5\u4E4B\u95F4\u7684\u65F6\u95F4\u8DE8\u5EA6\u4E0D\u660E\u786E',
      ],
      location_issues: [
        '\u89D2\u8272\u4ECE A \u57CE\u5230 B \u57CE\u7684\u65C5\u884C\u65F6\u95F4\u672A\u4EA4\u4EE3',
      ],
      state_issues: [
        '\u7269\u54C1X\u5728\u573A\u666F4\u540E\u6D88\u5931\uFF0C\u573A\u666F7\u91CD\u65B0\u51FA\u73B0\u4F46\u672A\u89E3\u91CA',
      ],
      suggestions: [
        '\u5728\u573A\u666F4\u540E\u6DFB\u52A0\u8FC7\u6E21\u573A\u666F',
        '\u660E\u786E\u65F6\u95F4\u7EBF\u7684\u63A8\u8FDB',
        '\u4EA4\u4EE3\u89D2\u8272\u7684\u884C\u8E2A',
      ],
    };
  }
}
