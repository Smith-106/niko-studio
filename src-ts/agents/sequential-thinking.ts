/**
 * sequential-thinking.ts - Dynamic reasoning engine.
 *
 * Supports dynamic chain-of-thought, branching, revision, and backtracking.
 *
 * Migrated from src/agents/sequential_thinking.py
 */

import * as crypto from "crypto";
import { createLogger } from '../logger/index.js';

const log = createLogger('sequential-thinking');

// ============================================================
// Enums
// ============================================================

export enum ThoughtType {
  INITIAL = "initial",
  ANALYSIS = "analysis",
  HYPOTHESIS = "hypothesis",
  VERIFICATION = "verification",
  CONCLUSION = "conclusion",
  BRANCH = "branch",
  REVISION = "revision",
  BACKTRACK = "backtrack",
}

export enum ThoughtStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  ABANDONED = "abandoned",
  REVISED = "revised",
}

// ============================================================
// Interfaces
// ============================================================

export interface ThoughtData {
  id: string;
  content: string;
  thoughtType: ThoughtType;
  status: ThoughtStatus;
  parentId: string | null;
  branchId: string | null;
  depth: number;
  /** 0.0 - 1.0 */
  confidence: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  revisedBy: string | null;
}

export interface Branch {
  id: string;
  name: string;
  description: string;
  parentBranchId: string | null;
  forkPointId: string | null;
  status: ThoughtStatus;
  priority: number;
  thoughts: string[];
}

// ============================================================
// Serialization helpers
// ============================================================

export function thoughtDataToDict(t: ThoughtData): Record<string, unknown> {
  return {
    id: t.id,
    content: t.content,
    thought_type: t.thoughtType,
    status: t.status,
    parent_id: t.parentId,
    branch_id: t.branchId,
    depth: t.depth,
    confidence: t.confidence,
    metadata: t.metadata,
    created_at: t.createdAt.toISOString(),
    revised_by: t.revisedBy,
  };
}

export function thoughtDataFromDict(data: Record<string, any>): ThoughtData {
  return {
    id: data["id"],
    content: data["content"],
    thoughtType: ThoughtType[data["thought_type"] as keyof typeof ThoughtType]
      ?? ThoughtType.ANALYSIS,
    status: ThoughtType[data["status"] as keyof typeof ThoughtType] !== undefined
      // The data["status"] may actually be a ThoughtStatus value, not a ThoughtType key.
      // Handle both cases below.
      ? ThoughtStatus.ACTIVE
      : ThoughtStatus.ACTIVE,
    parentId: data["parent_id"] ?? null,
    branchId: data["branch_id"] ?? null,
    depth: data["depth"] ?? 0,
    confidence: data["confidence"] ?? 1.0,
    metadata: data["metadata"] ?? {},
    createdAt: data["created_at"] ? new Date(data["created_at"]) : new Date(),
    revisedBy: data["revised_by"] ?? null,
  };
}

// Fix: proper fromDict that handles both enum key and value forms
function parseThoughtStatus(raw: unknown): ThoughtStatus {
  if (typeof raw === "string") {
    for (const val of Object.values(ThoughtStatus) as string[]) {
      if (val === raw) return val as ThoughtStatus;
    }
  }
  return ThoughtStatus.ACTIVE;
}

function parseThoughtType(raw: unknown): ThoughtType {
  if (typeof raw === "string") {
    for (const val of Object.values(ThoughtType) as string[]) {
      if (val === raw) return val as ThoughtType;
    }
  }
  return ThoughtType.ANALYSIS;
}

export function thoughtDataFromDictProper(data: Record<string, any>): ThoughtData {
  return {
    id: data["id"],
    content: data["content"],
    thoughtType: parseThoughtType(data["thought_type"]),
    status: parseThoughtStatus(data["status"] ?? "active"),
    parentId: data["parent_id"] ?? null,
    branchId: data["branch_id"] ?? null,
    depth: data["depth"] ?? 0,
    confidence: data["confidence"] ?? 1.0,
    metadata: data["metadata"] ?? {},
    createdAt: data["created_at"] ? new Date(data["created_at"]) : new Date(),
    revisedBy: data["revised_by"] ?? null,
  };
}

