import { describe, expect, it, vi } from 'vitest';

import { createWriterInput, WriterAgent, type WriterOutput } from '../../agents/writer';

function createLlmService(response: string = '生成的文本内容') {
  return {
    generate: vi.fn().mockResolvedValue(response),
  };
}

function createEmptyOutput(): WriterOutput {
  return {
    content: '',
    wordcount: 0,
    characters_appeared: [],
    locations: [],
    foreshadows_planted: [],
    foreshadows_harvested: [],
    sensory_types_used: [],
    forbidden_words_found: [],
    sections_needing_review: [],
  };
}

describe('WriterAgent additional coverage', () => {
  it('records a warning when knowledge retrieval throws', async () => {
    const writer = new WriterAgent({
      llmService: createLlmService() as never,
      knowledgeLayer: {
        search_entities: vi.fn().mockRejectedValue(new Error('search failed')),
        get_related_entities: vi.fn(),
        search_memories: vi.fn(),
      },
    });

    const warnings: string[] = [];
    const retrieved = await writer.retrieveContext('Aster', ['character'], 3, warnings);

    expect(retrieved).toEqual({
      entities: [],
      relations: [],
      memories: [],
    });
    expect(warnings).toEqual([
      expect.stringContaining('knowledge_retrieval_failed: Error: search failed'),
    ]);
  });

  it('returns early without a knowledge layer and warns when syncing fails', async () => {
    const output: WriterOutput = {
      ...createEmptyOutput(),
      characters_appeared: ['Ada Lovelace'],
      locations: ['Old Dock'],
      foreshadows_planted: ['silver key'],
    };

    const noKnowledgeWriter = new WriterAgent({
      llmService: createLlmService() as never,
    });
    await expect(noKnowledgeWriter.syncToKnowledgeLayer(output, 'scene-0')).resolves.toBeUndefined();

    const addEntity = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('persist failed'));
    const writer = new WriterAgent({
      llmService: createLlmService() as never,
      knowledgeLayer: {
        add_entity: addEntity,
      },
    });

    const warnings: string[] = [];
    await writer.syncToKnowledgeLayer(output, 'scene-9', warnings);

    expect(addEntity).toHaveBeenNthCalledWith(
      1,
      'ada_lovelace',
      'Ada Lovelace',
      'character',
      'Appeared in scene scene-9',
    );
    expect(addEntity).toHaveBeenNthCalledWith(
      2,
      'old_dock',
      'Old Dock',
      'location',
      'Featured in scene scene-9',
    );
    expect(addEntity).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(/^foreshadow_scene-9_\d+$/),
      'silver key',
      'foreshadow',
      'Planted in scene scene-9',
    );
    expect(warnings).toEqual([
      expect.stringContaining('knowledge_sync_failed: Error: persist failed'),
    ]);
  });

  it('merges prior metadata warnings and completes knowledge sync when all entities persist', async () => {
    const writer = new WriterAgent({
      llmService: createLlmService() as never,
      enableKnowledgeRetrieval: false,
      knowledgeLayer: {
        add_entity: vi.fn().mockResolvedValue(undefined),
      },
    });

    vi.spyOn(writer, 'write').mockResolvedValue({
      ...createEmptyOutput(),
      content: 'draft',
      metadata: {
        warnings: ['prior-warning', 42],
      },
      foreshadows_planted: ['silver key'],
    } as WriterOutput);

    const output = await writer.writeWithKnowledge(
      createWriterInput({
        scene_id: 'scene-merge-1',
        pov_character: 'Aster',
        objective: 'Find the ledger',
        conflict: 'Evade the dock watch',
      }),
    );

    expect(output.metadata).toMatchObject({
      warnings: ['prior-warning', '42'],
      knowledge_retrieved: {
        entities_count: 0,
        relations_count: 0,
        memories_count: 0,
      },
    });

    const syncWarnings: string[] = [];
    await expect(
      writer.syncToKnowledgeLayer(
        {
          ...createEmptyOutput(),
          characters_appeared: ['Ada Lovelace'],
          locations: ['Old Dock'],
          foreshadows_planted: ['silver key'],
        },
        'scene-merge-1',
        syncWarnings,
      ),
    ).resolves.toBeUndefined();
    expect(syncWarnings).toEqual([]);
    expect((writer as unknown as { knowledgeLayer: { add_entity: ReturnType<typeof vi.fn> } }).knowledgeLayer.add_entity)
      .toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(/^foreshadow_scene-merge-1_\d+$/),
        'silver key',
        'foreshadow',
        'Planted in scene scene-merge-1',
      );
  });

  it('builds continuation and rewrite prompts for targeted rewrite modes', async () => {
    const llmService = createLlmService('续写内容');
    const writer = new WriterAgent({
      llmService: llmService as never,
      enableKnowledgeRetrieval: false,
    });

    await writer.continueWriting('The fog curled along the pier.', 'Have the witness reveal the ledger.', 640);
    await writer.rewriteSection('The room was quiet.', 'Add more atmosphere.', 'sensory');
    await writer.rewriteSection('The room was quiet.', 'Keep the intent but sharpen the flow.', 'unknown-mode');

    expect(llmService.generate).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('About 640 words'),
      expect.objectContaining({ temperature: 0.7 }),
    );
    expect(llmService.generate.mock.calls[0]?.[0]).toContain('The fog curled along the pier.');
    expect(llmService.generate.mock.calls[0]?.[0]).toContain('Have the witness reveal the ledger.');
    expect(llmService.generate.mock.calls[1]?.[0]).toContain('Add sensory descriptions using animism technique');
    expect(llmService.generate.mock.calls[2]?.[0]).toContain('Rewrite according to instructions');
  });

  it('supports ai edit guidance and custom revision presets', async () => {
    const llmService = createLlmService('Revised text.');
    const writer = new WriterAgent({
      llmService: llmService as never,
      enableKnowledgeRetrieval: false,
    });

    await writer.revise(
      'Draft one',
      {
        issues: ['Conflict feels thin'],
        suggestions: ['Increase physical tension'],
        dimension_scores: { pacing: 6, coherence: 8 },
      },
      true,
      {
        humanization_preset: 'ai_edit_guidance',
      },
    );

    await writer.revise(
      'Draft two',
      {
        issues: [],
        suggestions: [],
        dimension_scores: {},
      },
      true,
      {
        humanization_preset: 'custom',
        custom_humanization_instruction: 'Preserve the clipped noir cadence.',
      },
    );

    const aiEditPrompt = String(llmService.generate.mock.calls[0]?.[0] ?? '');
    const customPrompt = String(llmService.generate.mock.calls[1]?.[0] ?? '');

    expect(aiEditPrompt).toContain('Focus on improving: pacing');
    expect(aiEditPrompt).toContain('Optimize text from an editing perspective');
    expect(aiEditPrompt).toContain('Conflict feels thin');
    expect(aiEditPrompt).toContain('Increase physical tension');
    expect(customPrompt).toContain('Follow custom revision instruction: Preserve the clipped noir cadence.');
  });

  it('analyzes sensory mix, forbidden words and character appearances in post processing', () => {
    const writer = new WriterAgent({
      llmService: createLlmService() as never,
      enableKnowledgeRetrieval: false,
    });
    const input = createWriterInput({
      character_profiles: [{ name: 'Aster' }, { name: 'Mira' }],
      foreshadows_to_plant: ['silver key'],
      foreshadows_to_harvest: ['old debt'],
    });

    const richOutput = (writer as any).postProcess(
      'Aster watched the bright light, heard a sound, felt cold pain, and noticed a bitter smell in the dark.',
      input,
    ) as WriterOutput;
    expect(richOutput.sensory_types_used).toEqual(['visual', 'auditory', 'tactile', 'olfactory']);
    expect(richOutput.characters_appeared).toEqual(['Aster']);
    expect(richOutput.foreshadows_planted).toEqual(['silver key']);
    expect(richOutput.foreshadows_harvested).toEqual(['old debt']);
    expect(richOutput.sections_needing_review).toEqual([]);

    const sparseOutput = (writer as any).postProcess(
      'Mira suddenly looked into the light.',
      input,
    ) as WriterOutput;
    expect(sparseOutput.forbidden_words_found).toEqual(['suddenly']);
    expect(sparseOutput.characters_appeared).toEqual(['Mira']);
    expect(sparseOutput.sections_needing_review).toEqual([
      'Contains forbidden words: suddenly',
      'Insufficient sensory description: visual',
    ]);
  });

  it('handles skill scope failures and chapter end detection fallbacks', () => {
    const writer = new WriterAgent({
      llmService: createLlmService() as never,
      skillRouter: {} as never,
      enableKnowledgeRetrieval: false,
    });

    const injectWarnings: string[] = [];
    vi.spyOn(writer as any, 'injectSkills').mockImplementation(() => {
      throw new Error('inject failed');
    });

    const previousState = (writer as any).enterSkillScope(['skill-a'], injectWarnings) as Record<string, unknown>;
    expect(previousState).toEqual({
      skills: [],
      guidance: '',
    });
    expect(injectWarnings).toEqual([
      expect.stringContaining('skill_injection_failed: Error: inject failed'),
    ]);

    const badPrevious: Record<string, unknown> = {};
    Object.defineProperty(badPrevious, 'skills', {
      get() {
        throw new Error('bad state');
      },
    });
    Object.defineProperty(badPrevious, 'guidance', {
      get() {
        return 'ignored';
      },
    });

    const exitWarnings: string[] = [];
    (writer as any).safeExitSkillScope(badPrevious, exitWarnings);
    expect(exitWarnings).toEqual([
      expect.stringContaining('skill_injection_failed: scope_exit: Error: bad state'),
    ]);
    expect((writer as any).injectedSkills).toEqual([]);
    expect((writer as any).injectedSkillGuidance).toBe('');

    expect((writer as any).isChapterEnd(createWriterInput({
      scene_id: 'CH09-SC09',
      world_settings: { is_chapter_end: true },
    }))).toBe(true);
    expect((writer as any).isChapterEnd(createWriterInput({
      scene_id: '   ',
    }))).toBe(false);
    expect((writer as any).isChapterEnd(createWriterInput({
      scene_id: 'CH02-SC01',
    }))).toBe(true);
    expect((writer as any).isChapterEnd(createWriterInput({
      scene_id: 'CH02-SC03',
    }))).toBe(false);
  });
});
