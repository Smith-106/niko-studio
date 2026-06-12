import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const skillsListMock = vi.hoisted(() => vi.fn());
const skillsLoadMock = vi.hoisted(() => vi.fn());
const skillsMatchMock = vi.hoisted(() => vi.fn());
const skillsGetChainMock = vi.hoisted(() => vi.fn());

function makeRequest(
  body: Record<string, unknown> = {},
  query: Record<string, string> = {},
): HttpRequest {
  return {
    method: 'POST',
    url: '/skills',
    headers: {},
    body,
    query,
    params: {},
  };
}

async function loadSkillsModule() {
  vi.resetModules();

  vi.doMock('../../mcp/services/skills', () => ({
    skillsList: skillsListMock,
    skillsLoad: skillsLoadMock,
    skillsMatch: skillsMatchMock,
    skillsGetChain: skillsGetChainMock,
  }));

  return import('../../mcp/endpoints/skills.js');
}

describe('skills endpoints', () => {
  let tempSkillsDir: string;

  beforeEach(async () => {
    tempSkillsDir = await mkdtemp(join(tmpdir(), 'niko-skills-'));
    process.env['NIKO_SKILLS_DIR'] = tempSkillsDir;
    skillsListMock.mockReset();
    skillsLoadMock.mockReset();
    skillsMatchMock.mockReset();
    skillsGetChainMock.mockReset();
  });

  afterEach(async () => {
    delete process.env['NIKO_SKILLS_DIR'];
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../mcp/services/skills');
    await rm(tempSkillsDir, { recursive: true, force: true });
  });

  it('passes through list, load, match, and chain requests', async () => {
    skillsListMock.mockResolvedValueOnce([{ id: 'revise' }]);
    skillsLoadMock.mockResolvedValueOnce({ id: 'revise', content: 'Guide text' });
    skillsMatchMock.mockResolvedValueOnce([{ id: 'match-1' }]);
    skillsGetChainMock.mockResolvedValueOnce(['plan', 'review']);

    const {
      skillsListEndpoint,
      skillsLoadEndpoint,
      skillsMatchEndpoint,
      skillsChainEndpoint,
    } = await loadSkillsModule();

    const listResponse = await skillsListEndpoint(makeRequest({}, { category: 'writing' }));
    expect(skillsListMock).toHaveBeenCalledWith('writing');
    expect(listResponse.body).toEqual({ skills: [{ id: 'revise' }] });

    const loadResponse = await skillsLoadEndpoint(makeRequest({ skill_id: 'revise' }));
    expect(skillsLoadMock).toHaveBeenCalledWith('revise');
    expect(loadResponse.body).toEqual({ id: 'revise', content: 'Guide text' });

    const matchResponse = await skillsMatchEndpoint(makeRequest({
      task_type: 'revision',
      keywords: ['tone', 'pace'],
      issue: 'pacing',
    }));
    expect(skillsMatchMock).toHaveBeenCalledWith({
      taskType: 'revision',
      keywords: ['tone', 'pace'],
      issue: 'pacing',
    });
    expect(matchResponse.body).toEqual([{ id: 'match-1' }]);

    const chainResponse = await skillsChainEndpoint(makeRequest({ task_type: 'revision' }));
    expect(skillsGetChainMock).toHaveBeenCalledWith('revision');
    expect(chainResponse.body).toEqual(['plan', 'review']);
  });

  it('creates a sanitized skill file and rejects duplicates', async () => {
    const { skillsCreateEndpoint } = await loadSkillsModule();

    const missing = await skillsCreateEndpoint(makeRequest({}));
    expect(missing.statusCode).toBe(400);
    expect(missing.body).toEqual({ error: 'name is required' });

    const created = await skillsCreateEndpoint(makeRequest({
      name: 'tone/rewrite',
      content: 'Keep the voice sharp.',
    }));
    expect(created.statusCode).toBe(200);
    expect(created.body).toEqual({ id: 'tone/rewrite' });

    const createdPath = join(tempSkillsDir, 'tone_rewrite.md');
    const fileContent = await readFile(createdPath, 'utf8');
    expect(fileContent).toContain('name: tone/rewrite');
    expect(fileContent).toContain('Keep the voice sharp.');

    const duplicate = await skillsCreateEndpoint(makeRequest({
      name: 'tone/rewrite',
      content: 'Duplicate',
    }));
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.body).toEqual({ error: "Skill 'tone/rewrite' already exists" });
  });

  it('saves existing skills, synthesizes frontmatter when needed, and reports missing cases', async () => {
    const { skillsSaveEndpoint } = await loadSkillsModule();

    const missingId = await skillsSaveEndpoint(makeRequest({}));
    expect(missingId.statusCode).toBe(400);
    expect(missingId.body).toEqual({ error: 'skill_id is required' });

    const notFound = await skillsSaveEndpoint(makeRequest({
      skill_id: 'ghost',
      content: 'No file',
    }));
    expect(notFound.statusCode).toBe(404);
    expect(notFound.body).toEqual({ error: "Skill 'ghost' not found" });

    const existingPath = join(tempSkillsDir, 'rewrite.md');
    await writeFile(
      existingPath,
      '---\nname: rewrite\ndescription: Existing\n---\n\nOld body\n',
      'utf8',
    );

    const saved = await skillsSaveEndpoint(makeRequest({
      skill_id: 'rewrite',
      content: 'New body',
    }));
    expect(saved.statusCode).toBe(200);
    expect(saved.body).toEqual({ success: true });
    expect(await readFile(existingPath, 'utf8')).toContain('\nNew body');

    const fallbackPath = join(tempSkillsDir, 'plain.md');
    await writeFile(fallbackPath, 'Plain body without frontmatter', 'utf8');

    const fallback = await skillsSaveEndpoint(makeRequest({
      skill_id: 'plain',
      content: 'Replacement body',
    }));
    expect(fallback.statusCode).toBe(200);
    expect(await readFile(fallbackPath, 'utf8')).toContain('name: plain');
    expect(await readFile(fallbackPath, 'utf8')).toContain('Replacement body');
  });

  it('deletes skills and reports missing cases', async () => {
    const { skillsDeleteEndpoint } = await loadSkillsModule();

    const missingId = await skillsDeleteEndpoint(makeRequest({}));
    expect(missingId.statusCode).toBe(400);
    expect(missingId.body).toEqual({ error: 'skill_id is required' });

    const notFound = await skillsDeleteEndpoint(makeRequest({ skill_id: 'ghost' }));
    expect(notFound.statusCode).toBe(404);
    expect(notFound.body).toEqual({ error: "Skill 'ghost' not found" });

    const filePath = join(tempSkillsDir, 'delete_me.md');
    await writeFile(filePath, 'temporary', 'utf8');

    const deleted = await skillsDeleteEndpoint(makeRequest({ skill_id: 'delete_me' }));
    expect(deleted.statusCode).toBe(200);
    expect(deleted.body).toEqual({ success: true });

    const missingAfterDelete = await skillsDeleteEndpoint(makeRequest({ skill_id: 'delete_me' }));
    expect(missingAfterDelete.statusCode).toBe(404);
  });

  it('falls back to the homedir-based skills directory when NIKO_SKILLS_DIR is unset', async () => {
    delete process.env['NIKO_SKILLS_DIR'];
    vi.doMock('os', () => ({
      homedir: () => tempSkillsDir,
    }));

    const { skillsCreateEndpoint } = await loadSkillsModule();
    const response = await skillsCreateEndpoint(makeRequest({
      name: 'fallback-home',
      content: 'Stored through homedir fallback.',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ id: 'fallback-home' });
    const fileContent = await readFile(
      join(tempSkillsDir, '.niko', 'skills', 'fallback-home.md'),
      'utf8',
    );
    expect(fileContent).toContain('Stored through homedir fallback.');
  });
});
