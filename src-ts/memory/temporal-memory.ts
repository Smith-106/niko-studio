/**
 * Temporal Memory Tracker
 *
 * Implements temporal tracking and versioning for memories:
 * - Validity window management (valid_from, valid_until)
 * - Supersession chain tracking (supersedes, superseded_by)
 * - Point-in-time queries
 * - Version history navigation
 *
 * Inspired by Zep Graphiti temporal model.
 */

import { randomUUID } from "crypto";

/** Represents a temporal validity window. */
export class ValidityWindow {
  validFrom: Date;
  validUntil: Date | null; // null = still valid

  constructor(params: { validFrom: Date; validUntil?: Date | null }) {
    this.validFrom = params.validFrom;
    this.validUntil = params.validUntil ?? null;
  }

  /** Check if window is valid at a specific time. */
  isValidAt(pointInTime: Date): boolean {
    if (pointInTime < this.validFrom) {
      return false;
    }
    if (this.validUntil !== null && pointInTime >= this.validUntil) {
      return false;
    }
    return true;
  }

  /** Check if window is currently valid. */
  isCurrentlyValid(): boolean {
    return this.isValidAt(new Date());
  }

  /** Get duration of validity window in milliseconds. */
  duration(): number | null {
    if (this.validUntil === null) {
      return null;
    }
    return this.validUntil.getTime() - this.validFrom.getTime();
  }

  /** Check if this window overlaps with another. */
  overlaps(other: ValidityWindow): boolean {
    // If either has no end, check start overlap
    if (this.validUntil === null && other.validUntil === null) {
      return true;
    }
    if (this.validUntil === null) {
      return this.validFrom < (other.validUntil as Date);
    }
    if (other.validUntil === null) {
      return other.validFrom < this.validUntil;
    }

    // Both have ends
    return this.validFrom < other.validUntil && other.validFrom < this.validUntil;
  }
}

/** A fact with temporal validity. */
export class TemporalFact {
  id: string;
  content: string;
  entityId: string;
  validity: ValidityWindow;
  supersedes: string | null; // ID of fact this supersedes
  supersededBy: string | null; // ID of fact that superseded this
  importance: number;
  dimension: string | null;
  metadata: Record<string, unknown>;

  constructor(params: {
    id: string;
    content: string;
    entityId: string;
    validity: ValidityWindow;
    supersedes?: string | null;
    supersededBy?: string | null;
    importance?: number;
    dimension?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    this.id = params.id;
    this.content = params.content;
    this.entityId = params.entityId;
    this.validity = params.validity;
    this.supersedes = params.supersedes ?? null;
    this.supersededBy = params.supersededBy ?? null;
    this.importance = params.importance ?? 0.5;
    this.dimension = params.dimension ?? null;
    this.metadata = params.metadata ?? {};
  }

  /** Check if fact is currently valid and not superseded. */
  isCurrent(): boolean {
    return this.supersededBy === null && this.validity.isCurrentlyValid();
  }

  /** Check if fact was valid at a specific time. */
  isValidAt(pointInTime: Date): boolean {
    return this.validity.isValidAt(pointInTime);
  }
}

/** Chain of superseded facts for an entity. */
export class SupersessionChain {
  entityId: string;
  facts: TemporalFact[]; // Ordered from oldest to newest
  currentFact: TemporalFact | null;

  constructor(params: {
    entityId: string;
    facts: TemporalFact[];
    currentFact?: TemporalFact | null;
  }) {
    this.entityId = params.entityId;
    this.facts = params.facts;
    this.currentFact = params.currentFact ?? null;
  }

  /** Get the fact that was valid at a specific time. */
  getAtTime(pointInTime: Date): TemporalFact | null {
    for (let i = this.facts.length - 1; i >= 0; i--) {
      if (this.facts[i].isValidAt(pointInTime)) {
        return this.facts[i];
      }
    }
    return null;
  }

