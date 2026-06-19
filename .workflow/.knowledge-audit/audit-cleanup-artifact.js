const fs = require('fs');
const path = require('path');

const repoRoot = 'C:/Users/niko/Desktop/工作目录/niko-studio';
const wfRoot = path.join(repoRoot, '.workflow');
const now = new Date();
const today = new Date('2026-06-18T00:00:00+08:00');
const since = new Date('2026-05-01T00:00:00+08:00');
const timestamp = now.toISOString().replace(/[:.]/g, '').slice(0, 15);
const trashDir = path.join(wfRoot, `.trash/knowledge-audit-${timestamp}`);

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
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function moveToTrash(src, relDest) {
  const normalized = path.normalize(src);
  if (normalized === path.normalize(wfRoot) || normalized.length <= wfRoot.length) {
    throw new Error(`Refusing to move protected path: ${src}`);
  }
  const dest = path.join(trashDir, relDest);
  ensureDir(path.dirname(dest));
  fs.renameSync(src, dest);
  return dest;
}
function toSlug(id) {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function readFirstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try { return fs.readFileSync(p, 'utf8'); } catch {}
    }
  }
  return '';
}
function extractSummary(dir) {
  const text = readFirstExisting([
    path.join(dir, 'conclusions.json'),
    path.join(dir, 'plan.json'),
    path.join(dir, 'fix-plan.json'),
    path.join(dir, 'guidance-specification.md'),
    path.join(dir, 'plan-overview.md'),
    path.join(dir, 'debug-log.md'),
  ]);
  if (!text) {
    const mdFiles = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
    if (mdFiles.length) return fs.readFileSync(path.join(dir, mdFiles[0]), 'utf8').slice(0, 800);
    return '';
  }
  if (text.trim().startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      return (obj.summary || obj.description || obj.task || obj.rationale || JSON.stringify(obj, null, 2)).slice(0, 800);
    } catch { return text.slice(0, 800); }
  }
  return text.slice(0, 800);
}

ensureDir(trashDir);

const statePath = path.join(wfRoot, 'state.json');
fs.copyFileSync(statePath, path.join(trashDir, 'state.json.bak'));
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
if (!state.artifact_archive) state.artifact_archive = [];
const currentMilestone = state.current_milestone;

