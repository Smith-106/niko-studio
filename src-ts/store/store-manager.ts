/**
 * StoreManager - Document Repository
 *
 * Provides document storage with:
 * - Multi-format support (Markdown, Plain text, JSON, PDF, DOCX, YAML)
 * - Automatic chunking via MemoryChunk integration
 * - Normalized storage in OpenKL structure
 * - CRUD operations for documents
 * - OpenKL file system contract integration
 *
 * Directory Structure:
 * .writing/store/
 *   sources/          # Original files
 *   normalized/       # Normalized text (*.ok.md)
 *
 * Supported Formats:
 * - Markdown (.md)
 * - Plain text (.txt)
 * - JSON (.json)
 * - YAML (.yaml, .yml)
 * - PDF (.pdf) - requires pdf-parse npm package
 * - DOCX (.docx) - requires mammoth npm package
 */

import { randomUUID } from 'node:crypto';
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  copyFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, basename, extname } from 'node:path';

import { createLogger } from '../logger/index.js';
import { MemoryChunk, TextChunker } from '../memory/memory-chunk';

const _log = createLogger('store-manager');

// ---------------------------------------------------------------------------
// DocumentFormat enum
// ---------------------------------------------------------------------------

/** Supported document formats */
export enum DocumentFormat {
  MARKDOWN = 'markdown',
  PLAIN_TEXT = 'plain_text',
  JSON = 'json',
  YAML = 'yaml',
  PDF = 'pdf',
  DOCX = 'docx',
}

/** Extension to DocumentFormat mapping */
const EXTENSION_MAP: Record<string, DocumentFormat> = {
  md: DocumentFormat.MARKDOWN,
  markdown: DocumentFormat.MARKDOWN,
  txt: DocumentFormat.PLAIN_TEXT,
  text: DocumentFormat.PLAIN_TEXT,
  json: DocumentFormat.JSON,
  yaml: DocumentFormat.YAML,
  yml: DocumentFormat.YAML,
  pdf: DocumentFormat.PDF,
  docx: DocumentFormat.DOCX,
};

/** DocumentFormat to extension mapping */
const FORMAT_EXTENSION: Record<DocumentFormat, string> = {
  [DocumentFormat.MARKDOWN]: '.md',
  [DocumentFormat.PLAIN_TEXT]: '.txt',
  [DocumentFormat.JSON]: '.json',
  [DocumentFormat.YAML]: '.yaml',
  [DocumentFormat.PDF]: '.pdf',
  [DocumentFormat.DOCX]: '.docx',
};

// ---------------------------------------------------------------------------
// DocumentFormat helper functions
// ---------------------------------------------------------------------------

/** Get format from file extension */
export function documentFormatFromExtension(ext: string): DocumentFormat {
  const normalized = ext.toLowerCase().replace(/^\./, '');
  return EXTENSION_MAP[normalized] ?? DocumentFormat.PLAIN_TEXT;
}

/** Get file extension for a document format */
export function documentFormatExtension(fmt: DocumentFormat): string {
  return FORMAT_EXTENSION[fmt] ?? '.txt';
}

/** Check if format is binary (needs special handling) */
export function isBinaryFormat(fmt: DocumentFormat): boolean {
  return fmt === DocumentFormat.PDF || fmt === DocumentFormat.DOCX;
}

// ---------------------------------------------------------------------------
// Document class
// ---------------------------------------------------------------------------

/**
 * Document data structure
 */
export class Document {
  id: string;
  content: string;
  format: DocumentFormat;
  metadata: Record<string, unknown>;
  chunks: MemoryChunk[];
  created_at: Date;
  updated_at: Date;

  constructor(params: {
    id: string;
    content: string;
    format: DocumentFormat;
    metadata?: Record<string, unknown>;
    chunks?: MemoryChunk[];
    created_at?: Date;
    updated_at?: Date;
  }) {
    this.id = params.id;
    this.content = params.content;
    this.format = params.format;
    this.metadata = params.metadata ?? {};
    this.chunks = params.chunks ?? [];
    this.created_at = params.created_at ?? new Date();
    this.updated_at = params.updated_at ?? new Date();
  }

