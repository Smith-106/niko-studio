/**
 * Knowledge module - configuration loader
 *
 * Supports loading service configuration from YAML files and environment variables.
 * Environment variable format: ${ENV_VAR} or ${ENV_VAR:default_value}
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  ModelTier,
  ProviderType,
  ProviderConfig,
  ServiceConfig,
  createProviderConfig,
  createServiceConfig,
} from './models';

// ============================================================
// Config Error
// ============================================================

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

// ============================================================
// Config Loader
// ============================================================

/**
 * Environment variable pattern: ${VAR} or ${VAR:default}
 */
const ENV_PATTERN = /\$\{([^}:]+)(?::([^}]*))?\}/;

/**
 * Parse a ProviderType string value
 */
function parseProviderType(value: string): ProviderType {
  const normalized = value.toLowerCase().trim();
  const validTypes = Object.values(ProviderType) as string[];
  if (validTypes.includes(normalized)) {
    return normalized as ProviderType;
  }
  throw new ConfigError(
    `Invalid provider type: '${value}', valid values: ${validTypes.join(', ')}`
  );
}

/**
 * Parse a ModelTier string value
 */
function parseModelTier(value: string): ModelTier {
  const normalized = value.toLowerCase().trim();
  const validTiers = Object.values(ModelTier) as string[];
  if (validTiers.includes(normalized)) {
    return normalized as ModelTier;
  }
  throw new ConfigError(
    `Invalid model tier: '${value}', valid values: ${validTiers.join(', ')}`
  );
}

/**
 * Substitute environment variables in a string
 *
 * Supports:
 * - ${ENV_VAR}: get from env, return undefined if not set
 * - ${ENV_VAR:default}: get from env, use default if not set
 */
function substituteEnvVars(value: string): string | null | undefined {
  const match = ENV_PATTERN.exec(value);
  if (!match) {
    return value;
  }

  // Check if the entire value is a single env var reference
  const fullMatch = new RegExp(`^\\$\\{([^}:]+)(?::([^}]*))?\\}$`).exec(value);
  if (fullMatch) {
    const [, envName, defaultVal] = fullMatch;
    const envValue = process.env[envName];
    if (envValue !== undefined) return envValue;
    if (defaultVal !== undefined) return defaultVal;
    return null;
  }

  // Partial substitution
  return value.replace(/\$\{([^}:]+)(?::([^}]*))?\}/g, (_, envName: string, defaultVal?: string) => {
    const envValue = process.env[envName];
    if (envValue !== undefined) return envValue;
    if (defaultVal !== undefined) return defaultVal;
    return '';
  });
}

/**
 * Recursively substitute environment variables in config data
 */
function substituteEnvVarsRecursive(value: unknown): unknown {
  if (typeof value === 'string') {
    return substituteEnvVars(value);
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = substituteEnvVarsRecursive(v);
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map(item => substituteEnvVarsRecursive(item));
  }
  return value;
}

/**
 * Simple YAML-like parser for basic config files.
 * For full YAML support, use a library like 'js-yaml'.
 * This implementation handles flat and nested objects with string/number/boolean values.
 */
function parseSimpleYAML(content: string): Record<string, unknown> {
  // A minimal parser for service config YAML
  // Supports: key: value, nested objects via indentation
  const result: Record<string, unknown> = {};
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [
    { obj: result, indent: -1 },
  ];
  const lines = content.split('\n');

  for (const rawLine of lines) {
    // Skip empty lines and comments
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Calculate indentation
    const indent = rawLine.search(/\S/);

    // Pop stack to find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const current = stack[stack.length - 1].obj;

    // Parse key: value
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.substring(0, colonIdx).trim();
    const valueStr = trimmed.substring(colonIdx + 1).trim();

    if (!valueStr) {
      // This key starts a new nested object
      const nested: Record<string, unknown> = {};
      current[key] = nested;
      stack.push({ obj: nested, indent });
    } else {
      // Parse the value
      let value: unknown = valueStr;
      if (valueStr === 'true') value = true;
      else if (valueStr === 'false') value = false;
      else if (valueStr === 'null') value = null;
      else if (/^-?\d+(\.\d+)?$/.test(valueStr)) value = parseFloat(valueStr);
      else if (valueStr.startsWith('"') && valueStr.endsWith('"'))
        value = valueStr.slice(1, -1);
      else if (valueStr.startsWith("'") && valueStr.endsWith("'"))
        value = valueStr.slice(1, -1);

      current[key] = value;
    }
  }

  return result;
}

