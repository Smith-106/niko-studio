/**
 * FileSync Protocol
 *
 * Unified adapter interface for file synchronization paths.
 * Implementations: FileSyncService, KnowledgeServiceImpl.syncFile,
 * ObsidianKnowledgeSyncImpl.
 */

/**
 * Result of a single file sync operation.
 */
export interface FileSyncResult {
  path: string;
  success: boolean;
  action: 'synced' | 'skipped' | 'deleted' | 'error';
  message: string;
  contentHash?: string;
}

/**
 * Adapter interface for file sync operations.
 *
 * All three independent FileSync paths (FileSyncService,
 * KnowledgeService.syncFile, ObsidianKnowledgeSync) implement
 * this contract, enabling interchangeable use.
 */
export interface FileSyncAdapter {
  /**
   * Sync a single file.
   */
  syncFile(filePath: string, options?: { force?: boolean }): Promise<FileSyncResult>;

  /**
   * Sync all matching files in a directory.
   */
  syncDirectory(
    directory: string,
    patterns?: string[],
    options?: { force?: boolean },
  ): Promise<FileSyncResult[]>;

  /**
   * Stop any background watchers and release resources.
   */
  stop(): void;
}
