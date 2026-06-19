import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ArtifactResolver,
  STAGE_CONTRACTS,
  type IArtifactContract,
  type StateArtifact,
} from '../../workflow/artifact-contract.js';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-artifact-contract-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('workflow/artifact-contract', () => {
  it('resolves suffix and directory inputs, joins outputs, and reports missing concrete files', () => {
    const scratchDir = createTempDir();
    fs.mkdirSync(path.join(scratchDir, '.summaries'), { recursive: true });

    const artifacts: StateArtifact[] = [
      {
        type: 'analysis',
        path: path.join('runs', 'phase-1', 'conclusions.json'),
      },
      {
        type: 'summary',
        path: 'runs/phase-1/.summaries/TASK-001-summary.md',
      },
    ];
    const contract: IArtifactContract = {
      stage: 'review',
      inputSchema: {
        conclusions: 'conclusions.json',
        summaries: '.summaries/',
        missing: 'missing.json',
      },
      outputSchema: {
        wildcardSummary: '.summaries/TASK-*-summary.md',
        review: 'review.json',
      },
    };

    const resolver = new ArtifactResolver(artifacts);
    const inputs = resolver.resolveInput(contract);
    const outputs = resolver.resolveOutput(contract, scratchDir);
    const validation = resolver.validate(contract, scratchDir);

    expect(inputs.get('conclusions')).toBe(path.join('runs', 'phase-1', 'conclusions.json'));
    expect(inputs.get('summaries')).toBe(
      'runs/phase-1/.summaries/TASK-001-summary.md',
    );
    expect(inputs.get('missing')).toBe('');
    expect(outputs.get('wildcardSummary')).toBe(
      path.join(scratchDir, '.summaries', 'TASK-*-summary.md'),
    );
    expect(outputs.get('review')).toBe(path.join(scratchDir, 'review.json'));
    expect(validation).toEqual({
      missingInputs: ['missing'],
      missingOutputs: ['review'],
    });
  });

  it('treats wildcard outputs as satisfied when only the parent directory exists and flags missing parents otherwise', () => {
    const scratchDir = createTempDir();
    const resolver = new ArtifactResolver([
      {
        type: 'plan',
        path: path.join('runs', 'phase-2', 'plan.json'),
      },
    ]);

    expect(resolver.validate(STAGE_CONTRACTS.execute, scratchDir)).toEqual({
      missingInputs: [],
      missingOutputs: ['summaries'],
    });

    fs.mkdirSync(path.join(scratchDir, '.summaries'), { recursive: true });

    expect(resolver.validate(STAGE_CONTRACTS.execute, scratchDir)).toEqual({
      missingInputs: [],
      missingOutputs: [],
    });
  });

  it('exports the expected stage contract conventions', () => {
    expect(Object.keys(STAGE_CONTRACTS)).toEqual([
      'analyze',
      'plan',
      'execute',
      'verify',
      'review',
    ]);
    expect(STAGE_CONTRACTS.analyze.outputSchema).toEqual({
      conclusions: 'conclusions.json',
    });
    expect(STAGE_CONTRACTS.verify.inputSchema).toEqual({
      summaries: '.summaries/',
    });
    expect(STAGE_CONTRACTS.review.outputSchema).toEqual({
      review: 'review.json',
    });
  });
});