const logs = readJsonl(path.join(wfRoot, 'harvest/harvest-log.jsonl'));
const harvestedSourceIds = new Set(logs.map((r) => r.source_id));
const artifactPaths = new Set((state.artifacts || []).map((a) => a.path?.replace(/^\.workflow\//, '')).filter(Boolean));

let harvestedCount = 0;
let archivedCount = 0;
let deletedCount = 0;
const applied = [];

// 1. Bulk harvest unharvested state artifacts
for (const art of state.artifacts || []) {
  if (art.status !== 'completed' || art.harvested === true) continue;
  const date = art.completed_at || art.created_at;
  if (!date || new Date(date) < since) continue;
  const age = daysBetween(date, today);
  if (age <= 7 || art.milestone === currentMilestone) continue;

  const sourceId = art.id;
  if (harvestedSourceIds.has(sourceId)) continue;

  let dir = art.path || '';
  if (dir.startsWith('.workflow/')) dir = dir.slice('.workflow/'.length);
  const fullDir = path.join(wfRoot, dir);
  const summary = extractSummary(fullDir);
  const title = (art.description || `${art.type} ${art.id}`).replace(/[\n\r]+/g, ' ').trim().slice(0, 120);
  const body = summary || title;
  const slug = `harvest-stale-${toSlug(art.id)}`;
  const tags = `harvest,stale,${art.type},${art.milestone || 'none'}`;
  const fm = `---\nslug: ${slug}\ntitle: ${title}\ntype: note\ntags: ${tags}\nsource: harvest\nsource_ref: ${sourceId}\ncreated_at: ${now.toISOString()}\n---\n\n${body}\n`;
  fs.writeFileSync(path.join(wfRoot, `harvest/wiki-pending-${slug}.md`), fm);
  logs.push({
    fragment_id: `HRV-${Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')}`,
    source_type: art.type,
    source_id: sourceId,
    routed_to: 'wiki',
    target_id: `pending:${slug}`,
    timestamp: now.toISOString(),
    title,
    confidence: 0.65,
  });
  art.harvested = true;
  harvestedCount++;
}

// 2. Bulk harvest unharvested orphan directories
function listOldDirs(dir, thresholdDays) {
  const full = path.join(wfRoot, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .map((f) => ({ name: f, full: path.join(full, f), stat: fs.statSync(path.join(full, f)) }))
    .filter((x) => x.stat.isDirectory() && new Date(x.stat.mtime) >= since && daysBetween(x.stat.mtime, today) > thresholdDays)
    .map((x) => ({ rel: `${dir}/${x.name}`, full: x.full }));
}

const orphanDirs = [...listOldDirs('scratch', 7), ...listOldDirs('.maestro', 7)]
  .filter((o) => !artifactPaths.has(o.rel));

for (const o of orphanDirs) {
  const sourceId = path.basename(o.rel);
  if (harvestedSourceIds.has(sourceId)) continue;
  const summary = extractSummary(o.full);
  const title = sourceId;
  const body = summary || title;
  const slug = `harvest-orphan-${toSlug(sourceId)}`;
  const tags = `harvest,orphan,${path.dirname(o.rel).replace(/\//g, ',')}`;
  const fm = `---\nslug: ${slug}\ntitle: ${title}\ntype: note\ntags: ${tags}\nsource: harvest\nsource_ref: ${sourceId}\ncreated_at: ${now.toISOString()}\n---\n\n${body}\n`;
  fs.writeFileSync(path.join(wfRoot, `harvest/wiki-pending-${slug}.md`), fm);
  logs.push({
    fragment_id: `HRV-${Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')}`,
    source_type: 'orphan',
    source_id: sourceId,
    routed_to: 'wiki',
    target_id: `pending:${slug}`,
    timestamp: now.toISOString(),
    title,
    confidence: 0.6,
  });
  harvestedSourceIds.add(sourceId);
  harvestedCount++;
}

writeJsonl(path.join(wfRoot, 'harvest/harvest-log.jsonl'), logs);

// 3. Archive stale harvested state artifacts
for (let i = state.artifacts.length - 1; i >= 0; i--) {
  const art = state.artifacts[i];
  if (art.status !== 'completed' || art.harvested !== true) continue;
  const date = art.completed_at || art.created_at;
  if (!date || new Date(date) < since) continue;
  const age = daysBetween(date, today);
  if (age <= 7 || art.milestone === currentMilestone) continue;

  let dir = art.path || '';
  if (dir.startsWith('.workflow/')) dir = dir.slice('.workflow/'.length);
  if (!dir || dir === '.' || dir === './') {
    state.artifact_archive.push({ ...art, archived_at: now.toISOString(), reason: 'knowledge-audit artifact scope since 2026-05-01 (no dir)' });
    state.artifacts.splice(i, 1);
    archivedCount++;
    applied.push({ action: 'archive', target: art.id });
    continue;
  }
  const fullDir = path.join(wfRoot, dir);
  if (fs.existsSync(fullDir)) moveToTrash(fullDir, dir);
  state.artifact_archive.push({ ...art, archived_at: now.toISOString(), reason: 'knowledge-audit artifact scope since 2026-05-01' });
  state.artifacts.splice(i, 1);
  archivedCount++;
  applied.push({ action: 'archive', target: art.id });
}

// 4. Delete orphan directories (now all have harvest records or were already harvested)
const orphanDirsNow = [...listOldDirs('scratch', 7), ...listOldDirs('.maestro', 7)]
  .filter((o) => !artifactPaths.has(o.rel));
for (const o of orphanDirsNow) {
  if (!o.rel || o.full === wfRoot || path.normalize(o.full) === path.normalize(wfRoot)) continue;
  const sourceId = path.basename(o.rel);
  if (fs.existsSync(o.full)) {
    moveToTrash(o.full, o.rel);
    deletedCount++;
    applied.push({ action: 'delete', target: o.rel });
  }
}

fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

// Update report
const reportPath = path.join(wfRoot, '.knowledge-audit', 'audit-report-artifact-2026-06-18.md');
if (fs.existsSync(reportPath)) {
  let report = fs.readFileSync(reportPath, 'utf8');
  const actionsTable = applied.map((a, i) => `| ${i + 1} | ${a.action} | ${a.target} | OK |`).join('\n');
  report = report.replace(
    '## Actions Applied\n_未执行任何变更。_',
    `## Actions Applied\n\n| # | Action | Target | Status |\n|---|---|---|---|\n${actionsTable}\n\n- Harvested ${harvestedCount} stale/orphan artifacts into wiki pending\n- Archived ${archivedCount} stale harvested state artifacts\n- Deleted ${deletedCount} orphan directories\n`,
  );
  report = report.replace(
    '## Backup\n_无变更，未生成备份。_',
    `## Backup\n- Trash: ${trashDir}\n- State backup: ${path.join(trashDir, 'state.json.bak')}\n`,
  );
  fs.writeFileSync(reportPath, report);
}

// Audit log
const auditLogPath = path.join(wfRoot, '.knowledge-audit', 'audit-log.jsonl');
const auditEntries = applied.map((a) => ({
  audit_id: `AUD-${timestamp}`,
  finding_id: null,
  store: 'artifact',
  category: 'F',
  subtype: a.action === 'archive' ? 'T1-stale-harvested' : 'T4-orphan-directory',
  priority: a.action === 'archive' ? 'P1' : 'P2',
  target: { file: a.target },
  action: a.action,
  applied_at: now.toISOString(),
  backup_path: trashDir,
}));
fs.writeFileSync(auditLogPath, auditEntries.map((e) => JSON.stringify(e)).join('\n') + '\n', { flag: 'a' });

console.log(JSON.stringify({ harvested: harvestedCount, archived: archivedCount, deleted: deletedCount, trash: trashDir }));
