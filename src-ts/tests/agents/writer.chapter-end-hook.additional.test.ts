import { describe, expect, it, vi } from 'vitest';

import { createWriterInput, WriterAgent } from '../../agents/writer';

describe('WriterAgent chapter-end hook coverage', () => {
  it('uses cliffhanger guidance when the scene is a chapter end', async () => {
    const llmService = {
      generate: vi.fn().mockResolvedValue('draft segment'),
    };
    const writer = new WriterAgent({
      llmService: llmService as never,
      enableKnowledgeRetrieval: false,
    });

    await writer.write(
      createWriterInput({
        scene_id: 'CH02-SC01',
        objective: 'Hold the line',
        conflict: 'A witness starts to panic',
        outcome: 'The team regains control',
        emotional_arc: 'calm->resolve',
        world_settings: {
          is_chapter_end: true,
        },
      }),
    );

    expect(llmService.generate).toHaveBeenCalledTimes(4);
    const resolutionPrompt = String(llmService.generate.mock.calls[3]?.[0] ?? '');
    expect(resolutionPrompt).toContain('### Hook Requirement');
    expect(resolutionPrompt).toContain(
      'Must have a strong hook (Cliffhanger)',
    );
  });
});