// ============================================================
// SequentialThinking class
// ============================================================

export class SequentialThinking {
  public readonly maxDepth: number;
  public readonly maxBranches: number;
  public readonly autoPrune: boolean;

  protected _thoughts: Map<string, ThoughtData>;
  protected _branches: Map<string, Branch>;
  protected _currentBranchId: string;
  protected _currentThoughtId: string | null;
  protected _thoughtCounter: number;

  protected _onThoughtAdded: ((thought: ThoughtData) => void) | null;
  protected _onBranchCreated: ((branch: Branch) => void) | null;

  constructor(maxDepth: number = 10, maxBranches: number = 5, autoPrune: boolean = true) {
    this.maxDepth = maxDepth;
    this.maxBranches = maxBranches;
    this.autoPrune = autoPrune;

    this._thoughts = new Map();
    this._branches = new Map();
    this._currentBranchId = "main";
    this._currentThoughtId = null;
    this._thoughtCounter = 0;

    // Initialise main branch
    this._branches.set("main", {
      id: "main",
      name: "Main",
      description: "\u4E3B\u601D\u7EF4\u94FE",
      parentBranchId: null,
      forkPointId: null,
      status: ThoughtStatus.ACTIVE,
      priority: 0,
      thoughts: [],
    });

    this._onThoughtAdded = null;
    this._onBranchCreated = null;
  }

  // ---------- ID generators ----------

  protected _generateThoughtId(): string {
    this._thoughtCounter += 1;
    const now = new Date();
    const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join("");
    return `thought_${ts}_${String(this._thoughtCounter).padStart(4, "0")}`;
  }

  protected _generateBranchId(name: string): string {
    const hashSuffix = crypto
      .createHash("md5")
      .update(`${name}${new Date().toISOString()}`)
      .digest("hex")
      .slice(0, 6);
    return `branch_${name.toLowerCase().replace(/ /g, "_")}_${hashSuffix}`;
  }

  // ---------- Core operations ----------

  think(
    content: string,
    thoughtType: ThoughtType = ThoughtType.ANALYSIS,
    confidence: number = 1.0,
    metadata?: Record<string, unknown>,
  ): ThoughtData {
    const thoughtId = this._generateThoughtId();
    const currentBranch = this._branches.get(this._currentBranchId)!;

    // Compute depth
    let depth = 0;
    if (this._currentThoughtId) {
      const parentThought = this._thoughts.get(this._currentThoughtId);
      if (parentThought) {
        depth = parentThought.depth + 1;
      }
    }

    // Depth limit
    if (depth >= this.maxDepth) {
      log.warn(`Reached max depth ${this.maxDepth}, cannot add more thoughts`);
      throw new Error(`Maximum thought depth (${this.maxDepth}) reached`);
    }

    const thought: ThoughtData = {
      id: thoughtId,
      content,
      thoughtType,
      status: ThoughtStatus.ACTIVE,
      parentId: this._currentThoughtId,
      branchId: this._currentBranchId,
      depth,
      confidence,
      metadata: metadata ?? {},
      createdAt: new Date(),
      revisedBy: null,
    };

    this._thoughts.set(thoughtId, thought);
    currentBranch.thoughts.push(thoughtId);
    this._currentThoughtId = thoughtId;

    if (this._onThoughtAdded) {
      this._onThoughtAdded(thought);
    }

    return thought;
  }

  branch(name: string, description: string, priority: number = 0): Branch {
    if (this._branches.size >= this.maxBranches) {
      if (this.autoPrune) {
        this._pruneLowestPriorityBranch();
      } else {
        throw new Error(`Maximum branches (${this.maxBranches}) reached`);
      }
    }

    const branchId = this._generateBranchId(name);

    const newBranch: Branch = {
      id: branchId,
      name,
      description,
      parentBranchId: this._currentBranchId,
      forkPointId: this._currentThoughtId,
      status: ThoughtStatus.ACTIVE,
      priority,
      thoughts: [],
    };

    this._branches.set(branchId, newBranch);

    if (this._onBranchCreated) {
      this._onBranchCreated(newBranch);
    }

    return newBranch;
  }

