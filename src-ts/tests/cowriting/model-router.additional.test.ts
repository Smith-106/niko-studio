import { describe, expect, it } from 'vitest';

import type { ModelConfig } from '../../cowriting/ModelRouter.js';
import { ModelRouter } from '../../cowriting/ModelRouter.js';

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
  maxTokens: 80_000,
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

describe('cowriting/ModelRouter additional coverage', () => {
  it('reports medium latency for medium-sized cloud contexts', () => {
    const router = new ModelRouter({
      defaultModel,
      guidedModel,
      directedModel,
      fallbackModel,
    });

    const decision = router.route('guided', 20_000);

    expect(decision).toMatchObject({
      model: guidedModel,
      estimatedLatency: 'medium',
    });
  });
});
