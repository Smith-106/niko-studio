/**
 * RS-to-Overlay Bridge — transforms consensus items into OverlayMarker[]
 *
 * Bridges the Reader Simulation consensus layer to the narrative visualization
 * overlay. Each consensus item is mapped to an OverlayMarker; items with
 * consensusStrength >= 0.5 become 'consensus' markers, otherwise 'dissent'.
 * Dimension-level aggregation produces summary stats for overlay rendering.
 *
 * Related: T-035, SME-02
 */

// ============================================================
// Interfaces
// ============================================================

/**
 * Single marker on the narrative visualization overlay
 */
export interface OverlayMarker {
  id: string;
  type: 'consensus' | 'dissent' | 'highlight';
  dimension: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  position: { chapterId?: string; paragraphIndex?: number };
  personaCount: number;
  consensusStrength: number;
  personaIds: string[];
}

/**
 * Dimension-level aggregation for overlay summary
 */
export interface DimensionOverlayEntry {
  avgScore: number;
  markerCount: number;
  worstSeverity: string;
}

/**
 * Result of the overlay bridge transformation
 */
export interface OverlayBridgeResult {
  markers: OverlayMarker[];
  dimensionOverlay: Record<string, DimensionOverlayEntry>;
}

/**
 * Input consensus item structure (expected from ConsensusEngine, T-034)
 *
 * Defined here as the contract the bridge depends on.
 * ConsensusEngine will produce items matching this shape.
 */
export interface ConsensusItem {
  dimension: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  position: { chapterId?: string; paragraphIndex?: number };
  consensusStrength: number;  // 0-1, >=0.5 = consensus, <0.5 = dissent
  personaIds: string[];
  score: number;              // 0-1 dimension score
}

// ============================================================
// Severity ordering helper
// ============================================================

const SEVERITY_ORDER: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function worstOf(a: string, b: string): string {
  return (SEVERITY_ORDER[a] ?? 0) >= (SEVERITY_ORDER[b] ?? 0) ? a : b;
}

// ============================================================
// Overlay Bridge
// ============================================================

let markerIdCounter = 0;

/**
 * Transform consensus items into overlay markers with dimension aggregation
 *
 * @param consensusItems - items from the consensus engine
 * @returns markers array + dimension-level summary
 */
export function transformToOverlay(consensusItems: ConsensusItem[]): OverlayBridgeResult {
  const markers: OverlayMarker[] = consensusItems.map((item) => {
    markerIdCounter += 1;

    return {
      id: `overlay-${markerIdCounter}`,
      type: item.consensusStrength >= 0.5 ? 'consensus' : 'dissent',
      dimension: item.dimension,
      severity: item.severity,
      description: item.description,
      position: { ...item.position },
      personaCount: item.personaIds.length,
      consensusStrength: item.consensusStrength,
      personaIds: [...item.personaIds],
    };
  });

  const dimensionOverlay = buildDimensionOverlay(consensusItems);

  return { markers, dimensionOverlay };
}

// ============================================================
// Dimension Aggregation (Private)
// ============================================================

function buildDimensionOverlay(
  items: ConsensusItem[],
): Record<string, DimensionOverlayEntry> {
  const grouped = new Map<string, { scores: number[]; count: number; worst: string }>();

  for (const item of items) {
    const dim = item.dimension;
    let entry = grouped.get(dim);

    if (!entry) {
      entry = { scores: [], count: 0, worst: 'low' };
      grouped.set(dim, entry);
    }

    entry.scores.push(item.score);
    entry.count += 1;
    entry.worst = worstOf(entry.worst, item.severity);
  }

  const result: Record<string, DimensionOverlayEntry> = {};

  grouped.forEach((entry, dim) => {
    const avgScore = entry.scores.length > 0
      ? entry.scores.reduce((sum, s) => sum + s, 0) / entry.scores.length
      : 0;

    result[dim] = {
      avgScore,
      markerCount: entry.count,
      worstSeverity: entry.worst,
    };
  });

  return result;
}

// ============================================================
// Reset (for testing)
// ============================================================

/**
 * Reset internal counter (test-only)
 */
export function resetOverlayBridge(): void {
  markerIdCounter = 0;
}
