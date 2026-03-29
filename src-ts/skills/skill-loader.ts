/**
 * Skill Loader - Static knowledge file reader
 *
 * Reads Markdown skill files from a configurable set of directories,
 * parses YAML frontmatter, and supports @skill:name references.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

// ============================================================
// Data Classes
// ============================================================

export interface SkillMeta {
  name: string;
  description: string;
  tags: string[];
  triggers: string[];
}

export interface Skill {
  name: string;
  meta: SkillMeta;
  content: string;
  path: string;
  techniques: string[];
}

// ============================================================
// Skill Loader
// ============================================================

export class SkillLoader {
  private _skillPaths: string[];
  private _cache: Map<string, Skill> = new Map();
  private _allSkills: Skill[] | null = null;

  constructor(basePath?: string) {
    const envDir = (process.env['NIKO_SKILLS_DIR'] ?? '').trim();
    this._skillPaths = [];

    // Environment override (highest priority)
    if (envDir) this._skillPaths.push(envDir);

    // Default priority paths
    this._skillPaths.push(
      '.niko/skills',         // project level
      join(homedir(), '.niko/skills'), // user level
      'skills',               // built-in
    );

    // If basePath provided, insert after env override
    if (basePath) {
      const idx = envDir ? 1 : 0;
      this._skillPaths.splice(idx, 0, join(basePath, 'skills'));
    }
  }

  // ============================================================
  // Core Methods
  // ============================================================

  load(skillName: string): string {
    return this._getSkill(skillName).content;
  }

  loadFull(skillName: string): Skill {
    return this._getSkill(skillName);
  }

  loadSkill(skillName: string): Record<string, unknown> {
    const skill = this._getSkill(skillName);
    return {
      name: skill.name,
      content: skill.content,
      metadata: {
        description: skill.meta.description,
        tags: skill.meta.tags,
        triggers: skill.meta.triggers,
        path: skill.path,
        techniques: skill.techniques,
      },
      techniques: skill.techniques,
    };
  }

  loadTechnique(skillName: string, technique: string): string {
    const techniqueName = technique.endsWith('.md') ? technique : `${technique}.md`;
    for (const basePath of this._skillPaths) {
      const techniquePath = join(basePath, skillName, 'techniques', techniqueName);
      if (existsSync(techniquePath)) {
        return readFileSync(techniquePath, 'utf-8');
      }
    }
    throw new Error(`Technique '${technique}' not found for skill '${skillName}'`);
  }

  loadTemplate(skillName: string, template: string): string {
    const templateName = template.endsWith('.md') ? template : `${template}.md`;
    for (const basePath of this._skillPaths) {
      const templatePath = join(basePath, skillName, 'templates', templateName);
      if (existsSync(templatePath)) {
        return readFileSync(templatePath, 'utf-8');
      }
    }
    throw new Error(`Template '${template}' not found for skill '${skillName}'`);
  }

  getTechnique(skillName: string, technique: string): string | null {
    const content = this.load(skillName);
    const pattern = new RegExp(`^(#{2,3})\\s+${escapeRegex(technique)}.*?\\n(.*?)(?=^#{2,3}\\s|\\Z)`, 'gms');
    const match = pattern.exec(content);
    return match ? match[2].trim() : null;
  }

  listSkills(): string[] {
    return this._discoverAll().map(s => s.name);
  }

  getSummary(): string {
    const skills = this._discoverAll();
    const lines = ['Available skills:', ''];

    for (const skill of skills) {
      const tagsStr = skill.meta.tags.length > 0
        ? ` [${skill.meta.tags.slice(0, 3).join(', ')}]`
        : '';
      lines.push(`- **${skill.name}**${tagsStr}: ${skill.meta.description}`);
    }

    lines.push('');
    lines.push('Usage: @skill:skill-name');
    return lines.join('\n');
  }

  getSummaryDict(): Record<string, unknown>[] {
    return this._discoverAll().map(s => ({
      name: s.name,
      description: s.meta.description,
      tags: s.meta.tags,
      triggers: s.meta.triggers,
      techniques: s.techniques.slice(0, 5),
    }));
  }

  // ============================================================
  // @skill Reference Resolution
  // ============================================================

  resolveRefs(text: string): string {
    return text.replace(/@skill:([a-zA-Z0-9_-]+)/g, (_match, skillName: string) => {
      try {
        let content = this.load(skillName);
        if (content.length > 4000) {
          content = content.slice(0, 4000) + '\n... (truncated)';
        }
        return `\n[Skill: ${skillName}]\n${content}\n[/Skill]\n`;
      } catch {
        return `[Skill ${skillName} not found]`;
      }
    });
  }

  extractRefs(text: string): string[] {
    const pattern = /@skill:([a-zA-Z0-9_-]+)/g;
    const refs: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      refs.push(match[1]);
    }
    return refs;
  }

  clearCache(): void {
    this._cache.clear();
    this._allSkills = null;
  }

  // ============================================================
  // Internal Methods
  // ============================================================

  private _getSkill(skillName: string): Skill {
    const cached = this._cache.get(skillName);
    if (cached) return cached;

    for (const basePath of this._skillPaths) {
      const skillFile = join(basePath, skillName, 'SKILL.md');
      if (existsSync(skillFile)) {
        const skill = this._parseSkillFile(skillFile, skillName);
        this._cache.set(skillName, skill);
        return skill;
      }
    }

    throw new Error(`Skill '${skillName}' not found in any path`);
  }

  private _discoverAll(): Skill[] {
    if (this._allSkills) return this._allSkills;

    const discovered = new Map<string, Skill>();

    for (const basePath of this._skillPaths) {
      if (!existsSync(basePath)) continue;
      let entries: string[];
      try { entries = readdirSync(basePath); } catch { continue; }

      for (const entry of entries) {
        const skillDir = join(basePath, entry);
        try {
          if (!statSync(skillDir).isDirectory()) continue;
        } catch { continue; }

        const skillFile = join(skillDir, 'SKILL.md');
        if (!existsSync(skillFile)) continue;

        const skill = this._parseSkillFile(skillFile, entry);
        discovered.set(skill.name, skill);
        this._cache.set(skill.name, skill);
      }
    }

    this._allSkills = [...discovered.values()];
    return this._allSkills;
  }

  private _parseSkillFile(path: string, name: string): Skill {
    const content = readFileSync(path, 'utf-8');
    const meta = this._parseFrontmatter(content);
    const techniques = this._extractTechniques(content);

    if (!meta.description) {
      const firstPara = content.match(/^#.*?\n\n(.+?)(?:\n\n|\n#)/s);
      if (firstPara) meta.description = firstPara[1].trim().slice(0, 150);
    }

    meta.name = name;

    return { name, meta, content, path, techniques };
  }

  private _parseFrontmatter(content: string): SkillMeta {
    const meta: SkillMeta = { name: '', description: '', tags: [], triggers: [] };
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!match) return meta;

    const frontmatter = match[1];
    for (const line of frontmatter.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) continue;

      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();

      if (key === 'description') {
        meta.description = value.replace(/^["']|["']$/g, '');
      } else if (key === 'tags') {
        const tagsMatch = value.match(/\[(.*?)\]/);
        if (tagsMatch) meta.tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''));
      } else if (key === 'triggers') {
        const triggersMatch = value.match(/\[(.*?)\]/);
        if (triggersMatch) meta.triggers = triggersMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''));
      }
    }

    return meta;
  }

  private _extractTechniques(content: string): string[] {
    const matches = content.match(/^#{2,3}\s+(.+)$/gm);
    return (matches ?? [])
      .map(m => m.replace(/^#{2,3}\s+/, '').trim())
      .filter(t => !t.startsWith('---'));
  }
}

// ============================================================
// Convenience Functions
// ============================================================

let _defaultLoader: SkillLoader | null = null;

export function getLoader(basePath?: string): SkillLoader {
  if (!_defaultLoader) _defaultLoader = new SkillLoader(basePath);
  return _defaultLoader;
}

export function loadSkillContent(skillName: string): string {
  return getLoader().load(skillName);
}

export function listSkills(): string[] {
  return getLoader().listSkills();
}

export function getSkillSummary(): string {
  return getLoader().getSummary();
}

export function resolveSkillRefs(text: string): string {
  return getLoader().resolveRefs(text);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
