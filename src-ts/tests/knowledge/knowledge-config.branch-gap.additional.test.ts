import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderType } from '../../knowledge/models';

describe('knowledge/config branch gap coverage', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    vi.doUnmock('js-yaml');
    vi.restoreAllMocks();
  });

  it('uses environment values during partial placeholder substitution', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-config-partial-env-'));
    const configPath = path.join(tempDir, 'services.yaml');

    process.env.API_HOST = 'internal.example.com';

    fs.writeFileSync(configPath, [
      'default_llm_provider: openai',
      'default_embedding_provider: local',
      'providers:',
      '  openai:',
      '    api_key: sk-partial-env',
      // eslint-disable-next-line no-template-curly-in-string
      '    base_url: https://${API_HOST}/v1',
      '    models:',
      '      fast: gpt-fast',
      '      default: gpt-default',
      '      powerful: gpt-power',
      '',
    ].join('\n'), 'utf-8');

    try {
      const { ConfigLoader } = await import('../../knowledge/config');
      const config = ConfigLoader.fromYAML(configPath);

      expect(config.providers[0]?.provider).toBe(ProviderType.OPENAI);
      expect(config.providers[0]?.baseUrl).toBe('https://internal.example.com/v1');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('falls back to an empty object when js-yaml returns null', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-config-yaml-null-'));
    const configPath = path.join(tempDir, 'services.yaml');

    fs.writeFileSync(configPath, 'ignored: true\n', 'utf-8');

    vi.doMock('js-yaml', () => ({
      load: vi.fn(() => null),
    }));

    try {
      const { ConfigLoader } = await import('../../knowledge/config');
      const config = ConfigLoader.fromYAML(configPath);

      expect(config.providers).toEqual([]);
      expect(config.defaultLLMProvider).toBe(ProviderType.OPENAI);
      expect(config.defaultEmbeddingProvider).toBe(ProviderType.LOCAL);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('falls back to an empty object when yaml parsing returns undefined for an empty file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-config-empty-yaml-'));
    const configPath = path.join(tempDir, 'services.yaml');

    fs.writeFileSync(configPath, '', 'utf-8');

    try {
      const { ConfigLoader } = await import('../../knowledge/config');
      const config = ConfigLoader.fromYAML(configPath);

      expect(config.providers).toEqual([]);
      expect(config.defaultLLMProvider).toBe(ProviderType.OPENAI);
      expect(config.defaultEmbeddingProvider).toBe(ProviderType.LOCAL);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
