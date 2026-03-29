/**
 * MemoryManager - OpenKL Temporal Memory Management
 *
 * Implements OpenKL file system contract:
 * 1. by_date time organization: memories/by_date/YYYY/MM/DD/
 * 2. topics symlink index: memories/topics/{topic}/
 * 3. YAML Frontmatter metadata
 * 4. Temporal tracking and version control
 */

import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ---------------------------------------------------------------------------
// Simple YAML front-matter utilities (no external dependency)
// ---------------------------------------------------------------------------

function yamlDump(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${JSON.stringify(item)}`);
        }
      }
    } else if (typeof value === "object") {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else if (typeof value === "string") {
      // Use JSON-style quoting for strings that contain special chars
      if (value.includes(":") || value.includes("#") || value.includes("'") || value.includes("\n")) {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else if (typeof value === "number") {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join("\n");
}

function yamlSafeLoad(text: string): Record<string, any> {
  // Minimal YAML parser for the flat frontmatter format we produce.
  const result: Record<string, any> = {};
  const lines = text.split("\n");
  let currentKey: string | null = null;
  let currentArray: any[] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    // Array item
    const arrayMatch = line.match(/^(\s*)- (.*)$/);
    if (arrayMatch && currentArray !== null) {
      let val: any = arrayMatch[2].trim();
      try {
        val = JSON.parse(val);
      } catch {
        // keep as string
      }
      currentArray.push(val);
      continue;
    }

    // Key-value pair
    const kvMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (kvMatch) {
      // Flush previous array
      if (currentKey && currentArray !== null) {
        result[currentKey] = currentArray;
      }

      currentKey = kvMatch[1];
      const rawVal = kvMatch[2].trim();

      if (rawVal === "" || rawVal === "[]" ) {
        if (rawVal === "[]") {
          result[currentKey] = [];
          currentArray = null;
        } else {
          // Start of a block sequence or empty
          currentArray = [];
        }
      } else {
        let parsed: any = rawVal;
        try {
          parsed = JSON.parse(rawVal);
        } catch {
          // keep as string
        }
        result[currentKey] = parsed;
        currentArray = null;
      }
      continue;
    }
  }

  // Flush last array
  if (currentKey && currentArray !== null) {
    result[currentKey] = currentArray;
  }

  return result;
}

// ---------------------------------------------------------------------------
// MemoryEntry
// ---------------------------------------------------------------------------

export class MemoryEntry {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  topics: string[];
  entityId: string | null;
  validFrom: string | null;
  validUntil: string | null;
  supersedes: string | null;
  supersededBy: string | null;
  importance: number;
  source: string;
  metadata: Record<string, unknown>;

  constructor(params: {
    id: string;
    content: string;
    createdAt?: string;
    updatedAt?: string;
    topics?: string[];
    entityId?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
    supersedes?: string | null;
    supersededBy?: string | null;
    importance?: number;
    source?: string;
    metadata?: Record<string, unknown>;
  }) {
    this.id = params.id;
    this.content = params.content;
    this.createdAt = params.createdAt ?? new Date().toISOString();
    this.updatedAt = params.updatedAt ?? new Date().toISOString();
    this.topics = params.topics ?? [];
    this.entityId = params.entityId ?? null;
    this.validFrom = params.validFrom ?? null;
    this.validUntil = params.validUntil ?? null;
    this.supersedes = params.supersedes ?? null;
    this.supersededBy = params.supersededBy ?? null;
    this.importance = params.importance ?? 0.5;
    this.source = params.source ?? "user";
    this.metadata = params.metadata ?? {};
  }

  /** Convert to YAML frontmatter format string. */
  toYamlFrontmatter(): string {
    const frontmatter: Record<string, unknown> = {
      id: this.id,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      topics: this.topics,
      entity_id: this.entityId,
      valid_from: this.validFrom,
      valid_until: this.validUntil,
      supersedes: this.supersedes,
      superseded_by: this.supersededBy,
      importance: this.importance,
      source: this.source,
      metadata: Object.keys(this.metadata).length > 0 ? this.metadata : undefined,
    };

    // Remove null/undefined values
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(frontmatter)) {
      if (v !== undefined && v !== null) cleaned[k] = v;
    }

    const yamlContent = yamlDump(cleaned);
    return `---\n${yamlContent}\n---\n\n${this.content}`;
  }

  /** Parse from YAML frontmatter file. */
  static fromYamlFile(filePath: string): MemoryEntry {
    const content = fs.readFileSync(filePath, "utf-8");
    return MemoryEntry.fromYamlContent(content);
  }

  /** Parse from YAML frontmatter string. */
  static fromYamlContent(content: string): MemoryEntry {
    if (!content.startsWith("---")) {
      throw new Error("Invalid YAML frontmatter format");
    }

    const parts = content.split("---");
    // parts[0] = "" (before first ---), parts[1] = frontmatter, parts[2..] = body
    if (parts.length < 3) {
      throw new Error("Invalid YAML frontmatter format");
    }

    const frontmatterStr = parts[1].trim();
    const body = parts.slice(2).join("---").trim();

    const frontmatter = yamlSafeLoad(frontmatterStr);

    return new MemoryEntry({
      id: frontmatter.id ?? "",
      content: body,
      createdAt: frontmatter.created_at ?? new Date().toISOString(),
      updatedAt: frontmatter.updated_at ?? new Date().toISOString(),
      topics: frontmatter.topics ?? [],
      entityId: frontmatter.entity_id ?? null,
      validFrom: frontmatter.valid_from ?? null,
      validUntil: frontmatter.valid_until ?? null,
      supersedes: frontmatter.supersedes ?? null,
      supersededBy: frontmatter.superseded_by ?? null,
      importance: frontmatter.importance ?? 0.5,
      source: frontmatter.source ?? "user",
      metadata: frontmatter.metadata ?? {},
    });
  }
}

// ---------------------------------------------------------------------------
// Index types
// ---------------------------------------------------------------------------

interface MemoryIndex {
  memories: Record<string, string>; // id -> relative path
  topics: Record<string, string[]>; // topic -> [id, ...]
  entities: Record<string, string[]>; // entity_id -> [id, ...]
}

function emptyIndex(): MemoryIndex {
  return { memories: {}, topics: {}, entities: {} };
}

// ---------------------------------------------------------------------------
// MemoryManager
// ---------------------------------------------------------------------------

export class MemoryManager {
  basePath: string;
  memoriesDir: string;
  byDateDir: string;
  topicsDir: string;
  indexPath: string;
  private _index: MemoryIndex;

  constructor(basePath: string = ".writing") {
    this.basePath = basePath;
    this.memoriesDir = path.join(basePath, "memories");
    this.byDateDir = path.join(this.memoriesDir, "by_date");
    this.topicsDir = path.join(this.memoriesDir, "topics");
    this.indexPath = path.join(this.memoriesDir, "index.json");

    this._ensureDirectories();
    this._index = this._loadIndex();
  }

  private _ensureDirectories(): void {
    fs.mkdirSync(this.memoriesDir, { recursive: true });
    fs.mkdirSync(this.byDateDir, { recursive: true });
    fs.mkdirSync(this.topicsDir, { recursive: true });
  }

  private _loadIndex(): MemoryIndex {
    if (fs.existsSync(this.indexPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.indexPath, "utf-8"));
      } catch {
        console.warn("Corrupted index, rebuilding...");
        return this._rebuildIndex();
      }
    }
    return emptyIndex();
  }

  private _saveIndex(): void {
    fs.writeFileSync(this.indexPath, JSON.stringify(this._index, null, 2), "utf-8");
  }

  private _rebuildIndex(): MemoryIndex {
    const index = emptyIndex();

    if (!fs.existsSync(this.byDateDir)) return index;

    const yearDirs = this._safeReaddir(this.byDateDir);
    for (const year of yearDirs) {
      const yearPath = path.join(this.byDateDir, year);
      if (!fs.statSync(yearPath).isDirectory()) continue;

      const monthDirs = this._safeReaddir(yearPath);
      for (const month of monthDirs) {
        const monthPath = path.join(yearPath, month);
        if (!fs.statSync(monthPath).isDirectory()) continue;

        const dayDirs = this._safeReaddir(monthPath);
        for (const day of dayDirs) {
          const dayPath = path.join(monthPath, day);
          if (!fs.statSync(dayPath).isDirectory()) continue;

          const files = this._safeReaddir(dayPath).filter((f) => f.endsWith(".md"));
          for (const file of files) {
            const memoryFile = path.join(dayPath, file);
            try {
              const entry = MemoryEntry.fromYamlFile(memoryFile);
              const relativePath = path.relative(this.memoriesDir, memoryFile);
              index.memories[entry.id] = relativePath;

              for (const topic of entry.topics) {
                if (!index.topics[topic]) index.topics[topic] = [];
                index.topics[topic].push(entry.id);
              }

              if (entry.entityId) {
                if (!index.entities[entry.entityId]) index.entities[entry.entityId] = [];
                index.entities[entry.entityId].push(entry.id);
              }
            } catch (e) {
              console.warn(`Failed to index ${memoryFile}: ${e}`);
            }
          }
        }
      }
    }

    return index;
  }

  private _safeReaddir(dirPath: string): string[] {
    try {
      return fs.readdirSync(dirPath);
    } catch {
      return [];
    }
  }

  private _generateId(content: string): string {
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").substring(0, 14);
    const contentHash = createHash("sha256").update(content, "utf-8").digest("hex").substring(0, 8);
    return `mem-${timestamp}-${contentHash}`;
  }

  private _getDatePath(dt?: Date): string {
    const d = dt ?? new Date();
    return path.join(
      this.byDateDir,
      String(d.getFullYear()),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    );
  }

  /**
   * Add a new memory entry.
   */
  add(
    content: string,
    topics?: string[] | null,
    entityId?: string | null,
    validFrom?: string | null,
    validUntil?: string | null,
    importance: number = 0.5,
    source: string = "user",
    metadata?: Record<string, unknown> | null,
  ): MemoryEntry {
    const memoryId = this._generateId(content);
    const now = new Date();

    const entry = new MemoryEntry({
      id: memoryId,
      content,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      topics: topics ?? [],
      entityId: entityId ?? null,
      validFrom: validFrom ?? now.toISOString(),
      validUntil: validUntil ?? null,
      importance,
      source,
      metadata: metadata ?? {},
    });

    // Save to by_date structure
    const datePath = this._getDatePath(now);
    fs.mkdirSync(datePath, { recursive: true });

    const memoryFile = path.join(datePath, `${memoryId}.md`);
    fs.writeFileSync(memoryFile, entry.toYamlFrontmatter(), "utf-8");

    // Create topic links
    this._createTopicLinks(entry, memoryFile);

    // Update index
    const relativePath = path.relative(this.memoriesDir, memoryFile);
    this._index.memories[memoryId] = relativePath;

    for (const topic of entry.topics) {
      if (!this._index.topics[topic]) this._index.topics[topic] = [];
      this._index.topics[topic].push(memoryId);
    }

    if (entry.entityId) {
      if (!this._index.entities[entry.entityId]) this._index.entities[entry.entityId] = [];
      this._index.entities[entry.entityId].push(memoryId);
    }

    this._saveIndex();

    console.log(`Added memory: ${memoryId}`);
    return entry;
  }

  private _createTopicLinks(entry: MemoryEntry, sourceFile: string): void {
    for (const topic of entry.topics) {
      const topicDir = path.join(this.topicsDir, topic);
      fs.mkdirSync(topicDir, { recursive: true });

      const linkPath = path.join(topicDir, `${entry.id}.md`);

      try {
        const relativeSource = path.relative(topicDir, sourceFile);

        // Remove existing link if exists
        if (fs.existsSync(linkPath) || fs.lstatSync(linkPath).isSymbolicLink()) {
          fs.unlinkSync(linkPath);
        }

        // Create symlink; fall back to copy on Windows without admin
        try {
          fs.symlinkSync(relativeSource, linkPath);
        } catch {
          fs.writeFileSync(linkPath, fs.readFileSync(sourceFile, "utf-8"), "utf-8");
        }
      } catch (e) {
        // If lstatSync fails (file doesn't exist), try symlink/copy anyway
        try {
          fs.writeFileSync(linkPath, fs.readFileSync(sourceFile, "utf-8"), "utf-8");
        } catch (e2) {
          console.warn(`Failed to create topic link for ${topic}: ${e2}`);
        }
      }
    }
  }

  /**
   * Get memory by ID.
   */
  get(memoryId: string): MemoryEntry | null {
    if (!(memoryId in this._index.memories)) return null;

    const relativePath = this._index.memories[memoryId];
    const filePath = path.join(this.memoriesDir, relativePath);

    if (!fs.existsSync(filePath)) {
      console.warn(`Memory file not found: ${filePath}`);
      return null;
    }

    return MemoryEntry.fromYamlFile(filePath);
  }

  /**
   * Batch get multiple memories (avoids N+1 queries).
   */
  getBatch(memoryIds: string[]): MemoryEntry[] {
    if (!memoryIds || memoryIds.length === 0) return [];

    // For small batches, sequential is fine
    const entries: MemoryEntry[] = [];
    for (const memoryId of memoryIds) {
      const entry = this.get(memoryId);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  /**
   * Update an existing memory.
   */
  update(
    memoryId: string,
    content?: string | null,
    topics?: string[] | null,
    validUntil?: string | null,
    importance?: number | null,
    metadata?: Record<string, unknown> | null,
  ): MemoryEntry | null {
    const entry = this.get(memoryId);
    if (!entry) return null;

    if (content != null) entry.content = content;

    if (topics != null) {
      const oldTopics = new Set(entry.topics);
      const newTopics = new Set(topics);
      entry.topics = topics;

      // Update topic links
      const removedTopics = new Set([...oldTopics].filter((t) => !newTopics.has(t)));
      const addedTopics = new Set([...newTopics].filter((t) => !oldTopics.has(t)));

      for (const topic of removedTopics) {
        const linkPath = path.join(this.topicsDir, topic, `${memoryId}.md`);
        try {
          if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath);
        } catch {
          // ignore
        }
      }

      const relativePath = this._index.memories[memoryId];
      const sourceFile = path.join(this.memoriesDir, relativePath);

      for (const topic of addedTopics) {
        const topicDir = path.join(this.topicsDir, topic);
        fs.mkdirSync(topicDir, { recursive: true });
        const linkPath = path.join(topicDir, `${memoryId}.md`);
        try {
          const relativeSource = path.relative(topicDir, sourceFile);
          fs.symlinkSync(relativeSource, linkPath);
        } catch {
          fs.writeFileSync(linkPath, fs.readFileSync(sourceFile, "utf-8"), "utf-8");
        }
      }
    }

    if (validUntil != null) entry.validUntil = validUntil;
    if (importance != null) entry.importance = importance;
    if (metadata) entry.metadata = { ...entry.metadata, ...metadata };

    entry.updatedAt = new Date().toISOString();

    const relativePath = this._index.memories[memoryId];
    const filePath = path.join(this.memoriesDir, relativePath);
    fs.writeFileSync(filePath, entry.toYamlFrontmatter(), "utf-8");

    console.log(`Updated memory: ${memoryId}`);
    return entry;
  }

  /**
   * Create a new memory that supersedes an existing one.
   */
  supersede(
    oldMemoryId: string,
    newContent: string,
    topics?: string[] | null,
  ): MemoryEntry | null {
    const oldEntry = this.get(oldMemoryId);
    if (!oldEntry) return null;

    const newEntry = this.add(
      newContent,
      topics ?? oldEntry.topics,
      oldEntry.entityId,
      undefined,
      undefined,
      oldEntry.importance,
      oldEntry.source,
      oldEntry.metadata,
    );

    // Update new entry to reference old
    newEntry.supersedes = oldMemoryId;
    this.update(newEntry.id, undefined, undefined, undefined, undefined, { supersedes: oldMemoryId });

    // Mark old entry as superseded
    oldEntry.supersededBy = newEntry.id;
    oldEntry.validUntil = new Date().toISOString();
    this.update(oldMemoryId, undefined, undefined, oldEntry.validUntil, undefined, { supersededBy: newEntry.id });

    console.log(`Superseded ${oldMemoryId} with ${newEntry.id}`);
    return newEntry;
  }

  /**
   * Delete a memory.
   */
  delete(memoryId: string): boolean {
    if (!(memoryId in this._index.memories)) return false;

    const entry = this.get(memoryId);

    const relativePath = this._index.memories[memoryId];
    const filePath = path.join(this.memoriesDir, relativePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Delete topic links
    if (entry) {
      for (const topic of entry.topics) {
        const linkPath = path.join(this.topicsDir, topic, `${memoryId}.md`);
        try {
          if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath);
        } catch {
          // ignore
        }
      }
    }

    // Update index
    delete this._index.memories[memoryId];

    for (const topic of Object.keys(this._index.topics)) {
      const list = this._index.topics[topic];
      const idx = list.indexOf(memoryId);
      if (idx !== -1) list.splice(idx, 1);
    }

    if (entry && entry.entityId && this._index.entities[entry.entityId]) {
      const list = this._index.entities[entry.entityId];
      const idx = list.indexOf(memoryId);
      if (idx !== -1) list.splice(idx, 1);
    }

    this._saveIndex();

    console.log(`Deleted memory: ${memoryId}`);
    return true;
  }

  /**
   * Get all memories for a topic.
   */
  getByTopic(topic: string): MemoryEntry[] {
    if (!(topic in this._index.topics)) return [];
    return this.getBatch(this._index.topics[topic]);
  }

  /**
   * Get all memories for an entity.
   */
  getByEntity(entityId: string): MemoryEntry[] {
    if (!(entityId in this._index.entities)) return [];
    return this.getBatch(this._index.entities[entityId]);
  }

  /**
   * Get all memories for a specific date.
   */
  getByDate(
    targetDate: Date | string,
    includeSuperseded: boolean = false,
  ): MemoryEntry[] {
    let d: Date;
    if (typeof targetDate === "string") {
      d = new Date(targetDate);
    } else {
      d = targetDate;
    }

    const datePath = path.join(
      this.byDateDir,
      String(d.getFullYear()),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    );

    if (!fs.existsSync(datePath)) return [];

    const entries: MemoryEntry[] = [];
    const files = this._safeReaddir(datePath).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      try {
        const entry = MemoryEntry.fromYamlFile(path.join(datePath, file));
        if (!includeSuperseded && entry.supersededBy) continue;
        entries.push(entry);
      } catch (e) {
        console.warn(`Failed to read ${file}: ${e}`);
      }
    }

    return entries;
  }

  /**
   * Get facts about an entity valid at a specific time.
   */
  getTemporalFacts(
    entityId: string,
    atTime?: string | null,
  ): MemoryEntry[] {
    const resolvedAtTime = atTime ?? new Date().toISOString();

    const allEntries = this.getByEntity(entityId);
    const validEntries: MemoryEntry[] = [];

    for (const entry of allEntries) {
      if (entry.supersededBy) continue;
      if (entry.validFrom && entry.validFrom > resolvedAtTime) continue;
      if (entry.validUntil && entry.validUntil <= resolvedAtTime) continue;
      validEntries.push(entry);
    }

    validEntries.sort((a, b) => b.importance - a.importance);
    return validEntries;
  }

  /** Get all topic names. */
  listTopics(): string[] {
    return Object.keys(this._index.topics);
  }

  /** Get memory statistics. */
  stats(): Record<string, unknown> {
    return {
      totalMemories: Object.keys(this._index.memories).length,
      totalTopics: Object.keys(this._index.topics).length,
      totalEntities: Object.keys(this._index.entities).length,
      topics: Object.fromEntries(
        Object.entries(this._index.topics).map(([k, v]) => [k, v.length]),
      ),
    };
  }

  // ============================================================
  // Alias Methods (OpenKL API Compatibility)
  // ============================================================

  /** Save a memory entry (alias for add). */
  saveMemory(
    content: string,
    topics?: string[] | null,
    entityId?: string | null,
    importance: number = 0.5,
    source: string = "user",
    metadata?: Record<string, unknown> | null,
  ): MemoryEntry {
    return this.add(content, topics, entityId, undefined, undefined, importance, source, metadata);
  }

  /** Load a memory entry by ID (alias for get). */
  loadMemory(memoryId: string): MemoryEntry | null {
    return this.get(memoryId);
  }

  /**
   * List memories within a date range.
   */
  listByDate(
    startDate?: Date | string | null,
    endDate?: Date | string | null,
    includeSuperseded: boolean = false,
  ): MemoryEntry[] {
    // Parse dates
    let end: Date;
    if (endDate == null) {
      end = new Date();
    } else if (typeof endDate === "string") {
      end = new Date(endDate);
    } else {
      end = endDate;
    }

    let start: Date;
    if (startDate == null) {
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (typeof startDate === "string") {
      start = new Date(startDate);
    } else {
      start = startDate;
    }

    const entries: MemoryEntry[] = [];
    const current = new Date(start);

    while (current <= end) {
      const dayEntries = this.getByDate(current, includeSuperseded);
      entries.push(...dayEntries);
      current.setDate(current.getDate() + 1);
    }

    entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return entries;
  }

  /**
   * List memories for a topic with optional filtering.
   */
  listByTopic(
    topic: string,
    limit: number = 100,
    includeSuperseded: boolean = false,
  ): MemoryEntry[] {
    let entries = this.getByTopic(topic);

    if (!includeSuperseded) {
      entries = entries.filter((e) => !e.supersededBy);
    }

    entries.sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return entries.slice(0, limit);
  }

  /**
   * Simple text search across memories.
   */
  search(
    query: string,
    topics?: string[] | null,
    entityId?: string | null,
    limit: number = 20,
  ): MemoryEntry[] {
    const results: MemoryEntry[] = [];
    const queryLower = query.toLowerCase();

    let candidates: MemoryEntry[];

    if (entityId) {
      candidates = this.getByEntity(entityId);
    } else if (topics && topics.length > 0) {
      const seen = new Set<string>();
      const unique: MemoryEntry[] = [];
      for (const topic of topics) {
        for (const entry of this.getByTopic(topic)) {
          if (!seen.has(entry.id)) {
            seen.add(entry.id);
            unique.push(entry);
          }
        }
      }
      candidates = unique;
    } else {
      const memoryIds = Object.keys(this._index.memories);
      candidates = this.getBatch(memoryIds);
    }

    for (const entry of candidates) {
      if (entry.supersededBy) continue;
      if (entry.content.toLowerCase().includes(queryLower)) {
        results.push(entry);
        if (results.length >= limit) break;
      }
    }

    results.sort((a, b) => b.importance - a.importance);
    return results;
  }
}

// ---------------------------------------------------------------------------
// MemoryService Integration
// ---------------------------------------------------------------------------

/**
 * Adapter to integrate MemoryManager with MemoryService.
 *
 * Provides a unified interface for both file-based (OpenKL) and
 * vector-based (MemoryService) memory operations.
 */
export class MemoryManagerAdapter {
  private _manager: MemoryManager;
  private _service: any | null;

  constructor(
    memoryManager?: MemoryManager | null,
    memoryService?: any | null,
    basePath: string = ".writing",
  ) {
    this._manager = memoryManager ?? new MemoryManager(basePath);
    this._service = memoryService ?? null;
  }

  /** Get MemoryManager instance. */
  get manager(): MemoryManager {
    return this._manager;
  }

  /** Get MemoryService instance (if available). */
  get service(): any | null {
    return this._service;
  }

  /**
   * Save memory to both file system and vector store.
   */
  async save(
    content: string,
    topics?: string[] | null,
    entityId?: string | null,
    importance: number = 0.5,
    source: string = "user",
    metadata?: Record<string, unknown> | null,
    indexInVector: boolean = true,
  ): Promise<MemoryEntry> {
    const entry = this._manager.saveMemory(content, topics, entityId, importance, source, metadata);

    // Also index in vector store if service available
    if (indexInVector && this._service) {
      try {
        // Dynamic import-style usage: the service should expose add()
        if (typeof this._service.add === "function") {
          await this._service.add(
            [{ role: "memory", content }],
            { namespace: "memories", tags: topics ?? [], importance },
          );
        }
      } catch (e) {
        console.warn(`Failed to index in vector store: ${e}`);
      }
    }

    return entry;
  }

  /**
   * Hybrid search across both file and vector stores.
   */
  async searchHybrid(
    query: string,
    topics?: string[] | null,
    limit: number = 10,
  ): Promise<Array<Record<string, unknown>>> {
    const results: Array<Record<string, unknown>> = [];

    // File-based search
    const fileResults = this._manager.search(query, topics, undefined, limit);
    for (const entry of fileResults) {
      results.push({
        id: entry.id,
        content: entry.content,
        score: entry.importance,
        source: "file",
        topics: entry.topics,
        metadata: entry.metadata,
      });
    }

    // Vector search if available
    if (this._service) {
      try {
        if (typeof this._service.search === "function") {
          const vectorResults = await this._service.search(query, {
            namespace: "memories",
            limit,
          });

          for (const vr of vectorResults) {
            if (!results.some((r) => r.id === vr.id)) {
              results.push({
                id: vr.id,
                content: vr.content,
                score: vr.score,
                source: "vector",
                topics: vr.metadata?.tags ?? [],
                metadata: vr.metadata,
              });
            }
          }
        }
      } catch (e) {
        console.warn(`Vector search failed: ${e}`);
      }
    }

    results.sort((a, b) => ((b.score as number) ?? 0) - ((a.score as number) ?? 0));
    return results.slice(0, limit);
  }
}

// ---------------------------------------------------------------------------
// Factory Functions (singleton)
// ---------------------------------------------------------------------------

let _memoryManager: MemoryManager | null = null;

/**
 * Get or create MemoryManager singleton.
 */
export function getMemoryManager(basePath: string = ".writing"): MemoryManager {
  if (_memoryManager === null) {
    _memoryManager = new MemoryManager(basePath);
  }
  return _memoryManager;
}

/** Reset MemoryManager singleton (for testing). */
export function resetMemoryManager(): void {
  _memoryManager = null;
}