  /** Get full history of facts (oldest first). */
  getHistory(): TemporalFact[] {
    return [...this.facts].sort(
      (a, b) => a.validity.validFrom.getTime() - b.validity.validFrom.getTime()
    );
  }
}

/** Interface for temporal memory tracking. */
export interface ITemporalTracker {
  /** Add a temporal fact. */
  addFact(params: {
    content: string;
    entityId: string;
    validFrom?: Date | null;
    validUntil?: Date | null;
    supersedes?: string | null;
  }): Promise<TemporalFact>;

  /** Get facts valid at a specific time. */
  getFactsAt(entityId: string, pointInTime: Date): Promise<TemporalFact[]>;

  /** Get currently valid facts for an entity. */
  getCurrentFacts(entityId: string): Promise<TemporalFact[]>;

  /** Create a new fact that supersedes an existing one. */
  supersede(oldFactId: string, newContent: string): Promise<TemporalFact>;

  /** Get supersession chain for an entity. */
  getChain(entityId: string): Promise<SupersessionChain>;
}

/** Interface for database connections used by TemporalMemoryTracker */
export interface TemporalDbConnection {
  execute(sql: string, params: unknown[]): void;
  commit(): void;
}

/**
 * Tracks temporal validity and supersession of memories.
 *
 * Provides point-in-time queries and version history navigation.
 */
export class TemporalMemoryTracker implements ITemporalTracker {
  db: TemporalDbConnection | null;
  private _facts: Map<string, TemporalFact> = new Map();
  private _entityIndex: Map<string, string[]> = new Map(); // entityId -> factIds

  constructor(dbConnection?: TemporalDbConnection | null) {
    this.db = dbConnection ?? null;
    console.log("TemporalMemoryTracker initialized");
  }

  /** Set or update database connection. */
  setDbConnection(dbConnection: TemporalDbConnection): void {
    this.db = dbConnection;
  }

