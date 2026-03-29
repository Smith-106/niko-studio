/**
 * Bailian (Alibaba Cloud DashScope) Reranker Strategy
 *
 * Migrated from src/services/reranker/strategies/bailian_reranker.py.
 * Uses Alibaba Cloud DashScope rerank API for document reranking.
 */

import type { RankedDocument, RerankerConfig } from '../models';
import { RerankerError, RerankerType } from '../models';
import { RerankerStrategy } from '../base';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';
const DEFAULT_MODEL = 'gte-rerank';

export class BailianReranker extends RerankerStrategy {
  private readonly _baseUrl: string;
  private readonly _model: string;

  constructor(config: RerankerConfig) {
    super(config);
    this._baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this._model = config.model ?? DEFAULT_MODEL;
  }

  get rerankerType(): RerankerType {
    return RerankerType.BAILIAN;
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
      throw new RerankerError('Bailian API key (DashScope) is required', {
        rerankerType: this.rerankerType,
      });
    }

    const payload = {
      model: this._model,
      input: {
        query,
        documents,
      },
      parameters: {
        top_n: Math.min(topK, documents.length),
        return_documents: false,
      },
    };

    const url = `${this._baseUrl}/services/rerank/text-rerank/rerank`;
    const response = await this._doRequest(url, payload);

    // Check response status
    const respData = response as { code?: string; message?: string; output?: { results?: Array<{ index: number; relevance_score?: number }> } };
    if (respData.code && respData.code !== '200') {
      throw new RerankerError(`Bailian API error: ${respData.message ?? 'Unknown error'}`, {
        rerankerType: this.rerankerType,
      });
    }

    const resultsData = respData.output?.results ?? [];
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
        throw new RerankerError(`Bailian API request failed: ${text}`, {
          rerankerType: this.rerankerType,
          statusCode: res.status,
        });
      }

      return await res.json();
    } catch (err) {
      if (err instanceof RerankerError) throw err;
      throw new RerankerError(`Bailian API request error: ${(err as Error).message}`, {
        rerankerType: this.rerankerType,
      });
    }
  }
}