// ============================================================
// ConfigLoader class
// ============================================================

export class ConfigLoader {
  /**
   * Load configuration from a YAML file
   */
  static fromYAML(filePath: string): ServiceConfig {
    if (!fs.existsSync(filePath)) {
      throw new ConfigError(`Config file not found: ${filePath}`);
    }

    let data: Record<string, unknown>;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Try js-yaml first if available, otherwise use simple parser
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const yaml = require('js-yaml');
        data = yaml.load(content) as Record<string, unknown> || {};
      } catch {
        data = parseSimpleYAML(content);
      }
    } catch (e) {
      throw new ConfigError(`YAML parse error: ${e}`);
    }

    // Recursively substitute environment variables
    data = substituteEnvVarsRecursive(data) as Record<string, unknown>;

    return ConfigLoader.fromDict(data);
  }

  /**
   * Load configuration from environment variables
   *
   * Supported environment variables:
   * - LLM_DEFAULT_PROVIDER: Default LLM provider
   * - EMBEDDING_DEFAULT_PROVIDER: Default Embedding provider
   * - OPENAI_API_KEY: OpenAI API key
   * - ANTHROPIC_API_KEY: Anthropic API key
   * - AZURE_OPENAI_API_KEY: Azure OpenAI API key
   * - LOCAL_LLM_BASE_URL: Local LLM service URL
   */
  static fromEnv(): ServiceConfig {
    const providers: ProviderConfig[] = [];

    // OpenAI configuration
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      providers.push(createProviderConfig({
        provider: ProviderType.OPENAI,
        apiKey: openaiKey,
        baseUrl: process.env.OPENAI_BASE_URL ?? null,
        modelMapping: {
          [ModelTier.FAST]: process.env.OPENAI_MODEL_FAST ?? 'gpt-4o-mini',
          [ModelTier.DEFAULT]: process.env.OPENAI_MODEL_DEFAULT ?? 'gpt-4o',
          [ModelTier.POWERFUL]: process.env.OPENAI_MODEL_POWERFUL ?? 'gpt-4-turbo',
        },
        embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
      }));
    }

    // Anthropic configuration
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      providers.push(createProviderConfig({
        provider: ProviderType.ANTHROPIC,
        apiKey: anthropicKey,
        modelMapping: {
          [ModelTier.FAST]: process.env.ANTHROPIC_MODEL_FAST ?? 'claude-3-haiku-20240307',
          [ModelTier.DEFAULT]: process.env.ANTHROPIC_MODEL_DEFAULT ?? 'claude-3-5-sonnet-20241022',
          [ModelTier.POWERFUL]: process.env.ANTHROPIC_MODEL_POWERFUL ?? 'claude-3-opus-20240229',
        },
      }));
    }

    // Azure configuration
    const azureKey = process.env.AZURE_OPENAI_API_KEY;
    if (azureKey) {
      providers.push(createProviderConfig({
        provider: ProviderType.AZURE,
        apiKey: azureKey,
        baseUrl: process.env.AZURE_OPENAI_ENDPOINT ?? null,
        modelMapping: {
          [ModelTier.FAST]: process.env.AZURE_MODEL_FAST ?? 'gpt-4o-mini',
          [ModelTier.DEFAULT]: process.env.AZURE_MODEL_DEFAULT ?? 'gpt-4o',
          [ModelTier.POWERFUL]: process.env.AZURE_MODEL_POWERFUL ?? 'gpt-4-turbo',
        },
        embeddingModel: process.env.AZURE_EMBEDDING_MODEL ?? 'text-embedding-3-small',
      }));
    }

    // Local service configuration
    const localUrl = process.env.LOCAL_LLM_BASE_URL;
    if (localUrl) {
      providers.push(createProviderConfig({
        provider: ProviderType.LOCAL,
        baseUrl: localUrl,
        modelMapping: {
          [ModelTier.FAST]: process.env.LOCAL_MODEL_FAST ?? 'llama3',
          [ModelTier.DEFAULT]: process.env.LOCAL_MODEL_DEFAULT ?? 'llama3',
          [ModelTier.POWERFUL]: process.env.LOCAL_MODEL_POWERFUL ?? 'llama3',
        },
        embeddingModel: process.env.LOCAL_EMBEDDING_MODEL ?? 'bge-large-zh-v1.5',
      }));
    }

    // Default providers
    const defaultLLM = process.env.LLM_DEFAULT_PROVIDER ?? 'openai';
    const defaultEmbedding = process.env.EMBEDDING_DEFAULT_PROVIDER ?? 'openai';

    return createServiceConfig({
      providers,
      defaultLLMProvider: parseProviderType(defaultLLM),
      defaultEmbeddingProvider: parseProviderType(defaultEmbedding),
      embeddingCacheEnabled: (process.env.EMBEDDING_CACHE_ENABLED ?? 'true').toLowerCase() === 'true',
      embeddingCacheTTL: parseInt(process.env.EMBEDDING_CACHE_TTL ?? '86400', 10),
      embeddingCacheMaxSize: parseInt(process.env.EMBEDDING_CACHE_MAX_SIZE ?? '10000', 10),
      retryMaxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS ?? '3', 10),
      retryInitialDelay: parseFloat(process.env.RETRY_INITIAL_DELAY ?? '1.0'),
      retryMaxDelay: parseFloat(process.env.RETRY_MAX_DELAY ?? '60.0'),
      retryExponentialBase: parseFloat(process.env.RETRY_EXPONENTIAL_BASE ?? '2.0'),
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL ?? '60', 10),
    });
  }

  /**
   * Load configuration from a dictionary
   */
  static fromDict(data: Record<string, unknown>): ServiceConfig {
    const providers: ProviderConfig[] = [];
    const providersData = data.providers as Record<string, Record<string, unknown> | null> | undefined;

    if (providersData) {
      for (const [name, providerData] of Object.entries(providersData)) {
        if (!providerData) continue;

        const providerType = parseProviderType(
          (providerData.type as string) ?? name
        );

        // Parse model mapping
        const models = (providerData.models ?? {}) as Record<string, string>;
        const modelMapping: Record<string, string> = {
          [ModelTier.FAST]: models.fast ?? '',
          [ModelTier.DEFAULT]: models.default ?? '',
          [ModelTier.POWERFUL]: models.powerful ?? '',
        };

        providers.push(createProviderConfig({
          provider: providerType,
          apiKey: (providerData.api_key as string) ?? null,
          baseUrl: (providerData.base_url as string) ?? null,
          organization: (providerData.organization as string) ?? null,
          modelMapping,
          embeddingModel: (providerData.embedding_model as string) ?? '',
          maxRetries: (providerData.max_retries as number) ?? 3,
          timeout: (providerData.timeout as number) ?? 60.0,
          rateLimitRpm: (providerData.rate_limit_rpm as number) ?? 60,
        }));
      }
    }

    // Cache configuration
    const cacheConfig = (data.cache ?? {}) as Record<string, unknown>;

    // Retry configuration
    const retryConfig = (data.retry ?? {}) as Record<string, unknown>;

    return createServiceConfig({
      providers,
      defaultLLMProvider: parseProviderType(
        (data.default_llm_provider as string) ?? 'openai'
      ),
      defaultEmbeddingProvider: parseProviderType(
        (data.default_embedding_provider as string) ?? 'openai'
      ),
      embeddingCacheEnabled: (cacheConfig.enabled as boolean) ?? true,
      embeddingCacheTTL: (cacheConfig.ttl as number) ?? 86400,
      embeddingCacheMaxSize: (cacheConfig.max_size as number) ?? 10000,
      retryMaxAttempts: (retryConfig.max_retries as number) ?? 3,
      retryInitialDelay: (retryConfig.base_delay as number) ?? 1.0,
      retryMaxDelay: (retryConfig.max_delay as number) ?? 60.0,
      retryExponentialBase: (retryConfig.exponential_base as number) ?? 2.0,
      healthCheckInterval: (data.health_check_interval as number) ?? 60,
    });
  }
}

// ============================================================
// Convenience function
// ============================================================

/**
 * Load service configuration
 *
 * @param filePath - YAML config file path, null to try default locations
 * @param envFallback - Whether to fall back to environment variables when file is not found
 */
export function loadConfig(
  filePath?: string | null,
  envFallback: boolean = true,
): ServiceConfig {
  if (!filePath) {
    // Try common locations
    const candidates = [
      'config/services.yaml',
      'services.yaml',
      path.join(os.homedir(), '.config', 'niko-studio', 'services.yaml'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        filePath = candidate;
        break;
      }
    }
  }

  if (filePath) {
    try {
      return ConfigLoader.fromYAML(filePath);
    } catch (e) {
      if (!envFallback) throw e;
    }
  }

  // Fall back to environment variables
  return ConfigLoader.fromEnv();
}
