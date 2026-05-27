/**
 * LibraryImportProcessor
 *
 * Processes Nowledge Mem Library imports into structured narrative entities
 * for KnowledgeService consumption.
 *
 * Pipeline: Library artifact → parse → structure → persist via adapter
 * Gracefully degrades when Nowledge Mem is unavailable.
 */

import type { INowledgeMemService, NowledgeMemLibraryArtifact } from '../protocols/nowledge-mem';
import type { KnowledgeMemoryEngineAdapter } from '../protocols/knowledge';

export interface ImportedNarrativeEntity {
  id: string;
  name: string;
  sourceType: string;
  summary: string;
  tags: string[];
  importedAt: string;
}

export interface ImportProcessingResult {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
  entities: ImportedNarrativeEntity[];
}

export class LibraryImportProcessor {
  private service: INowledgeMemService;
  private _available = false;

  constructor(service: INowledgeMemService) {
    this.service = service;
  }

  async initialize(): Promise<void> {
    try {
      const status = await this.service.status();
      this._available = status.connected;
    } catch {
      this._available = false;
    }
  }

  /** Search library and import matching artifacts as narrative entities */
  async searchAndImport(
    query: string,
    options?: { limit?: number; filterLabels?: string[]; dryRun?: boolean },
    adapter?: KnowledgeMemoryEngineAdapter,
  ): Promise<ImportProcessingResult> {
    if (!this._available) {
      return { total: 0, imported: 0, skipped: 0, errors: [], entities: [] };
    }

    const result: ImportProcessingResult = {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      entities: [],
    };

    try {
      // Search library for matching artifacts
      const artifacts = await this.service.searchLibrary(query, { limit: options?.limit });
      result.total = artifacts.length;

      if (options?.dryRun) {
        result.skipped = artifacts.length;
        result.entities = artifacts.map((a) => this.artifactToEntity(a));
        return result;
      }

      // Import each artifact
      for (const artifact of artifacts) {
        try {
          const entity = this.artifactToEntity(artifact);

          // Optionally persist via knowledge adapter
          if (adapter?.add) {
            await adapter.add({
              content: entity.summary,
              layer: 'library-import',
              tags: entity.tags,
              source: `nowledge-mem:library:${entity.id}`,
              importance: 0.5,
            });
          }

          result.entities.push(entity);
          result.imported++;
        } catch (e: unknown) {
          result.errors.push(`Failed to import ${artifact.name}: ${(e as Error).message}`);
          result.skipped++;
        }
      }
    } catch (e: unknown) {
      result.errors.push(`Search failed: ${(e as Error).message}`);
    }

    return result;
  }

  /** Import from a specific source path */
  async importFromSource(
    source: string,
    options?: { maxItems?: number; filterLabels?: string[]; dryRun?: boolean },
    adapter?: KnowledgeMemoryEngineAdapter,
  ): Promise<ImportProcessingResult> {
    if (!this._available) {
      return { total: 0, imported: 0, skipped: 0, errors: [], entities: [] };
    }

    try {
      const importResult = await this.service.importFromLibrary(source, {
        maxItems: options?.maxItems,
        filterLabels: options?.filterLabels,
        dryRun: options?.dryRun,
      });

      const entities: ImportedNarrativeEntity[] = importResult.ids.map((id, i) => ({
        id,
        name: `import-${i}`,
        sourceType: 'file',
        summary: '',
        tags: options?.filterLabels ?? [],
        importedAt: new Date().toISOString(),
      }));

      // Persist non-dry-run entities via adapter
      if (!options?.dryRun && adapter?.add) {
        for (const entity of entities) {
          try {
            await adapter.add({
              content: entity.summary || `Imported from ${source}`,
              layer: 'library-import',
              tags: entity.tags,
              source: `nowledge-mem:library:${entity.id}`,
              importance: 0.5,
            });
          } catch {
            // individual persistence failures are non-critical
          }
        }
      }

      return {
        total: importResult.imported + importResult.skipped,
        imported: importResult.imported,
        skipped: importResult.skipped,
        errors: importResult.errors,
        entities,
      };
    } catch (e: unknown) {
      return {
        total: 0,
        imported: 0,
        skipped: 0,
        errors: [`Import failed: ${(e as Error).message}`],
        entities: [],
      };
    }
  }

  private artifactToEntity(artifact: NowledgeMemLibraryArtifact): ImportedNarrativeEntity {
    return {
      id: artifact.id,
      name: artifact.name,
      sourceType: artifact.type,
      summary: artifact.summary ?? '',
      tags: [artifact.type, 'library-import'],
      importedAt: new Date().toISOString(),
    };
  }
}