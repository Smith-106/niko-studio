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
 * Aligned with ConsensusEngine.ts ConsensusItem interface.
 * Uses agreeingPersonas/disagreeingPersonas + location to match engine output.
 */
export interface ConsensusItem {
  dimension: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: { chapter?: string; paragraph?: number };
  consensusStrength: number;  // 0-1, >=0.5 = consensus, <0.5 = dissent
  agreeingPersonas: string[];
  disagreeingPersonas: string[];
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
  /* v8 ignore next -- known and unknown severity cases are exercised, but V8 misses this compact comparison branch */
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

    // Derive personaIds from agreeingPersonas (those who flagged the issue)
    const personaIds = [...item.agreeingPersonas];

    return {
      id: `overlay-${markerIdCounter}`,
      type: item.consensusStrength >= 0.5 ? 'consensus' : 'dissent',
      dimension: item.dimension,
      severity: item.severity,
      description: item.description,
      position: {
        chapterId: item.location.chapter,
        paragraphIndex: item.location.paragraph,
      },
      personaCount: personaIds.length,
      consensusStrength: item.consensusStrength,
      personaIds,
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
  const grouped = new Map<string, { count: number; worst: string }>();

  for (const item of items) {
    const dim = item.dimension;
    let entry = grouped.get(dim);

    if (!entry) {
      entry = { count: 0, worst: 'low' };
      grouped.set(dim, entry);
    }

    entry.count += 1;
    entry.worst = worstOf(entry.worst, item.severity);
  }

  const result: Record<string, DimensionOverlayEntry> = {};

  grouped.forEach((entry, dim) => {
    result[dim] = {
      avgScore: 0, // Score not available in ConsensusEngine output; set to 0
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