  /**
   * Add a temporal fact.
   *
   * @returns Created TemporalFact.
   */
  async addFact(params: {
    content: string;
    entityId: string;
    factId?: string | null;
    validFrom?: Date | null;
    validUntil?: Date | null;
    supersedes?: string | null;
    importance?: number;
    dimension?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<TemporalFact> {
    const {
      content,
      entityId,
      factId,
      validFrom,
      validUntil,
      supersedes,
      importance = 0.5,
      dimension,
      metadata,
    } = params;

    const now = new Date();
    const resolvedFactId =
      factId ??
      `tf-${now.toISOString().replace(/[-:T]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;

    const validity = new ValidityWindow({
      validFrom: validFrom ?? now,
      validUntil: validUntil ?? undefined,
    });

    const fact = new TemporalFact({
      id: resolvedFactId,
      content,
      entityId,
      validity,
      supersedes: supersedes ?? null,
      importance,
      dimension: dimension ?? null,
      metadata: metadata ?? {},
    });

    // If superseding, update the old fact
    if (supersedes) {
      const oldFact = this._facts.get(supersedes);
      if (oldFact) {
        oldFact.supersededBy = resolvedFactId;
        if (oldFact.validity.validUntil === null) {
          oldFact.validity.validUntil = validity.validFrom;
        }
      }
    }

    // Store fact
    this._facts.set(resolvedFactId, fact);

    // Update entity index
    if (!this._entityIndex.has(entityId)) {
      this._entityIndex.set(entityId, []);
    }
    this._entityIndex.get(entityId)!.push(resolvedFactId);

    // Persist to database if available
    if (this.db) {
      await this._persistFact(fact);
    }

    return fact;
  }

  /**
   * Get facts valid at a specific point in time.
   *
   * @returns List of facts valid at that time.
   */
  async getFactsAt(entityId: string, pointInTime: Date): Promise<TemporalFact[]> {
    const factIds = this._entityIndex.get(entityId) ?? [];
    const validFacts: TemporalFact[] = [];

    for (const factId of factIds) {
      const fact = this._facts.get(factId);
      if (fact && fact.isValidAt(pointInTime)) {
        // Check if not superseded at that time
        if (fact.supersededBy) {
          const successor = this._facts.get(fact.supersededBy);
          if (successor && successor.validity.validFrom <= pointInTime) {
            continue; // Was superseded by this time
          }
        }
        validFacts.push(fact);
      }
    }

    // Sort by importance
    validFacts.sort((a, b) => b.importance - a.importance);
    return validFacts;
  }

  /**
   * Get currently valid facts for an entity.
   *
   * @returns List of current facts.
   */
  async getCurrentFacts(entityId: string): Promise<TemporalFact[]> {
    const factIds = this._entityIndex.get(entityId) ?? [];
    const currentFacts: TemporalFact[] = [];

    for (const factId of factIds) {
      const fact = this._facts.get(factId);
      if (fact && fact.isCurrent()) {
        currentFacts.push(fact);
      }
    }

    currentFacts.sort((a, b) => b.importance - a.importance);
    return currentFacts;
  }

  /**
   * Create a new fact that supersedes an existing one.
   *
   * @throws ValueError if old fact not found.
   */
  async supersede(
    oldFactId: string,
    newContent: string,
    validFrom?: Date | null
  ): Promise<TemporalFact> {
    const oldFact = this._facts.get(oldFactId);
    if (!oldFact) {
      throw new Error(`Fact not found: ${oldFactId}`);
    }

    return this.addFact({
      content: newContent,
      entityId: oldFact.entityId,
      validFrom: validFrom ?? null,
      supersedes: oldFactId,
      importance: oldFact.importance,
      dimension: oldFact.dimension,
    });
  }

  /**
   * Get supersession chain for an entity.
   *
   * @returns SupersessionChain with full history.
   */
  async getChain(entityId: string): Promise<SupersessionChain> {
    const factIds = this._entityIndex.get(entityId) ?? [];
    const facts = factIds
      .filter((fid) => this._facts.has(fid))
      .map((fid) => this._facts.get(fid)!);

    // Find current fact (not superseded, currently valid)
    let current: TemporalFact | null = null;
    for (const fact of facts) {
      if (fact.isCurrent()) {
        current = fact;
        break;
      }
    }

    return new SupersessionChain({
      entityId,
      facts,
      currentFact: current,
    });
  }

  /**
   * Get history of facts for an entity within a time range.
   *
   * @returns List of facts ordered by validFrom.
   */
  async getHistory(
    entityId: string,
    startTime?: Date | null,
    endTime?: Date | null
  ): Promise<TemporalFact[]> {
    const chain = await this.getChain(entityId);
    let history = chain.getHistory();

    if (startTime) {
      history = history.filter((f) => f.validity.validFrom >= startTime);
    }
    if (endTime) {
      history = history.filter((f) => f.validity.validFrom <= endTime);
    }

    return history;
  }

  /**
   * Expire a fact (set validUntil).
   *
   * @returns True if expired, False if not found.
   */
  async expireFact(
    factId: string,
    validUntil?: Date | null
  ): Promise<boolean> {
    const fact = this._facts.get(factId);
    if (!fact) {
      return false;
    }

    fact.validity.validUntil = validUntil ?? new Date();

    if (this.db) {
      await this._updateValidity(factId, fact.validity);
    }

    return true;
  }

  /**
   * Delete a fact entirely.
   *
   * @returns True if deleted, False if not found.
   */
  async deleteFact(factId: string): Promise<boolean> {
    const fact = this._facts.get(factId);
    if (!fact) {
      return false;
    }

    // Update supersession chain
    if (fact.supersedes) {
      const predecessor = this._facts.get(fact.supersedes);
      if (predecessor) {
        predecessor.supersededBy = fact.supersededBy;
      }
    }

    if (fact.supersededBy) {
      const successor = this._facts.get(fact.supersededBy);
      if (successor) {
        successor.supersedes = fact.supersedes;
      }
    }

    // Remove from indexes
    this._facts.delete(factId);
    const entityFacts = this._entityIndex.get(fact.entityId);
    if (entityFacts) {
      this._entityIndex.set(
        fact.entityId,
        entityFacts.filter((fid) => fid !== factId)
      );
    }

    if (this.db) {
      await this._deleteFromDb(factId);
    }

    return true;
  }

  /**
   * Query temporal facts with filters.
   *
   * @returns List of matching facts.
   */
  async queryTemporal(params: {
    entityId?: string | null;
    dimension?: string | null;
    validAt?: Date | null;
    includeSuperseded?: boolean;
    limit?: number;
  } = {}): Promise<TemporalFact[]> {
    const {
      entityId = null,
      dimension = null,
      validAt = null,
      includeSuperseded = false,
      limit = 100,
    } = params;

    const results: TemporalFact[] = [];

    for (const fact of this._facts.values()) {
      // Apply filters
      if (entityId && fact.entityId !== entityId) {
        continue;
      }
      if (dimension && fact.dimension !== dimension) {
        continue;
      }
      if (validAt && !fact.isValidAt(validAt)) {
        continue;
      }
      if (!includeSuperseded && fact.supersededBy) {
        continue;
      }

      results.push(fact);

      if (results.length >= limit) {
        break;
      }
    }

    // Sort by importance and recency
    results.sort((a, b) => {
      if (a.importance !== b.importance) {
        return b.importance - a.importance;
      }
      return b.validity.validFrom.getTime() - a.validity.validFrom.getTime();
    });
    return results;
  }

  /** Persist fact to database. */
  private async _persistFact(fact: TemporalFact): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      this.db.execute(
        `
        INSERT OR REPLACE INTO memories
        (id, content, entity_id, valid_from, valid_until,
         supersedes, superseded_by, importance, dimension)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          fact.id,
          fact.content,
          fact.entityId,
          fact.validity.validFrom.toISOString(),
          fact.validity.validUntil ? fact.validity.validUntil.toISOString() : null,
          fact.supersedes,
          fact.supersededBy,
          fact.importance,
          fact.dimension,
        ]
      );
      this.db.commit();
    } catch (e) {
      console.error(`Failed to persist fact ${fact.id}: ${e}`);
    }
  }

