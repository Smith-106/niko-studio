import { describe, expect, it, vi } from 'vitest';

import { EntityType, PipelineStatus } from '../../learning/learning-types';
import { ReadingLearningPipeline } from '../../learning/reading-pipeline';
import * as extractionUtils from '../../learning/extraction-utils';

function createKnowledgeService() {
  return {
    addDocument: vi.fn().mockResolvedValue(undefined),
    addEntity: vi.fn().mockResolvedValue(undefined),
  };
}

describe('learning/reading-pipeline additional coverage', () => {
  it('falls back to the unknown book id when no metadata or session is provided', async () => {
    const knowledgeService = createKnowledgeService();
    const pipeline = new ReadingLearningPipeline({
      knowledgeService: knowledgeService as never,
      graphEngine: {} as never,
    });
    const extractEntitiesSpy = vi
      .spyOn(extractionUtils, 'extractEntities')
      .mockReturnValue([]);
    const worldviewSpy = vi
      .spyOn(extractionUtils, 'detectWorldviewElements')
      .mockReturnValue([]);
    const insightsSpy = vi
      .spyOn(extractionUtils, 'extractBasicInsights')
      .mockReturnValue([]);

    const result = await pipeline.execute({
      content: 'A quiet chapter with no reusable entities.',
    });

    expect(result.metadata).toMatchObject({
      bookId: 'unknown',
      distilledCount: 0,
      crossReferences: [],
    });
    expect(knowledgeService.addEntity).not.toHaveBeenCalled();
    expect(knowledgeService.addDocument).not.toHaveBeenCalled();

    extractEntitiesSpy.mockRestore();
    worldviewSpy.mockRestore();
    insightsSpy.mockRestore();
  });

  it('stringifies non-Error failures in pipeline status', async () => {
    const knowledgeService = createKnowledgeService();
    knowledgeService.addEntity.mockRejectedValueOnce('string failure');

    const pipeline = new ReadingLearningPipeline({
      knowledgeService: knowledgeService as never,
      graphEngine: {} as never,
    });
    const extractEntitiesSpy = vi
      .spyOn(extractionUtils, 'extractEntities')
      .mockReturnValue([
        {
          name: 'Hero',
          type: EntityType.CHARACTER,
          confidence: 0.9,
          attributes: {},
          mentions: 1,
        },
      ]);
    const worldviewSpy = vi
      .spyOn(extractionUtils, 'detectWorldviewElements')
      .mockReturnValue([]);
    const insightsSpy = vi
      .spyOn(extractionUtils, 'extractBasicInsights')
      .mockReturnValue([]);

    await expect(
      pipeline.execute({
        content: 'Hero enters the room.',
        metadata: {
          bookId: 'book-failure',
        },
      }),
    ).rejects.toBe('string failure');

    expect(pipeline.getStatus()).toMatchObject({
      status: PipelineStatus.FAILED,
      enabled: true,
      itemsProcessed: 0,
      error: 'string failure',
    });

    extractEntitiesSpy.mockRestore();
    worldviewSpy.mockRestore();
    insightsSpy.mockRestore();
  });
});
