import { describe, expect, it, vi } from 'vitest';

import {
  WorldviewCoherenceValidator,
  WorldviewConflictType,
  WorldviewSeverity,
} from '../../narrative/worldview-coherence-validator.js';

describe('narrative/worldview-coherence-validator branch gaps', () => {
  it('defaults worldview setting chapters to 1 when the source has no chapter marker', () => {
    const validator = new WorldviewCoherenceValidator({
      worldviewSettings: [
        {
          term: 'Quiet Law',
          nature: 'forbidden',
          detail: 'No thunder',
          source: 'Prologue',
        },
      ],
    });

    expect(validator.getRules()).toEqual([
      expect.objectContaining({
        id: 'WVE-Quiet-Law',
        establishedIn: 1,
      }),
    ]);
  });

  it('fills missing chapter meta entries with generated defaults', () => {
    const validator = new WorldviewCoherenceValidator();

    const report = validator.quickAnalyze(
      ['第一章没有异常。', '第二章依旧平稳。'],
      [{ chapterNumber: 1, title: 'Opening' }],
    );

    expect(report.chapterProfiles[1]).toMatchObject({
      chapterNumber: 2,
      chapterTitle: 'Chapter 2',
    });
  });

  it('skips sentences that do not start with a Chinese character name', () => {
    const validator = new WorldviewCoherenceValidator();
    const extractCharacterAbilities = (
      validator as unknown as {
        extractCharacterAbilities: (content: string) => Map<string, string[]>;
      }
    ).extractCharacterAbilities.bind(validator);

    const abilities = extractCharacterAbilities('但是，法术失控。');

    expect(abilities.size).toBe(0);
  });

  it('falls back to the default conflict type for unknown rule categories', () => {
    const validator = new WorldviewCoherenceValidator();
    const categoryToConflictType = (
      validator as unknown as {
        categoryToConflictType: (category: string) => WorldviewConflictType;
      }
    ).categoryToConflictType.bind(validator);

    expect(categoryToConflictType('weather')).toBe(WorldviewConflictType.LORE_CONTRADICTION);
  });

  it('handles missing chapter lists in cross-chapter location comparison fallbacks', () => {
    const validator = new WorldviewCoherenceValidator();
    const checkCrossChapterConsistency = (
      validator as unknown as {
        checkCrossChapterConsistency: (
          current: {
            chapterNumber: number;
            chapterTitle: string;
            locationsMentioned: string[];
            characterAbilities: Map<string, string[]>;
            culturalReferences: string[];
            technologyReferences: string[];
            magicReferences: string[];
            potentialViolations: unknown[];
          },
          allProfiles: Array<{
            chapterNumber: number;
            chapterTitle: string;
            locationsMentioned: string[];
            characterAbilities: Map<string, string[]>;
            culturalReferences: string[];
            technologyReferences: string[];
            magicReferences: string[];
            potentialViolations: unknown[];
          }>,
        ) => Array<{ type: WorldviewConflictType }>;
      }
    ).checkCrossChapterConsistency.bind(validator);

    const originalGet = Map.prototype.get;
    const getSpy = vi
      .spyOn(Map.prototype, 'get')
      .mockImplementation(function(this: Map<unknown, unknown>, key: unknown) {
        if (key === 'StoneGateCity' || key === 'GateCity') {
          return undefined;
        }
        return originalGet.call(this, key);
      });

    try {
      const profile = {
        chapterNumber: 3,
        chapterTitle: 'Aliases',
        locationsMentioned: ['StoneGateCity', 'GateCity'],
        characterAbilities: new Map<string, string[]>(),
        culturalReferences: [],
        technologyReferences: [],
        magicReferences: [],
        potentialViolations: [],
      };

      const conflicts = checkCrossChapterConsistency(profile, [profile]);

      expect(conflicts).toEqual([]);
    } finally {
      getSpy.mockRestore();
    }
  });

  it('uses severity fallback ordering for unknown conflict severities during report build', () => {
    const validator = new WorldviewCoherenceValidator();
    const buildReport = (
      validator as unknown as {
        buildReport: (
          conflicts: Array<{
            id: string;
            type: WorldviewConflictType;
            severity: WorldviewSeverity | 'mystery' | 'alien';
            ruleId: string | null;
            ruleName: string;
            chaptersInvolved: number[];
            description: string;
            expected: string;
            actual: string;
            evidence: string[];
            suggestion: string;
          }>,
          profiles: unknown[],
        ) => { conflicts: Array<{ severity: string }>; summary: string; totalConflicts: number };
      }
    ).buildReport.bind(validator);

    const report = buildReport(
      [
        {
          id: 'c1',
          type: WorldviewConflictType.LORE_CONTRADICTION,
          severity: 'mystery',
          ruleId: null,
          ruleName: 'unknown-a',
          chaptersInvolved: [1],
          description: 'unknown severity a',
          expected: 'n/a',
          actual: 'n/a',
          evidence: [],
          suggestion: 'n/a',
        },
        {
          id: 'c2',
          type: WorldviewConflictType.LORE_CONTRADICTION,
          severity: 'alien',
          ruleId: null,
          ruleName: 'unknown-b',
          chaptersInvolved: [2],
          description: 'unknown severity b',
          expected: 'n/a',
          actual: 'n/a',
          evidence: [],
          suggestion: 'n/a',
        },
      ],
      [],
    );

    expect(report.totalConflicts).toBe(2);
    expect(report.summary).toContain('minor worldview issues');
    expect(report.conflicts.map(conflict => conflict.severity)).toEqual(['mystery', 'alien']);
  });

  it('deduplicates repeated conflicts with the same signature during report build', () => {
    const validator = new WorldviewCoherenceValidator();
    const buildReport = (
      validator as unknown as {
        buildReport: (
          conflicts: Array<{
            id: string;
            type: WorldviewConflictType;
            severity: WorldviewSeverity;
            ruleId: string | null;
            ruleName: string;
            chaptersInvolved: number[];
            description: string;
            expected: string;
            actual: string;
            evidence: string[];
            suggestion: string;
          }>,
          profiles: unknown[],
        ) => { conflicts: Array<{ id: string }>; totalConflicts: number };
      }
    ).buildReport.bind(validator);

    const duplicate = {
      type: WorldviewConflictType.LORE_CONTRADICTION,
      severity: WorldviewSeverity.MINOR,
      ruleId: null,
      ruleName: 'duplicate-rule',
      chaptersInvolved: [2, 3],
      description: 'duplicate',
      expected: 'same',
      actual: 'same',
      evidence: [],
      suggestion: 'same',
    };

    const report = buildReport(
      [
        { id: 'dup-1', ...duplicate },
        { id: 'dup-2', ...duplicate },
      ],
      [],
    );

    expect(report.totalConflicts).toBe(1);
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]?.id).toBe('dup-1');
  });
});
