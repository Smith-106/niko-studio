import { describe, expect, it, vi } from 'vitest';

import { ImportLearningPipeline } from '../../learning/import-pipeline';
import {
  ExtractionTier,
  LearningCapability,
  PipelineStatus,
  type ReadingSession,
} from '../../learning/learning-types';
import { ReadingLearningPipeline } from '../../learning/reading-pipeline';
import { EntityType, WorldviewCategory } from '../../learning/learning-types';
import * as extractionUtils from '../../learning/extraction-utils';

function createKnowledgeService() {
  return {
    addDocument: vi.fn().mockResolvedValue(undefined),
    addEntity: vi.fn().mockResolvedValue(undefined),
  };
}

function createImportContent(): string {
  return [
    '---',
    'title: 导入测试',
    '---',
    '第一章 开始',
    '“走吧。”林风说道。',
    '“马上。”林风说道。',
    '在古城，魔法规则仍然支配着所有人。',
    '总而言之，正义比力量更重要。',
    '',
    '第二章 继续',
    '“跟上。”苏雨说道。',
    '“别怕。”苏雨说道。',
    '换句话说，王朝的法律塑造了秩序。',
  ].join('\n');
}

function createReadingContent(): string {
  return [
    '“继续。”林风说道。',
    '“快点。”林风说道。',
    '“我知道了。”苏雨说道。',
    '“别停。”苏雨说道。',
    '在帝国古城，魔法与仪式共同维持秩序。',
    '关键是，所有规则都要求守夜人服从钟楼法则。',
  ].join('');
}

