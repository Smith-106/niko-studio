/**
 * Jina Reranker Strategy
 *
 * Migrated from src/services/reranker/strategies/jina_reranker.py.
 * Uses Jina AI Reranker API for document reranking.
 */

import type { RankedDocument, RerankerConfig } from '../models';
import { RerankerError, RerankerType } from '../models';
import { RerankerStrategy } from '../base';

const DEFAULT_BASE_URL = 'https://api.jina.ai/v1';
const DEFAULT_MODEL = 'jina-reranker-v2-base-multilingual';

export class JinaReranker extends RerankerStrategy {
  private readonly _baseUrl: string;
  private readonly _model: string;

  constructor(config: RerankerConfig) {
    super(config);
    this._baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this._model = config.model ?? DEFAULT_MODEL;
  }

  get rerankerType(): RerankerType {
    return RerankerType.JINA;
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

    if (!this._config.apiKey) {
      throw new RerankerError('Jina API key is required', {
        rerankerType: this.rerankerType,
      });
    }

    const payload = {
      model: this._model,
      query,
      documents,
      top_n: Math.min(topK, documents.length),
      return_documents: false,
    };

    const url = `${this._baseUrl}/rerank`;
    const response = await this._doRequest(url, payload);

    const resultsData = (response as { results?: Array<{ index: number; relevance_score?: number }> }).results ?? [];
    const scores: number[] = [];
    const indices: number[] = [];

    for (const item of resultsData) {
      indices.push(item.index);
      scores.push(Math.min(1.0, Math.max(0.0, item.relevance_score ?? 0.0)));
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
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this._config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this._config.timeout * 1000),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new RerankerError(`Jina API request failed: ${text}`, {
          rerankerType: this.rerankerType,
          statusCode: res.status,
        });
      }

      return await res.json();
    } catch (err) {
      if (err instanceof RerankerError) throw err;
      throw new RerankerError(`Jina API request error: ${(err as Error).message}`, {
        rerankerType: this.rerankerType,
      });
    }
  }
}
