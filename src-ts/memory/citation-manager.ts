/**
 * Citation Manager Module
 *
 * Implements the Citation Management System for handling creation,
 * verification, storage, and garbage collection of content citations.
 */

import { createHash, randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Types (mirroring SearchResultLocation from vector-search)
// ---------------------------------------------------------------------------

export interface SearchResultLocation {
  kind: string;
  start: number;
  end: number | null;
}

export interface SearchResultMeta {
  path: string | null;
  surface: string | null;
  loc: SearchResultLocation | null;
}

// ---------------------------------------------------------------------------
// TransientCitation
// ---------------------------------------------------------------------------

export class TransientCitation {
  citationId: string;
  sourceText: string;
  sourceLocation: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  contextBefore: string;
  contextAfter: string;
  score: number | null;
  metadata: Record<string, unknown>;

  constructor(params: {
    citationId: string;
    sourceText: string;
    sourceLocation: Record<string, unknown>;
    createdAt: string;
    expiresAt: string;
    contextBefore?: string;
    contextAfter?: string;
    score?: number | null;
    metadata?: Record<string, unknown>;
  }) {
    this.citationId = params.citationId;
    this.sourceText = params.sourceText;
    this.sourceLocation = params.sourceLocation;
    this.createdAt = params.createdAt;
    this.expiresAt = params.expiresAt;
    this.contextBefore = params.contextBefore ?? "";
    this.contextAfter = params.contextAfter ?? "";
    this.score = params.score ?? null;
    this.metadata = params.metadata ?? {};
  }

  /** Check if the citation has expired. */
  isExpired(): boolean {
    try {
      const expires = new Date(this.expiresAt.replace("Z", "+00:00"));
      return new Date() > expires;
    } catch {
      return true;
    }
  }

  /** Convert to plain object. */
  toDict(): Record<string, unknown> {
    return {
      citationId: this.citationId,
      sourceText: this.sourceText,
      sourceLocation: this.sourceLocation,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      contextBefore: this.contextBefore,
      contextAfter: this.contextAfter,
      score: this.score,
      metadata: this.metadata,
    };
  }

  /** Create from plain object. */
  static fromDict(data: Record<string, any>): TransientCitation {
    return new TransientCitation({
      citationId: data.citationId ?? data.citation_id ?? "",
      sourceText: data.sourceText ?? data.source_text ?? "",
      sourceLocation: data.sourceLocation ?? data.source_location ?? {},
      createdAt: data.createdAt ?? data.created_at ?? "",
      expiresAt: data.expiresAt ?? data.expires_at ?? "",
      contextBefore: data.contextBefore ?? data.context_before ?? "",
      contextAfter: data.contextAfter ?? data.context_after ?? "",
      score: data.score ?? null,
      metadata: data.metadata ?? {},
    });
  }
}

// ---------------------------------------------------------------------------
// PersistedCitation
// ---------------------------------------------------------------------------

export class PersistedCitation {
  citationId: string;
  sourceHash: string;
  sourceLocation: Record<string, unknown>;
  verifiedAt: string | null;
  quote: string;
  context: Record<string, string> | null;
  sourceType: string;
  retentionClass: string;
  tags: string[];
  createdAt: string | null;
  lastAccessed: string | null;
  sourceMetadata: Record<string, unknown> | null;

  constructor(params: {
    citationId?: string;
    sourceHash?: string;
    sourceLocation?: Record<string, unknown> | null;
    verifiedAt?: string | null;
    quote?: string;
    context?: Record<string, string> | null;
    sourceType?: string;
    retentionClass?: string;
    tags?: string[] | null;
    createdAt?: string | null;
    lastAccessed?: string | null;
    sourceMetadata?: Record<string, unknown> | null;
    // legacy aliases
    id?: string;
    type?: string;
    p?: string;
    sha256?: string;
    loc?: Record<string, unknown>;
    surface?: string;
    source?: Record<string, unknown>;
  }) {
    const p = params;
    this.citationId = p.citationId ?? p.id ?? "";

    this.sourceHash = p.sourceHash ?? p.sha256 ?? "";

    if (p.sourceLocation == null) {
      const resolved: Record<string, unknown> = {};
      if (p.p !== undefined) resolved.path = p.p;
      if (p.loc !== undefined) resolved.loc = p.loc;
      if (p.surface !== undefined) resolved.surface = p.surface;
      this.sourceLocation = resolved;
    } else {
      this.sourceLocation = p.sourceLocation;
    }

    this.verifiedAt = p.verifiedAt ?? null;
    this.quote = p.quote ?? "";
    this.context = p.context ?? null;
    this.sourceType = p.type ?? p.sourceType ?? "doc";
    this.retentionClass = p.retentionClass ?? "standard";
    this.tags = p.tags ?? [];
    this.createdAt = p.createdAt ?? null;
    this.lastAccessed = p.lastAccessed ?? null;
    this.sourceMetadata = p.source ?? p.sourceMetadata ?? null;
  }

  // -- Property aliases for legacy access --

  get id(): string {
    return this.citationId;
  }

  get type(): string {
    return this.sourceType;
  }

  get path(): string | null {
    return (this.sourceLocation?.path as string) ?? null;
  }

  get sha256(): string {
    return this.sourceHash;
  }

  get loc(): Record<string, unknown> | null {
    return (this.sourceLocation?.loc as Record<string, unknown>) ?? null;
  }

  /** Convert to plain object. */
  toDict(): Record<string, unknown> {
    return {
      citationId: this.citationId,
      sourceHash: this.sourceHash,
      sourceLocation: this.sourceLocation,
      verifiedAt: this.verifiedAt,
      quote: this.quote,
      context: this.context,
      sourceType: this.sourceType,
      retentionClass: this.retentionClass,
      tags: this.tags,
      createdAt: this.createdAt,
      lastAccessed: this.lastAccessed,
      sourceMetadata: this.sourceMetadata,
    };
  }

  /** Create from plain object (supports legacy field names). */
  static fromDict(data: Record<string, any>): PersistedCitation {
    const mapped: Record<string, any> = { ...data };

    if ("id" in mapped && !("citationId" in mapped)) {
      mapped.citationId = mapped.id;
      delete mapped.id;
    }
    if ("sha256" in mapped && !("sourceHash" in mapped)) {
      mapped.sourceHash = mapped.sha256;
      delete mapped.sha256;
    }
    if ("path" in mapped && !("sourceLocation" in mapped)) {
      mapped.sourceLocation = { path: mapped.path };
      delete mapped.path;
      if ("loc" in mapped) {
        mapped.sourceLocation.loc = mapped.loc;
        delete mapped.loc;
      }
      if ("surface" in mapped) {
        mapped.sourceLocation.surface = mapped.surface;
        delete mapped.surface;
      }
    }
    if ("type" in mapped && !("sourceType" in mapped)) {
      mapped.sourceType = mapped.type;
      delete mapped.type;
    }
    if ("source" in mapped && !("sourceMetadata" in mapped)) {
      mapped.sourceMetadata = mapped.source;
      delete mapped.source;
    }

    const known = new Set([
      "citationId",
      "sourceHash",
      "sourceLocation",
      "verifiedAt",
      "quote",
      "context",
      "sourceType",
      "retentionClass",
      "tags",
      "createdAt",
      "lastAccessed",
      "sourceMetadata",
    ]);

    const filtered: Record<string, any> = {};
    for (const [k, v] of Object.entries(mapped)) {
      if (known.has(k)) filtered[k] = v;
    }

    return new PersistedCitation(filtered);
  }
}

// ---------------------------------------------------------------------------
// VerificationResult
// ---------------------------------------------------------------------------

export interface VerificationResult {
  valid: boolean;
  error?: string;
  storedHash?: string;
  currentHash?: string;
  verifiedAt?: string | null;
}

// ---------------------------------------------------------------------------
// CitationManager
// ---------------------------------------------------------------------------

/** Reference to MemoryManager -- filled at runtime to avoid circular imports. */
export type MemoryManagerLike = {
  get(id: string): { content: string; topics: string[]; entityId: string | null; importance: number } | null;
};

export class CitationManager {
  /** Default TTL for transient citations (30 minutes) */
  static readonly DEFAULT_TRANSIENT_TTL_SECONDS = 1800;
  /** Default TTL for ephemeral persisted citations (24 hours) */
  static readonly DEFAULT_EPHEMERAL_TTL_SECONDS = 86400;

  basePath: string;
  citationsDir: string;
  private _memoryManager: MemoryManagerLike | null;
  private _transientTtl: number;
  private _transientCache: Map<string, TransientCitation> = new Map();

  constructor(
    basePath: string = ".writing",
    memoryManager?: MemoryManagerLike | null,
    transientTtl: number = CitationManager.DEFAULT_TRANSIENT_TTL_SECONDS,
  ) {
    this.basePath = basePath;
    this.citationsDir = path.join(basePath, "citations");
    fs.mkdirSync(this.citationsDir, { recursive: true });
    this._memoryManager = memoryManager ?? null;
    this._transientTtl = transientTtl;
    console.log(`CitationManager initialized at ${this.citationsDir}`);
  }

  /** Set the MemoryManager for integration. */
  setMemoryManager(memoryManager: MemoryManagerLike): void {
    this._memoryManager = memoryManager;
  }

  // ============================================================
  // ICitationService Implementation
  // ============================================================

  /**
   * Create a transient citation from source text and location.
   */
  createCitation(
    sourceText: string,
    location: Record<string, any>,
    contextBefore: string = "",
    contextAfter: string = "",
    score?: number | null,
    metadata?: Record<string, any> | null,
  ): TransientCitation {
    const normalizedLocation = this._normalizeSearchResultLocation(location);

    const now = new Date();
    const expires = new Date(now.getTime() + this._transientTtl * 1000);

    let citationId = this._generateCitationId(sourceText);
    if (metadata && typeof metadata === "object") {
      const metaCid = metadata.citationId ?? metadata.citation_id ?? metadata.id;
      if (metaCid) citationId = metaCid as string;
    }

    const transient = new TransientCitation({
      citationId,
      sourceText,
      sourceLocation: normalizedLocation,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      contextBefore,
      contextAfter,
      score: score ?? null,
      metadata: metadata ?? {},
    });

    this._transientCache.set(citationId, transient);
    return transient;
  }

  /**
   * Alias for createCitation (ICitationService compatibility).
   * Supports SearchResult / dict-like results and legacy args.
   */
  createTransientCitation(
    sourceText?: string | null,
    location?: Record<string, any> | null,
    source?: any | null,
    kwargs: Record<string, any> = {},
  ): TransientCitation {
    const kw: Record<string, any> = { ...kwargs };

    if (source == null && sourceText == null && "content" in kw) {
      source = kw.content;
      delete kw.content;
    }

    if (source != null) {
      let payload: Record<string, any>;
      if (typeof source.toDict === "function") {
        payload = source.toDict();
      } else if (typeof source === "object" && source !== null) {
        payload = source;
      } else {
        payload = {};
      }

      sourceText = sourceText ?? payload.content ?? undefined;
      location = location ?? {
        path: payload.metadata?.path,
        surface: payload.metadata?.surface,
        loc: payload.metadata?.loc ?? payload.loc,
      };
      if (payload.score !== undefined && kw.score === undefined) kw.score = payload.score;
      if (payload.metadata !== undefined && kw.metadata === undefined) kw.metadata = payload.metadata;
      if (payload.id !== undefined && kw.citationId === undefined) kw.citationId = payload.id;
    }

    const legacyId = kw.id ?? null;
    const legacySurface = kw.surface ?? null;
    const legacyPath = kw.path ?? null;
    const legacyQuote = kw.quote ?? null;
    const legacyLoc = kw.loc ?? null;

    const citationId: string | null = kw.citationId ?? legacyId;

    if (legacyQuote != null) {
      sourceText = sourceText ?? legacyQuote;
    }

    if (location == null) location = {};
    if (legacyPath != null) {
      if (!location.path) location.path = legacyPath;
    }
    if (legacySurface != null) {
      if (!location.surface) location.surface = legacySurface;
    }
    if (legacyLoc != null) {
      if (!location.loc) location.loc = legacyLoc;
    }

    if (!sourceText) sourceText = "";

    // Remove legacy keys before passing to createCitation
    delete kw.id;
    delete kw.surface;
    delete kw.path;
    delete kw.quote;
    delete kw.loc;
    delete kw.citationId;

    const transient = this.createCitation(
      sourceText,
      location,
      kw.contextBefore ?? kw.context_before ?? "",
      kw.contextAfter ?? kw.context_after ?? "",
      kw.score ?? null,
      kw.metadata ?? null,
    );

    if (citationId) {
      const originalId = transient.citationId;
      if (citationId !== originalId) {
        this._transientCache.delete(originalId);
        transient.citationId = citationId;
      }
      this._transientCache.set(citationId, transient);
    }

    return transient;
  }

  /**
   * Persist a transient citation.
   */
  persistCitation(
    transientId: string,
    retentionClass: string = "standard",
    tags?: string[] | null,
  ): PersistedCitation | null {
    const transient = this._transientCache.get(transientId);
    if (!transient) {
      console.warn(`Transient citation not found: ${transientId}`);
      return null;
    }

    if (transient.isExpired()) {
      console.warn(`Transient citation expired: ${transientId}`);
      this._transientCache.delete(transientId);
      return null;
    }

    const sourceHash = this._calculateTextHash(transient.sourceText);
    const now = new Date().toISOString();

    const persisted = new PersistedCitation({
      citationId: transient.citationId,
      sourceHash,
      sourceLocation: transient.sourceLocation,
      verifiedAt: now,
      quote: transient.sourceText,
      context:
        transient.contextBefore || transient.contextAfter
          ? { before: transient.contextBefore, after: transient.contextAfter }
          : null,
      sourceType: (transient.sourceLocation.surface as string) ?? "doc",
      retentionClass,
      tags: tags ?? [],
      createdAt: now,
      lastAccessed: now,
      sourceMetadata: transient.metadata,
    });

    this._saveCitation(persisted);
    this._transientCache.delete(transientId);

    console.log(`Persisted citation: ${transientId}`);
    return persisted;
  }

  /**
   * Convert a TransientCitation to a PersistedCitation directly.
   */
  makeCitation(
    transient: TransientCitation,
    retentionClass: string = "standard",
    tags?: string[] | null,
  ): PersistedCitation {
    const sourceHash = this._calculateTextHash(transient.sourceText);
    const now = new Date().toISOString();

    const persisted = new PersistedCitation({
      citationId: transient.citationId,
      sourceHash,
      sourceLocation: transient.sourceLocation,
      verifiedAt: now,
      quote: transient.sourceText,
      context:
        transient.contextBefore || transient.contextAfter
          ? { before: transient.contextBefore, after: transient.contextAfter }
          : null,
      sourceType: (transient.sourceLocation.surface as string) ?? "doc",
      retentionClass,
      tags: tags ?? [],
      createdAt: now,
      lastAccessed: now,
      sourceMetadata: transient.metadata,
    });

    this._saveCitation(persisted);
    console.log(`Made citation: ${transient.citationId}`);
    return persisted;
  }

  /**
   * Verify the integrity of a citation using SHA256.
   */
  verifyCitation(citationId: string): boolean {
    const result = this.verifyCitationDetailed(citationId);
    return result.valid;
  }

  /**
   * Verify citation with detailed result.
   */
  verifyCitationDetailed(citationId: string): VerificationResult {
    const citation = this.getCitation(citationId);
    if (!citation) {
      console.warn(`Citation not found for verification: ${citationId}`);
      return { valid: false, error: "Citation not found" };
    }

    const sourcePath = citation.sourceLocation?.path as string | undefined;
    const quoteHash = this._calculateTextHash(citation.quote);
    let fileHash = "";
    if (sourcePath && fs.existsSync(sourcePath)) {
      fileHash = this._calculateFileHash(sourcePath);
    }

    const currentHash = fileHash || quoteHash;
    const isValid = fileHash
      ? citation.sourceHash === quoteHash || citation.sourceHash === fileHash
      : quoteHash === citation.sourceHash;

    if (isValid) {
      citation.verifiedAt = new Date().toISOString();
      this._saveCitation(citation);
    } else {
      console.warn(
        `Citation verification failed: ${citationId} (expected=${citation.sourceHash}, got=${currentHash})`,
      );
    }

    return {
      valid: isValid,
      storedHash: citation.sourceHash,
      currentHash,
      verifiedAt: isValid ? citation.verifiedAt : null,
    };
  }

  /**
   * Retrieve a citation by ID.
   */
  getCitation(citationId: string): PersistedCitation | null {
    const filePath = this._getCitationPath(citationId);

    if (!fs.existsSync(filePath)) return null;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const citation = PersistedCitation.fromDict(data);

      // Update last accessed
      citation.lastAccessed = new Date().toISOString();
      this._saveCitation(citation);

      return citation;
    } catch (e) {
      console.warn(`Failed to load citation ${citationId}: ${e}`);
      return null;
    }
  }

  /**
   * Retrieve a transient citation from cache.
   */
  getTransientCitation(citationId: string): TransientCitation | null {
    const transient = this._transientCache.get(citationId);
    if (transient && !transient.isExpired()) {
      return transient;
    }
    if (transient) {
      this._transientCache.delete(citationId);
    }
    return null;
  }

  /**
   * List all citations, optionally filtered by source.
   */
  listCitations(sourceId?: string | null): PersistedCitation[] {
    const citations: PersistedCitation[] = [];

    const files = fs.readdirSync(this.citationsDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.citationsDir, file), "utf-8"));
        const citation = PersistedCitation.fromDict(data);

        if (sourceId) {
          const locPath = citation.sourceLocation?.path;
          if (locPath !== sourceId) continue;
        }

        citations.push(citation);
      } catch {
        continue;
      }
    }

    citations.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return citations;
  }

  /**
   * Garbage collect expired citations.
   */
  gcExpired(dryRun: boolean = false): string[] {
    const deletedIds: string[] = [];
    const now = new Date();

    // Clean transient cache
    const expiredTransient: string[] = [];
    for (const [cid, c] of this._transientCache) {
      if (c.isExpired()) expiredTransient.push(cid);
    }
    for (const cid of expiredTransient) {
      deletedIds.push(`transient:${cid}`);
      if (!dryRun) this._transientCache.delete(cid);
    }

    // Clean persisted citations
    const files = fs.readdirSync(this.citationsDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const filePath = path.join(this.citationsDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const citation = PersistedCitation.fromDict(data);

        let shouldDelete = false;

        // Check for ephemeral expiration
        if (citation.retentionClass === "ephemeral" && citation.createdAt) {
          try {
            const created = new Date(citation.createdAt.replace("Z", "+00:00"));
            const age = (now.getTime() - created.getTime()) / 1000;
            if (age > CitationManager.DEFAULT_EPHEMERAL_TTL_SECONDS) {
              shouldDelete = true;
            }
          } catch {
            // ignore date parse errors
          }
        }

        if (shouldDelete) {
          deletedIds.push(citation.citationId);
          if (!dryRun) fs.unlinkSync(filePath);
        }
      } catch {
        // Corrupt file
        deletedIds.push(path.basename(file, ".json"));
        if (!dryRun) fs.unlinkSync(filePath);
      }
    }

    if (deletedIds.length > 0) {
      console.log(`GC cleaned ${deletedIds.length} citations (dryRun=${dryRun})`);
    }

    return deletedIds;
  }

  /**
   * Garbage collect orphaned or expired citations (legacy API).
   */
  gcOrphanedCitations(
    dryRun: boolean = false,
    maxAgeSeconds: number = CitationManager.DEFAULT_EPHEMERAL_TTL_SECONDS,
  ): string[] {
    const deletedIds: string[] = [];
    const now = new Date();

    const files = fs.readdirSync(this.citationsDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const filePath = path.join(this.citationsDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const citation = PersistedCitation.fromDict(data);

        let shouldDelete = false;

        // Check if source exists
        const sourcePath = citation.sourceLocation?.path as string | undefined;
        if (sourcePath && !fs.existsSync(sourcePath)) {
          shouldDelete = true;
        }

        // Check for expiration if ephemeral
        if (!shouldDelete && citation.retentionClass === "ephemeral" && citation.createdAt) {
          try {
            const created = new Date(citation.createdAt.replace("Z", "+00:00"));
            const age = (now.getTime() - created.getTime()) / 1000;
            if (age > maxAgeSeconds) shouldDelete = true;
          } catch {
            // ignore
          }
        }

        if (shouldDelete) {
          deletedIds.push(citation.citationId);
          if (!dryRun) fs.unlinkSync(filePath);
        }
      } catch {
        deletedIds.push(path.basename(file, ".json"));
        if (!dryRun) fs.unlinkSync(filePath);
      }
    }

    return deletedIds;
  }

  // ============================================================
  // MemoryManager Integration
  // ============================================================

  /**
   * Create a citation from a MemoryManager entry.
   */
  createCitationFromMemory(
    memoryId: string,
    excerpt: string,
    contextChars: number = 100,
  ): TransientCitation | null {
    if (!this._memoryManager) {
      console.warn("MemoryManager not configured");
      return null;
    }

    const entry = this._memoryManager.get(memoryId);
    if (!entry) {
      console.warn(`Memory not found: ${memoryId}`);
      return null;
    }

    // Find excerpt in content
    const content = entry.content;
    let startIdx = content.indexOf(excerpt);
    let resolvedExcerpt = excerpt;
    if (startIdx === -1) {
      startIdx = 0;
      resolvedExcerpt = content.length > 200 ? content.substring(0, 200) : content;
    }

    const contextStart = Math.max(0, startIdx - contextChars);
    const contextEnd = Math.min(content.length, startIdx + resolvedExcerpt.length + contextChars);

    const contextBefore = content.substring(contextStart, startIdx);
    const contextAfter = content.substring(startIdx + resolvedExcerpt.length, contextEnd);

    const location: Record<string, unknown> = {
      surface: "memory",
      path: memoryId,
      loc: {
        kind: "char",
        start: startIdx,
        end: startIdx + resolvedExcerpt.length,
      },
    };

    return this.createCitation(resolvedExcerpt, location, contextBefore, contextAfter, null, {
      memoryId,
      topics: entry.topics,
      entityId: entry.entityId,
      importance: entry.importance,
    });
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /** Generate unique citation ID based on content hash and timestamp. */
  private _generateCitationId(sourceText: string): string {
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").substring(0, 20);
    const contentHash = createHash("sha256").update(sourceText, "utf-8").digest("hex").substring(0, 8);
    const randomSuffix = randomUUID().replace(/-/g, "").substring(0, 6);
    return `cit-${timestamp}-${contentHash}-${randomSuffix}`;
  }

  /** Normalize location payload to expected SearchResult location shape. */
  private _normalizeSearchResultLocation(location: Record<string, any>): Record<string, unknown> {
    if (!location || Object.keys(location).length === 0) {
      return { path: null, surface: null, loc: null };
    }

    const p = location.path ?? null;
    const surface = location.surface ?? null;
    const rawLoc = location.loc;

    let normalizedLoc: SearchResultLocation | null = null;
    if (rawLoc) {
      const kind = rawLoc.kind ?? "char";
      const start = Number(rawLoc.start ?? 0);
      const end = rawLoc.end !== undefined && rawLoc.end !== null ? Number(rawLoc.end) : null;
      normalizedLoc = { kind, start, end };
    }

    return { path: p, surface, loc: normalizedLoc };
  }

  /** Calculate SHA256 hash of text content. */
  private _calculateTextHash(text: string): string {
    return createHash("sha256").update(text, "utf-8").digest("hex");
  }

  /** Calculate SHA256 hash of a file. */
  private _calculateFileHash(filePath: string): string {
    try {
      const data = fs.readFileSync(filePath);
      return createHash("sha256").update(data).digest("hex");
    } catch {
      return "";
    }
  }

  /** Get the file path for a citation ID. */
  private _getCitationPath(citationId: string): string {
    return path.join(this.citationsDir, `${citationId}.json`);
  }

  /** Save citation to disk. */
  private _saveCitation(citation: PersistedCitation): void {
    const filePath = this._getCitationPath(citation.citationId);
    fs.writeFileSync(filePath, JSON.stringify(citation.toDict(), null, 2), "utf-8");
  }

  // ============================================================
  // Legacy API Compatibility
  // ============================================================

  /** Add (save) a citation to storage (legacy API). */
  addCitation(citation: PersistedCitation): void {
    if (!citation.createdAt) {
      citation.createdAt = new Date().toISOString();
    }
    this._saveCitation(citation);
  }

  /** Update an existing citation (legacy API). */
  updateCitation(citation: PersistedCitation): void {
    this._saveCitation(citation);
  }

  /** Delete a citation (legacy API). */
  deleteCitation(citationId: string): boolean {
    const filePath = this._getCitationPath(citationId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  // ============================================================
  // Statistics
  // ============================================================

  /** Get citation statistics. */
  stats(): Record<string, unknown> {
    const files = fs.readdirSync(this.citationsDir).filter((f) => f.endsWith(".json"));
    const persistedCount = files.length;
    const transientCount = this._transientCache.size;
    let expiredTransient = 0;
    for (const c of this._transientCache.values()) {
      if (c.isExpired()) expiredTransient++;
    }

    return {
      persistedCount,
      transientCount,
      expiredTransientCount: expiredTransient,
      citationsDir: this.citationsDir,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory Functions (singleton)
// ---------------------------------------------------------------------------

let _citationManager: CitationManager | null = null;

/**
 * Get or create CitationManager singleton.
 */
export function getCitationManager(
  basePath: string = ".writing",
  memoryManager?: MemoryManagerLike | null,
): CitationManager {
  if (_citationManager === null) {
    _citationManager = new CitationManager(basePath, memoryManager);
  } else if (memoryManager && !_citationManager["_memoryManager"]) {
    _citationManager.setMemoryManager(memoryManager);
  }
  return _citationManager;
}

/** Reset CitationManager singleton (for testing). */
export function resetCitationManager(): void {
  _citationManager = null;
}
