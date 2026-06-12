import { describe, expect, it, vi } from 'vitest';

import { createWriterInput, WriterAgent } from '../../agents/writer';

describe('WriterAgent hook requirement additional coverage', () => {
  it('uses emotional transition guidance when the scene is not a chapter end', async () => {
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
          is_chapter_end: false,
        },
      }),
    );

    expect(llmService.generate).toHaveBeenCalledTimes(4);
    expect(String(llmService.generate.mock.calls[3]?.[0] ?? '')).toContain(
      'Complete emotional transition',
    );
    expect(String(llmService.generate.mock.calls[3]?.[0] ?? '')).not.toContain(
      'Must have a strong hook (Cliffhanger)',
    );
  });
});
