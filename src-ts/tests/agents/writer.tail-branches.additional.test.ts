import { describe, expect, it, vi } from 'vitest';

import {
  createWriterNode,
  WriterAgent,
  type WriterOutput,
} from '../../agents/writer';
import { SKILL_REGISTRY } from '../../agents/skill-router';

function createLlmService(response: string = 'generated draft') {
  return {
    generate: vi.fn().mockResolvedValue(response),
  };
}

function createEmptyOutput(content = 'draft output'): WriterOutput {
  return {
    content,
    wordcount: 10,
    characters_appeared: [],
    locations: [],
    foreshadows_planted: [],
    foreshadows_harvested: [],
    sensory_types_used: [],
    forbidden_words_found: [],
    sections_needing_review: [],
  };
}

describe('WriterAgent tail additional coverage', () => {
  it('falls back to registry names and raw skill ids, and normalizes empty skill state restores', () => {
    const llmService = createLlmService();
    const knownSkillId = Object.keys(SKILL_REGISTRY)[0]!;
    const knownSkillName = (SKILL_REGISTRY as Record<string, { name?: string }>)[knownSkillId]?.name ?? knownSkillId;

    const writer = new WriterAgent({
      llmService: llmService as never,
      skillRouter: {} as never,
      skillLoader: {
        loadFull: vi.fn().mockImplementation((skillId: string) => ({
          meta: {
            name: '',
            description: '',
            tags: [],
            triggers: [],
          },
          content: `content for ${skillId}`,
          path: `/tmp/${skillId}/SKILL.md`,
          techniques: [],
        })),
      } as never,
      enableKnowledgeRetrieval: false,
    });

    const guidance = writer.injectSkills([knownSkillId, 'unknown-skill']);
    expect(guidance).toContain(`### ${knownSkillName}`);
    expect(guidance).toContain(`### unknown-skill`);

    expect((writer as any).collectEffectiveSkillIds({
      world_settings: null,
    })).toEqual([]);
    expect((writer as any).collectEffectiveSkillIds({
      world_settings: {
        skill_ids: ['skill-a', 'skill-a', 'skill-b', 3],
      },
    })).toEqual(['skill-a', 'skill-b']);

    const warnings: string[] = [];
    (writer as any).injectedSkills = ['temporary'];
    (writer as any).injectedSkillGuidance = 'temporary guidance';
    (writer as any).safeExitSkillScope({}, warnings);
    expect((writer as any).injectedSkills).toEqual([]);
    expect((writer as any).injectedSkillGuidance).toBe('');
    expect(warnings).toEqual([]);

    expect((writer as any).isChapterEnd({
      scene_id: undefined,
      world_settings: {},
    })).toBe(false);
  });

  it('uses fallback emotional defaults and non-chapter-end hook requirements during write', async () => {
    const llmService = createLlmService('scene text');
    const writer = new WriterAgent({
      llmService: llmService as never,
      enableKnowledgeRetrieval: false,
    });

    const unusualArc = {
      split: vi.fn().mockReturnValue([]),
    };

    const output = await writer.write({
      scene_id: 'CH03-SC02',
      chapter_num: 3,
      pov_character: 'Aster',
      objective: 'Find the witness',
      conflict: 'Lose the trail',
      outcome: 'Recover the clue',
      plot_beat: 'turn',
      emotional_arc: unusualArc as unknown as string,
      sensory_guidance: {},
      character_profiles: [],
      world_settings: {},
      foreshadows_to_plant: [],
      foreshadows_to_harvest: [],
      word_target: 900,
    } as never);

    expect(output.content.length).toBeGreaterThan(0);
    expect(unusualArc.split).toHaveBeenCalledWith('->');

    const prompts = llmService.generate.mock.calls.map(call => String(call[0]));
    expect(prompts[0]).toContain('- Emotional starting point: calm');
    expect(prompts[2]).toContain('From calm to change');
    expect(prompts[3]).toContain('Complete emotional transition');
  });

  it('defaults revise feedback buckets and createWriterNode state fallbacks', async () => {
    const llmService = createLlmService('steady revision');
    const writer = new WriterAgent({
      llmService: llmService as never,
      enableKnowledgeRetrieval: false,
    });

    const revised = await writer.revise('Draft body', {});
    expect(revised.content).toContain('steady revision');
    const revisePrompt = String(llmService.generate.mock.calls[0]?.[0] ?? '');
    expect(revisePrompt).not.toContain('Focus on improving:');
    expect(revisePrompt).not.toContain('Fix the following issues:');
    expect(revisePrompt).not.toContain('Adopt the following suggestions:');
    expect(revisePrompt).not.toContain('Style optimization goals:');

    const writeSpy = vi.spyOn(WriterAgent.prototype, 'write').mockResolvedValue(createEmptyOutput('node draft'));
    const node = createWriterNode(createLlmService() as never);

    const result = await node({});

    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scene_id: 'CH01-SC01',
        chapter_num: 1,
        pov_character: 'protagonist',
        objective: 'advance plot',
        conflict: 'encounter obstacle',
        outcome: '+',
        plot_beat: 'scene progression',
        emotional_arc: 'calm->change',
        sensory_guidance: {},
        character_profiles: [],
        world_settings: {},
        foreshadows_to_plant: [],
        foreshadows_to_harvest: [],
        word_target: 2000,
      }),
      true,
    );
    expect(result).toMatchObject({
      draft_content: 'node draft',
      writer_self_check: {
        sensory_types: [],
        forbidden_words: [],
        needs_review: [],
      },
    });
  });
});
