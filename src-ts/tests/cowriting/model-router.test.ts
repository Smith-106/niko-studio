import { describe, expect, it } from 'vitest';

import {
  ModelRouter,
  createModelRouter,
  type ModelConfig,
} from '../../cowriting/ModelRouter.js';

const defaultModel: ModelConfig = {
  id: 'creative',
  name: 'Creative Cloud',
  provider: 'claude',
  maxTokens: 120_000,
  supportsStreaming: true,
};

const guidedModel: ModelConfig = {
  id: 'guided',
  name: 'Guided Analyst',
  provider: 'openai',
  maxTokens: 8_000,
  supportsStreaming: true,
};

const directedModel: ModelConfig = {
  id: 'directed',
  name: 'Directed Local',
  provider: 'local',
  maxTokens: 16_000,
  supportsStreaming: false,
};

const fallbackModel: ModelConfig = {
  id: 'fallback',
  name: 'Fallback Safety',
  provider: 'openai',
  maxTokens: 64_000,
  supportsStreaming: true,
};

describe('cowriting/ModelRouter', () => {
  it('routes each mode to the configured base model and exposes its config', () => {
    const router = new ModelRouter({
      defaultModel,
      guidedModel,
      directedModel,
      fallbackModel,
    });

    expect(router.getConfig()).toEqual({
      defaultModel,
      guidedModel,
      directedModel,
      fallbackModel,
    });
    expect(router.route('auto', 5_000)).toMatchObject({
      model: defaultModel,
      estimatedLatency: 'low',
    });
    expect(router.route('guided', 6_000)).toMatchObject({
      model: guidedModel,
      estimatedLatency: 'low',
    });
    expect(router.route('directed', 12_000)).toMatchObject({
      model: directedModel,
      estimatedLatency: 'low',
    });
  });

  it('falls back for unknown modes and large contexts while keeping the exceeded model in the reason string', () => {
    const router = createModelRouter({
      defaultModel,
      guidedModel,
      directedModel,
      fallbackModel,
    });

    const unknown = router.route('mystery', 100);
    const overflow = router.route('guided', 10_000);

    expect(unknown.model).toBe(defaultModel);
    expect(unknown.reason).toContain("Unknown mode 'mystery'");

    expect(overflow).toMatchObject({
      model: fallbackModel,
      estimatedLatency: 'low',
    });
    expect(overflow.reason).toContain('Guided Analyst');
    expect(overflow.reason).toContain('8000');
    expect(overflow.reason).not.toContain('Fallback Safety max tokens (64000)');
  });

  it('reports high latency for large cloud contexts', () => {
    const router = new ModelRouter({
      defaultModel,
      guidedModel,
      directedModel,
      fallbackModel,
    });

    const decision = router.route('auto', 80_000);

    expect(decision.estimatedLatency).toBe('high');
  });
});
