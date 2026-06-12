import { describe, expect, it, vi } from 'vitest';

import { ImportLearningPipeline } from '../../learning/import-pipeline';
import { EntityType, PipelineStatus } from '../../learning/learning-types';
import * as extractionUtils from '../../learning/extraction-utils';

function createKnowledgeService() {
  return {
    addDocument: vi.fn().mockResolvedValue(undefined),
    addEntity: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ImportLearningPipeline branch-gap additional coverage', () => {
  it('uses default import metadata and removes duplicate insights by content', async () => {
    const knowledgeService = createKnowledgeService();
    const pipeline = new ImportLearningPipeline({
      knowledgeService: knowledgeService as never,
      graphEngine: {} as never,
    });

    const parseSpy = vi
      .spyOn(extractionUtils, 'parseDocument')
      .mockReturnValue('plain imported content');
    const segmentSpy = vi
      .spyOn(extractionUtils, 'segmentText')
      .mockReturnValue([{ label: 'seg-0', content: 'segment body' }]);
    const entitySpy = vi
      .spyOn(extractionUtils, 'extractEntities')
      .mockReturnValue([
        {
          name: '主角',
          type: EntityType.CHARACTER,
          confidence: 0.8,
          attributes: {},
          mentions: 1,
        },
      ]);
    const insightSpy = vi
      .spyOn(extractionUtils, 'extractBasicInsights')
      .mockReturnValue([
        {
          content: '重复洞察',
          source: 'import',
          tags: ['auto'],
          confidence: 0.6,
          chapter: 'seg-0',
        },
        {
          content: '重复洞察',
          source: 'import',
          tags: ['auto'],
          confidence: 0.5,
          chapter: 'seg-0',
        },
      ]);
    const styleSpy = vi
      .spyOn(extractionUtils, 'calculateStyleFeatures')
      .mockReturnValue({
        sentenceLength: 12,
        vocabularyDiversity: 0.4,
        dialogueRatio: 0.3,
        descriptionRatio: 0.4,
        pacingScore: 0.5,
        toneMarkers: [],
        summary: 'default style summary',
      });
    const worldviewSpy = vi
      .spyOn(extractionUtils, 'detectWorldviewElements')
      .mockReturnValue([]);

    const result = await pipeline.execute({
      content: 'raw input',
    });

    expect(parseSpy).toHaveBeenCalledWith('raw input', 'txt');
    expect(segmentSpy).toHaveBeenCalledWith('plain imported content', 'chapter');
    expect(insightSpy).toHaveBeenCalledWith('segment body', 'import', 'seg-0');
    expect(result.insights).toEqual([
      expect.objectContaining({
        content: '重复洞察',
      }),
    ]);
    expect(result.metadata).toMatchObject({
      source: 'import',
      format: 'txt',
      segmentMode: 'chapter',
      segmentCount: 1,
    });
    expect(knowledgeService.addDocument).toHaveBeenCalledWith(
      expect.stringMatching(/^import-import-/),
      'default style summary',
      expect.objectContaining({
        source: 'import',
        type: 'import-learning',
      }),
    );

    parseSpy.mockRestore();
    segmentSpy.mockRestore();
    entitySpy.mockRestore();
    insightSpy.mockRestore();
    styleSpy.mockRestore();
    worldviewSpy.mockRestore();
  });

  it('records non-Error failures using String(err)', async () => {
    const knowledgeService = createKnowledgeService();
    const pipeline = new ImportLearningPipeline({
      knowledgeService: knowledgeService as never,
      graphEngine: {} as never,
    });

    const parseSpy = vi
      .spyOn(extractionUtils, 'parseDocument')
      .mockImplementation(() => {
        throw 'pipeline exploded';
      });

    await expect(
      pipeline.execute({
        content: 'raw input',
      }),
    ).rejects.toBe('pipeline exploded');

    expect(pipeline.getStatus()).toMatchObject({
      status: PipelineStatus.FAILED,
      error: 'pipeline exploded',
      itemsProcessed: 0,
      enabled: true,
    });

    parseSpy.mockRestore();
  });
});
