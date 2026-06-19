import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ConfigError,
  ConfigLoader,
  loadConfig,
} from '../../knowledge/config';
import { ProviderType } from '../../knowledge/models';

describe('knowledge/config additional coverage', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.env = originalEnv;
    process.chdir(originalCwd);
    vi.restoreAllMocks();
  });

  it('substitutes environment variables recursively when loading YAML', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-config-env-'));
    const configPath = path.join(tempDir, 'services.yaml');

    process.env.TEST_OPENAI_KEY = 'sk-env-value';

    fs.writeFileSync(configPath, `
default_llm_provider: openai
default_embedding_provider: local
providers:
  openai:
    api_key: \${TEST_OPENAI_KEY}
    base_url: https://\${API_HOST:api.example.com}/v1
    organization: \${OPENAI_ORG}
    embedding_model: \${EMBED_MODEL:text-embedding-3-small}
    models:
      fast: gpt-fast
      default: gpt-default
      powerful: gpt-power
metadata:
  label: plain-text
  tags:
    - \${TAG_ONE:alpha}
    - \${TAG_TWO}
`, 'utf-8');

    try {
      const config = ConfigLoader.fromYAML(configPath);
      const provider = config.providers[0];

      expect(provider.provider).toBe(ProviderType.OPENAI);
      expect(provider.apiKey).toBe('sk-env-value');
      expect(provider.baseUrl).toBe('https://api.example.com/v1');
      expect(provider.organization).toBeNull();
      expect(provider.embeddingModel).toBe('text-embedding-3-small');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('replaces missing env vars with empty strings during partial substitution', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-config-partial-'));
    const configPath = path.join(tempDir, 'services.yaml');

    fs.writeFileSync(configPath, [
      'default_llm_provider: openai',
      'default_embedding_provider: local',
      'providers:',
      '  openai:',
      '    api_key: sk-partial',
      // eslint-disable-next-line no-template-curly-in-string
      '    base_url: https://api.example.com/${MISSING_PATH}',
      // eslint-disable-next-line no-template-curly-in-string
      '    organization: tenant-${MISSING_ORG}',
      '    models:',
      '      fast: gpt-fast',
      '      default: gpt-default',
      '      powerful: gpt-power',
      '',
    ].join('\n'), 'utf-8');

    try {
      const config = ConfigLoader.fromYAML(configPath);
      const provider = config.providers[0];

      expect(provider.baseUrl).toBe('https://api.example.com/');
      expect(provider.organization).toBe('tenant-');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('wraps YAML read failures in ConfigError', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-config-error-'));
    const configPath = path.join(tempDir, 'services.yaml');
    fs.mkdirSync(configPath);

    try {
      expect(() => ConfigLoader.fromYAML(configPath)).toThrow(ConfigError);
      expect(() => ConfigLoader.fromYAML(configPath)).toThrow('YAML parse error');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('falls back to default retry delays when env values are invalid', () => {
    process.env.RETRY_INITIAL_DELAY = 'invalid';
    process.env.RETRY_MAX_DELAY = 'nan';
    process.env.RETRY_EXPONENTIAL_BASE = 'oops';

    const config = ConfigLoader.fromEnv();

    expect(config.retryInitialDelay).toBe(1.0);
    expect(config.retryMaxDelay).toBe(60.0);
    expect(config.retryExponentialBase).toBe(2.0);
  });

  it('chooses the first existing default config candidate when no path is supplied', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-config-candidates-'));
    fs.mkdirSync(path.join(tempDir, 'config'));
    fs.writeFileSync(path.join(tempDir, 'config', 'services.yaml'), 'default_llm_provider: anthropic\n', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'services.yaml'), 'default_llm_provider: openai\n', 'utf-8');

    try {
      process.chdir(tempDir);
      const config = loadConfig(undefined, false);
      expect(config.defaultLLMProvider).toBe(ProviderType.ANTHROPIC);
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('falls back to env config when a discovered candidate fails to load', () => {
    process.env.OPENAI_API_KEY = 'sk-fallback';
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-config-fallback-'));
    fs.mkdirSync(path.join(tempDir, 'config'));
    fs.mkdirSync(path.join(tempDir, 'config', 'services.yaml'));

    try {
      process.chdir(tempDir);
      const config = loadConfig(undefined, true);
      expect(config.providers[0].apiKey).toBe('sk-fallback');
      expect(config.defaultLLMProvider).toBe(ProviderType.OPENAI);
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
