import { afterEach, describe, expect, it } from 'vitest';

import { RerankerFactory } from '../../services/reranker/factory.js';
import {
  DEFAULT_RERANKER_CONFIG,
  RerankerType,
} from '../../services/reranker/models.js';
import { JinaReranker } from '../../services/reranker/strategies/jina-reranker.js';
import { TEIReranker } from '../../services/reranker/strategies/tei-reranker.js';

describe('services/reranker additional coverage', () => {
  afterEach(() => {
    delete process.env.RERANKER_TYPE;
    delete process.env.RERANKER_MODEL;
    delete process.env.RERANKER_TIMEOUT;
    delete process.env.RERANKER_MAX_RETRIES;
    delete process.env.JINA_API_KEY;
    delete process.env.JINA_BASE_URL;
    delete process.env.TEI_API_KEY;
    delete process.env.TEI_BASE_URL;
  });

  it('uses RERANKER_TYPE from the environment when no explicit type is provided', () => {
    process.env.RERANKER_TYPE = 'tei';
    process.env.TEI_BASE_URL = 'http://tei.local';
    process.env.TEI_API_KEY = 'tei-key';
    process.env.RERANKER_TIMEOUT = '0';
    process.env.RERANKER_MAX_RETRIES = '9';

    const reranker = RerankerFactory.fromEnv();

    expect(reranker).toBeInstanceOf(TEIReranker);
    expect(reranker.config).toMatchObject({
      rerankerType: RerankerType.TEI,
      apiKey: 'tei-key',
      baseUrl: 'http://tei.local',
      timeout: 30,
      maxRetries: 9,
      batchSize: DEFAULT_RERANKER_CONFIG.batchSize,
    });
  });

  it('accepts explicit enum types and falls back to Jina detection when no env key is present', () => {
    process.env.JINA_API_KEY = 'jina-key';
    process.env.JINA_BASE_URL = 'https://jina.local';

    const explicit = RerankerFactory.fromEnv(RerankerType.JINA);
    expect(explicit).toBeInstanceOf(JinaReranker);
    expect(explicit.config).toMatchObject({
      rerankerType: RerankerType.JINA,
      apiKey: 'jina-key',
      baseUrl: 'https://jina.local',
    });

    delete process.env.JINA_API_KEY;
    delete process.env.JINA_BASE_URL;
    delete process.env.TEI_API_KEY;
    delete process.env.TEI_BASE_URL;

    const detected = RerankerFactory.fromEnv();
    expect(detected).toBeInstanceOf(JinaReranker);
    expect(detected.config).toMatchObject({
      rerankerType: RerankerType.JINA,
      apiKey: undefined,
      baseUrl: undefined,
      timeout: 30,
      maxRetries: 3,
      batchSize: DEFAULT_RERANKER_CONFIG.batchSize,
    });
  });

  it('executes the non-string explicit type branch before failing unsupported runtime values', () => {
    expect(() =>
      RerankerFactory.fromEnv({ runtime: 'custom' } as unknown as RerankerType),
    ).toThrow('Unsupported reranker type: [object Object]');
  });

  it('defaults from plain dictionaries when type and numeric options are omitted', () => {
    const reranker = RerankerFactory.fromDict({
      api_key: 'dict-jina-key',
      base_url: 'https://jina.defaulted',
    });

    expect(reranker).toBeInstanceOf(JinaReranker);
    expect(reranker.config).toMatchObject({
      rerankerType: RerankerType.JINA,
      apiKey: 'dict-jina-key',
      baseUrl: 'https://jina.defaulted',
      timeout: DEFAULT_RERANKER_CONFIG.timeout,
      maxRetries: DEFAULT_RERANKER_CONFIG.maxRetries,
      batchSize: DEFAULT_RERANKER_CONFIG.batchSize,
    });
  });
});
