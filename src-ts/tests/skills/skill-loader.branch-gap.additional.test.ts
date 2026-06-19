import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function writeSkill(
  root: string,
  skillName: string,
  content: string,
  extras?: {
    techniques?: Record<string, string>;
  },
): void {
  const skillDir = join(root, skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf8');

  for (const [name, value] of Object.entries(extras?.techniques ?? {})) {
    const dir = join(skillDir, 'techniques');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), value, 'utf8');
  }
}

describe('skills/skill-loader branch-gap coverage', () => {
  let sandboxRoot: string;
  let envSkillsDir: string;
  let basePath: string;

  beforeEach(() => {
    vi.resetModules();
    sandboxRoot = mkdtempSync(join(tmpdir(), 'skill-loader-branch-gap-'));
    envSkillsDir = join(sandboxRoot, 'env-skills');
    basePath = join(sandboxRoot, 'workspace');
    mkdirSync(envSkillsDir, { recursive: true });
    mkdirSync(join(basePath, 'skills'), { recursive: true });
    process.env.NIKO_SKILLS_DIR = envSkillsDir;
  });

  afterEach(() => {
    delete process.env.NIKO_SKILLS_DIR;
    vi.doUnmock('fs');
    vi.restoreAllMocks();
    vi.resetModules();
    rmSync(sandboxRoot, { recursive: true, force: true });
  });

  it('keeps an explicit .md suffix when loading a technique file', async () => {
    writeSkill(
      envSkillsDir,
      'alpha',
      '# Alpha\n\nBody.\n',
      {
        techniques: {
          'loop.md': 'Loop technique body',
        },
      },
    );

    const { SkillLoader } = await import('../../skills/skill-loader.js');
    const loader = new SkillLoader(basePath);

    expect(loader.loadTechnique('alpha', 'loop.md')).toBe('Loop technique body');
  });

  it('skips existing roots whose directory listing throws', async () => {
    writeSkill(
      join(basePath, 'skills'),
      'beta',
      '# Beta\n\nFallback body.\n',
    );

    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      return {
        ...actual,
        readdirSync: vi.fn((targetPath: Parameters<typeof actual.readdirSync>[0], options?: Parameters<typeof actual.readdirSync>[1]) => {
          if (String(targetPath) === envSkillsDir) {
            throw new Error('permission denied');
          }
          return actual.readdirSync(targetPath as never, options as never);
        }),
      };
    });

    const { SkillLoader } = await import('../../skills/skill-loader.js?branch-gap-readdir');
    const loader = new SkillLoader(basePath);

    expect(loader.listSkills()).toContain('beta');
  });

  it('skips entries whose stat lookup throws while discovering skills', async () => {
    writeSkill(
      envSkillsDir,
      'alpha',
      '# Alpha\n\nEnv body.\n',
    );
    mkdirSync(join(envSkillsDir, 'broken-entry'), { recursive: true });

    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      const brokenPath = join(envSkillsDir, 'broken-entry');
      return {
        ...actual,
        statSync: vi.fn((targetPath: Parameters<typeof actual.statSync>[0], options?: Parameters<typeof actual.statSync>[1]) => {
          if (String(targetPath) === brokenPath) {
            throw new Error('stat failed');
          }
          return actual.statSync(targetPath as never, options as never);
        }),
      };
    });

    const { SkillLoader } = await import('../../skills/skill-loader.js?branch-gap-stat');
    const loader = new SkillLoader(basePath);

    expect(loader.listSkills()).toContain('alpha');
  });
});
