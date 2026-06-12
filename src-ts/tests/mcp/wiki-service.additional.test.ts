import { afterEach, describe, expect, it, vi } from 'vitest';

const resolveProjectWikiStoreMock = vi.hoisted(() => vi.fn());
const writeProjectWikiPageMock = vi.hoisted(() => vi.fn());
const writeProjectWikiRawEvidenceMock = vi.hoisted(() => vi.fn());
const appendProjectWikiLogMock = vi.hoisted(() => vi.fn());
const readProjectWikiIndexMock = vi.hoisted(() => vi.fn());
const readProjectWikiPageMock = vi.hoisted(() => vi.fn());

function buildWorkspace() {
  return {
    schemaVersion: '2026-04-08',
    identity: {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      projectName: 'Atlas',
      workspaceRoot: 'C:/tmp/atlas-workspace',
    },
    manuscript: {
      manuscriptId: null,
      title: null,
      chapterId: null,
      chapterTitle: null,
      chapterNumber: null,
    },
    storyBible: {
      storyBibleId: null,
      draftId: null,
      version: null,
      storage: 'workspace',
    },
    knowledge: {
      focusEntityId: null,
      graphEntityIds: [],
      memoryEntryIds: [],
    },
    authority: {
      recordSetId: null,
      activeSceneId: null,
      activeEventId: null,
      activeTimelineId: null,
      consistencyRunId: null,
    },
    workflow: {
      sessionId: 'session-1',
      planId: null,
      level: 'L3',
    },
    chat: {
      conversationId: 'conversation-1',
      comparisonEnabled: false,
    },
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [],
      notes: [],
    },
  };
}

async function loadWikiServiceModule() {
  vi.resetModules();

  vi.doMock('../../project/wiki-store.js', () => ({
    resolveProjectWikiStore: resolveProjectWikiStoreMock,
    writeProjectWikiPage: writeProjectWikiPageMock,
    writeProjectWikiRawEvidence: writeProjectWikiRawEvidenceMock,
    appendProjectWikiLog: appendProjectWikiLogMock,
    readProjectWikiIndex: readProjectWikiIndexMock,
    readProjectWikiPage: readProjectWikiPageMock,
  }));

  return import('../../mcp/services/wiki.js');
}

describe('mcp wiki service additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns page-write-failed when page persistence returns null', async () => {
    resolveProjectWikiStoreMock.mockReturnValue({
      available: true,
      reason: null,
      workspaceId: 'atlas-workspace',
    });
    writeProjectWikiPageMock.mockResolvedValue(null);

    const { promoteProjectWikiCanon } = await loadWikiServiceModule();
    const result = await promoteProjectWikiCanon({
      workspace: buildWorkspace() as any,
      title: 'Broken page',
      body: 'body',
    });

    expect(result).toEqual({
      available: true,
      reason: 'page-write-failed',
      workspace_id: 'atlas-workspace',
      page: null,
      raw_evidence_path: null,
      log_entry: null,
    });
  });

  it('generates default raw evidence paths and tolerates malformed log entries', async () => {
    resolveProjectWikiStoreMock.mockReturnValue({
      available: true,
      reason: null,
      workspaceId: 'atlas-workspace',
    });
    writeProjectWikiPageMock.mockResolvedValue({
      frontmatter: {
        id: 'page-1',
        slug: 'characters/atlas-hero',
        title: 'Atlas Hero',
        status: 'curated',
        promotedFrom: 'chat',
      },
      markdown: '# Atlas Hero',
      path: 'C:/tmp/atlas-hero.md',
    });
    writeProjectWikiRawEvidenceMock.mockResolvedValue('C:/tmp/raw-evidence.md');
    appendProjectWikiLogMock.mockResolvedValue('not-json');

    const { promoteProjectWikiCanon } = await loadWikiServiceModule();
    const result = await promoteProjectWikiCanon({
      workspace: buildWorkspace() as any,
      title: 'Atlas Hero',
      body: 'body',
      promotedFrom: 'chat',
      sourceId: 'source-123',
      rawEvidence: {
        content: 'raw note',
      },
    });

    expect(writeProjectWikiRawEvidenceMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'atlas-workspace' }),
      'promotions/chat/source-123.md',
      'raw note',
    );
    expect(result.raw_evidence_path).toBe('C:/tmp/raw-evidence.md');
    expect(result.log_entry).toBeNull();
  });

  it('uses normalized status filters and clamps invalid limits for listing', async () => {
    resolveProjectWikiStoreMock.mockReturnValue({
      available: true,
      reason: null,
      workspaceId: 'atlas-workspace',
    });
    readProjectWikiIndexMock.mockResolvedValue({
      pages: [
        { id: '1', slug: 'a', title: 'A', status: 'curated', filePath: 'a.md' },
        { id: '2', slug: 'b', title: 'B', status: 'draft', filePath: 'b.md' },
      ],
    });

    const { listProjectWikiCanonPages } = await loadWikiServiceModule();
    const result = await listProjectWikiCanonPages({
      workspace: buildWorkspace() as any,
      status: 'invalid-status' as any,
      limit: 0,
    });

    expect(result).toEqual({
      available: true,
      reason: null,
      workspace_id: 'atlas-workspace',
      total_pages: 2,
      pages: [
        { id: '1', slug: 'a', title: 'A', status: 'curated', file_path: 'a.md' },
      ],
    });
  });

  it('returns missing-slug when a blank slug is requested', async () => {
    resolveProjectWikiStoreMock.mockReturnValue({
      available: true,
      reason: null,
      workspaceId: 'atlas-workspace',
    });

    const { readProjectWikiCanonPage } = await loadWikiServiceModule();
    const result = await readProjectWikiCanonPage({
      workspace: buildWorkspace() as any,
      slug: '   ',
    });

    expect(result).toEqual({
      available: true,
      reason: 'missing-slug',
      workspace_id: 'atlas-workspace',
      page: null,
    });
  });

  it('returns page-not-found when index entry exists but markdown cannot be read', async () => {
    resolveProjectWikiStoreMock.mockReturnValue({
      available: true,
      reason: null,
      workspaceId: 'atlas-workspace',
    });
    readProjectWikiIndexMock.mockResolvedValue({
      pages: [
        {
          id: 'page-1',
          slug: 'characters/atlas-hero',
          title: 'Atlas Hero',
          status: 'curated',
          filePath: 'characters/atlas-hero.md',
        },
      ],
    });
    readProjectWikiPageMock.mockResolvedValue(null);

    const { readProjectWikiCanonPage } = await loadWikiServiceModule();
    const result = await readProjectWikiCanonPage({
      workspace: buildWorkspace() as any,
      slug: 'characters/atlas-hero',
    });

    expect(result).toEqual({
      available: true,
      reason: 'page-not-found',
      workspace_id: 'atlas-workspace',
      page: null,
    });
  });
});
