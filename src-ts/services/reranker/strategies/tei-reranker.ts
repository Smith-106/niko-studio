/**
 * TEI (Text Embeddings Inference) Reranker Strategy
 *
 * Migrated from src/services/reranker/strategies/tei_reranker.py.
 * Uses Hugging Face TEI service for document reranking.
 */

import type { RankedDocument, RerankerConfig } from '../models';
import { RerankerError, RerankerType } from '../models';
import { RerankerStrategy } from '../base';

const ENV_BASE_URL = process.env.TEI_RERANKER_URL || process.env.NIKO_TEI_RERANKER_URL || '';
const DEFAULT_MODEL = 'BAAI/bge-reranker-v2-m3';

export class TEIReranker extends RerankerStrategy {
  private readonly _baseUrl: string;
  private readonly _model: string;

  constructor(config: RerankerConfig) {
    super(config);
    // Resolve base URL: explicit config > env vars > fallback to localhost
    if (config.baseUrl) {
      this._baseUrl = config.baseUrl;
    } else if (ENV_BASE_URL) {
      this._baseUrl = ENV_BASE_URL;
    } else {
      this._baseUrl = 'http://localhost:8080';
    }
    this._model = config.model ?? DEFAULT_MODEL;
  }

  get rerankerType(): RerankerType {
    return RerankerType.TEI;
  }

  async rerank(
    query: string,
    documents: string[],
    topK = 10,
    options?: {
      documentIds?: string[];
      metadataList?: Record<string, unknown>[];
    },
  ): Promise<RankedDocument[]> {
    if (documents.length === 0) {
      return [];
    }

    const payload = {
      query,
      texts: documents,
      truncate: true,
    };

    const url = `${this._baseUrl}/rerank`;
    const response = await this._doRequest(url, payload);

    // TEI returns: [{"index": 0, "score": 0.95}, ...]
    const data = response as Array<{ index: number; score?: number }>;
    const scores: number[] = [];
    const indices: number[] = [];

    for (const item of data) {
      indices.push(item.index);
      // TEI scores can exceed 1.0; normalize with sigmoid
      const rawScore = item.score ?? 0.0;
      const normalizedScore = 1 / (1 + Math.exp(-rawScore));
      scores.push(normalizedScore);
    }

    return this.buildRankedDocuments(
      documents,
      scores,
      indices,
      topK,
      options?.documentIds,
      options?.metadataList,
    );
  }

  private async _doRequest(url: string, payload: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this._config.apiKey) {
      headers['Authorization'] = `Bearer ${this._config.apiKey}`;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this._config.timeout * 1000),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new RerankerError(`TEI API request failed: ${text}`, {
          rerankerType: this.rerankerType,
          statusCode: res.status,
        });
      }

      return await res.json();
    } catch (err) {
      if (err instanceof RerankerError) throw err;
      throw new RerankerError(`TEI API request error: ${(err as Error).message}`, {
        rerankerType: this.rerankerType,
      });
    }
  }
}
