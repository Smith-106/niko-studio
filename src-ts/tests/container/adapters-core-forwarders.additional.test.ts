import { afterEach, describe, expect, it, vi } from 'vitest';

const memoryEngineCtor = vi.hoisted(() => vi.fn());
const memoryInitializeMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const memoryAddMock = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'mem-1' }));
const memorySearchMock = vi.hoisted(() => vi.fn());
const memoryTemporalFactsMock = vi.hoisted(() => vi.fn().mockResolvedValue([{ id: 'fact-1' }]));
const memoryDetectConflictsMock = vi.hoisted(() => vi.fn().mockResolvedValue([{ id: 'conflict-1' }]));
const memoryResolveConflictMock = vi.hoisted(() => vi.fn().mockResolvedValue({ resolved: true }));

const graphEngineCtor = vi.hoisted(() => vi.fn());
const graphInitializeMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const graphCreateEntityMock = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'entity-1' }));
const graphCreateRelationMock = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'relation-1' }));
const graphSearchEntitiesByNameMock = vi.hoisted(() => vi.fn());
const graphExecuteCypherMock = vi.hoisted(() => vi.fn());
const graphGetCharacterMock = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'character-1' }));
const graphGetRelationshipsMock = vi.hoisted(() => vi.fn().mockResolvedValue([{ id: 'relationship-1' }]));
const graphGetForeshadowsMock = vi.hoisted(() => vi.fn().mockResolvedValue([{ id: 'foreshadow-1' }]));

const workflowEngineCtor = vi.hoisted(() => vi.fn());
const workflowRunMock = vi.hoisted(() => vi.fn());

const criticEngineCtor = vi.hoisted(() => vi.fn());
const criticQuickScanMock = vi.hoisted(() => vi.fn());

const backupManagerCtor = vi.hoisted(() => vi.fn());
const backupCreateMock = vi.hoisted(() => vi.fn());
const backupRestoreMock = vi.hoisted(() => vi.fn());
const backupListMock = vi.hoisted(() => vi.fn());
const backupDeleteMock = vi.hoisted(() => vi.fn());

const obsidianServiceCtor = vi.hoisted(() => vi.fn());
const getVaultByPathMock = vi.hoisted(() => vi.fn());
const getFilesMock = vi.hoisted(() => vi.fn());
const readNoteMock = vi.hoisted(() => vi.fn());
const writeNoteMock = vi.hoisted(() => vi.fn());
const updateNoteMock = vi.hoisted(() => vi.fn());
const createNoteMock = vi.hoisted(() => vi.fn());
const deleteNoteMock = vi.hoisted(() => vi.fn());
const readFrontmatterMock = vi.hoisted(() => vi.fn());
const updateFrontmatterMock = vi.hoisted(() => vi.fn());
const mergeFrontmatterMock = vi.hoisted(() => vi.fn());
const resolveWikiLinkMock = vi.hoisted(() => vi.fn());
const getBacklinksMock = vi.hoisted(() => vi.fn());
const createDailyNoteMock = vi.hoisted(() => vi.fn());
const getDailyNoteMock = vi.hoisted(() => vi.fn());
const appendToDailyNoteMock = vi.hoisted(() => vi.fn());
const searchNotesMock = vi.hoisted(() => vi.fn());

const mkdirSyncMock = vi.hoisted(() => vi.fn());
const writeFileSyncMock = vi.hoisted(() => vi.fn());

vi.mock('../../memory/unified-memory', () => ({
  UnifiedMemoryEngine: class {
    constructor(config: unknown) {
      memoryEngineCtor(config);
    }

    initialize = memoryInitializeMock;
    add = memoryAddMock;
    search = memorySearchMock;
    getTemporalFacts = memoryTemporalFactsMock;
    detectConflicts = memoryDetectConflictsMock;
    resolveConflict = memoryResolveConflictMock;
  },
}));