  /** Update validity in database. */
  private async _updateValidity(
    factId: string,
    validity: ValidityWindow
  ): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      this.db.execute(
        `
        UPDATE memories
        SET valid_until = ?, updated_at = ?
        WHERE id = ?
      `,
        [
          validity.validUntil ? validity.validUntil.toISOString() : null,
          new Date().toISOString(),
          factId,
        ]
      );
      this.db.commit();
    } catch (e) {
      console.error(`Failed to update validity for ${factId}: ${e}`);
    }
  }

  /** Delete fact from database. */
  private async _deleteFromDb(factId: string): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      this.db.execute("DELETE FROM memories WHERE id = ?", [factId]);
      this.db.commit();
    } catch (e) {
      console.error(`Failed to delete fact ${factId}: ${e}`);
    }
  }

  /** Get tracker statistics. */
  stats(): Record<string, unknown> {
    const allFacts = Array.from(this._facts.values());
    const total = allFacts.length;
    const current = allFacts.filter((f) => f.isCurrent()).length;
    const superseded = allFacts.filter((f) => f.supersededBy !== null).length;
    const expired = allFacts.filter((f) => !f.validity.isCurrentlyValid()).length;

    return {
      total_facts: total,
      current_facts: current,
      superseded_facts: superseded,
      expired_facts: expired,
      entities_tracked: this._entityIndex.size,
    };
  }
}

// Singleton instance
let _temporalTracker: TemporalMemoryTracker | null = null;

/** Get or create TemporalMemoryTracker singleton. */
export function getTemporalTracker(
  dbConnection?: TemporalDbConnection | null
): TemporalMemoryTracker {
  if (_temporalTracker === null) {
    _temporalTracker = new TemporalMemoryTracker(dbConnection);
  } else if (dbConnection != null && _temporalTracker.db === null) {
    _temporalTracker.setDbConnection(dbConnection);
  }
  return _temporalTracker;
}

/** Reset TemporalMemoryTracker singleton (for testing). */
export function resetTemporalTracker(): void {
  _temporalTracker = null;
}
