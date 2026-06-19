import { describe, expect, it, vi } from 'vitest';

import { NarrativeVoiceManager } from '../../narrative/narrative-voice';

describe('NarrativeVoiceManager branch-gap coverage', () => {
  it('falls back to empty weak and strong passage lists when llm omits them', async () => {
    const llmClient = {
      generateJson: vi
        .fn()
        .mockResolvedValueOnce({
          weak_passages: undefined,
          strong_passages: undefined,
        })
        .mockResolvedValueOnce({
          strong_passages: undefined,
        }),
    };
    const manager = new NarrativeVoiceManager(llmClient as never);

    await expect(manager.identifyWeakPassages('content')).resolves.toEqual([]);
    await expect(manager.extractStrongPassages('content')).resolves.toEqual([]);
  });

  it('maps missing improved examples to null', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValueOnce({
        weak_passages: [
          {
            location: '第 1 段',
            original_text: '原句',
            issue: '问题',
            suggestion: '建议',
          },
        ],
        strong_passages: undefined,
      }),
    };
    const manager = new NarrativeVoiceManager(llmClient as never);

    await expect(manager.identifyWeakPassages('content')).resolves.toEqual([
      {
        location: '第 1 段',
        originalText: '原句',
        issue: '问题',
        suggestion: '建议',
        improvedExample: null,
      },
    ]);
  });
});
