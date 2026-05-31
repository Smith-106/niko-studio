import { KnowledgeBridgeV2 } from './services/knowledge-bridge-v2'
import { NarrativeEngine } from './services/narrative-engine'
import { NowledgeMemHTTPClient } from './services/nowledge-mem-http-client'
import { NullNowledgeMemAPI } from './services/null-nowledge-mem-api'
import type { GraphManager } from './graph/graph-manager'
import type { SqliteMemoryStore } from './memory/sqlite-memory-store'

export interface AppContainer {
  narrativeEngine: NarrativeEngine
  knowledgeBridge: KnowledgeBridgeV2
  graphManager: GraphManager
  memoryStore: SqliteMemoryStore
}

export async function createAppContainer(deps: {
  graphManager: GraphManager
  memoryStore: SqliteMemoryStore
  dataDir: string
  nowledgeMemHost?: string
  nowledgeMemPort?: number
}): Promise<AppContainer> {
  const bridge = new KnowledgeBridgeV2({
    host: deps.nowledgeMemHost ?? '127.0.0.1',
    port: deps.nowledgeMemPort ?? 19828,
    dataDir: deps.dataDir,
  })

  const narrativeEngine = new NarrativeEngine(
    deps.graphManager,
    deps.memoryStore,
    bridge,
  )

  return {
    narrativeEngine,
    knowledgeBridge: bridge,
    graphManager: deps.graphManager,
    memoryStore: deps.memoryStore,
  }
}
