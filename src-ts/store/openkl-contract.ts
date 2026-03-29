/**
 * OpenKL File System Contract
 *
 * Implements the OpenKL "File as Truth" philosophy with standardized directory structure.
 *
 * Directory Structure:
 * .writing/
 *   store/
 *     sources/          # Original files
 *     normalized/       # Normalized text (*.ok.md)
 *   memories/
 *     by_date/          # Temporal organization (YYYY-MM/DD/<id>.md)
 *     topics/           # Topic symlinks
 *   citations/            # Citation JSON files
 *   sessions/
 *     active/           # Active sessions
 *     archived/         # Archived sessions
 *   .ok/
 *     kuzu/             # Kuzu graph database
 *     mapping.jsonl     # docID -> path mapping
 */

import { randomUUID } from 'node:crypto';
import {
  writeFileSync,
  readFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  copyFileSync,
  readdirSync,
  symlinkSync,
} from 'node:fs';
import { join, dirname, basename, extname, relative } from 'node:path';
import { homedir, platform } from 'node:os';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// OpenKLPaths
// ---------------------------------------------------------------------------

/**
 * OpenKL directory paths configuration
 */
export class OpenKLPaths {
  basePath: string;

  constructor(basePath: string = '.writing') {
    this.basePath = basePath;
  }

  get store(): string {
    return join(this.basePath, 'store');
  }

  get sources(): string {
    return join(this.store, 'sources');
  }

  get normalized(): string {
    return join(this.store, 'normalized');
  }

  get memories(): string {
    return join(this.basePath, 'memories');
  }

  get memoriesByDate(): string {
    return join(this.memories, 'by_date');
  }

  get memoriesTopics(): string {
    return join(this.memories, 'topics');
  }

  get citations(): string {
    return join(this.basePath, 'citations');
  }

  get sessions(): string {
    return join(this.basePath, 'sessions');
  }

  get activeSessions(): string {
    return join(this.sessions, 'active');
  }

  get archivedSessions(): string {
    return join(this.sessions, 'archived');
  }

  get okDir(): string {
    return join(this.basePath, '.ok');
  }

  get kuzuDir(): string {
    return join(this.okDir, 'kuzu');
  }

  get mappingFile(): string {
    return join(this.okDir, 'mapping.jsonl');
  }

  /** Get all directory paths that should exist */
  allPaths(): string[] {
    return [
      this.sources,
      this.normalized,
      this.memoriesByDate,
      this.memoriesTopics,
      this.citations,
      this.activeSessions,
      this.archivedSessions,
      this.kuzuDir,
    ];
  }
}

// ---------------------------------------------------------------------------
// DocumentMapping
// ---------------------------------------------------------------------------

/**
 * Document ID to path mapping entry
 */
export class DocumentMapping {
  docId: string;
  path: string;
  sha256: string;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;

  constructor(params: {
    docId: string;
    path: string;
    sha256: string;
    sourceType: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
  }) {
    this.docId = params.docId;
    this.path = params.path;
    this.sha256 = params.sha256;
    this.sourceType = params.sourceType;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
    this.metadata = params.metadata ?? {};
  }

  toDict(): Record<string, unknown> {
    return {
      doc_id: this.docId,
      path: this.path,
      sha256: this.sha256,
      source_type: this.sourceType,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      metadata: this.metadata,
    };
  }

  static fromDict(data: Record<string, unknown>): DocumentMapping {
    return new DocumentMapping({
      docId: data['doc_id'] as string,
      path: data['path'] as string,
      sha256: data['sha256'] as string,
      sourceType: (data['source_type'] as string) ?? 'general',
      createdAt: data['created_at'] as string,
      updatedAt: data['updated_at'] as string,
      metadata: (data['metadata'] as Record<string, unknown>) ?? {},
    });
  }
}

// ---------------------------------------------------------------------------
// OpenKLContract
// ---------------------------------------------------------------------------

/**
 * OpenKL File System Contract Manager
 *
 * Implements the "File as Truth" philosophy:
 * - All data is stored as files in a standardized directory structure
 * - Documents are normalized and indexed
 * - Mappings track document IDs to file paths
 * - Supports temporal organization and topic linking
 */
export class OpenKLContract {
  static readonly SUPPORTED_EXTENSIONS: readonly string[] = ['.md', '.txt', '.json', '.yaml', '.yml'];

  paths: OpenKLPaths;
  private _mappings: Map<string, DocumentMapping> = new Map();

