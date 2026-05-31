/**
 * Skills REST Endpoints
 *
 * Skills-related HTTP endpoints for Desktop frontend.
 * Ported from src/mcp/endpoints/skills.py
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import {
  skillsList,
  skillsLoad,
  skillsMatch,
  skillsGetChain,
} from '../services/skills';

function resolveUserSkillsDir(): string {
  const envDir = (process.env['NIKO_SKILLS_DIR'] ?? '').trim();
  if (envDir) return envDir;
  return join(homedir(), '.niko', 'skills');
}

function skillFilePath(name: string): string {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(resolveUserSkillsDir(), `${safeName}.md`);
}

export async function skillsListEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const category = request.query['category'] ?? undefined;
  const result = await skillsList(category);
  return jsonResponse({ skills: result });
}

export async function skillsLoadEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await skillsLoad((body.skill_id as string) ?? '');
  return jsonResponse(result);
}

export async function skillsMatchEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await skillsMatch({
    taskType: body.task_type as string | undefined,
    keywords: body.keywords as string[] | undefined,
    issue: body.issue as string | undefined,
  });
  return jsonResponse(result);
}

export async function skillsChainEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await skillsGetChain((body.task_type as string) ?? '');
  return jsonResponse(result);
}

export async function skillsCreateEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  const content = String(body.content ?? '');
  if (!name) return jsonResponse({ error: 'name is required' }, 400);

  const filePath = skillFilePath(name);
  if (existsSync(filePath)) return jsonResponse({ error: `Skill '${name}' already exists` }, 409);

  const dir = join(filePath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const frontmatter = `---\nname: ${name}\ndescription: User-created skill\ntags: []\ntriggers: []\n---\n\n`;
  writeFileSync(filePath, frontmatter + content, 'utf-8');
  return jsonResponse({ id: name });
}

export async function skillsSaveEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const skillId = String(body.skill_id ?? '').trim();
  const content = String(body.content ?? '');
  if (!skillId) return jsonResponse({ error: 'skill_id is required' }, 400);

  const filePath = skillFilePath(skillId);
  if (!existsSync(filePath)) return jsonResponse({ error: `Skill '${skillId}' not found` }, 404);

  const existing = readFileSync(filePath, 'utf-8');
  const bodyStart = existing.indexOf('---', existing.indexOf('---') + 3);
  const frontmatter = bodyStart >= 0 ? existing.slice(0, bodyStart + 3) : `---\nname: ${skillId}\n---\n`;
  writeFileSync(filePath, frontmatter + '\n' + content, 'utf-8');
  return jsonResponse({ success: true });
}

export async function skillsDeleteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const skillId = String(body.skill_id ?? '').trim();
  if (!skillId) return jsonResponse({ error: 'skill_id is required' }, 400);

  const filePath = skillFilePath(skillId);
  if (!existsSync(filePath)) return jsonResponse({ error: `Skill '${skillId}' not found` }, 404);

  unlinkSync(filePath);
  return jsonResponse({ success: true });
}
