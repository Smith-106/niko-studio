/**
 * RerankerFactory - Creates reranker instances based on configuration
 *
 * Migrated from src/services/reranker/factory.py.
 * Supports creation from config objects, dictionaries, or environment variables.
 */

import {
  DEFAULT_RERANKER_CONFIG,
  RerankerConfig,
  RerankerError,
  RerankerType,
} from './models';
import { RerankerStrategy } from './base';
import {
  JinaReranker,
  VoyageReranker,
  TEIReranker,
  BailianReranker,
} from './strategies';

/** Mapping from reranker type to implementation class */
const RERANKER_CLASSES: Record<RerankerType, new (config: RerankerConfig) => RerankerStrategy> = {
  [RerankerType.JINA]: JinaReranker,
  [RerankerType.VOYAGE]: VoyageReranker,
  [RerankerType.TEI]: TEIReranker,
  [RerankerType.BAILIAN]: BailianReranker,
};

/** Mapping from environment variable names to reranker types */
const ENV_KEY_MAPPING: Record<string, RerankerType> = {
  JINA_API_KEY: RerankerType.JINA,
  VOYAGE_API_KEY: RerankerType.VOYAGE,
  TEI_BASE_URL: RerankerType.TEI,
  DASHSCOPE_API_KEY: RerankerType.BAILIAN,
};

export class RerankerFactory {
  /**
   * Create a reranker from a full config object
   */
  static create(config: RerankerConfig): RerankerStrategy {
    const RerankerClass = RERANKER_CLASSES[config.rerankerType];
    if (!RerankerClass) {
      throw new RerankerError(`Unsupported reranker type: ${config.rerankerType}`, {
        rerankerType: config.rerankerType,
      });
    }
    return new RerankerClass(config);
  }

  /**
   * Create a reranker from a plain dictionary
   *
   * @param data - Config dictionary with keys: type, api_key, base_url, model, timeout, max_retries, batch_size
   */
  static fromDict(data: Record<string, unknown>): RerankerStrategy {
    const typeStr = (data.type as string) ?? 'jina';
    let rerankerType: RerankerType;

    try {
      rerankerType = parseRerankerType(typeStr);
    } catch {
      const validTypes = Object.values(RerankerType);
      throw new RerankerError(
        `Invalid reranker type: '${typeStr}', valid types: ${validTypes.join(', ')}`,
      );
    }

    const config: RerankerConfig = {
      rerankerType,
      apiKey: data.api_key as string | undefined,
      baseUrl: data.base_url as string | undefined,
      model: data.model as string | undefined,
      timeout: (data.timeout as number) ?? DEFAULT_RERANKER_CONFIG.timeout,
      maxRetries: (data.max_retries as number) ?? DEFAULT_RERANKER_CONFIG.maxRetries,
      batchSize: (data.batch_size as number) ?? DEFAULT_RERANKER_CONFIG.batchSize,
    };

    return RerankerFactory.create(config);
  }

  /**
   * Create a reranker from environment variables
   *
   * Supported env vars:
   * - RERANKER_TYPE: Reranker type (jina, voyage, tei, bailian)
   * - JINA_API_KEY / VOYAGE_API_KEY / DASHSCOPE_API_KEY / TEI_BASE_URL
   * - RERANKER_MODEL: Model name (optional)
   * - RERANKER_TIMEOUT: Timeout in seconds (optional)
   */
  static fromEnv(rerankerType?: RerankerType | string): RerankerStrategy {
    // Determine reranker type
    let resolvedType: RerankerType;
    if (rerankerType == null) {
      const envType = process.env.RERANKER_TYPE;
      if (envType) {
        resolvedType = parseRerankerType(envType);
      } else {
        resolvedType = detectRerankerType();
      }
    } else if (typeof rerankerType === 'string') {
      resolvedType = parseRerankerType(rerankerType);
    } else {
      resolvedType = rerankerType;
    }

    const apiKey = getApiKeyForType(resolvedType);
    const baseUrl = getBaseUrlForType(resolvedType);

    const config: RerankerConfig = {
      rerankerType: resolvedType,
      apiKey,
      baseUrl,
      model: process.env.RERANKER_MODEL,
      timeout: parseFloat(process.env.RERANKER_TIMEOUT ?? '30.0') || 30.0,
      maxRetries: parseInt(process.env.RERANKER_MAX_RETRIES ?? '3', 10),
      batchSize: DEFAULT_RERANKER_CONFIG.batchSize,
    };

    return RerankerFactory.create(config);
  }

  /**
   * Return all supported reranker types
   */
  static availableTypes(): RerankerType[] {
    return Object.values(RerankerType);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRerankerType(value: string): RerankerType {
  const lower = value.toLowerCase();
  const allTypes = Object.values(RerankerType) as string[];
  if (allTypes.includes(lower)) {
    return lower as RerankerType;
  }
  throw new Error(`Unknown reranker type: ${value}`);
}

function detectRerankerType(): RerankerType {
  for (const [envKey, rerankerType] of Object.entries(ENV_KEY_MAPPING)) {
    if (process.env[envKey]) {
      return rerankerType;
    }
  }
  return RerankerType.JINA;
}

const API_KEY_ENV: Record<RerankerType, string> = {
  [RerankerType.JINA]: 'JINA_API_KEY',
  [RerankerType.VOYAGE]: 'VOYAGE_API_KEY',
  [RerankerType.TEI]: 'TEI_API_KEY',
  [RerankerType.BAILIAN]: 'DASHSCOPE_API_KEY',
};

function getApiKeyForType(type: RerankerType): string | undefined {
  const envKey = API_KEY_ENV[type];
  return envKey ? process.env[envKey] : undefined;
}

const BASE_URL_ENV: Record<RerankerType, string> = {
  [RerankerType.JINA]: 'JINA_BASE_URL',
  [RerankerType.VOYAGE]: 'VOYAGE_BASE_URL',
  [RerankerType.TEI]: 'TEI_BASE_URL',
  [RerankerType.BAILIAN]: 'DASHSCOPE_BASE_URL',
};

function getBaseUrlForType(type: RerankerType): string | undefined {
  const envKey = BASE_URL_ENV[type];
  return envKey ? process.env[envKey] : undefined;
}
