import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('js-yaml', () => ({
  load() {
    throw new Error('mocked js-yaml failure');
  },
}));

import { ConfigLoader } from '../../knowledge/config';
import { ModelTier, ProviderType } from '../../knowledge/models';

describe('knowledge/config simple YAML fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses nested values through the simple YAML fallback parser', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-config-simple-'));
    const configPath = path.join(tempDir, 'services.yaml');

    fs.writeFileSync(configPath, `
# comment line
default_llm_provider: "openai"
default_embedding_provider: 'local'
health_check_interval: 45

cache:
  enabled: false
  ttl: 1234
  max_size: 99
retry:
  max_retries: 6
  base_delay: 1.5
  max_delay: 12
  exponential_base: 3
providers:
  openai:
    api_key: sk-simple
    base_url: null
    timeout: 42
    rate_limit_rpm: 88
    models:
      fast: "fast-model"
      default: 'default-model'
      powerful: powerful-model
    embedding_model: embed-model
unused_section:
  ignored
  nested:
    value: true
`, 'utf-8');

    try {
      const config = ConfigLoader.fromYAML(configPath);
      const provider = config.providers[0];

      expect(config.defaultLLMProvider).toBe(ProviderType.OPENAI);
      expect(config.defaultEmbeddingProvider).toBe(ProviderType.LOCAL);
      expect(config.healthCheckInterval).toBe(45);
      expect(config.embeddingCacheEnabled).toBe(false);
      expect(config.embeddingCacheTTL).toBe(1234);
      expect(config.embeddingCacheMaxSize).toBe(99);
      expect(config.retryMaxAttempts).toBe(6);
      expect(config.retryInitialDelay).toBe(1.5);
      expect(config.retryMaxDelay).toBe(12);
      expect(config.retryExponentialBase).toBe(3);
      expect(provider.apiKey).toBe('sk-simple');
      expect(provider.baseUrl).toBeNull();
      expect(provider.timeout).toBe(42);
      expect(provider.rateLimitRpm).toBe(88);
      expect(provider.embeddingModel).toBe('embed-model');
      expect(provider.modelMapping[ModelTier.FAST]).toBe('fast-model');
      expect(provider.modelMapping[ModelTier.DEFAULT]).toBe('default-model');
      expect(provider.modelMapping[ModelTier.POWERFUL]).toBe('powerful-model');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
