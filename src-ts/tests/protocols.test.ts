import { describe, it, expect } from 'vitest';
import {
  LLMService,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  StreamChunk,
  EmbeddingService,
  EmbeddingProvider,
  EmbeddingCache,
  EmbeddingRequest,
  EmbeddingResponse,
  AgentProtocol,
  ServiceProtocol,
  SearchInterface,
  MemoryInterface,
  GraphInterface
} from '../protocols';

describe('Protocols Migration Tests', () => {

  describe('LLM Protocols', () => {
    describe('LLMService Interface', () => {
      class MockLLMService implements LLMService {
        async generate(prompt: string, options?: { model?: string }): Promise<string> {
          return `Generated: ${prompt} using ${options?.model || 'default'}`;
        }
        
        async generateWithMetadata(request: LLMRequest): Promise<LLMResponse> {
          return {
            content: `Content for ${request.prompt}`,
            metadata: { model: request.model || 'default', duration: 100 }
          };
        }
        
        async generateJson(prompt: string): Promise<Record<string, unknown>> {
          return { result: prompt, success: true };
        }
        
        async *stream(prompt: string): AsyncIterableIterator<StreamChunk> {
          yield { content: prompt.substring(0, 1), isFinished: false };
          yield { content: prompt.substring(1), isFinished: true, metadata: { done: true } };
        }

        async batchGenerate(prompts: string[]): Promise<string[]> {
          return prompts.map(p => `Batch: ${p}`);
        }
      }

      it('should instantiate MockLLMService', () => {
        const service: LLMService = new MockLLMService();
        expect(service).toBeDefined();
      });

      it('should implement generate', async () => {
        const service: LLMService = new MockLLMService();
        const res = await service.generate('hello', { model: 'gpt-4' });
        expect(res).toBe('Generated: hello using gpt-4');
      });

      it('should implement generateWithMetadata', async () => {
        const service: LLMService = new MockLLMService();
        const res = await service.generateWithMetadata({ prompt: 'test' });
        expect(res.content).toBe('Content for test');
        expect(res.metadata.model).toBe('default');
      });

      it('should implement generateJson', async () => {
        const service: LLMService = new MockLLMService();
        const res = await service.generateJson('data');
        expect(res.result).toBe('data');
        expect(res.success).toBe(true);
      });

      it('should implement stream', async () => {
        const service: LLMService = new MockLLMService();
        const chunks: StreamChunk[] = [];
        for await (const chunk of service.stream('hi')) {
          chunks.push(chunk);
        }
        expect(chunks).toHaveLength(2);
        expect(chunks[0].content).toBe('h');
        expect(chunks[0].isFinished).toBe(false);
        expect(chunks[1].content).toBe('i');
        expect(chunks[1].isFinished).toBe(true);
      });

      it('should implement batchGenerate', async () => {
        const service: LLMService = new MockLLMService();
        const res = await service.batchGenerate(['a', 'b']);
        expect(res).toEqual(['Batch: a', 'Batch: b']);
      });
    });

    describe('LLMProvider Interface', () => {
      class MockLLMProvider implements LLMProvider {
        readonly providerType = 'openai';
        
        async complete(prompt: string, model: string): Promise<LLMResponse> {
          return {
            content: `Completed ${prompt} via ${model}`,
            metadata: { provider: this.providerType }
          };
        }
        
        async *streamComplete(prompt: string, model: string): AsyncIterableIterator<StreamChunk> {
          yield { content: prompt, isFinished: true };
        }
        
        async healthCheck(): Promise<boolean> {
          return true;
        }
        
        getModelForTier(tier: string): string {
          return tier === 'FAST' ? 'gpt-3.5' : 'gpt-4';
        }
      }

      it('should instantiate MockLLMProvider', () => {
        const provider: LLMProvider = new MockLLMProvider();
        expect(provider.providerType).toBe('openai');
      });

      it('should implement complete', async () => {
        const provider: LLMProvider = new MockLLMProvider();
        const res = await provider.complete('test', 'gpt-4');
        expect(res.content).toBe('Completed test via gpt-4');
      });

      it('should implement streamComplete', async () => {
        const provider: LLMProvider = new MockLLMProvider();
        const iter = provider.streamComplete('test', 'gpt-4');
        const first = await iter.next();
        expect(first.value.content).toBe('test');
        expect(first.value.isFinished).toBe(true);
      });

      it('should implement healthCheck for LLMProvider', async () => {
        const provider: LLMProvider = new MockLLMProvider();
        const isHealthy = await provider.healthCheck();
        expect(isHealthy).toBe(true);
      });

      it('should implement getModelForTier', () => {
        const provider: LLMProvider = new MockLLMProvider();
        expect(provider.getModelForTier('FAST')).toBe('gpt-3.5');
        expect(provider.getModelForTier('POWERFUL')).toBe('gpt-4');
      });
    });
  });

  describe('Embedding Protocols', () => {
    describe('EmbeddingService Interface', () => {
      class MockEmbeddingService implements EmbeddingService {
        async embed(text: string): Promise<number[]> {
          return [0.5, 0.5];
        }
        
        async embedBatch(texts: string[]): Promise<number[][]> {
          return texts.map(() => [0.5, 0.5]);
        }
        
        async embedWithMetadata(request: EmbeddingRequest): Promise<EmbeddingResponse> {
          return {
            embedding: [0.1, 0.9],
            metadata: { length: request.text.length }
          };
        }
        
        similarity(e1: number[], e2: number[]): number {
          return 0.99;
        }
        
        getDimensions(model?: string): number {
          return 384;
        }
      }

      it('should instantiate MockEmbeddingService', () => {
        const service: EmbeddingService = new MockEmbeddingService();
        expect(service).toBeDefined();
      });

      it('should implement embed', async () => {
        const service: EmbeddingService = new MockEmbeddingService();
        const res = await service.embed('test');
        expect(res).toEqual([0.5, 0.5]);
      });

      it('should implement embedBatch', async () => {
        const service: EmbeddingService = new MockEmbeddingService();
        const res = await service.embedBatch(['a', 'b']);
        expect(res).toEqual([[0.5, 0.5], [0.5, 0.5]]);
      });

      it('should implement embedWithMetadata', async () => {
        const service: EmbeddingService = new MockEmbeddingService();
        const res = await service.embedWithMetadata({ text: 'xyz' });
        expect(res.embedding).toEqual([0.1, 0.9]);
        expect(res.metadata.length).toBe(3);
      });

      it('should implement similarity', () => {
        const service: EmbeddingService = new MockEmbeddingService();
        const score = service.similarity([0.1], [0.1]);
        expect(score).toBe(0.99);
      });

      it('should implement getDimensions for EmbeddingService', () => {
        const service: EmbeddingService = new MockEmbeddingService();
        expect(service.getDimensions('test-model')).toBe(384);
      });
    });

    describe('EmbeddingProvider Interface', () => {
      class MockEmbeddingProvider implements EmbeddingProvider {
        readonly providerType = 'local';
        
        async embed(texts: string[], model: string): Promise<EmbeddingResponse> {
          return {
            embedding: [0.2, 0.4],
            metadata: { provider: this.providerType, model }
          };
        }
        
        async healthCheck(): Promise<boolean> {
          return true;
        }
        
        getDimensions(model: string): number {
          return 768;
        }
      }

      it('should instantiate MockEmbeddingProvider', () => {
        const provider: EmbeddingProvider = new MockEmbeddingProvider();
        expect(provider.providerType).toBe('local');
      });

      it('should implement embed for Provider', async () => {
        const provider: EmbeddingProvider = new MockEmbeddingProvider();
        const res = await provider.embed(['test'], 'model-a');
        expect(res.embedding).toEqual([0.2, 0.4]);
      });

      it('should implement healthCheck for Provider', async () => {
        const provider: EmbeddingProvider = new MockEmbeddingProvider();
        expect(await provider.healthCheck()).toBe(true);
      });

      it('should implement getDimensions for Provider', () => {
        const provider: EmbeddingProvider = new MockEmbeddingProvider();
        expect(provider.getDimensions('model-a')).toBe(768);
      });
    });

    describe('EmbeddingCache Interface', () => {
      class MockEmbeddingCache implements EmbeddingCache {
        private cache = new Map<string, number[]>();
        
        async get(text: string, model: string): Promise<number[] | null> {
          return this.cache.get(`${text}-${model}`) || null;
        }
        
        async set(text: string, model: string, embedding: number[]): Promise<void> {
          this.cache.set(`${text}-${model}`, embedding);
        }
        
        async getBatch(texts: string[], model: string): Promise<Record<string, number[] | null>> {
          const result: Record<string, number[] | null> = {};
          for (const text of texts) {
            result[text] = this.cache.get(`${text}-${model}`) || null;
          }
          return result;
        }
        
        async setBatch(items: Record<string, number[]>, model: string): Promise<void> {
          for (const [text, emb] of Object.entries(items)) {
            this.cache.set(`${text}-${model}`, emb);
          }
        }
        
        async clear(): Promise<void> {
          this.cache.clear();
        }
        
        async stats(): Promise<Record<string, unknown>> {
          return { size: this.cache.size };
        }
      }

      it('should implement set and get', async () => {
        const cache: EmbeddingCache = new MockEmbeddingCache();
        await cache.set('text1', 'm1', [1, 2]);
        const res = await cache.get('text1', 'm1');
        expect(res).toEqual([1, 2]);
      });

      it('should return null on get miss', async () => {
        const cache: EmbeddingCache = new MockEmbeddingCache();
        const res = await cache.get('unknown', 'm1');
        expect(res).toBeNull();
      });

      it('should implement batch operations', async () => {
        const cache: EmbeddingCache = new MockEmbeddingCache();
        await cache.setBatch({ 't1': [1], 't2': [2] }, 'm1');
        const res = await cache.getBatch(['t1', 't2', 't3'], 'm1');
        expect(res['t1']).toEqual([1]);
        expect(res['t2']).toEqual([2]);
        expect(res['t3']).toBeNull();
      });

      it('should clear cache', async () => {
        const cache: EmbeddingCache = new MockEmbeddingCache();
        await cache.set('t', 'm', [1]);
        await cache.clear();
        expect(await cache.get('t', 'm')).toBeNull();
      });

      it('should provide stats', async () => {
        const cache: EmbeddingCache = new MockEmbeddingCache();
        await cache.set('t', 'm', [1]);
        const stats = await cache.stats();
        expect(stats.size).toBe(1);
      });
    });
  });

  describe('Agent Protocols', () => {
    class MockAgent implements AgentProtocol {
      readonly name = 'TestAgent';
      
      async execute(inputData: unknown): Promise<unknown> {
        return { executed: inputData };
      }
      
      validate(inputData: unknown): [boolean, string[]] {
        if (!inputData) return [false, ['No input']];
        return [true, []];
      }
      
      formatOutput(result: unknown): Record<string, unknown> {
        return { formatted: true, data: result };
      }
      
      async healthCheck(): Promise<boolean> {
        return true;
      }
    }

    it('should expose agent name', () => {
      const agent: AgentProtocol = new MockAgent();
      expect(agent.name).toBe('TestAgent');
    });

    it('should implement execute', async () => {
      const agent: AgentProtocol = new MockAgent();
      const res = await agent.execute('task');
      expect(res).toEqual({ executed: 'task' });
    });

    it('should implement validate correctly', () => {
      const agent: AgentProtocol = new MockAgent();
      const [isValid, errors] = agent.validate(null);
      expect(isValid).toBe(false);
      expect(errors).toContain('No input');
      
      const [isValid2, errors2] = agent.validate('valid');
      expect(isValid2).toBe(true);
      expect(errors2).toHaveLength(0);
    });

    it('should implement formatOutput', () => {
      const agent: AgentProtocol = new MockAgent();
      const out = agent.formatOutput('result');
      expect(out.formatted).toBe(true);
      expect(out.data).toBe('result');
    });

    it('should implement healthCheck for Agent', async () => {
      const agent: AgentProtocol = new MockAgent();
      expect(await agent.healthCheck()).toBe(true);
    });
  });

  describe('Service Protocols', () => {
    class MockService implements ServiceProtocol {
      readonly name = 'TestService';
      private init = false;
      
      async initialize(): Promise<void> {
        this.init = true;
      }
      
      async shutdown(): Promise<void> {
        this.init = false;
      }
      
      async healthCheck(): Promise<boolean> {
        return this.init;
      }
      
      getStatus(): Record<string, unknown> {
        return { initialized: this.init };
      }
    }

    it('should expose service name', () => {
      const service: ServiceProtocol = new MockService();
      expect(service.name).toBe('TestService');
    });

    it('should implement initialize', async () => {
      const service: ServiceProtocol = new MockService();
      await service.initialize();
      expect(await service.healthCheck()).toBe(true);
    });

    it('should implement shutdown', async () => {
      const service: ServiceProtocol = new MockService();
      await service.initialize();
      await service.shutdown();
      expect(await service.healthCheck()).toBe(false);
    });

    it('should return valid status', () => {
      const service: ServiceProtocol = new MockService();
      const status = service.getStatus();
      expect(status.initialized).toBe(false);
    });
  });

  describe('Search & Memory Protocols', () => {
    class MockSearch implements SearchInterface {
      async search(query: string): Promise<Record<string, unknown>[]> {
        return [{ query, result: true }];
      }
      
      async index(id: string, content: string): Promise<void> {
        // Mock index
      }
      
      async delete(id: string): Promise<boolean> {
        return true;
      }
    }

    class MockMemory implements MemoryInterface {
      async store(key: string, value: unknown): Promise<void> {}
      async retrieve(key: string): Promise<unknown> { return 'value'; }
      async search(query: string): Promise<unknown[]> { return []; }
      async clear(): Promise<void> {}
    }

    class MockGraph implements GraphInterface {
      async addNode(id: string, data: unknown): Promise<void> {}
      async addEdge(from: string, to: string, rel: string): Promise<void> {}
      async getNode(id: string): Promise<unknown> { return null; }
      async traverse(startId: string): Promise<unknown[]> { return []; }
    }

    it('should test SearchInterface search', async () => {
      const s: SearchInterface = new MockSearch();
      const res = await s.search('test query');
      expect(res[0].query).toBe('test query');
    });

    it('should test SearchInterface index', async () => {
      const s: SearchInterface = new MockSearch();
      await expect(s.index('id1', 'content')).resolves.not.toThrow();
    });

    it('should test SearchInterface delete', async () => {
      const s: SearchInterface = new MockSearch();
      expect(await s.delete('id1')).toBe(true);
    });

    it('should test MemoryInterface store', async () => {
      const m: MemoryInterface = new MockMemory();
      await expect(m.store('key', 'val')).resolves.not.toThrow();
    });

    it('should test MemoryInterface retrieve', async () => {
      const m: MemoryInterface = new MockMemory();
      expect(await m.retrieve('key')).toBe('value');
    });

    it('should test MemoryInterface search', async () => {
      const m: MemoryInterface = new MockMemory();
      expect(await m.search('q')).toEqual([]);
    });

    it('should test MemoryInterface clear', async () => {
      const m: MemoryInterface = new MockMemory();
      await expect(m.clear()).resolves.not.toThrow();
    });

    it('should test GraphInterface addNode', async () => {
      const g: GraphInterface = new MockGraph();
      await expect(g.addNode('id', {})).resolves.not.toThrow();
    });

    it('should test GraphInterface addEdge', async () => {
      const g: GraphInterface = new MockGraph();
      await expect(g.addEdge('A', 'B', 'rel')).resolves.not.toThrow();
    });

    it('should test GraphInterface getNode', async () => {
      const g: GraphInterface = new MockGraph();
      expect(await g.getNode('id')).toBeNull();
    });

    it('should test GraphInterface traverse', async () => {
      const g: GraphInterface = new MockGraph();
      expect(await g.traverse('id')).toEqual([]);
    });
  });

});
