/**
 * Reader Simulation MCP Services
 *
 * Singleton getters, in-memory stores, file persistence, and store management
 * for Reader Simulation Engine (SME-02).
 *
 * Related: T-036, SME-02
 */

import type { HttpResponse } from '../../mcp/http-types';
import { jsonResponse } from '../../mcp/http-types';
import type { ReaderPersona } from '../PersonaDefinition';
import { ConsensusEngine } from '../ConsensusEngine';
import { DualEngine } from '../DualEngine';
import { DimensionAnalyzer, createDimensionAnalyzer } from '../DimensionAnalyzer';
import { RevisionServiceImpl } from '../../services/revision-service';
import { createLogger } from '../../logger';
import { tryResolveWorkspaceRoot } from '../../mcp/input-validation.js';
import type { FeedbackAggregate } from './reader-types';

const _log = createLogger('reader-services');

// ============================================================
// File Persistence for Custom Personas
// ============================================================

const PERSONAS_FILE = 'reader-personas.json';
const NIKO_STUDIO_DIR = '.niko-studio';

function getWorkspaceRoot(): string | HttpResponse {
  const result = tryResolveWorkspaceRoot();
  return result.ok ? result.value : result.error;
}

function getPersonasFilePath(): string | null {
  const { join } = require('node:path');
  const root = getWorkspaceRoot();
  if (typeof root !== 'string') return null;
  return join(root, NIKO_STUDIO_DIR, PERSONAS_FILE);
}

/**
 * Load custom personas from .niko-studio/reader-personas.json
 * Returns empty Map if file doesn't exist or is malformed.
 */
export async function loadCustomPersonas(): Promise<Map<string, ReaderPersona>> {
  const store = new Map<string, ReaderPersona>();
  try {
    const path = getPersonasFilePath();
    if (!path) return store;

    const { readFile } = await import('node:fs/promises');
    const { existsSync } = await import('node:fs');

    if (!existsSync(path)) {
      return store;
    }

    const content = await readFile(path, 'utf-8');
    const data = JSON.parse(content) as unknown;

    if (!Array.isArray(data)) {
      _log.warn('Personas file is not an array, using empty store', { path });
      return store;
    }

    for (const item of data) {
      if (item && typeof item === 'object' && 'id' in item && 'name' in item && 'type' in item) {
        const persona = item as ReaderPersona;
        store.set(persona.id, persona);
      }
    }

    _log.info('Loaded custom personas from file', { count: store.size, path });
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.warn('Failed to load custom personas from file, using empty store', { error: message });
  }
  return store;
}

/**
 * Save custom personas to .niko-studio/reader-personas.json
 * Silently fails on I/O errors (memory store remains authoritative).
 */
export async function saveCustomPersonas(store: Map<string, ReaderPersona>): Promise<void> {
  try {
    const path = getPersonasFilePath();
    if (!path) return;

    const { writeFile, mkdir } = await import('node:fs/promises');
    const { dirname } = await import('node:path');

    // Ensure directory exists
    await mkdir(dirname(path), { recursive: true });

    const data = Array.from(store.values());
    await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');

    _log.info('Saved custom personas to file', { count: data.length, path });
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.warn('Failed to save custom personas to file', { error: message });
  }
}

/**
 * Delete the custom personas persistence file.
 * Used by clearReaderStores for test cleanup.
 */
export async function deletePersonasFile(): Promise<void> {
  try {
    const { unlink } = await import('node:fs/promises');
    const { existsSync } = await import('node:fs');
    const path = getPersonasFilePath();

    if (path && existsSync(path)) {
      await unlink(path!);
      _log.info('Deleted custom personas file', { path });
    }
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.warn('Failed to delete custom personas file', { error: message });
  }
}

// ============================================================
// Singletons
// ============================================================

// RevisionService singleton for de-AI endpoint
let revisionServiceInstance: RevisionServiceImpl | null = null;

export function getRevisionService(): RevisionServiceImpl {
  if (!revisionServiceInstance) {
    revisionServiceInstance = new RevisionServiceImpl();
  }
  return revisionServiceInstance;
}

// ConsensusEngine singleton
let consensusEngineInstance: ConsensusEngine | null = null;

export function getConsensusEngine(): ConsensusEngine {
  if (!consensusEngineInstance) {
    consensusEngineInstance = new ConsensusEngine();
  }
  return consensusEngineInstance;
}

// DualEngine singleton
let dualEngineInstance: DualEngine | null = null;
let dimensionAnalyzerInstance: DimensionAnalyzer | null = null;

export function getDualEngine(): DualEngine {
  if (!dualEngineInstance) {
    dualEngineInstance = new DualEngine();
  }
  return dualEngineInstance;
}

export function getDimensionAnalyzer(): DimensionAnalyzer {
  if (!dimensionAnalyzerInstance) {
    dimensionAnalyzerInstance = createDimensionAnalyzer();
  }
  return dimensionAnalyzerInstance;
}

// ============================================================
// In-memory storage (with file persistence)
// ============================================================

export const customPersonaStore = new Map<string, ReaderPersona>();
export const analysisResultCache = new Map<string, import('../DualEngine').DualEngineResult>();

// Load persisted personas on module initialization — bind promise for ready guard
let customPersonaStoreReady: Promise<void> = loadCustomPersonas().then((loaded) => {
  for (const [id, persona] of loaded) {
    customPersonaStore.set(id, persona);
  }
});

/**
 * Return the promise that resolves when customPersonaStore has finished loading
 * from the persistence file. Endpoint handlers that read the store should await
 * this before accessing customPersonaStore to avoid race conditions.
 */
export function getCustomPersonaStoreReady(): Promise<void> {
  return customPersonaStoreReady;
}

// Feedback aggregate store: personaId -> dimension -> FeedbackAggregate
export const feedbackAggregateStore = new Map<string, Map<string, FeedbackAggregate>>();

// Threshold for writing back persona weights (accept + reject + modify >= threshold)
export const FEEDBACK_THRESHOLD = 5;

// Weight adjustment step size
export const WEIGHT_STEP = 0.05;

// Weight bounds
export const MIN_WEIGHT = 0.0;
export const MAX_WEIGHT = 1.0;

// ============================================================
// Store Management
// ============================================================

export async function clearReaderStores(): Promise<void> {
  customPersonaStore.clear();
  analysisResultCache.clear();
  feedbackAggregateStore.clear();
  await deletePersonasFile();
}

export function getCustomPersonaStore(): Map<string, ReaderPersona> {
  return customPersonaStore;
}

export function getAnalysisResultCache(): Map<string, import('../DualEngine').DualEngineResult> {
  return analysisResultCache;
}

export function getFeedbackAggregateStore(): Map<string, Map<string, FeedbackAggregate>> {
  return feedbackAggregateStore;
}

export function clearFeedbackAggregateStore(): void {
  feedbackAggregateStore.clear();
}
