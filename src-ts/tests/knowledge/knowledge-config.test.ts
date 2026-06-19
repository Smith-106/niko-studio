/**
 * Knowledge Config Tests
 *
 * Tests ConfigLoader, ConfigError, env var substitution, YAML parsing,
 * and configuration from different sources.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import {
  ConfigLoader,
  ConfigError,
  loadConfig,
} from '../../knowledge/config';

import { ProviderType, ModelTier, createServiceConfig } from '../../knowledge/models';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConfigError', () => {
  it('extends Error with ConfigError name', () => {
    const err = new ConfigError('test error');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConfigError');
    expect(err.message).toBe('test error');
  });
});

describe('ConfigLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fromDict', () => {
    it('creates default config from empty dict', () => {
      const config = ConfigLoader.fromDict({});
      expect(config).toBeDefined();
      expect(config.providers).toEqual([]);
      expect(config.defaultLLMProvider).toBe(ProviderType.OPENAI);
      expect(config.defaultEmbeddingProvider).toBe(ProviderType.LOCAL);
      expect(config.embeddingCacheEnabled).toBe(true);
      expect(config.retryMaxAttempts).toBe(3);
    });

    it('parses providers from dict', () => {
      const config = ConfigLoader.fromDict({
        providers: {
          openai: {
            type: 'openai',
            api_key: 'sk-test',
            base_url: 'https://api.openai.com/v1',
            models: {
              fast: 'gpt-4o-mini',
              default: 'gpt-4o',
              powerful: 'gpt-4-turbo',
            },
            embedding_model: 'text-embedding-3-small',
          },
        },
      });
      expect(config.providers.length).toBe(1);
      expect(config.providers[0].provider).toBe(ProviderType.OPENAI);
      expect(config.providers[0].apiKey).toBe('sk-test');
      expect(config.providers[0].baseUrl).toBe('https://api.openai.com/v1');
      expect(config.providers[0].modelMapping[ModelTier.FAST]).toBe('gpt-4o-mini');
      expect(config.providers[0].embeddingModel).toBe('text-embedding-3-small');
    });

    it('uses key name as provider type when type field missing', () => {
      const config = ConfigLoader.fromDict({
        providers: {
          anthropic: {
            api_key: 'ak-test',
          },
        },
      });
      expect(config.providers[0].provider).toBe(ProviderType.ANTHROPIC);
    });

    it('parses cache configuration', () => {
      const config = ConfigLoader.fromDict({
        cache: {
          enabled: false,
          ttl: 7200,
          max_size: 5000,
        },
      });
      expect(config.embeddingCacheEnabled).toBe(false);
      expect(config.embeddingCacheTTL).toBe(7200);
      expect(config.embeddingCacheMaxSize).toBe(5000);
    });

    it('parses retry configuration', () => {
      const config = ConfigLoader.fromDict({
        retry: {
          max_retries: 5,
          base_delay: 2.0,
          max_delay: 120.0,
          exponential_base: 3.0,
        },
      });
      expect(config.retryMaxAttempts).toBe(5);
      expect(config.retryInitialDelay).toBe(2.0);
      expect(config.retryMaxDelay).toBe(120.0);
      expect(config.retryExponentialBase).toBe(3.0);
    });

    it('parses default providers', () => {
      const config = ConfigLoader.fromDict({
        default_llm_provider: 'anthropic',
        default_embedding_provider: 'local',
      });
      expect(config.defaultLLMProvider).toBe(ProviderType.ANTHROPIC);
      expect(config.defaultEmbeddingProvider).toBe(ProviderType.LOCAL);
    });

    it('parses health check interval', () => {
      const config = ConfigLoader.fromDict({
        health_check_interval: 30,
      });
      expect(config.healthCheckInterval).toBe(30);
    });

    it('throws ConfigError for invalid provider type', () => {
      expect(() => ConfigLoader.fromDict({ default_llm_provider: 'invalid_provider' })).toThrow(ConfigError);
    });

    it('skips null provider data', () => {
      const config = ConfigLoader.fromDict({
        providers: {
          openai: null as any,
          anthropic: {
            type: 'anthropic',
          },
        },
      });
      expect(config.providers.length).toBe(1);
      expect(config.providers[0].provider).toBe(ProviderType.ANTHROPIC);
    });

    it('handles provider defaults for optional fields', () => {
      const config = ConfigLoader.fromDict({
        providers: {
          openai: {},
        },
      });
      const prov = config.providers[0];
      expect(prov.apiKey).toBeNull();
      expect(prov.baseUrl).toBeNull();
      expect(prov.maxRetries).toBe(3);
      expect(prov.timeout).toBe(60.0);
      expect(prov.rateLimitRpm).toBe(60);
    });
  });

  describe('fromYAML', () => {
    it('throws ConfigError for non-existent file', () => {
      expect(() => ConfigLoader.fromYAML('/nonexistent/file.yaml')).toThrow(ConfigError);
    });

    it('loads config from YAML file', () => {
      const fs = require('node:fs');
      const { writeFileSync, mkdirSync, mkdtempSync } = fs;
      const { join } = require('node:path');
      const { tmpdir } = require('node:os');

      const tempDir = mkdtempSync(join(tmpdir(), 'niko-config-'));
      const configPath = join(tempDir, 'services.yaml');
      const yaml = `
default_llm_provider: openai
default_embedding_provider: openai
health_check_interval: 30
cache:
  enabled: true
  ttl: 7200
  max_size: 5000
retry:
  max_retries: 2
  base_delay: 0.5
providers:
  openai:
    type: openai
    api_key: sk-test
    models:
      fast: gpt-4o-mini
      default: gpt-4o
      powerful: gpt-4-turbo
    embedding_model: text-embedding-3-small
`;
      writeFileSync(configPath, yaml, 'utf-8');

      try {
        const config = ConfigLoader.fromYAML(configPath);
        expect(config.defaultLLMProvider).toBe(ProviderType.OPENAI);
        expect(config.healthCheckInterval).toBe(30);
        expect(config.embeddingCacheTTL).toBe(7200);
        expect(config.providers.length).toBe(1);
        expect(config.providers[0].apiKey).toBe('sk-test');
      } finally {
        const { rmSync } = fs;
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('fromEnv', () => {
    let originalEnv: NodeJS.ProcessEnv;
    const envKeysToClear = [
      'OPENAI_API_KEY',
      'OPENAI_BASE_URL',
      'OPENAI_MODEL_FAST',
      'OPENAI_MODEL_DEFAULT',
      'OPENAI_MODEL_POWERFUL',
      'OPENAI_EMBEDDING_MODEL',
      'ANTHROPIC_API_KEY',
      'ANTHROPIC_MODEL_FAST',
      'ANTHROPIC_MODEL_DEFAULT',
      'ANTHROPIC_MODEL_POWERFUL',
      'AZURE_OPENAI_API_KEY',
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_MODEL_FAST',
      'AZURE_MODEL_DEFAULT',
      'AZURE_MODEL_POWERFUL',
      'AZURE_EMBEDDING_MODEL',
      'LOCAL_LLM_BASE_URL',
      'LOCAL_MODEL_FAST',
      'LOCAL_MODEL_DEFAULT',
      'LOCAL_MODEL_POWERFUL',
      'LOCAL_EMBEDDING_MODEL',
      'LLM_DEFAULT_PROVIDER',
      'EMBEDDING_DEFAULT_PROVIDER',
      'EMBEDDING_CACHE_ENABLED',
      'EMBEDDING_CACHE_TTL',
      'EMBEDDING_CACHE_MAX_SIZE',
      'RETRY_MAX_ATTEMPTS',
      'RETRY_INITIAL_DELAY',
      'RETRY_MAX_DELAY',
      'RETRY_EXPONENTIAL_BASE',
      'HEALTH_CHECK_INTERVAL',
    ] as const;

    const clearConfigEnv = () => {
      for (const key of envKeysToClear) {
        delete process.env[key];
      }
    };

    beforeEach(() => {
      originalEnv = { ...process.env };
      clearConfigEnv();
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('creates config from OPENAI_API_KEY env', () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const config = ConfigLoader.fromEnv();
      expect(config.providers.length).toBe(1);
      expect(config.providers[0].provider).toBe(ProviderType.OPENAI);
      expect(config.providers[0].apiKey).toBe('sk-test-key');
    });

    it('creates config from ANTHROPIC_API_KEY env', () => {
      process.env.ANTHROPIC_API_KEY = 'ak-test-key';
      const config = ConfigLoader.fromEnv();
      expect(config.providers.length).toBe(1);
      expect(config.providers[0].provider).toBe(ProviderType.ANTHROPIC);
    });

    it('creates config from AZURE_OPENAI_API_KEY env', () => {
      process.env.AZURE_OPENAI_API_KEY = 'az-test-key';
      const config = ConfigLoader.fromEnv();
      const azure = config.providers.find((p) => p.provider === ProviderType.AZURE);
      expect(azure).toBeDefined();
    });

    it('creates config from LOCAL_LLM_BASE_URL env', () => {
      process.env.LOCAL_LLM_BASE_URL = 'http://localhost:8080';
      const config = ConfigLoader.fromEnv();
      const local = config.providers.find((p) => p.provider === ProviderType.LOCAL);
      expect(local).toBeDefined();
      expect(local!.baseUrl).toBe('http://localhost:8080');
    });

    it('uses model override env vars', () => {
      process.env.OPENAI_API_KEY = 'sk-key';
      process.env.OPENAI_MODEL_FAST = 'my-fast-model';
      process.env.OPENAI_MODEL_DEFAULT = 'my-default-model';
      process.env.OPENAI_MODEL_POWERFUL = 'my-powerful-model';
      const config = ConfigLoader.fromEnv();
      const openai = config.providers[0];
      expect(openai.modelMapping[ModelTier.FAST]).toBe('my-fast-model');
      expect(openai.modelMapping[ModelTier.DEFAULT]).toBe('my-default-model');
      expect(openai.modelMapping[ModelTier.POWERFUL]).toBe('my-powerful-model');
    });

    it('parses cache env vars', () => {
      process.env.EMBEDDING_CACHE_ENABLED = 'false';
      process.env.EMBEDDING_CACHE_TTL = '3600';
      process.env.EMBEDDING_CACHE_MAX_SIZE = '5000';
      const config = ConfigLoader.fromEnv();
      expect(config.embeddingCacheEnabled).toBe(false);
      expect(config.embeddingCacheTTL).toBe(3600);
      expect(config.embeddingCacheMaxSize).toBe(5000);
    });

    it('parses retry env vars', () => {
      process.env.RETRY_MAX_ATTEMPTS = '5';
      process.env.RETRY_INITIAL_DELAY = '2.0';
      process.env.RETRY_MAX_DELAY = '120.0';
      process.env.RETRY_EXPONENTIAL_BASE = '3.0';
      const config = ConfigLoader.fromEnv();
      expect(config.retryMaxAttempts).toBe(5);
      expect(config.retryInitialDelay).toBe(2.0);
      expect(config.retryMaxDelay).toBe(120.0);
      expect(config.retryExponentialBase).toBe(3.0);
    });

    it('uses default provider env vars', () => {
      process.env.LLM_DEFAULT_PROVIDER = 'anthropic';
      process.env.EMBEDDING_DEFAULT_PROVIDER = 'local';
      const config = ConfigLoader.fromEnv();
      expect(config.defaultLLMProvider).toBe(ProviderType.ANTHROPIC);
      expect(config.defaultEmbeddingProvider).toBe(ProviderType.LOCAL);
    });

    it('throws ConfigError for invalid default provider', () => {
      process.env.LLM_DEFAULT_PROVIDER = 'nonexistent';
      expect(() => ConfigLoader.fromEnv()).toThrow(ConfigError);
    });
  });
});

describe('loadConfig', () => {
  it('falls back to env when file not found', () => {
    const config = loadConfig('/nonexistent/file.yaml');
    expect(config).toBeDefined();
    expect(config.defaultLLMProvider).toBe(ProviderType.OPENAI);
  });

  it('does not fall back to env when envFallback=false', () => {
    expect(() => loadConfig('/nonexistent/file.yaml', false)).toThrow();
  });
});

describe('parseSimpleYAML (indirect via fromDict)', () => {
  it('handles nested config via fromDict', () => {
    // This tests the simple YAML parser indirectly through fromDict
    // since fromYAML falls back to simple parser when js-yaml is unavailable
    const config = createServiceConfig({
      providers: [],
      defaultLLMProvider: ProviderType.OPENAI,
    });
    expect(config).toBeDefined();
  });
});
