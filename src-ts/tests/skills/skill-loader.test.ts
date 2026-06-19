import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function writeSkill(
  root: string,
  skillName: string,
  content: string,
  extras?: {
    techniques?: Record<string, string>;
    templates?: Record<string, string>;
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

  for (const [name, value] of Object.entries(extras?.templates ?? {})) {
    const dir = join(skillDir, 'templates');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), value, 'utf8');
  }
}

describe('skills/skill-loader', () => {
  let sandboxRoot: string;
  let envSkillsDir: string;
  let basePath: string;

  beforeEach(() => {
    vi.resetModules();
    sandboxRoot = mkdtempSync(join(tmpdir(), 'skill-loader-'));
    envSkillsDir = join(sandboxRoot, 'env-skills');
    basePath = join(sandboxRoot, 'workspace');
    mkdirSync(envSkillsDir, { recursive: true });
    mkdirSync(join(basePath, 'skills'), { recursive: true });
    process.env.NIKO_SKILLS_DIR = envSkillsDir;
  });

  afterEach(() => {
    delete process.env.NIKO_SKILLS_DIR;
    rmSync(sandboxRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('loads skill content, metadata, techniques, templates, and section bodies', async () => {
    writeSkill(
      envSkillsDir,
      'alpha',
      `---
description: "Alpha summary"
tags: [one, "two words"]
triggers: [draft, polish]
---
# Alpha

Alpha body.

## Plan (v2)
Line A
Line B

### Other
Ignored section
`,
      {
        techniques: {
          'loop.md': 'Loop technique body',
        },
        templates: {
          'prompt.md': 'Prompt template body',
        },
      },
    );

    const { SkillLoader } = await import('../../skills/skill-loader.js');
    const loader = new SkillLoader(basePath);

    expect(loader.load('alpha')).toContain('# Alpha');
    expect(loader.loadFull('alpha')).toMatchObject({
      name: 'alpha',
      meta: {
        description: 'Alpha summary',
        tags: ['one', 'two words'],
        triggers: ['draft', 'polish'],
      },
      techniques: ['Plan (v2)', 'Other'],
    });
    expect(loader.loadSkill('alpha')).toEqual({
      name: 'alpha',
      content: expect.stringContaining('# Alpha'),
      metadata: {
        description: 'Alpha summary',
        tags: ['one', 'two words'],
        triggers: ['draft', 'polish'],
        path: join(envSkillsDir, 'alpha', 'SKILL.md'),
        techniques: ['Plan (v2)', 'Other'],
      },
      techniques: ['Plan (v2)', 'Other'],
    });
    expect(loader.loadTechnique('alpha', 'loop')).toBe('Loop technique body');
    expect(loader.loadTemplate('alpha', 'prompt.md')).toBe('Prompt template body');
    expect(loader.getTechnique('alpha', 'Plan (v2)')).toBe('Line A\nLine B');
    expect(loader.getTechnique('alpha', 'Missing')).toBeNull();
  });

  it('discovers skills, summarizes metadata, and falls back to the first paragraph description', async () => {
    writeSkill(
      envSkillsDir,
      'alpha',
      `---
description: "Alpha summary"
tags: [one]
triggers: [draft]
---
# Alpha

Alpha body.

## Alpha Technique
Body
`,
    );
    writeSkill(
      join(basePath, 'skills'),
      'beta',
      `# Beta

Beta first paragraph becomes the fallback description and should be trimmed from the markdown body.

## Beta Technique
Keep me
`,
    );
    mkdirSync(join(envSkillsDir, 'ignored-dir'), { recursive: true });
    writeFileSync(join(envSkillsDir, 'plain.txt'), 'not a skill', 'utf8');

    const { SkillLoader } = await import('../../skills/skill-loader.js');
    const loader = new SkillLoader(basePath);
    const summary = loader.getSummary();
    const summaryDict = loader.getSummaryDict();

    expect(loader.listSkills().sort()).toEqual(['alpha', 'beta']);
    expect(summary).toContain('Available skills:');
    expect(summary).toContain('- **alpha** [one]: Alpha summary');
    expect(summary).toContain('- **beta**: Beta first paragraph becomes the fallback description');
    expect(summary).toContain('Usage: @skill:skill-name');
    expect(summaryDict).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'alpha',
          description: 'Alpha summary',
          tags: ['one'],
          triggers: ['draft'],
          techniques: ['Alpha Technique'],
        }),
        expect.objectContaining({
          name: 'beta',
          description: expect.stringContaining('Beta first paragraph becomes the fallback description'),
          tags: [],
          triggers: [],
          techniques: ['Beta Technique'],
        }),
      ]),
    );
  });

  it('resolves refs with truncation, extracts ref order, and invalidates caches explicitly', async () => {
    writeSkill(
      envSkillsDir,
      'alpha',
      '# Alpha\n\nOriginal alpha body.\n',
    );
    writeSkill(
      envSkillsDir,
      'longskill',
      `# Longskill\n\n${'x'.repeat(4_200)}`,
    );

    const { SkillLoader } = await import('../../skills/skill-loader.js');
    const loader = new SkillLoader(basePath);

    const original = loader.load('alpha');
    writeSkill(
      envSkillsDir,
      'alpha',
      '# Alpha\n\nUpdated alpha body.\n',
    );

    expect(loader.load('alpha')).toBe(original);

    const resolved = loader.resolveRefs('Use @skill:alpha then @skill:missing and @skill:longskill');
    expect(resolved).toContain('[Skill: alpha]');
    expect(resolved).toContain('Original alpha body.');
    expect(resolved).toContain('[Skill missing not found]');
    expect(resolved).toContain('... (truncated)');
    expect(loader.extractRefs('A @skill:alpha B @skill:missing C @skill:alpha')).toEqual([
      'alpha',
      'missing',
      'alpha',
    ]);

    loader.listSkills();
    writeSkill(
      join(basePath, 'skills'),
      'gamma',
      '# Gamma\n\nFresh gamma body.\n',
    );

    expect(loader.listSkills()).not.toContain('gamma');
    loader.clearCache();
    expect(loader.load('alpha')).toContain('Updated alpha body.');
    expect(loader.listSkills()).toContain('gamma');
  });

  it('uses env override priority and module-level singleton convenience helpers', async () => {
    writeSkill(
      envSkillsDir,
      'shadow',
      '# Shadow\n\nLoaded from env.\n',
    );
    writeSkill(
      join(basePath, 'skills'),
      'shadow',
      '# Shadow\n\nLoaded from base.\n',
    );

    const module = await import('../../skills/skill-loader.js');
    const {
      getLoader,
      loadSkillContent,
      listSkills,
      getSkillSummary,
      resolveSkillRefs,
    } = module;

    const firstLoader = getLoader(basePath);
    const secondLoader = getLoader();

    expect(firstLoader).toBe(secondLoader);
    expect(loadSkillContent('shadow')).toContain('Loaded from env.');
    expect(listSkills()).toContain('shadow');
    expect(getSkillSummary()).toContain('- **shadow**');
    expect(resolveSkillRefs('Reference @skill:shadow')).toContain('[Skill: shadow]');
  });

  it('throws clear errors when techniques, templates, or skills are missing', async () => {
    writeSkill(
      envSkillsDir,
      'alpha',
      '# Alpha\n\nBody.\n',
    );

    const { SkillLoader } = await import('../../skills/skill-loader.js');
    const loader = new SkillLoader(basePath);

    expect(() => loader.loadTechnique('alpha', 'missing')).toThrow(
      "Technique 'missing' not found for skill 'alpha'",
    );
    expect(() => loader.loadTemplate('alpha', 'missing')).toThrow(
      "Template 'missing' not found for skill 'alpha'",
    );
    expect(() => loader.load('missing')).toThrow(
      "Skill 'missing' not found in any path",
    );
    expect(readFileSync(join(envSkillsDir, 'alpha', 'SKILL.md'), 'utf8')).toContain('# Alpha');
  });
});