  constructor(basePath: string = '.writing') {
    this.paths = new OpenKLPaths(basePath);
    this._ensureStructure();
    this._loadMappings();

    console.info(`OpenKL contract initialized at: ${this.paths.basePath}`);
  }

  // -----------------------------------------------------------------------
  // Directory management
  // -----------------------------------------------------------------------

  private _ensureStructure(): void {
    /** Create all required directories */
    for (const path of this.paths.allPaths()) {
      mkdirSync(path, { recursive: true });
    }
    // Ensure mapping file exists
    if (!existsSync(this.paths.mappingFile)) {
      writeFileSync(this.paths.mappingFile, '');
    }
  }

  // -----------------------------------------------------------------------
  // Mapping persistence
  // -----------------------------------------------------------------------

  private _loadMappings(): void {
    /** Load document mappings from JSONL file */
    if (!existsSync(this.paths.mappingFile)) return;
    try {
      const content = readFileSync(this.paths.mappingFile, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed);
          const mapping = DocumentMapping.fromDict(data);
          this._mappings.set(mapping.docId, mapping);
        } catch (e) {
          if (e instanceof SyntaxError) {
            console.warn(`Invalid mapping line: ${e.message}`);
          }
        }
      }
    } catch (e) {
      console.error(`Failed to load mappings: ${e}`);
    }
  }

  private _saveMappings(): void {
    /** Save all mappings to JSONL file */
    try {
      const lines = Array.from(this._mappings.values()).map((m) =>
        JSON.stringify(m.toDict()) + '\n'
      );
      writeFileSync(this.paths.mappingFile, lines.join(''), 'utf-8');
    } catch (e) {
      console.error(`Failed to save mappings: ${e}`);
    }
  }

  private _appendMapping(mapping: DocumentMapping): void {
    /** Append a single mapping to the JSONL file */
    try {
      const line = JSON.stringify(mapping.toDict()) + '\n';
      appendFileSync(this.paths.mappingFile, line, 'utf-8');
    } catch (e) {
      console.error(`Failed to append mapping: ${e}`);
    }
  }

  // -----------------------------------------------------------------------
  // Static helpers
  // -----------------------------------------------------------------------

  /** Compute SHA256 hash of content */
  static computeSha256(content: string | Buffer): string {
    if (typeof content === 'string') {
      content = Buffer.from(content, 'utf-8');
    }
    return createHash('sha256').update(content).digest('hex');
  }

  /** Generate a unique document ID from path */
  static generateDocId(path: string, prefix: string = 'doc'): string {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').replace(/\./g, '');
    const pathHash = createHash('md5').update(path).digest('hex').slice(0, 8);
    return `${prefix}-${timestamp}-${pathHash}`;
  }

  /**
   * Normalize document content to OpenKL format (*.ok.md)
   *
   * Normalization includes:
   * - Unicode NFC normalization
   * - Line ending standardization
   * - Metadata header addition
   */
  normalizeContent(content: string, sourcePath: string): string {
    // Unicode NFC normalization (JavaScript strings are already NFC)
    // Standardize line endings
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Add OpenKL metadata header
    const now = new Date().toISOString();
    const header = `---
source: ${basename(sourcePath)}
normalized_at: ${now}
format: ok.md

`;

    return header + content;
  }

  // -----------------------------------------------------------------------
  // File ingestion
  // -----------------------------------------------------------------------

  /**
   * Ingest a file into the OpenKL store
   *
   * @param sourcePath - Path to the source file
   * @param docId - Optional document ID (auto-generated if not provided)
   * @param sourceType - Document type classification
   * @param normalize - Whether to create normalized version
   * @param metadata - Additional metadata
   * @returns Document ID
   */
  ingestFile(
    sourcePath: string,
    docId?: string | null,
    sourceType: string = 'general',
    normalize: boolean = true,
    metadata?: Record<string, unknown> | null
  ): string {
    if (!existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    const ext = extname(sourcePath).toLowerCase();
    if (!OpenKLContract.SUPPORTED_EXTENSIONS.includes(ext)) {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    // Read content
    const content = readFileSync(sourcePath, 'utf-8');
    const sha256 = OpenKLContract.computeSha256(content);

    // Generate doc_id if not provided
    if (docId === undefined || docId === null) {
      docId = OpenKLContract.generateDocId(sourcePath);
    }

    // Copy to sources directory
    const destSource = join(this.paths.sources, `${docId}${extname(sourcePath)}`);
    copyFileSync(sourcePath, destSource);

    // Create normalized version if requested
    if (normalize) {
      const normalizedContent = this.normalizeContent(content, sourcePath);
      const destNormalized = join(this.paths.normalized, `${docId}.ok.md`);
      writeFileSync(destNormalized, normalizedContent, 'utf-8');
    }

    // Create mapping
    const now = new Date().toISOString();
    const mapping = new DocumentMapping({
      docId,
      path: relative(this.paths.basePath, destSource),
      sha256,
      sourceType,
      createdAt: now,
      updatedAt: now,
      metadata: metadata ?? {},
    });

    this._mappings.set(docId, mapping);
    this._appendMapping(mapping);

    console.info(`Ingested document: ${docId} from ${sourcePath}`);
    return docId;
  }

  /**
   * Ingest content directly into the OpenKL store
   *
   * @param content - Text content to ingest
   * @param docId - Optional document ID
   * @param sourceType - Document type classification
   * @param filename - Optional filename for the content
   * @param normalize - Whether to create normalized version
   * @param metadata - Additional metadata
   * @returns Document ID
   */
  ingestContent(
    content: string,
    docId?: string | null,
    sourceType: string = 'general',
    filename?: string | null,
    normalize: boolean = true,
    metadata?: Record<string, unknown> | null
  ): string {
    const sha256 = OpenKLContract.computeSha256(content);

    // Generate doc_id if not provided
    if (docId === undefined || docId === null) {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').replace(/\./g, '');
      const hashSuffix = sha256.slice(0, 8);
      docId = `doc-${timestamp}-${hashSuffix}`;
    }

    // Determine filename
    if (filename === undefined || filename === null) {
      filename = `${docId}.md`;
    }

    // Save to sources
    const destSource = join(this.paths.sources, filename);
    writeFileSync(destSource, content, 'utf-8');

    // Create normalized version if requested
    if (normalize) {
      const normalizedContent = this.normalizeContent(content, destSource);
      const destNormalized = join(this.paths.normalized, `${docId}.ok.md`);
      writeFileSync(destNormalized, normalizedContent, 'utf-8');
    }

    // Create mapping
    const now = new Date().toISOString();
    const mapping = new DocumentMapping({
      docId,
      path: relative(this.paths.basePath, destSource),
      sha256,
      sourceType,
      createdAt: now,
      updatedAt: now,
      metadata: metadata ?? {},
    });

    this._mappings.set(docId, mapping);
    this._appendMapping(mapping);

    console.info(`Ingested content as document: ${docId}`);
    return docId;
  }

  // -----------------------------------------------------------------------
  // Document CRUD
  // -----------------------------------------------------------------------

  /** Get document by ID */
  getDocument(docId: string): Record<string, unknown> | null {
    const mapping = this._mappings.get(docId);
    if (!mapping) {
      return null;
    }

    const docPath = join(this.paths.basePath, mapping.path);
    if (!existsSync(docPath)) {
      console.warn(`Document file missing: ${docPath}`);
      return null;
    }

    const content = readFileSync(docPath, 'utf-8');
    return {
      doc_id: mapping.docId,
      path: mapping.path,
      content,
      sha256: mapping.sha256,
      source_type: mapping.sourceType,
      created_at: mapping.createdAt,
      updated_at: mapping.updatedAt,
      metadata: mapping.metadata,
    };
  }

  /** Get normalized content for a document */
  getNormalizedContent(docId: string): string | null {
    const normalizedPath = join(this.paths.normalized, `${docId}.ok.md`);
    if (existsSync(normalizedPath)) {
      return readFileSync(normalizedPath, 'utf-8');
    }
    return null;
  }

  /** Delete a document and its normalized version */
  deleteDocument(docId: string): boolean {
    const mapping = this._mappings.get(docId);
    if (!mapping) {
      return false;
    }

    // Delete source file
    const sourcePath = join(this.paths.basePath, mapping.path);
    if (existsSync(sourcePath)) {
      unlinkSync(sourcePath);
    }

    // Delete normalized file
    const normalizedPath = join(this.paths.normalized, `${docId}.ok.md`);
    if (existsSync(normalizedPath)) {
      unlinkSync(normalizedPath);
    }

    // Remove mapping
    this._mappings.delete(docId);
    this._saveMappings();

    console.info(`Deleted document: ${docId}`);
    return true;
  }

  /** List all documents, optionally filtered by type */
  listDocuments(sourceType?: string | null, limit: number = 100): Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];

    for (const mapping of this._mappings.values()) {
      if (sourceType && mapping.sourceType !== sourceType) {
        continue;
      }

      results.push({
        doc_id: mapping.docId,
        path: mapping.path,
        source_type: mapping.sourceType,
        created_at: mapping.createdAt,
        metadata: mapping.metadata,
      });

      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }

  /** Iterate over all documents */
  *iterDocuments(sourceType?: string | null): Generator<Record<string, unknown>> {
    for (const mapping of this._mappings.values()) {
      if (sourceType && mapping.sourceType !== sourceType) {
        continue;
      }
      const doc = this.getDocument(mapping.docId);
      if (doc) {
        yield doc;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Memory operations
  // -----------------------------------------------------------------------

  /**
   * Create a memory file in the temporal structure
   *
   * @param memoryId - Memory ID
   * @param content - Memory content
   * @param topics - Optional list of topics for symlink creation
   * @param metadata - Additional metadata
   * @returns Path to the created memory file
   */
  createMemory(
    memoryId: string,
    content: string,
    topics?: string[] | null,
    metadata?: Record<string, unknown> | null
  ): string {
    const now = new Date();

    // Create date-based path
    const yearMonth = now.toISOString().slice(0, 7);
    const day = now.toISOString().slice(8, 10);
    const dateDir = join(this.paths.memoriesByDate, yearMonth, day);
    mkdirSync(dateDir, { recursive: true });

    // Write memory file
    const memoryPath = join(dateDir, `${memoryId}.md`);

    // Add metadata header
    const header = `---
memory_id: ${memoryId}
created_at: ${now.toISOString()}
topics: ${JSON.stringify(topics ?? [])}
metadata: ${JSON.stringify(metadata ?? {})}

`;

    writeFileSync(memoryPath, header + content, 'utf-8');

    // Create topic symlinks
    if (topics) {
      for (const topic of topics) {
        const topicDir = join(this.paths.memoriesTopics, topic);
        mkdirSync(topicDir, { recursive: true });

        const symlinkPath = join(topicDir, `${memoryId}.md`);
        if (!existsSync(symlinkPath)) {
          try {
            if (platform() === 'win32') {
              // Windows: copy instead of symlink
              copyFileSync(memoryPath, symlinkPath);
            } else {
              symlinkSync(memoryPath, symlinkPath);
            }
          } catch {
            // Symlinks may not work on all systems
          }
        }
      }
    }

    console.info(`Created memory: ${memoryId}`);
    return memoryPath;
  }

  // -----------------------------------------------------------------------
  // Citation operations
  // -----------------------------------------------------------------------

  /** Save a citation to the citations directory */
  saveCitation(citationId: string, citationData: Record<string, unknown>): string {
    const citationPath = join(this.paths.citations, `${citationId}.json`);
    writeFileSync(
      citationPath,
      JSON.stringify(citationData, null, 2),
      'utf-8'
    );
    return citationPath;
  }

  /** Get a citation by ID */
  getCitation(citationId: string): Record<string, unknown> | null {
    const citationPath = join(this.paths.citations, `${citationId}.json`);
    if (!existsSync(citationPath)) {
      return null;
    }
    return JSON.parse(readFileSync(citationPath, 'utf-8'));
  }

  // -----------------------------------------------------------------------
  // Integrity verification
  // -----------------------------------------------------------------------

  /** Verify the integrity of the store */
  verifyIntegrity(): Record<string, unknown> {
    const results: Record<string, unknown> = {
      total_documents: this._mappings.size,
      missing_files: [] as string[],
      hash_mismatches: [] as Record<string, unknown>[],
      orphaned_files: [] as string[],
    };

    // Check mapped documents
    for (const [docId, mapping] of this._mappings) {
      const docPath = join(this.paths.basePath, mapping.path);

      if (!existsSync(docPath)) {
        (results.missing_files as string[]).push(docId);
        continue;
      }

      // Verify hash
      const content = readFileSync(docPath, 'utf-8');
      const currentHash = OpenKLContract.computeSha256(content);

      if (currentHash !== mapping.sha256) {
        (results.hash_mismatches as Record<string, unknown>[]).push({
          doc_id: docId,
          expected: mapping.sha256,
          actual: currentHash,
        });
      }
    }

    // Check for orphaned files
    const mappedPaths = new Set(
      Array.from(this._mappings.values()).map((m) => m.path)
    );

    try {
      const sourceFiles = readdirSync(this.paths.sources, { withFileTypes: true });
      for (const sourceFile of sourceFiles) {
        if (sourceFile.isFile()) {
          const relPath = relative(this.paths.basePath, join(this.paths.sources, sourceFile.name));
          if (!mappedPaths.has(relPath)) {
            (results.orphaned_files as string[]).push(relPath);
          }
        }
      }
    } catch {
      // Sources directory may not exist yet
    }

    return results;
  }
}