vi.mock('../../graph/graph-engine', () => ({
  GraphEngine: class {
    constructor(dbPath: string) {
      graphEngineCtor(dbPath);
    }

    initialize = graphInitializeMock;
    createEntity = graphCreateEntityMock;
    createRelation = graphCreateRelationMock;
    searchEntitiesByName = graphSearchEntitiesByNameMock;
    executeCypher = graphExecuteCypherMock;
    getCharacter = graphGetCharacterMock;
    getRelationships = graphGetRelationshipsMock;
    getForeshadows = graphGetForeshadowsMock;
  },
}));

vi.mock('../../workflow/workflow-engine', () => ({
  WorkflowEngine: class {
    _llmService: unknown;
    _phaseOrch: unknown;
    args: unknown[];

    constructor(...args: unknown[]) {
      workflowEngineCtor(...args);
      this.args = args;
      this._llmService = args[2];
      this._phaseOrch = args[5];
    }

    run = workflowRunMock;
  },
}));

vi.mock('../../narrative/evaluators/critic-engine', () => ({
  CriticEngine: class {
    constructor() {
      criticEngineCtor();
    }

    quickScan = criticQuickScanMock;
  },
}));

vi.mock('../../services/backup-manager', () => ({
  BackupManager: class {
    constructor() {
      backupManagerCtor();
    }

    createBackup = backupCreateMock;
    restoreBackup = backupRestoreMock;
    listBackups = backupListMock;
    deleteBackup = backupDeleteMock;
  },
}));

vi.mock('../../services/obsidian-service', () => ({
  ObsidianService: class {
    constructor(arg0: unknown, conflictBridge: unknown) {
      obsidianServiceCtor(arg0, conflictBridge);
    }

    getVaultByPath = getVaultByPathMock;
    getFiles = getFilesMock;
    readNote = readNoteMock;
    writeNote = writeNoteMock;
    updateNote = updateNoteMock;
    createNote = createNoteMock;
    deleteNote = deleteNoteMock;
    readFrontmatter = readFrontmatterMock;
    updateFrontmatter = updateFrontmatterMock;
    mergeFrontmatter = mergeFrontmatterMock;
    resolveWikiLink = resolveWikiLinkMock;
    getBacklinks = getBacklinksMock;
    createDailyNote = createDailyNoteMock;
    getDailyNote = getDailyNoteMock;
    appendToDailyNote = appendToDailyNoteMock;
    searchNotes = searchNotesMock;
  },
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    mkdirSync: mkdirSyncMock,
    writeFileSync: writeFileSyncMock,
  };
});

vi.mock('node:path', () => ({
  join: (...parts: string[]) => parts.join('/'),
  dirname: (input: string) => input.split('/').slice(0, -1).join('/'),
  resolve: (...parts: string[]) => parts.join('/'),
  relative: (_from: string, to: string) => to,
}));