  /** Create a new document */
  static create(
    content: string,
    format: DocumentFormat = DocumentFormat.MARKDOWN,
    metadata?: Record<string, unknown> | null,
    docId?: string | null
  ): Document {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const id = docId ?? `doc-${timestamp}-${randomUUID().slice(0, 8)}`;
    return new Document({
      id,
      content,
      format,
      metadata: metadata ?? {},
      chunks: [],
      created_at: now,
      updated_at: now,
    });
  }

  /** Convert to dictionary */
  toDict(): Record<string, unknown> {
    return {
      id: this.id,
      content: this.content,
      format: this.format as string,
      metadata: this.metadata,
      chunks: this.chunks.map((c) => c.toDict()),
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString(),
    };
  }

  /** Create from dictionary — validates against contract schema */
  static fromDict(data: Record<string, unknown>): Document {
    // Validate required fields before constructing
    const validation = validateArtifact(data);
    if (!validation.valid) {
      throw new Error(`Invalid artifact: ${validation.errors.join('; ')}`);
    }

    let createdAt: Date;
    const rawCreated = data.created_at;
    if (typeof rawCreated === 'string') {
      createdAt = new Date(rawCreated);
    } else if (rawCreated instanceof Date) {
      createdAt = rawCreated;
    } else {
      createdAt = new Date();
    }

    let updatedAt: Date;
    const rawUpdated = data.updated_at;
    if (typeof rawUpdated === 'string') {
      updatedAt = new Date(rawUpdated);
    } else if (rawUpdated instanceof Date) {
      updatedAt = rawUpdated;
    } else {
      updatedAt = new Date();
    }

    // Parse chunks
    const chunksData = (data.chunks as Record<string, unknown>[]) ?? [];
    const chunks = chunksData.map((c: Record<string, unknown>) =>
      MemoryChunk.fromDict(c)
    );

    // Parse format
    const formatValue = data.format ?? 'markdown';
    const formatEnum =
      typeof formatValue === 'string'
        ? (formatValue as DocumentFormat)
        : formatValue;

    return new Document({
      id: data.id as string,
      content: data.content as string,
      format: formatEnum as DocumentFormat,
      metadata: (data.metadata as Record<string, unknown>) ?? {},
      chunks,
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  /** Number of chunks */
  get chunkCount(): number {
    return this.chunks.length;
  }

  /** Approximate word count (CJK characters + Latin words) */
  get wordCount(): number {
    if (!this.content) return 0;
    const cjkChars = this.content.match(/\p{Script=Han}/gu);
    const cjkCount = cjkChars ? cjkChars.length : 0;
    const withoutCjk = this.content.replace(/\p{Script=Han}/gu, ' ');
    const latinWords = withoutCjk.split(/\s+/).filter(Boolean).length;
    return cjkCount + latinWords;
  }

  /** Character count */
  get charCount(): number {
    return this.content.length;
  }
}

// ---------------------------------------------------------------------------
// DocumentFilter class
// ---------------------------------------------------------------------------

/** Filter criteria for listing documents */
export class DocumentFilter {
  format?: DocumentFormat;
  tags?: string[];
  created_after?: Date | null;
  created_before?: Date | null;
  metadata_match?: Record<string, unknown> | null;

  constructor(params?: {
    format?: DocumentFormat;
    tags?: string[];
    created_after?: Date | null;
    created_before?: Date | null;
    metadata_match?: Record<string, unknown> | null;
  }) {
    this.format = params?.format;
    this.tags = params?.tags;
    this.created_after = params?.created_after ?? null;
    this.created_before = params?.created_before ?? null;
    this.metadata_match = params?.metadata_match ?? null;
  }

  /** Check if document matches filter criteria */
  matches(doc: Document): boolean {
    // Format filter
    if (this.format && doc.format !== this.format) {
      return false;
    }

    // Tags filter
    if (this.tags) {
      const docTags = (doc.metadata['tags'] as string[]) ?? [];
      if (!this.tags.some((tag) => docTags.includes(tag))) {
        return false;
      }
    }

    // Date filters
    if (this.created_after && doc.created_at < this.created_after) {
      return false;
    }
    if (this.created_before && doc.created_at > this.created_before) {
      return false;
    }

    // Metadata match
    if (this.metadata_match) {
      for (const [key, value] of Object.entries(this.metadata_match)) {
        if (doc.metadata[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }
}

// ---------------------------------------------------------------------------
// Artifact contract enforcement
// ---------------------------------------------------------------------------

/** Required fields for a valid artifact/document */
const ARTIFACT_REQUIRED_FIELDS: readonly string[] = ['id', 'content', 'format'];

/** Validation result for artifact contract enforcement */
export interface ArtifactValidationResult {
  valid: boolean;
  missingFields: string[];
  errors: string[];
}

/**
 * Validate an artifact against the contract schema.
 *
 * Checks that required fields (id, content, format) are present and non-empty.
 * Returns a structured result with missing fields and error messages.
 */
export function validateArtifact(artifact: Record<string, unknown>): ArtifactValidationResult {
  const missingFields: string[] = [];
  const errors: string[] = [];

  for (const field of ARTIFACT_REQUIRED_FIELDS) {
    const value = artifact[field];
    if (value === undefined || value === null) {
      missingFields.push(field);
      errors.push(`Missing required field: ${field}`);
    } else if (typeof value === 'string' && value.trim() === '') {
      missingFields.push(field);
      errors.push(`Required field "${field}" must not be empty`);
    }
  }

  // Validate format is a known DocumentFormat value
  if (artifact.format !== undefined && artifact.format !== null) {
    const formatStr = String(artifact.format);
    if (!Object.values(DocumentFormat).includes(formatStr as DocumentFormat)) {
      errors.push(`Unknown document format: "${formatStr}"`);
    }
  }

  // Validate id is a non-whitespace string
  if (artifact.id !== undefined && artifact.id !== null) {
    if (typeof artifact.id !== 'string') {
      errors.push(`Field "id" must be a string`);
    }
  }

  return {
    valid: missingFields.length === 0 && errors.length === 0,
    missingFields,
    errors,
  };
}

// ---------------------------------------------------------------------------
// StoreManager
// ---------------------------------------------------------------------------

/**
 * Document Repository Manager
 *
 * Provides CRUD operations for documents with:
 * - Multi-format support (Markdown, Plain text, JSON)
 * - Automatic chunking via MemoryChunk integration
 * - Normalized storage in OpenKL .writing/store/ structure
 * - In-memory index with file-based persistence
 *
 * Usage:
 *   const store = new StoreManager({ basePath: '.writing' });
 *   const docId = store.addDocument('path/to/file.md', '# Content', { author: 'user' });
 *   const doc = store.getDocument(docId);
 *   store.updateDocument(docId, '# Updated Content');
 *   store.deleteDocument(docId);
 *   const docs = store.listDocuments(new DocumentFilter({ format: DocumentFormat.MARKDOWN }));
 */
export class StoreManager {
  basePath: string;
  storePath: string;
  sourcesPath: string;
  normalizedPath: string;
  indexPath: string;
  autoChunk: boolean;
  chunker: TextChunker;

  private _documents: Map<string, Document> = new Map();

  constructor(params: {
    basePath?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    autoChunk?: boolean;
  } = {}) {
    this.basePath = params.basePath ?? '.writing';
    this.storePath = join(this.basePath, 'store');
    this.sourcesPath = join(this.storePath, 'sources');
    this.normalizedPath = join(this.storePath, 'normalized');
    this.indexPath = join(this.storePath, '.index.json');

    this.autoChunk = params.autoChunk ?? true;
    this.chunker = new TextChunker({
      chunkSize: params.chunkSize ?? 512,
      chunkOverlap: params.chunkOverlap ?? 50,
    });

    // Ensure directory structure
    this._ensureDirectories();

    // Load existing index
    this._loadIndex();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private _ensureDirectories(): void {
    mkdirSync(this.sourcesPath, { recursive: true });
    mkdirSync(this.normalizedPath, { recursive: true });
  }

  private _loadIndex(): void {
    if (!existsSync(this.indexPath)) return;
    try {
      const raw = readFileSync(this.indexPath, 'utf-8');
      const indexData = JSON.parse(raw) as Record<string, unknown>;
      const docs = (indexData.documents as Record<string, unknown>[]) ?? [];
      for (const docData of docs) {
        try {
          const doc = Document.fromDict(docData);
          this._documents.set(doc.id, doc);
        } catch (e) {
          _log.warn(`Failed to load document`, { detail: String(e) });
        }
      }
    } catch (e) {
      _log.error(`Failed to load index`, { detail: String(e) });
    }
  }

  private _saveIndex(): void {
    try {
      const indexData = {
        version: '1.0',
        updated_at: new Date().toISOString(),
        documents: Array.from(this._documents.values()).map((d) => d.toDict()),
      };
      writeFileSync(this.indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
    } catch (e) {
      _log.error(`Failed to save index`, { detail: String(e) });
    }
  }

  private _detectFormat(filePath: string): DocumentFormat {
    return documentFormatFromExtension(extname(filePath));
  }

  private _normalizeContent(content: string, docId: string, format: DocumentFormat): string {
    // Unicode NFC normalization (JS strings are already NFC)
    // Standardize line endings
    let normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Add OpenKL metadata header
    const now = new Date().toISOString();
    const header = `---
doc_id: ${docId}
format: ${format as string}
normalized_at: ${now}
---

`;
    return header + normalized;
  }

  private _chunkDocument(doc: Document): MemoryChunk[] {
    if (!this.autoChunk) return [];

    const chunks = this.chunker.chunkText(doc.content, doc.id, {
      doc_format: doc.format as string,
      doc_id: doc.id,
      ...doc.metadata,
    });
    return chunks;
  }

  // -----------------------------------------------------------------------
  // CRUD operations
  // -----------------------------------------------------------------------

  /** Add a document to the store — validates artifact contract first */
  addDocument(
    path: string,
    content: string,
    metadata?: Record<string, unknown> | null,
    docId?: string | null,
    normalize: boolean = true
  ): string {
    const format = this._detectFormat(path);

    // Validate artifact contract before storage
    const validation = validateArtifact({
      id: docId ?? `doc-${Date.now()}`,
      content,
      format,
    });
    if (!validation.valid) {
      throw new Error(`Artifact validation failed: ${validation.errors.join('; ')}`);
    }

    // Create document
    const doc = Document.create(content, format, metadata ?? {}, docId);

    // Add source info to metadata
    doc.metadata['source_path'] = path;
    doc.metadata['source_name'] = basename(path);

    // Chunk document
    doc.chunks = this._chunkDocument(doc);

    // Save source file
    const ext = documentFormatExtension(format);
    const sourceFile = join(this.sourcesPath, `${doc.id}${ext}`);
    writeFileSync(sourceFile, content, 'utf-8');

    // Save normalized version
    if (normalize) {
      const normalizedContent = this._normalizeContent(content, doc.id, format);
      const normalizedFile = join(this.normalizedPath, `${doc.id}.ok.md`);
      writeFileSync(normalizedFile, normalizedContent, 'utf-8');
    }

    // Add to index
    this._documents.set(doc.id, doc);
    this._saveIndex();

    return doc.id;
  }

  /** Get a document by ID */
  getDocument(docId: string): Document | null {
    const doc = this._documents.get(docId);
    if (!doc) {
      return null;
    }

    // Verify file exists and reload content if needed
    const ext = documentFormatExtension(doc.format);
    const sourceFile = join(this.sourcesPath, `${docId}${ext}`);
    if (existsSync(sourceFile)) {
      doc.content = readFileSync(sourceFile, 'utf-8');
    }

    return doc;
  }

  /** Update a document's content */
  updateDocument(
    docId: string,
    content: string,
    metadata?: Record<string, unknown> | null,
    normalize: boolean = true
  ): boolean {
    const doc = this._documents.get(docId);
    if (!doc) {
      _log.warn(`Document not found for update`, { docId });
      return false;
    }

    // Update document
    doc.content = content;
    doc.updated_at = new Date();

    if (metadata) {
      Object.assign(doc.metadata, metadata);
    }

    // Re-chunk document
    doc.chunks = this._chunkDocument(doc);

    // Update source file
    const ext = documentFormatExtension(doc.format);
    const sourceFile = join(this.sourcesPath, `${docId}${ext}`);
    writeFileSync(sourceFile, content, 'utf-8');

    // Update normalized version
    if (normalize) {
      const normalizedContent = this._normalizeContent(content, docId, doc.format);
      const normalizedFile = join(this.normalizedPath, `${docId}.ok.md`);
      writeFileSync(normalizedFile, normalizedContent, 'utf-8');
    }

    // Save index
    this._saveIndex();

    return true;
  }

  /** Delete a document */
  deleteDocument(docId: string): boolean {
    const doc = this._documents.get(docId);
    if (!doc) {
      _log.warn(`Document not found for deletion`, { docId });
      return false;
    }

    // Delete source file
    const ext = documentFormatExtension(doc.format);
    const sourceFile = join(this.sourcesPath, `${docId}${ext}`);
    if (existsSync(sourceFile)) {
      unlinkSync(sourceFile);
    }

    // Delete normalized file
    const normalizedFile = join(this.normalizedPath, `${docId}.ok.md`);
    if (existsSync(normalizedFile)) {
      unlinkSync(normalizedFile);
    }

    // Remove from index
    this._documents.delete(docId);
    this._saveIndex();

    return true;
  }

  /** List documents with optional filtering */
  listDocuments(
    filter?: DocumentFilter | null,
    limit: number = 100,
    offset: number = 0
  ): Document[] {
    const results: Document[] = [];

    for (const doc of this._documents.values()) {
      if (filter && !filter.matches(doc)) {
        continue;
      }
      results.push(doc);
    }

    // Sort by creation date (newest first)
    results.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    // Apply pagination
    return results.slice(offset, offset + limit);
  }

  /** Simple content search (case-insensitive) */
  searchByContent(query: string, limit: number = 10): Document[] {
    const queryLower = query.toLowerCase();
    const results: Document[] = [];

    for (const doc of this._documents.values()) {
      if (doc.content.toLowerCase().includes(queryLower)) {
        results.push(doc);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /** Get chunks for a document */
  getChunks(docId: string): MemoryChunk[] {
    const doc = this._documents.get(docId);
    if (!doc) return [];
    return doc.chunks;
  }

  /** Get normalized content for a document */
  getNormalizedContent(docId: string): string | null {
    const normalizedFile = join(this.normalizedPath, `${docId}.ok.md`);
    if (existsSync(normalizedFile)) {
      return readFileSync(normalizedFile, 'utf-8');
    }
    return null;
  }

  /** Import an existing file into the store */
  importFile(
    filePath: string,
    metadata?: Record<string, unknown> | null,
    docId?: string | null
  ): string {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    return this.addDocument(filePath, content, metadata, docId);
  }

  /** Export a document to a file */
  exportDocument(
    docId: string,
    outputPath: string,
    normalized: boolean = false
  ): boolean {
    const doc = this.getDocument(docId);
    if (!doc) return false;

    // Ensure parent directory exists
    const dir = join(outputPath, '..');
    mkdirSync(dir, { recursive: true });

    let content: string;
    if (normalized) {
      content = this.getNormalizedContent(docId)
        ?? this._normalizeContent(doc.content, docId, doc.format);
    } else {
      content = doc.content;
    }

    writeFileSync(outputPath, content, 'utf-8');
    return true;
  }

  // -----------------------------------------------------------------------
  // Properties
  // -----------------------------------------------------------------------

  /** Total number of documents */
  get documentCount(): number {
    return this._documents.size;
  }

  /** Total number of chunks across all documents */
  get totalChunks(): number {
    let count = 0;
    for (const doc of this._documents.values()) {
      count += doc.chunkCount;
    }
    return count;
  }

  /** Get store statistics */
  stats(): Record<string, unknown> {
    const formatCounts: Record<string, number> = {};
    for (const doc of this._documents.values()) {
      const fmt = doc.format as string;
      formatCounts[fmt] = (formatCounts[fmt] ?? 0) + 1;
    }

    return {
      document_count: this.documentCount,
      total_chunks: this.totalChunks,
      format_counts: formatCounts,
      store_path: this.storePath,
    };
  }

  // -----------------------------------------------------------------------
  // Multi-format loading (PDF, DOCX, YAML support)
  // -----------------------------------------------------------------------

  /** Load content from PDF file (requires pdf-parse) */
  private async _loadPdfContent(filePath: string): Promise<string> {
    try {
      const pdfParse = (await import('pdf-parse')) as Record<string, unknown>;
      const buffer = readFileSync(filePath);
      const data = await (pdfParse.default as (buf: Buffer) => Promise<{ text: string }>)(buffer);
      return data.text ?? '';
    } catch {
      throw new Error(
        'pdf-parse is required for PDF support. Install with: npm install pdf-parse'
      );
    }
  }

  /** Load content from DOCX file (requires mammoth) */
  private async _loadDocxContent(filePath: string): Promise<string> {
    try {
      const mammothMod = (await import('mammoth')) as Record<string, unknown>;
      const result = await (mammothMod.extractRawText as (opts: { path: string }) => Promise<{ value: string }>)({ path: filePath });
      return result.value ?? '';
    } catch {
      throw new Error(
        'mammoth is required for DOCX support. Install with: npm install mammoth'
      );
    }
  }

  /** Load content from YAML file */
  private _loadYamlContent(filePath: string): string {
    // Fallback to plain text if js-yaml is not available
    return readFileSync(filePath, 'utf-8');
  }

  /** Load content from file based on format */
  async loadFileContent(filePath: string): Promise<string> {
    const fmt = this._detectFormat(filePath);

    switch (fmt) {
      case DocumentFormat.PDF:
        return this._loadPdfContent(filePath);
      case DocumentFormat.DOCX:
        return this._loadDocxContent(filePath);
      case DocumentFormat.YAML:
        return this._loadYamlContent(filePath);
      default:
        return readFileSync(filePath, 'utf-8');
    }
  }

  /** Import a binary file (PDF, DOCX) into the store */
  async importBinaryFile(
    filePath: string,
    metadata?: Record<string, unknown> | null,
    docId?: string | null
  ): Promise<string> {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fmt = this._detectFormat(filePath);
    const content = await this.loadFileContent(filePath);

    // Add format-specific metadata
    const meta: Record<string, unknown> = { ...(metadata ?? {}) };
    meta['original_format'] = fmt;
    meta['original_file'] = basename(filePath);

    // Store extracted text
    const id = this.addDocument(filePath, content, meta, docId);

    // Copy original binary file to sources
    if (isBinaryFormat(fmt)) {
      const binaryDest = join(
        this.sourcesPath,
        `${id}_original${documentFormatExtension(fmt)}`
      );
      copyFileSync(filePath, binaryDest);
    }

    return id;
  }

  // -----------------------------------------------------------------------
  // OpenKL Contract Integration
  // -----------------------------------------------------------------------

  /** Synchronize store with OpenKL contract */
  syncWithOpenKL(openklContract: {
    ingestContent: (
      content: string,
      docId?: string | null,
      sourceType?: string,
      filename?: string | null,
      normalize?: boolean,
      metadata?: Record<string, unknown> | null
    ) => string;
  }): Record<string, unknown> {
    let synced = 0;
    const errors: Record<string, unknown>[] = [];

    for (const doc of this._documents.values()) {
      try {
        openklContract.ingestContent(
          doc.content,
          doc.id,
          (doc.metadata['source_type'] as string) ?? 'store',
          null,
          true,
          {
            ...doc.metadata,
            format: doc.format as string,
            chunk_count: doc.chunkCount,
          }
        );
        synced++;
      } catch (e) {
        errors.push({ doc_id: doc.id, error: String(e) });
      }
    }

    return {
      synced,
      errors,
      total: this._documents.size,
    };
  }

  /** Import documents from OpenKL contract */
  importFromOpenKL(
    openklContract: {
      iterDocuments: (sourceType?: string | null) => Iterable<Record<string, unknown>>;
    },
    sourceType?: string | null
  ): number {
    let imported = 0;

    for (const docData of openklContract.iterDocuments(sourceType)) {
      const id = docData.doc_id as string;

      // Skip if already exists
      if (this._documents.has(id)) continue;

      const content = docData.content as string;
      const path = (docData.path as string) ?? `${id}.md`;
      const metadata = {
        ...((docData.metadata as Record<string, unknown>) ?? {}),
      };
      const sourceTypeValue = docData.source_type;
      if (typeof sourceTypeValue === 'string' && sourceTypeValue.length > 0) {
        metadata['source_type'] = sourceTypeValue;
      }

      this.addDocument(
        path,
        content,
        metadata,
        id,
        false // Already normalized in OpenKL
      );
      imported++;
    }

    return imported;
  }

  // -----------------------------------------------------------------------
  // Advanced chunking features
  // -----------------------------------------------------------------------

  /** Re-chunk a document with new parameters */
  rechunkDocument(
    docId: string,
    chunkSize?: number | null,
    chunkOverlap?: number | null
  ): number {
    const doc = this._documents.get(docId);
    if (!doc) {
      _log.warn(`Document not found`, { docId });
      return 0;
    }

    // Create temporary chunker with new settings
    const chunker = new TextChunker({
      chunkSize: chunkSize ?? this.chunker.chunkSize,
      chunkOverlap: chunkOverlap ?? this.chunker.chunkOverlap,
    });

    // Re-chunk
    doc.chunks = chunker.chunkText(doc.content, doc.id, {
      doc_format: doc.format as string,
      doc_id: doc.id,
      ...doc.metadata,
    });

    doc.updated_at = new Date();
    this._saveIndex();

    return doc.chunks.length;
  }

  /** Get all chunks from all documents */
  getAllChunks(filter?: DocumentFilter | null): MemoryChunk[] {
    const allChunks: MemoryChunk[] = [];

    for (const doc of this._documents.values()) {
      if (filter && !filter.matches(doc)) continue;
      allChunks.push(...doc.chunks);
    }

    return allChunks;
  }

  /** Search chunks by content (simple text matching) */
  searchChunks(query: string, limit: number = 20): Record<string, unknown>[] {
    const queryLower = query.toLowerCase();
    const results: Record<string, unknown>[] = [];

    for (const doc of this._documents.values()) {
      for (const chunk of doc.chunks) {
        if (chunk.content.toLowerCase().includes(queryLower)) {
          results.push({
            chunk,
            doc_id: doc.id,
            doc_format: doc.format,
            doc_metadata: doc.metadata,
          });
          if (results.length >= limit) return results;
        }
      }
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Batch operations
  // -----------------------------------------------------------------------

  /** Import all documents from a directory */
  async importDirectory(
    directory: string,
    recursive: boolean = true,
    extensions?: string[] | null
  ): Promise<Record<string, unknown>> {
    if (!existsSync(directory) || !statSync(directory).isDirectory()) {
      throw new Error(`Not a directory: ${directory}`);
    }

    // Default extensions
    const exts = extensions ?? ['.md', '.txt', '.json', '.yaml', '.yml', '.pdf', '.docx'];

    // Find files
    const files = this._findFiles(directory, exts, recursive);

    let imported = 0;
    const errors: Record<string, unknown>[] = [];

    for (const filePath of files) {
      try {
        const fmt = this._detectFormat(filePath);
        if (isBinaryFormat(fmt)) {
          await this.importBinaryFile(filePath);
        } else {
          this.importFile(filePath);
        }
        imported++;
      } catch (e) {
        errors.push({ file: filePath, error: String(e) });
      }
    }

    return {
      imported,
      errors,
      total_files: files.length,
    };
  }

  /** Find files matching extensions in a directory */
  private _findFiles(
    directory: string,
    extensions: string[],
    recursive: boolean
  ): string[] {
    const results: string[] = [];
    const extSet = new Set(extensions.map((e) => e.toLowerCase()));

    this._walkDir(directory, recursive, (filePath: string): void => {
      const ext = extname(filePath).toLowerCase();
      if (extSet.has(ext)) {
        results.push(filePath);
      }
    });

    return results;
  }

  /** Walk directory recursively or shallow */
  private _walkDir(
    dir: string,
    recursive: boolean,
    callback: (filePath: string) => void
  ): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && recursive) {
        this._walkDir(fullPath, recursive, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  }

  /** Export all documents to a directory */
  exportAll(
    outputDir: string,
    normalized: boolean = false,
    filter?: DocumentFilter | null
  ): number {
    mkdirSync(outputDir, { recursive: true });
    let exported = 0;

    for (const doc of this._documents.values()) {
      if (filter && !filter.matches(doc)) continue;
      const outputPath = join(
        outputDir,
        `${doc.id}${documentFormatExtension(doc.format)}`
      );
      if (this.exportDocument(doc.id, outputPath, normalized)) {
        exported++;
      }
    }

    return exported;
  }

  /** Delete all documents from the store */
  clearAll(confirm: boolean = false): number {
    if (!confirm) {
      throw new Error('Must set confirm=true to clear all documents');
    }

    const count = this._documents.size;
    for (const docId of Array.from(this._documents.keys())) {
      this.deleteDocument(docId);
    }

    return count;
  }
}