function createSession(
  overrides: Partial<ReadingSession> = {},
): ReadingSession {
  return {
    bookId: 'book-1',
    currentChapter: 1,
    totalChapters: 10,
    lastPosition: 'p1',
    startedAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('learning pipelines additional coverage', () => {
  it('runs the import pipeline end-to-end and persists deduplicated results', async () => {
    const knowledgeService = createKnowledgeService();
    const pipeline = new ImportLearningPipeline({
      knowledgeService: knowledgeService as never,
      graphEngine: {} as never,
    });
    const extractEntitiesSpy = vi
      .spyOn(extractionUtils, 'extractEntities')
      .mockReturnValueOnce([
        {
          name: '林风',
          type: EntityType.CHARACTER,
          confidence: 0.7,
          attributes: {},
          mentions: 1,
        },
      ])
      .mockReturnValueOnce([
        {
          name: '林风',
          type: EntityType.CHARACTER,
          confidence: 0.9,
          attributes: {},
          mentions: 2,
        },
        {
          name: '苏雨',
          type: EntityType.CHARACTER,
          confidence: 0.8,
          attributes: {},
          mentions: 2,
        },
      ]);
    const worldviewSpy = vi
      .spyOn(extractionUtils, 'detectWorldviewElements')
      .mockReturnValue([
        {
          name: '魔法规则',
          category: WorldviewCategory.RULE,
          description: 'rule',
          evidence: ['e1'],
          confidence: 0.6,
        },
      ]);
    const insightsSpy = vi
      .spyOn(extractionUtils, 'extractBasicInsights')
      .mockReturnValueOnce([
        {
          content: '总而言之，正义比力量更重要。',
          source: 'novel-import',
          tags: ['auto-extracted'],
          confidence: 0.6,
          chapter: 'seg-0',
        },
      ])
      .mockReturnValueOnce([
        {
          content: '换句话说，王朝的法律塑造了秩序。',
          source: 'novel-import',
          tags: ['auto-extracted'],
          confidence: 0.6,
          chapter: 'seg-1',
        },
      ]);

    const result = await pipeline.execute({
      content: createImportContent(),
      metadata: {
        format: 'md',
        source: 'novel-import',
      },
      options: {
        segmentMode: 'chapter',
      },
    });

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '林风', mentions: 3, confidence: 0.9 }),
        expect.objectContaining({ name: '苏雨', mentions: 2 }),
      ]),
    );
    expect(result.insights).toHaveLength(2);
    expect(result.worldviewElements.length).toBeGreaterThan(0);
    expect(result.metadata).toMatchObject({
      source: 'novel-import',
      format: 'md',
      segmentMode: 'chapter',
      segmentCount: 2,
    });

    expect(knowledgeService.addDocument).toHaveBeenCalledTimes(3);
    expect(knowledgeService.addDocument.mock.calls[0]?.[1]).toContain(
      'words',
    );
    expect(knowledgeService.addEntity).toHaveBeenCalledTimes(2);
    expect(knowledgeService.addEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '林风',
        source: 'novel-import',
      }),
    );

    expect(pipeline.getStatus()).toMatchObject({
      capability: LearningCapability.IMPORT,
      status: PipelineStatus.COMPLETED,
      itemsProcessed: 1,
      enabled: true,
      error: undefined,
    });
    expect(pipeline.getStatus().lastRun).toEqual(expect.any(String));

    extractEntitiesSpy.mockRestore();
    worldviewSpy.mockRestore();
    insightsSpy.mockRestore();
  });

  it('honors import pipeline enable-disable state and records failures', async () => {
    const knowledgeService = createKnowledgeService();
    knowledgeService.addEntity.mockRejectedValueOnce(new Error('entity store failed'));

    const pipeline = new ImportLearningPipeline({
      knowledgeService: knowledgeService as never,
      graphEngine: {} as never,
    });
    const extractEntitiesSpy = vi
      .spyOn(extractionUtils, 'extractEntities')
      .mockReturnValue([
        {
          name: '林风',
          type: EntityType.CHARACTER,
          confidence: 0.7,
          attributes: {},
          mentions: 2,
        },
      ]);

    pipeline.disable();
    await expect(
      pipeline.execute({
        content: createImportContent(),
      }),
    ).rejects.toThrow('Import learning pipeline is disabled');
    expect(pipeline.getStatus()).toMatchObject({
      status: PipelineStatus.IDLE,
      enabled: false,
      itemsProcessed: 0,
    });

    pipeline.enable();
    await expect(
      pipeline.execute({
        content: createImportContent(),
        metadata: {
          format: 'txt',
          source: 'broken-import',
        },
      }),
    ).rejects.toThrow('entity store failed');

    expect(pipeline.getStatus()).toMatchObject({
      status: PipelineStatus.FAILED,
      enabled: true,
      itemsProcessed: 0,
      error: 'entity store failed',
    });

    extractEntitiesSpy.mockRestore();
  });

  it('blocks early reading sessions and skips persistence while still updating the session', async () => {
    const knowledgeService = createKnowledgeService();
    const pipeline = new ReadingLearningPipeline({
      knowledgeService: knowledgeService as never,
      graphEngine: {} as never,
    });
    const session = createSession({
      bookId: 'book-early',
      currentChapter: 1,
      totalChapters: 12,
    });

    const result = await pipeline.execute({
      content: createReadingContent(),
      metadata: {
        session,
      },
    });

    expect(result.entities).toEqual([]);
    expect(result.insights).toEqual([]);
    expect(result.worldviewElements).toEqual([]);
    expect(result.metadata).toMatchObject({
      bookId: 'book-early',
      tier: ExtractionTier.BLOCKED,
      allowedCategories: [],
      distilledCount: 0,
      crossReferences: [],
    });
    expect(knowledgeService.addEntity).not.toHaveBeenCalled();
    expect(knowledgeService.addDocument).not.toHaveBeenCalled();
    expect(pipeline.getSession('book-early')).toMatchObject({
      bookId: 'book-early',
      currentChapter: 1,
      totalChapters: 12,
    });
    expect(pipeline.getSession('book-early')?.updatedAt).toEqual(
      expect.any(String),
    );
  });

  it('runs heavy reading extraction, persists results, and keeps session status', async () => {
    const knowledgeService = createKnowledgeService();
    const pipeline = new ReadingLearningPipeline({
      knowledgeService: knowledgeService as never,
      graphEngine: {} as never,
    });
    const extractEntitiesSpy = vi
      .spyOn(extractionUtils, 'extractEntities')
      .mockReturnValue([
        {
          name: '林风',
          type: EntityType.CHARACTER,
          confidence: 0.85,
          attributes: {},
          mentions: 2,
        },
        {
          name: '苏雨',
          type: EntityType.CHARACTER,
          confidence: 0.8,
          attributes: {},
          mentions: 2,
        },
      ]);
    const worldviewSpy = vi
      .spyOn(extractionUtils, 'detectWorldviewElements')
      .mockReturnValue([
        {
          name: '帝国',
          category: WorldviewCategory.SOCIAL_STRUCTURE,
          description: 'social',
          evidence: ['e1'],
          confidence: 0.6,
        },
      ]);
    const insightsSpy = vi
      .spyOn(extractionUtils, 'extractBasicInsights')
      .mockReturnValue([
        {
          content: '关键是，所有规则都要求守夜人服从钟楼法则。',
          source: 'book-late',
          tags: ['auto-extracted'],
          confidence: 0.6,
          chapter: 'ch9',
        },
      ]);
    const session = createSession({
      bookId: 'book-late',
      currentChapter: 9,
      totalChapters: 10,
    });

    const result = await pipeline.execute({
      content: createReadingContent(),
      metadata: {
        session,
      },
    });

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '林风' }),
        expect.objectContaining({ name: '苏雨' }),
      ]),
    );
    expect(result.worldviewElements.length).toBeGreaterThan(0);
    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.metadata).toMatchObject({
      bookId: 'book-late',
      tier: ExtractionTier.HEAVY,
      distilledCount: result.insights.length * 6,
    });

    expect(knowledgeService.addEntity).toHaveBeenCalledTimes(2);
    expect(knowledgeService.addDocument).toHaveBeenCalledTimes(1);
    expect(knowledgeService.addDocument).toHaveBeenCalledWith(
      expect.stringMatching(/^reading-book-late-/),
      expect.stringContaining('关键是'),
      expect.objectContaining({
        type: 'reading-insights',
        bookId: 'book-late',
      }),
    );

    expect(pipeline.getSession('book-late')).toMatchObject({
      bookId: 'book-late',
      currentChapter: 9,
      totalChapters: 10,
    });
    expect(pipeline.getStatus()).toMatchObject({
      capability: LearningCapability.READING,
      status: PipelineStatus.COMPLETED,
      itemsProcessed: 1,
      enabled: true,
      error: undefined,
    });

    extractEntitiesSpy.mockRestore();
    worldviewSpy.mockRestore();
    insightsSpy.mockRestore();
  });

  it('uses the default heavy tier without a stored session and reports reading failures', async () => {
    const knowledgeService = createKnowledgeService();
    knowledgeService.addDocument.mockRejectedValueOnce(
      new Error('reading persistence failed'),
    );

    const pipeline = new ReadingLearningPipeline({
      knowledgeService: knowledgeService as never,
      graphEngine: {} as never,
    });

    pipeline.disable();
    await expect(
      pipeline.execute({
        content: createReadingContent(),
      }),
    ).rejects.toThrow('Reading learning pipeline is disabled');
    expect(pipeline.getStatus()).toMatchObject({
      status: PipelineStatus.IDLE,
      enabled: false,
      itemsProcessed: 0,
    });

    pipeline.enable();
    await expect(
      pipeline.execute({
        content: createReadingContent(),
        metadata: {
          bookId: 'book-default',
        },
      }),
    ).rejects.toThrow('reading persistence failed');

    expect(pipeline.getSession('book-default')).toBeUndefined();
    expect(pipeline.getStatus()).toMatchObject({
      status: PipelineStatus.FAILED,
      enabled: true,
      itemsProcessed: 0,
      error: 'reading persistence failed',
    });
  });
});