describe('container/adapters core forwarders', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('covers memory and graph adapter forwarding branches', async () => {
    const { MemoryEngineAdapter, GraphEngineAdapter } = await import('../../container/adapters.js');

    memorySearchMock
      .mockResolvedValueOnce([{ id: 'retrieve-hit' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'search-text' }])
      .mockResolvedValueOnce([{ id: 'search-params' }]);

    const memoryAdapter = new MemoryEngineAdapter({
      flags: { elasticsearchEnabled: false },
      storageShadow: { shadowWriteMemory: vi.fn() },
    } as never);
    await expect(memoryAdapter.initialize()).resolves.toBeUndefined();
    await expect(memoryAdapter.store('scene-1', 'plain text')).resolves.toBeUndefined();
    await expect(memoryAdapter.store('scene-2', { mood: 'tense' })).resolves.toBeUndefined();
    await expect(memoryAdapter.add({ content: 'memory payload', layer: 'working' })).resolves.toEqual({ id: 'mem-1' });
    await expect(memoryAdapter.retrieve('scene-1')).resolves.toEqual({ id: 'retrieve-hit' });
    await expect(memoryAdapter.retrieve('scene-miss')).resolves.toBeUndefined();
    await expect(memoryAdapter.search('chapter opening', 3)).resolves.toEqual([{ id: 'search-text' }]);
    await expect(memoryAdapter.search({ query: 'chapter opening', limit: 2 })).resolves.toEqual([{ id: 'search-params' }]);
    await expect(memoryAdapter.getTemporalFacts({ entityId: 'hero-1' })).resolves.toEqual([{ id: 'fact-1' }]);
    await expect(memoryAdapter.detectConflicts('hero-1')).resolves.toEqual([{ id: 'conflict-1' }]);
    await expect(memoryAdapter.resolveConflict({ memoryIdA: 'a', memoryIdB: 'b' })).resolves.toEqual({ resolved: true });
    await expect(memoryAdapter.clear()).resolves.toBeUndefined();

    expect(memoryEngineCtor).toHaveBeenCalledWith({
      dbPath: '.writing/memory.db',
      integrationAdapters: {
        flags: { elasticsearchEnabled: false },
        storageShadow: { shadowWriteMemory: expect.any(Function) },
      },
    });
    expect(memoryAddMock).toHaveBeenNthCalledWith(1, {
      content: 'plain text',
      entityId: 'scene-1',
    });
    expect(memoryAddMock).toHaveBeenNthCalledWith(2, {
      content: JSON.stringify({ mood: 'tense' }),
      entityId: 'scene-2',
    });

    graphSearchEntitiesByNameMock
      .mockResolvedValueOnce([{ id: 'node-1', name: 'Node One' }, { id: 'other-node', name: 'Other' }])
      .mockResolvedValueOnce([{ id: 'other-node', name: 'Fallback Node' }])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('search failed'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'node{}\'1', name: 'Graph Root' }])
      .mockResolvedValueOnce([{ id: 'node-2', name: 'Graph Root' }]);
    graphExecuteCypherMock
      .mockResolvedValueOnce([{ id: 'child-node' }])
      .mockRejectedValueOnce(new Error('cypher failed'))
      .mockResolvedValueOnce([{ id: 'child-node' }]);

    const graphAdapter = new GraphEngineAdapter();
    await expect(graphAdapter.initialize()).resolves.toBeUndefined();
    await expect(graphAdapter.addNode('node-a', {
      type: 'scene',
      name: 'Scene A',
      properties: { chapter: 1 },
    })).resolves.toBeUndefined();
    await expect(graphAdapter.addNode('node-b', {})).resolves.toBeUndefined();
    await expect(graphAdapter.addEdge('node-a', 'node-b', 'connects')).resolves.toBeUndefined();
    await expect(graphAdapter.getNode('node-1')).resolves.toEqual({ id: 'node-1', name: 'Node One' });
    await expect(graphAdapter.getNode('node-fallback')).resolves.toEqual({ id: 'other-node', name: 'Fallback Node' });
    await expect(graphAdapter.getNode('node-missing')).resolves.toBeNull();
    await expect(graphAdapter.getNode('node-error')).resolves.toBeNull();
    await expect(graphAdapter.traverse('missing-root')).resolves.toEqual([]);
    await expect(graphAdapter.traverse("node{}'1", 9)).resolves.toEqual([{ id: 'child-node' }]);
    await expect(graphAdapter.traverse('node-2', 2)).resolves.toEqual([]);
    await expect(graphAdapter.executeCypher('MATCH (n) RETURN n')).resolves.toEqual([{ id: 'child-node' }]);
    await expect(graphAdapter.getCharacter('Lin', true, false)).resolves.toEqual({ id: 'character-1' });
    await expect(graphAdapter.getRelationships('Lin', 'ally', 2)).resolves.toEqual([{ id: 'relationship-1' }]);
    await expect(graphAdapter.getForeshadows('active', 3)).resolves.toEqual([{ id: 'foreshadow-1' }]);
    await expect(graphAdapter.createEntity('character', 'Lin', { role: 'lead' })).resolves.toEqual({ id: 'entity-1' });
    await expect(graphAdapter.createRelation('Lin', 'Mira', 'ally', { since: 'chapter-1' })).resolves.toEqual({ id: 'relation-1' });

    expect(graphEngineCtor).toHaveBeenCalledWith('.writing/graph.db');
    expect(graphCreateEntityMock).toHaveBeenNthCalledWith(1, 'scene', 'Scene A', { id: 'node-a', chapter: 1 });
    expect(graphCreateEntityMock).toHaveBeenNthCalledWith(2, 'unknown', 'node-b', { id: 'node-b' });
    expect(graphCreateRelationMock).toHaveBeenNthCalledWith(1, 'node-a', 'node-b', 'connects');
    expect(graphCreateRelationMock).toHaveBeenNthCalledWith(2, 'Lin', 'Mira', 'ally', { since: 'chapter-1' });
    expect(graphExecuteCypherMock).toHaveBeenNthCalledWith(
      1,
      "MATCH (n)-[r*1..5]-(m) WHERE n.id = 'node{}\\'1' RETURN m, r",
    );
    expect(graphExecuteCypherMock).toHaveBeenNthCalledWith(
      2,
      "MATCH (n)-[r*1..2]-(m) WHERE n.id = 'node-2' RETURN m, r",
    );
    expect(graphExecuteCypherMock).toHaveBeenNthCalledWith(3, 'MATCH (n) RETURN n');
  });

  it('covers search, workflow, and critic adapter branches', async () => {
    const { SearchEngineAdapter, WorkflowEngineAdapter, CriticEngineAdapter } = await import('../../container/adapters.js');

    const retriever = {
      hybridSearch: vi.fn().mockRejectedValue(new Error('retriever failed')),
    };
    const searchAdapter = new SearchEngineAdapter(retriever as never);
    await expect(searchAdapter.initialize()).resolves.toBeUndefined();
    await expect(searchAdapter.search('broken query', { limit: 2, threshold: 0.4 })).resolves.toEqual([]);

    const explicitEngine = {
      _llmService: { id: 'llm-service' },
      _phaseOrch: { id: 'phase-orchestrator' },
      run: workflowRunMock,
    };
    const workflowAdapter = new WorkflowEngineAdapter(explicitEngine as never);
    await expect(workflowAdapter.initialize()).resolves.toBeUndefined();
    expect(workflowAdapter.getLevels()).toEqual(['rapid', 'lite', 'standard', 'brainstorm', 'coordinator']);

    workflowRunMock
      .mockResolvedValueOnce({ status: 'completed' })
      .mockRejectedValueOnce(new Error('workflow exploded'))
      .mockResolvedValueOnce({ status: 'after-reset' });

    await expect(
      workflowAdapter.executeLevel('L0', {
        sessionId: '',
        userId: '',
        metadata: {},
      } as never),
    ).resolves.toMatchObject({
      success: true,
      metadata: {
        level: 'L0',
        task: 'workflow task',
      },
      output: { status: 'completed' },
    });
    expect(workflowRunMock).toHaveBeenNthCalledWith(1, 'workflow task', 'L0');

    await expect(
      workflowAdapter.executeLevel('L2', {
        sessionId: 'session-failure',
      } as never),
    ).resolves.toEqual({
      success: false,
      error: 'workflow exploded',
    });

    const runtime = workflowAdapter.createRuntime({
      workspace: '/tmp/workspace-a',
      sessionNamespace: 'ns-a',
    }) as unknown as { args: unknown[] };
    expect(runtime.args).toEqual([
      '/tmp/workspace-a',
      'ns-a',
      { id: 'llm-service' },
      undefined,
      undefined,
      { id: 'phase-orchestrator' },
    ]);

    workflowAdapter.reset();
    await expect(
      workflowAdapter.executeLevel('L3', {
        sessionId: 'session-reset',
      } as never),
    ).resolves.toMatchObject({
      success: true,
      output: { status: 'after-reset' },
    });
    expect(workflowEngineCtor).toHaveBeenNthCalledWith(
      1,
      '/tmp/workspace-a',
      'ns-a',
      { id: 'llm-service' },
      undefined,
      undefined,
      { id: 'phase-orchestrator' },
    );
    expect(workflowEngineCtor).toHaveBeenNthCalledWith(
      2,
      undefined,
      undefined,
      { id: 'llm-service' },
      undefined,
      undefined,
      { id: 'phase-orchestrator' },
    );

    criticQuickScanMock.mockResolvedValueOnce({
      overallScore: 81,
      moduleScores: {
        pacing: 75,
        dialogue: 60,
      },
      top3Issues: [
        { suggestion: 'tighten conflict' },
        { suggestion: 'tighten conflict' },
        { suggestion: 'clarify stakes' },
      ],
      allIssues: [
        { message: 'Conflict is weak' },
        { message: 'Stakes are unclear' },
      ],
    });

    const criticAdapter = new CriticEngineAdapter();
    await expect(criticAdapter.initialize()).resolves.toBeUndefined();
    await expect(criticAdapter.analyze('draft text')).resolves.toEqual({
      score: 81,
      issues: ['Conflict is weak', 'Stakes are unclear'],
      strengths: ['pacing score 75.0'],
      recommendations: ['tighten conflict', 'clarify stakes'],
    });
    expect(criticAdapter.getSuggestions({
      score: 10,
      issues: [],
      strengths: [],
      recommendations: ['a', 'b'],
    })).toEqual(['a', 'b']);
  });

  it('covers backup, obsidian, and gateway adapter branches', async () => {
    const { BackupManagerAdapter, ObsidianServiceAdapter, MCPGatewayAdapter } = await import('../../container/adapters.js');

    backupCreateMock
      .mockReturnValueOnce({ success: true, backupId: 'backup-1', name: 'ignored' })
      .mockReturnValueOnce({ success: true, name: 'backup-from-name' })
      .mockReturnValueOnce({ success: true })
      .mockReturnValueOnce({ success: false, error: 'backup failed' });
    backupRestoreMock
      .mockReturnValueOnce({ success: true })
      .mockReturnValueOnce({ success: false, error: 'restore failed' });
    backupListMock.mockReturnValueOnce([
      { id: 'b1', createdAt: new Date('2026-01-01T00:00:00.000Z'), sizeBytes: 512, type: 'full' },
      { id: 'b2', createdAt: new Date('2026-01-02T00:00:00.000Z') },
    ]);

    const backupAdapter = new BackupManagerAdapter();
    await expect(backupAdapter.createBackup()).resolves.toBe('backup-1');
    await expect(backupAdapter.createBackup()).resolves.toBe('backup-from-name');
    await expect(backupAdapter.createBackup()).resolves.toBe('backup');
    await expect(backupAdapter.createBackup()).rejects.toThrow('backup failed');
    await expect(backupAdapter.restoreBackup('backup-1')).resolves.toBeUndefined();
    await expect(backupAdapter.restoreBackup('backup-2')).rejects.toThrow('restore failed');
    await expect(backupAdapter.listBackups()).resolves.toEqual([
      {
        id: 'b1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        size: 512,
        type: 'full',
      },
      {
        id: 'b2',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        size: 0,
        type: 'full',
      },
    ]);
    await expect(backupAdapter.deleteBackup('backup-9')).resolves.toBeUndefined();
    expect(backupManagerCtor).toHaveBeenCalledTimes(1);
    expect(backupCreateMock).toHaveBeenCalledTimes(4);
    expect(backupDeleteMock).toHaveBeenCalledWith('backup-9');

    getVaultByPathMock
      .mockReturnValueOnce({ name: 'PrimaryVault' })
      .mockReturnValueOnce(null);
    readNoteMock
      .mockReturnValueOnce('note body')
      .mockImplementationOnce(() => {
        throw new Error('missing note');
      });
    readFrontmatterMock.mockReturnValueOnce({ title: 'Draft' });
    resolveWikiLinkMock.mockReturnValueOnce('/vault/chapter-1.md');
    getBacklinksMock.mockReturnValueOnce([
      { name: 'Backlink A', path: '/vault/a.md', relativePath: 'a.md' },
    ]);
    createDailyNoteMock.mockReturnValueOnce('/vault/daily/2026-06-05.md');
    getDailyNoteMock.mockReturnValueOnce('/vault/daily/2026-06-05.md');
    appendToDailyNoteMock.mockReturnValueOnce('/vault/daily/2026-06-05.md');
    searchNotesMock.mockReturnValueOnce([{ name: 'Draft', path: '/vault/draft.md', relativePath: 'draft.md' }]);
    getFilesMock.mockReturnValueOnce(['/vault/draft.md']);

    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const obsidianAdapter = new ObsidianServiceAdapter(undefined, { id: 'conflict-bridge' } as never);
    await expect(obsidianAdapter.export('/vault/root', '# Exported')).resolves.toBeUndefined();
    await expect(obsidianAdapter.import('/vault/root')).resolves.toBe('PrimaryVault');
    await expect(obsidianAdapter.import('/vault/missing')).rejects.toThrow('Vault not found: /vault/missing');
    await expect(obsidianAdapter.sync('/vault/root')).resolves.toEqual({ added: 0, modified: 0, deleted: 0 });
    await expect(obsidianAdapter.readNote('/vault/root', 'chapter-1.md')).resolves.toBe('note body');
    await expect(obsidianAdapter.readNote('/vault/root', 'missing.md')).resolves.toBeNull();
    await expect(obsidianAdapter.writeNote('/vault/root', 'chapter-1.md', 'new body')).resolves.toBeUndefined();
    await expect(obsidianAdapter.updateNote('/vault/root', 'chapter-1.md', 'updated body')).resolves.toBeUndefined();
    await expect(obsidianAdapter.createNote('/vault/root', 'chapter-2.md', 'created body', { tags: ['draft'] })).resolves.toBeUndefined();
    await expect(obsidianAdapter.deleteNote('/vault/root', 'chapter-2.md')).resolves.toBeUndefined();
    await expect(obsidianAdapter.readFrontmatter('/vault/root', 'chapter-1.md')).resolves.toEqual({ title: 'Draft' });
    await expect(obsidianAdapter.updateFrontmatter('/vault/root', 'chapter-1.md', { arc: 'rising' })).resolves.toBeUndefined();
    await expect(obsidianAdapter.mergeFrontmatter('/vault/root', 'chapter-1.md', { tags: ['scene'] })).resolves.toBeUndefined();
    await expect(obsidianAdapter.resolveWikiLink('/vault/root', '[[chapter-1]]')).resolves.toBe('/vault/chapter-1.md');
    await expect(obsidianAdapter.getBacklinks('/vault/root', 'chapter-1.md')).resolves.toEqual([
      { name: 'Backlink A', path: '/vault/a.md', relativePath: 'a.md' },
    ]);
    await expect(obsidianAdapter.createDailyNote('/vault/root')).resolves.toBe('/vault/daily/2026-06-05.md');
    await expect(obsidianAdapter.getDailyNote('/vault/root')).resolves.toBe('/vault/daily/2026-06-05.md');
    await expect(obsidianAdapter.appendToDailyNote('/vault/root', 'daily body')).resolves.toBe('/vault/daily/2026-06-05.md');
    expect(obsidianAdapter.search('/vault/root', 'draft')).toEqual([
      { name: 'Draft', path: '/vault/draft.md', relativePath: 'draft.md' },
    ]);
    expect(obsidianAdapter.getFiles('/vault/root')).toEqual(['/vault/draft.md']);

    expect(obsidianServiceCtor).toHaveBeenCalledWith(undefined, { id: 'conflict-bridge' });
    expect(mkdirSyncMock).toHaveBeenCalledWith('/vault/root', { recursive: true });
    expect(writeFileSyncMock).toHaveBeenCalledWith('/vault/root/export-1700000000000.md', '# Exported', 'utf-8');
    expect(writeNoteMock).toHaveBeenCalledWith('/vault/root', 'chapter-1.md', 'new body');
    expect(updateNoteMock).toHaveBeenCalledWith('/vault/root', 'chapter-1.md', 'updated body');
    expect(createNoteMock).toHaveBeenCalledWith('/vault/root', 'chapter-2.md', 'created body', { tags: ['draft'] });
    expect(deleteNoteMock).toHaveBeenCalledWith('/vault/root', 'chapter-2.md');
    expect(updateFrontmatterMock).toHaveBeenCalledWith('/vault/root', 'chapter-1.md', { arc: 'rising' });
    expect(mergeFrontmatterMock).toHaveBeenCalledWith('/vault/root', 'chapter-1.md', { tags: ['scene'] });
    expect(searchNotesMock).toHaveBeenCalledWith('/vault/root', 'draft', true, 50);
    expect(getFilesMock).toHaveBeenCalledWith('/vault/root', '*.md');
    dateNowSpy.mockRestore();

    const gatewayAdapter = new MCPGatewayAdapter();
    await expect(gatewayAdapter.initialize()).resolves.toBeUndefined();
    gatewayAdapter.registerHandler('tools/list', async (params) => ({ ok: true, params }));
    await expect(gatewayAdapter.sendRequest('tools/list', { query: 'hero' })).resolves.toEqual({
      ok: true,
      params: { query: 'hero' },
    });
    await expect(gatewayAdapter.sendRequest('tools/missing')).rejects.toThrow('MCP method not found: tools/missing');
    await expect(gatewayAdapter.close()).resolves.toBeUndefined();
    await expect(gatewayAdapter.sendRequest('tools/list')).rejects.toThrow('MCP method not found: tools/list');
  });

  it('covers explicit obsidian and url-based file sync routing branches', async () => {
    const { FileSyncAdapterChain } = await import('../../container/adapters.js');

    const obsidian = {
      sync: vi.fn().mockResolvedValue({ synced: 5, conflicts: 0 }),
      getSyncHistory: vi.fn().mockResolvedValue([]),
      getIndexedFiles: vi.fn().mockResolvedValue([]),
    };
    const cloud = {
      sync: vi.fn().mockResolvedValue({ synced: 6, conflicts: 1 }),
      getSyncHistory: vi.fn().mockResolvedValue([]),
      getIndexedFiles: vi.fn().mockResolvedValue([]),
    };
    const knowledge = {
      sync: vi.fn().mockResolvedValue({ synced: 7, conflicts: 0 }),
      getSyncHistory: vi.fn().mockResolvedValue([]),
      getIndexedFiles: vi.fn().mockResolvedValue([]),
    };
    const eventBus = { publish: vi.fn() };

    const adapter = new FileSyncAdapterChain({ obsidian, cloud, knowledge }, eventBus as never);

    await expect(adapter.sync('push', 'obsidian:daily-note', 'vault')).resolves.toEqual({ synced: 5, conflicts: 0 });
    await expect(adapter.sync('pull', 'remote-artifact', 'https://example.com/archive')).resolves.toEqual({ synced: 6, conflicts: 1 });

    expect(obsidian.sync).toHaveBeenCalledWith('push', 'obsidian:daily-note', 'vault');
    expect(cloud.sync).toHaveBeenCalledWith('pull', 'remote-artifact', 'https://example.com/archive');
    expect(knowledge.sync).not.toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
  });

  it('covers phase-orchestrator health bypass and active-phase routing branches', async () => {
    const { PhaseOrchestratorAdapter } = await import('../../container/adapters.js');
    const { TeamPhase } = await import('../../workflow/team/phase-gate-evaluator.js');

    const phase = new PhaseOrchestratorAdapter();

    expect(phase.routeThroughOrchestrator('health-check', 'POST', '/health/live')).toEqual({
      allowed: true,
      statusCode: 200,
      reason: 'health/admin route bypasses phase gate',
      currentPhase: TeamPhase.planning,
    });

    phase.orchestrator.reset(TeamPhase.execution);

    expect(phase.routeThroughOrchestrator('sync-now', 'POST', '/knowledge/sync')).toEqual({
      allowed: true,
      statusCode: 200,
      reason: 'operation permitted in execution phase',
      currentPhase: TeamPhase.execution,
    });
  });
});
