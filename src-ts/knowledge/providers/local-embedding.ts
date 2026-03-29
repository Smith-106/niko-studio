/**
 * Knowledge module - Local Embedding Provider
 *
 * Supports local embedding models including FastEmbed and Sentence-Transformers.
 * In the TypeScript context, this uses dynamic imports for optional backends.
 */

import type { EmbeddingResponse } from '../models';
import {
  ProviderType,
  createTokenUsage,
  createEmbeddingResponse,
  EmbeddingError,
} from '../models';

// ============================================================
// Model dimensions mapping
// ============================================================

const MODEL_DIMENSIONS: Record<string, number> = {
  'BAAI/bge-small-zh-v1.5': 512,
  'BAAI/bge-base-zh-v1.5': 768,
  'BAAI/bge-large-zh-v1.5': 1024,
  'BAAI/bge-small-en-v1.5': 384,
  'BAAI/bge-base-en-v1.5': 768,
  'BAAI/bge-large-en-v1.5': 1024,
  'sentence-transformers/all-MiniLM-L6-v2': 384,
  'sentence-transformers/all-mpnet-base-v2': 768,
};

// ============================================================
// Local Embedding Provider
// ============================================================

export class LocalEmbeddingProvider {
  private readonly _modelName: string;
  private readonly _backend: string;
  private _model: unknown = null;

  constructor(params: {
    modelName?: string;
    backend?: string;
  }) {
    this._modelName = params.modelName ?? 'BAAI/bge-small-zh-v1.5';
    this._backend = params.backend ?? 'fastembed';
  }

  get providerType(): string {
    return ProviderType.LOCAL;
  }

  getDimensions(model: string): number {
    if (model in MODEL_DIMENSIONS) {
      return MODEL_DIMENSIONS[model];
    }
    for (const [key, dim] of Object.entries(MODEL_DIMENSIONS)) {
      if (model.includes(key) || key.includes(model)) {
        return dim;
      }
    }
    return 768;
  }

  /**
   * Ensure model is loaded
   *
   * Attempts to dynamically import the backend module.
   * In Node.js environment, this will use the fastembed or sentence-transformers
   * package if available. Falls back to a stub if not installed.
   */
  private async _ensureModel(): Promise<void> {
    if (this._model !== null) return;

    if (this._backend === 'fastembed') {
      try {
        // Dynamic import for optional dependency
        const mod = await import('fastembed');
        const FlagEmbedding = mod.FlagEmbedding;
        const EmbeddingModel = mod.EmbeddingModel;
        if (!FlagEmbedding) {
          throw new EmbeddingError(
            'fastembed package does not export FlagEmbedding',
            ProviderType.LOCAL,
          );
        }
        // Map model name to EmbeddingModel enum value
        const modelMapping: Record<string, string> = {
          'BAAI/bge-small-zh-v1.5': EmbeddingModel.BGESmallZH,
          'BAAI/bge-small-en-v1.5': EmbeddingModel.BGESmallENV15,
          'BAAI/bge-base-en-v1.5': EmbeddingModel.BGEBaseENV15,
          'BAAI/bge-base-en': EmbeddingModel.BGEBaseEN,
          'BAAI/bge-small-en': EmbeddingModel.BGESmallEN,
          'sentence-transformers/all-MiniLM-L6-v2': EmbeddingModel.AllMiniLML6V2,
        };
        const modelKey = modelMapping[this._modelName] ?? EmbeddingModel.BGESmallZH;
        this._model = await FlagEmbedding.init({ model: modelKey as any });
      } catch (e) {
        if (e instanceof EmbeddingError) throw e;
        throw new EmbeddingError(
          'fastembed package not installed. Run: npm install fastembed',
          ProviderType.LOCAL,
        );
      }
    } else if (this._backend === 'sentence-transformers') {
      try {
        // Dynamic import for optional dependency
        const mod = await import('@xenova/transformers') as any;
        const pipeline = mod.pipeline;
        if (!pipeline) {
          throw new EmbeddingError(
            '@xenova/transformers package does not export pipeline',
            ProviderType.LOCAL,
          );
        }
        this._model = await pipeline('feature-extraction', this._modelName);
      } catch (e) {
        if (e instanceof EmbeddingError) throw e;
        throw new EmbeddingError(
          '@xenova/transformers package not installed. Run: npm install @xenova/transformers',
          ProviderType.LOCAL,
        );
      }
    } else {
      throw new EmbeddingError(
        `Unknown backend: ${this._backend}`,
        ProviderType.LOCAL,
      );
    }
  }

  /**
   * Execute vector encoding request
   */
  async embed(
    texts: string[],
    model: string,
    options?: { dimensions?: number },
  ): Promise<EmbeddingResponse> {
    await this._ensureModel();
    const startTime = performance.now();

    let embeddings: number[][];
    try {
      if (this._backend === 'fastembed') {
        const embedFn = (this._model as any).embed?.bind(this._model);
        if (!embedFn) {
          throw new EmbeddingError('Model does not have embed method', ProviderType.LOCAL);
        }
        const result = await embedFn(texts);
        // fastembed returns async generator or array of typed arrays
        if (Symbol.asyncIterator in result) {
          const chunks: number[][] = [];
          for await (const chunk of result) {
            chunks.push(Array.from(chunk));
          }
          embeddings = chunks;
        } else {
          embeddings = (result as any[]).map((e: any) => Array.from(e));
        }
      } else {
        // sentence-transformers / xenova/transformers
        const encodeFn = (this._model as any);
        const result = await encodeFn(texts, { pooling: 'mean', normalize: true });
        // result is a tensor
        if (result.tolist) {
          embeddings = result.tolist();
        } else if (Array.isArray(result)) {
          embeddings = result;
        } else {
          embeddings = Array.from(result.data || result);
        }
      }
    } catch (e) {
      if (e instanceof EmbeddingError) throw e;
      throw new EmbeddingError((e as Error).message, ProviderType.LOCAL);
    }

    const latencyMs = Math.round(performance.now() - startTime);
    const actualDimensions = embeddings.length > 0 ? embeddings[0].length : 0;

    return createEmbeddingResponse({
      embeddings,
      modelUsed: model || this._modelName,
      provider: ProviderType.LOCAL,
      dimensions: actualDimensions,
      usage: createTokenUsage(),
      latencyMs,
    });
  }

  /**
   * Check provider health status
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.embed(['test'], this._modelName);
      return true;
    } catch {
      return false;
    }
  }
}
