const fs = require('fs');
const path = require('path');

const repoRoot = 'C:/Users/niko/Desktop/工作目录/niko-studio';
const wfRoot = path.join(repoRoot, '.workflow');
const now = new Date().toISOString();

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}
function writeJsonl(file, records) {
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''));
}
function daysBetween(a, b) {
  return Math.floor((b.getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}
function toSlug(id) {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function readFirstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p, 'utf8');
      } catch {}
    }
  }
  return null;
}
function extractText(dir) {
  const candidates = [
    path.join(dir, 'conclusions.json'),
    path.join(dir, 'plan.json'),
    path.join(dir, 'fix-plan.json'),
    path.join(dir, 'guidance-specification.md'),
    path.join(dir, 'plan-overview.md'),
    path.join(dir, 'debug-log.md'),
    path.join(dir, 'design-research.md'),
  ];
  const raw = readFirstExisting(candidates);
  if (!raw) {
    const mdFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
    if (mdFiles.length) return fs.readFileSync(path.join(dir, mdFiles[0]), 'utf8');
    return '';
  }
  if (raw.trim().startsWith('{')) {
    try {
      const obj = JSON.parse(raw);
      return obj.summary || obj.description || obj.task || obj.rationale || JSON.stringify(obj, null, 2).slice(0, 800);
    } catch {
      return raw;
    }
  }
  return raw;
}
function sanitizeTitle(t) {
  return t.replace(/[\n\r]+/g, ' ').trim().slice(0, 120);
}
function sanitizeBody(t) {
  return t.replace(/---[\s\S]*?---/g, '').trim().slice(0, 1200);
}

const state = JSON.parse(fs.readFileSync(path.join(wfRoot, 'state.json'), 'utf8'));
const today = new Date('2026-06-18T00:00:00+08:00');
const currentMilestone = state.current_milestone;

const staleArtifacts = (state.artifacts || []).filter((art) => {
  if (art.status !== 'completed' || art.harvested === true) return false;
  const date = art.completed_at || art.created_at;
  const age = daysBetween(date, today);
  return age > 30 && art.milestone !== currentMilestone && art.path;
});

let logs = readJsonl(path.join(wfRoot, 'harvest/harvest-log.jsonl'));
const harvestedSourceIds = new Set(logs.map((r) => r.source_id));
let created = 0;
let skipped = 0;

for (const art of staleArtifacts) {
  const sourceId = art.id;
  if (harvestedSourceIds.has(sourceId)) {
    skipped++;
    continue;
  }
  let dir = art.path;
  if (dir.startsWith('.workflow/')) dir = dir.slice('.workflow/'.length);
  const fullDir = path.join(wfRoot, dir);
  if (!fs.existsSync(fullDir)) {
    skipped++;
    continue;
  }
  const text = extractText(fullDir);
  const title = sanitizeTitle(art.description || `${art.type} ${art.id}`);
  const body = sanitizeBody(text) || title;
  const slug = `harvest-stale-${toSlug(art.id)}`;
  const tags = `harvest,stale,${art.type},${art.milestone || 'none'}`;
  const fm = `---\nslug: ${slug}\ntitle: ${title}\ntype: note\ntags: ${tags}\nsource: harvest\nsource_ref: ${sourceId}\ncreated_at: ${now}\n---\n\n${body}\n`;
  fs.writeFileSync(path.join(wfRoot, `harvest/wiki-pending-${slug}.md`), fm);
  logs.push({
    fragment_id: `HRV-${Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')}`,
    source_type: art.type,
    source_id: sourceId,
    routed_to: 'wiki',
    target_id: `pending:${slug}`,
    timestamp: now,
    title,
    confidence: 0.7,
  });
  art.harvested = true;
  created++;
}

writeJsonl(path.join(wfRoot, 'harvest/harvest-log.jsonl'), logs);
fs.writeFileSync(path.join(wfRoot, 'state.json'), JSON.stringify(state, null, 2) + '\n');

console.log(JSON.stringify({ staleArtifacts: staleArtifacts.length, created, skipped }));
