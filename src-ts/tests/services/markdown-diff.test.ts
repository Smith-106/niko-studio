import { describe, expect, it } from 'vitest';

import { MarkdownDiff } from '../../services/markdown-diff.js';

describe('services/markdown-diff', () => {
  it('builds structured sections and identifies conflicting headings', () => {
    const diff = new MarkdownDiff({} as never);
    const sections = diff.structuredDiff(
      '# Intro\nAlpha\n# Shared\nVault version',
      '# Intro\nAlpha\n# Shared\nKnowledge version\n# Added\nFresh',
    );

    expect(sections).toEqual([
      {
        heading: '__preamble__',
        vaultLines: [],
        knowledgeLines: [],
        hasConflict: false,
      },
      {
        heading: 'Intro',
        vaultLines: ['Alpha'],
        knowledgeLines: ['Alpha'],
        hasConflict: false,
      },
      {
        heading: 'Shared',
        vaultLines: ['Vault version'],
        knowledgeLines: ['Knowledge version'],
        hasConflict: true,
      },
      {
        heading: 'Added',
        vaultLines: [],
        knowledgeLines: ['Fresh'],
        hasConflict: false,
      },
    ]);
  });

  it('auto-merges non-conflicting sections and inserts conflict markers when needed', () => {
    const diff = new MarkdownDiff({} as never);
    const result = diff.autoMerge(
      '# Intro\nAlpha\n# Shared\nVault version',
      '# Intro\nAlpha\n# Shared\nKnowledge version',
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.merged).toContain('# Intro\nAlpha');
    expect(result.merged).toContain('<<<<<<< vault');
    expect(result.merged).toContain('Vault version');
    expect(result.merged).toContain('Knowledge version');
    expect(result.merged).toContain('>>>>>>> knowledge');
  });

  it('preserves vault-only headings without marking them as conflicts', () => {
    const diff = new MarkdownDiff({} as never);
    const sections = diff.structuredDiff(
      '# Intro\nAlpha\n# VaultOnly\nVault exclusive',
      '# Intro\nAlpha',
    );
    const vaultOnly = sections.find((section) => section.heading === 'VaultOnly');

    expect(vaultOnly).toEqual({
      heading: 'VaultOnly',
      vaultLines: ['Vault exclusive'],
      knowledgeLines: [],
      hasConflict: false,
    });

    const merged = diff.autoMerge('# Intro\nAlpha\n# VaultOnly\nVault exclusive', '# Intro\nAlpha');
    expect(merged.conflicts).toEqual([]);
    expect(merged.merged).toContain('# VaultOnly\nVault exclusive');
  });
});
