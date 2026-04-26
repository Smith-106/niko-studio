import 'reflect-metadata';

import { Container } from 'inversify';
import { describe, expect, it } from 'vitest';

import { ContainerModule } from '../../container/ContainerModule';
import { ServiceContainer } from '../../container/ServiceContainer';
import {
  CANONICAL_SERVICE_IDENTIFIERS,
} from '../../container/bindings';
import { ServiceTypes } from '../../container/types';

function getRawContainer(serviceContainer: ServiceContainer): Container {
  return (serviceContainer as unknown as { container: Container }).container;
}

describe('container bindings parity', () => {
  it('registers the canonical binding set in both entrypoints', () => {
    const serviceContainer = new ServiceContainer();
    const moduleContainer = new Container();
    moduleContainer.load(ContainerModule);

    const serviceRuntime = getRawContainer(serviceContainer);

    for (const identifier of CANONICAL_SERVICE_IDENTIFIERS) {
      expect(serviceRuntime.isBound(identifier)).toBe(true);
      expect(moduleContainer.isBound(identifier)).toBe(true);
    }
  });

  it('resolves shared singleton instances for knowledge dependencies in both entrypoints', () => {
    const serviceContainer = new ServiceContainer();
    const moduleContainer = new Container();
    moduleContainer.load(ContainerModule);

    const serviceRuntime = getRawContainer(serviceContainer);

    const serviceEmbedding = serviceContainer.embedding;
    const serviceVectorSearch = serviceContainer.vectorSearch;
    const serviceKnowledge = serviceContainer.knowledge;

    expect(serviceVectorSearch).toBe(serviceContainer.vectorSearch);
    expect(serviceKnowledge).toBe(serviceContainer.knowledge);
    expect(serviceEmbedding).toBe(serviceContainer.embedding);
    expect(serviceRuntime.get(ServiceTypes.EmbeddingService)).toBe(serviceEmbedding);
    expect(serviceRuntime.get(ServiceTypes.VectorSearch)).toBe(serviceVectorSearch);
    expect(serviceRuntime.get(ServiceTypes.KnowledgeService)).toBe(serviceKnowledge);

    const moduleEmbedding = moduleContainer.get(ServiceTypes.EmbeddingService);
    const moduleVectorSearch = moduleContainer.get(ServiceTypes.VectorSearch);
    const moduleKnowledge = moduleContainer.get(ServiceTypes.KnowledgeService);

    expect(moduleEmbedding).toBe(moduleContainer.get(ServiceTypes.EmbeddingService));
    expect(moduleVectorSearch).toBe(moduleContainer.get(ServiceTypes.VectorSearch));
    expect(moduleKnowledge).toBe(moduleContainer.get(ServiceTypes.KnowledgeService));
  });
});
