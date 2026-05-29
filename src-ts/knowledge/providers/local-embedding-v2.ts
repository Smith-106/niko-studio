import path from 'path'
import fs from 'fs'

const EMBEDDING_DIM = 384

export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
}

export class LocalEmbeddingProvider {
  private session: any = null
  private tokenizer: any = null
  private modelPath: string
  private initialized = false

  constructor(modelDir: string) {
    this.modelPath = path.join(modelDir, 'model.onnx')
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true

    try {
      const ort = await import('onnxruntime-node')
      if (!fs.existsSync(this.modelPath)) {
        console.warn('[local-embedding] Model file not found:', this.modelPath)
        return false
      }

      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
      })
      this.initialized = true
      return true
    } catch (err) {
      console.warn('[local-embedding] Failed to initialize ONNX session:', err)
      return false
    }
  }

  async embed(text: string): Promise<EmbeddingResult> {
    if (!this.initialized || !this.session) {
      return { embedding: this.dummyEmbedding(), tokenCount: 0 }
    }

    try {
      const tokens = this.tokenize(text)
      const ort = await import('onnxruntime-node')

      const inputIds = new ort.Tensor('int64', BigInt64Array.from(tokens.map(BigInt)), [1, tokens.length])
      const attentionMask = new ort.Tensor('int64', BigInt64Array.from(tokens.map(() => 1n)), [1, tokens.length])
      const tokenTypeIds = new ort.Tensor('int64', BigInt64Array.from(tokens.map(() => 0n)), [1, tokens.length])

      const output = await this.session.run({
        input_ids: inputIds,
        attention_mask: attentionMask,
        token_type_ids: tokenTypeIds,
      })

      const lastHidden = output.last_hidden_state || output[Object.keys(output)[0]]
      if (!lastHidden) {
        return { embedding: this.dummyEmbedding(), tokenCount: tokens.length }
      }

      const embedding = this.meanPool(lastHidden, attentionMask)
      return { embedding: this.normalize(embedding), tokenCount: tokens.length }
    } catch (err) {
      console.warn('[local-embedding] Inference failed:', err)
      return { embedding: this.dummyEmbedding(), tokenCount: 0 }
    }
  }

  async embedBatch(texts: string[], batchSize = 32): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = []
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch.map((t) => this.embed(t)))
      results.push(...batchResults)
    }
    return results
  }

  private tokenize(text: string): number[] {
    // Simple whitespace tokenization as fallback
    // Real implementation would use @anush008/tokenizers
    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    return words.slice(0, 512).map((_, i) => i + 1)
  }

  private meanPool(hiddenState: any, attentionMask: any): number[] {
    const data = hiddenState.data as Float32Array
    const mask = attentionMask.data as BigInt64Array
    const [batchSize, seqLen, hiddenSize] = hiddenState.dims as [number, number, number]

    const result = new Array(hiddenSize).fill(0)
    let totalMask = 0

    for (let s = 0; s < seqLen; s++) {
      if (Number(mask[s]) > 0) {
        totalMask++
        for (let h = 0; h < hiddenSize; h++) {
          result[h] += data[s * hiddenSize + h]
        }
      }
    }

    if (totalMask > 0) {
      for (let h = 0; h < hiddenSize; h++) {
        result[h] /= totalMask
      }
    }

    return result
  }

  private normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
    if (norm === 0) return vec
    return vec.map((v) => v / norm)
  }

  private dummyEmbedding(): number[] {
    return new Array(EMBEDDING_DIM).fill(0)
  }

  get dimension(): number {
    return EMBEDDING_DIM
  }

  get isReady(): boolean {
    return this.initialized
  }
}
