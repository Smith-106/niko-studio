/**
 * Evidence Collection Helpers
 *
 * Provides utilities to generate structured evidence reports from benchmark
 * test results. Output format matches the evidence mapping defined in
 * project.vision.md for the .workflow/evidence/quality/ directory.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvidenceScore {
  evaluator: string;
  score: number;
  level: string;
  issues: number;
  criticalIssues: number;
  majorIssues: number;
}

export interface ConsistencyEvidenceScore {
  checker: string;
  score: number;
  totalConflicts: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
}

export interface EvidenceTestResult {
  test_name: string;
  sample_label: string;
  sample_category: 'high_quality' | 'low_quality' | 'coherent' | 'contradictory';
  scores: EvidenceScore[] | ConsistencyEvidenceScore[];
  passed: boolean;
  pass_criteria: string;
  details?: string;
}

export interface EvidenceReport {
  timestamp: string;
  report_id: string;
  suite_name: string;
  sample_size: number;
  results: EvidenceTestResult[];
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    pass_rate: number;
    average_quality_gap: number;
  };
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique report ID based on timestamp.
 */
export function generateReportId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  return `EVD-${date}-${time}`;
}

/**
 * Build a quality-gate evidence report from individual test results.
 */
export function buildQualityGateReport(
  suiteName: string,
  results: EvidenceTestResult[],
): EvidenceReport {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  // Calculate average quality gap: difference between high-quality and low-quality scores
  const highQualityResults = results.filter(
    (r) => r.sample_category === 'high_quality',
  );
  const lowQualityResults = results.filter(
    (r) => r.sample_category === 'low_quality',
  );

  let averageQualityGap = 0;
  if (highQualityResults.length > 0 && lowQualityResults.length > 0) {
    const highAvg =
      highQualityResults.reduce((sum, r) => {
        const scores = r.scores as EvidenceScore[];
        return sum + scores.reduce((s, ev) => s + ev.score, 0) / scores.length;
      }, 0) / highQualityResults.length;
    const lowAvg =
      lowQualityResults.reduce((sum, r) => {
        const scores = r.scores as EvidenceScore[];
        return sum + scores.reduce((s, ev) => s + ev.score, 0) / scores.length;
      }, 0) / lowQualityResults.length;
    averageQualityGap = Math.round((highAvg - lowAvg) * 10) / 10;
  }

  return {
    timestamp: new Date().toISOString(),
    report_id: generateReportId(),
    suite_name: suiteName,
    sample_size: results.length,
    results,
    summary: {
      total_tests: results.length,
      passed,
      failed,
      pass_rate: Math.round((passed / results.length) * 1000) / 100,
      average_quality_gap: averageQualityGap,
    },
  };
}

/**
 * Build a consistency-gate evidence report from individual test results.
 */
export function buildConsistencyGateReport(
  suiteName: string,
  results: EvidenceTestResult[],
): EvidenceReport {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return {
    timestamp: new Date().toISOString(),
    report_id: generateReportId(),
    suite_name: suiteName,
    sample_size: results.length,
    results,
    summary: {
      total_tests: results.length,
      passed,
      failed,
      pass_rate: Math.round((passed / results.length) * 1000) / 100,
      average_quality_gap: 0, // Not applicable for consistency gate
    },
  };
}

/**
 * Convert an evidence report to a JSON string suitable for writing to disk.
 */
export function reportToJson(report: EvidenceReport): string {
  return JSON.stringify(report, mapReplacer, 2);
}

/**
 * Write a serializable version of the report (handles Map objects).
 */
function mapReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  if (value instanceof Set) {
    return [...value];
  }
  return value;
}
