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

async function loadWikiServiceModule(options?: {
  normalizeProjectWikiSlug?: (value: string) => string;
}) {
  vi.resetModules();

  vi.doMock('../../project/wiki-store.js', () => ({
    resolveProjectWikiStore: resolveProjectWikiStoreMock,
    writeProjectWikiPage: writeProjectWikiPageMock,
    writeProjectWikiRawEvidence: writeProjectWikiRawEvidenceMock,
    appendProjectWikiLog: appendProjectWikiLogMock,
    readProjectWikiIndex: readProjectWikiIndexMock,
    readProjectWikiPage: readProjectWikiPageMock,
  }));

  if (options?.normalizeProjectWikiSlug) {
    vi.doMock('../../project/wiki-schema.js', async () => {
      const actual = await vi.importActual<typeof import('../../project/wiki-schema.js')>(
        '../../project/wiki-schema.js',
      );
      return {
        ...actual,
        normalizeProjectWikiSlug: options.normalizeProjectWikiSlug,
      };
    });
  } else {
    vi.doUnmock('../../project/wiki-schema.js');
  }

  return import('../../mcp/services/wiki.js');
}

describe('mcp wiki service branch gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('falls back to title-based evidence seeds and synthetic entry filenames', async () => {
    resolveProjectWikiStoreMock.mockReturnValue({
      available: true,
      reason: null,
      workspaceId: 'atlas-workspace',
    });
    writeProjectWikiPageMock.mockResolvedValue({
      frontmatter: {
        id: 'page-1',
        slug: '   ',
        title: 'Atlas Hero',
        status: 'curated',
        promotedFrom: 'manual',
      },
      markdown: '# Atlas Hero',
      path: 'C:/tmp/atlas-hero.md',
    });
    writeProjectWikiRawEvidenceMock.mockResolvedValue('C:/tmp/raw-evidence.md');
    appendProjectWikiLogMock.mockResolvedValue('   ');

    const { promoteProjectWikiCanon } = await loadWikiServiceModule({
      normalizeProjectWikiSlug: () => '',
    });
    const result = await promoteProjectWikiCanon({
      workspace: buildWorkspace() as any,
      title: 'Atlas Hero',
      body: 'body',
      rawEvidence: {
        content: 'raw note',
      },
    });

    expect(writeProjectWikiRawEvidenceMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'atlas-workspace' }),
      'promotions/manual/entry.md',
      'raw note',
    );
    expect(result.raw_evidence_path).toBe('C:/tmp/raw-evidence.md');
    expect(result.log_entry).toBeNull();
  });

  it('handles empty wiki indexes and clamps the fallback list limit', async () => {
    resolveProjectWikiStoreMock.mockReturnValue({
      available: true,
      reason: null,
      workspaceId: 'atlas-workspace',
    });
    readProjectWikiIndexMock.mockResolvedValue(null);

    const { listProjectWikiCanonPages } = await loadWikiServiceModule();
    const result = await listProjectWikiCanonPages({
      workspace: buildWorkspace() as any,
      limit: Number.NaN,
    });

    expect(result).toEqual({
      available: true,
      reason: null,
      workspace_id: 'atlas-workspace',
      total_pages: 0,
      pages: [],
    });
  });

  it('returns unavailable when read requests resolve to a missing wiki store', async () => {
    resolveProjectWikiStoreMock.mockReturnValue({
      available: false,
      reason: 'missing-workspace-root',
      workspaceId: null,
    });

    const { readProjectWikiCanonPage } = await loadWikiServiceModule();
    const result = await readProjectWikiCanonPage({
      workspace: buildWorkspace() as any,
      slug: 'characters/atlas-hero',
    });

    expect(result).toEqual({
      available: false,
      reason: 'missing-workspace-root',
      workspace_id: null,
      page: null,
    });
  });
});