  switchBranch(branchId: string): void {
    const branch = this._branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch ${branchId} not found`);
    }
    if (branch.status === ThoughtStatus.ABANDONED) {
      throw new Error(`Cannot switch to abandoned branch ${branchId}`);
    }

    this._currentBranchId = branchId;

    if (branch.thoughts.length > 0) {
      this._currentThoughtId = branch.thoughts[branch.thoughts.length - 1]!;
    } else {
      this._currentThoughtId = branch.forkPointId;
    }
  }

  revise(targetThoughtId: string, newContent: string, reason: string): ThoughtData {
    const targetThought = this._thoughts.get(targetThoughtId);
    if (!targetThought) {
      throw new Error(`Thought ${targetThoughtId} not found`);
    }

    // Mark original as revised
    targetThought.status = ThoughtStatus.REVISED;

    // Create revision thought
    const revisionThought = this.think(
      newContent,
      ThoughtType.REVISION,
      undefined,
      {
        revises: targetThoughtId,
        reason,
        original_content: targetThought.content,
      },
    );

    targetThought.revisedBy = revisionThought.id;

    return revisionThought;
  }

  backtrack(toThoughtId: string): void {
    const targetThought = this._thoughts.get(toThoughtId);
    if (!targetThought) {
      throw new Error(`Thought ${toThoughtId} not found`);
    }

    const branch = this._branches.get(targetThought.branchId!)!;

    // Mark thoughts after the target as abandoned
    let foundTarget = false;
    for (const tid of branch.thoughts) {
      if (tid === toThoughtId) {
        foundTarget = true;
        continue;
      }
      if (foundTarget) {
        const t = this._thoughts.get(tid);
        if (t) t.status = ThoughtStatus.ABANDONED;
      }
    }

    // Switch to target branch and thought
    this._currentBranchId = targetThought.branchId!;
    this._currentThoughtId = toThoughtId;

    // Add backtrack marker
    this.think(
      `Backtracked to thought: ${toThoughtId}`,
      ThoughtType.BACKTRACK,
      undefined,
      { backtrack_target: toThoughtId },
    );
  }

  conclude(conclusion: string, confidence: number = 1.0): ThoughtData {
    return this.think(conclusion, ThoughtType.CONCLUSION, confidence);
  }

  // ---------- Pruning ----------

  protected _pruneLowestPriorityBranch(): void {
    const activeBranches = Array.from(this._branches.values()).filter(
      (b) => b.status === ThoughtStatus.ACTIVE && b.id !== "main",
    );

    if (activeBranches.length === 0) return;

    // Find lowest priority
    let lowest = activeBranches[0]!;
    for (const b of activeBranches) {
      if (b.priority < lowest.priority) lowest = b;
    }

    lowest.status = ThoughtStatus.ABANDONED;

    for (const tid of lowest.thoughts) {
      const t = this._thoughts.get(tid);
      if (t) t.status = ThoughtStatus.ABANDONED;
    }
  }

  // ---------- Query methods ----------

  getThoughtChain(branchId?: string): ThoughtData[] {
    const bid = branchId ?? this._currentBranchId;
    const branch = this._branches.get(bid);
    if (!branch) return [];

    const result: ThoughtData[] = [];
    for (const tid of branch.thoughts) {
      const t = this._thoughts.get(tid);
      if (t) result.push(t);
    }
    return result;
  }

  getActiveThoughts(): ThoughtData[] {
    const result: ThoughtData[] = [];
    for (const t of this._thoughts.values()) {
      if (t.status === ThoughtStatus.ACTIVE) result.push(t);
    }
    return result;
  }

  getConclusions(): ThoughtData[] {
    const result: ThoughtData[] = [];
    for (const t of this._thoughts.values()) {
      if (
        t.thoughtType === ThoughtType.CONCLUSION &&
        (t.status === ThoughtStatus.ACTIVE || t.status === ThoughtStatus.COMPLETED)
      ) {
        result.push(t);
      }
    }
    return result;
  }

  getBestBranch(): Branch {
    const activeBranches = Array.from(this._branches.values()).filter(
      (b) => b.status === ThoughtStatus.ACTIVE,
    );

    if (activeBranches.length === 0) {
      return this._branches.get("main")!;
    }

    const branchScore = (branch: Branch): number => {
      const thoughts: ThoughtData[] = [];
      for (const tid of branch.thoughts) {
        const t = this._thoughts.get(tid);
        if (t) thoughts.push(t);
      }
      const avgConfidence = thoughts.length > 0
        ? thoughts.reduce((s, t) => s + t.confidence, 0) / thoughts.length
        : 0;
      return branch.priority + avgConfidence;
    };

    let best = activeBranches[0]!;
    let bestScore = branchScore(best);
    for (let i = 1; i < activeBranches.length; i++) {
      const score = branchScore(activeBranches[i]!);
      if (score > bestScore) {
        best = activeBranches[i]!;
        bestScore = score;
      }
    }
    return best;
  }

  // ---------- Serialisation ----------

  toDict(): Record<string, unknown> {
    const thoughts: Record<string, unknown> = {};
    for (const [tid, t] of this._thoughts.entries()) {
      thoughts[tid] = thoughtDataToDict(t);
    }

    const branches: Record<string, unknown> = {};
    for (const [bid, b] of this._branches.entries()) {
      branches[bid] = {
        id: b.id,
        name: b.name,
        description: b.description,
        parent_branch_id: b.parentBranchId,
        fork_point_id: b.forkPointId,
        status: b.status,
        priority: b.priority,
        thoughts: b.thoughts,
      };
    }

    return {
      thoughts,
      branches,
      current_branch_id: this._currentBranchId,
      current_thought_id: this._currentThoughtId,
    };
  }

  toMarkdown(): string {
    const lines: string[] = ["# Sequential Thinking Chain\n"];

    for (const [, branch] of this._branches) {
      if (branch.status === ThoughtStatus.ABANDONED) continue;

      lines.push(`\n## Branch: ${branch.name}`);
      lines.push(`*${branch.description}*\n`);

      for (const thoughtId of branch.thoughts) {
        const thought = this._thoughts.get(thoughtId);
        if (!thought) continue;

        const indent = "  ".repeat(thought.depth);

        const statusIcon: Record<string, string> = {
          [ThoughtStatus.ACTIVE]: "[ACTIVE]",
          [ThoughtStatus.COMPLETED]: "[DONE]",
          [ThoughtStatus.ABANDONED]: "[ABANDONED]",
          [ThoughtStatus.REVISED]: "[REVISED]",
        };
        const icon = statusIcon[thought.status] ?? "[?]";

        const typeLabel: Record<string, string> = {
          [ThoughtType.INITIAL]: "[Initial]",
          [ThoughtType.ANALYSIS]: "[Analysis]",
          [ThoughtType.HYPOTHESIS]: "[Hypothesis]",
          [ThoughtType.VERIFICATION]: "[Verify]",
          [ThoughtType.CONCLUSION]: "[Conclusion]",
          [ThoughtType.BRANCH]: "[Branch]",
          [ThoughtType.REVISION]: "[Revision]",
          [ThoughtType.BACKTRACK]: "[Backtrack]",
        };
        const label = typeLabel[thought.thoughtType] ?? "";

        const confidenceStr = thought.confidence < 1.0
          ? `(${Math.round(thought.confidence * 100)}%)`
          : "";

        lines.push(`${indent}${icon} ${label} ${thought.content} ${confidenceStr}`);
      }
    }

    return lines.join("\n");
  }

  // ---------- Reset ----------

  reset(): void {
    this._thoughts.clear();
    this._branches.clear();
    this._currentBranchId = "main";
    this._currentThoughtId = null;
    this._thoughtCounter = 0;

    this._branches.set("main", {
      id: "main",
      name: "Main",
      description: "\u4E3B\u601D\u7EF4\u94FE",
      parentBranchId: null,
      forkPointId: null,
      status: ThoughtStatus.ACTIVE,
      priority: 0,
      thoughts: [],
    });
  }

  // ---------- Callback setters ----------

  onThoughtAdded(callback: (thought: ThoughtData) => void): void {
    this._onThoughtAdded = callback;
  }

  onBranchCreated(callback: (branch: Branch) => void): void {
    this._onBranchCreated = callback;
  }
}
