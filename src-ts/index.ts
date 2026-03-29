/**
 * Main entry point for TypeScript backend
 * Exports ServiceContainer and types for external use
 */

import 'reflect-metadata';

export { ServiceContainer, getContainer, resetContainer } from './container/ServiceContainer';
export { ContainerModule } from './container/ContainerModule';
export * from './container/types';
