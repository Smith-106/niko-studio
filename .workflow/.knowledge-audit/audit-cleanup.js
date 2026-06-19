const fs = require('fs');
const path = require('path');

const repoRoot = 'C:/Users/niko/Desktop/工作目录/niko-studio';
const wfRoot = path.join(repoRoot, '.workflow');
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '').slice(0, 15);
const trashDir = path.join(wfRoot, `.trash/knowledge-audit-${timestamp}`);

function daysBetween(a, b) {
  return Math.floor((b.getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function moveToTrash(src, relDest) {
  const dest = path.join(trashDir, relDest);
  ensureDir(path.dirname(dest));
  fs.renameSync(src, dest);
  return dest;
}

ensureDir(trashDir);

const statePath = path.join(wfRoot, 'state.json');
const stateBackupPath = path.join(trashDir, 'state.json.bak');
fs.copyFileSync(statePath, stateBackupPath);

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const today = new Date('2026-06-18T00:00:00+08:00');
const currentMilestone = state.current_milestone;
if (!state.artifact_archive) state.artifact_archive = [];

const applied = [];

// 1. Archive stale harvested artifacts
for (let i = state.artifacts.length - 1; i >= 0; i--) {
  const art = state.artifacts[i];
  if (art.status !== 'completed' || art.harvested !== true) continue;
  const date = art.completed_at || art.created_at;
  const age = daysBetween(date, today);
  if (age <= 30 || art.milestone === currentMilestone) continue;

  let dir = art.path || '';
  if (dir.startsWith('.workflow/')) dir = dir.slice('.workflow/'.length);
  const fullDir = path.join(wfRoot, dir);
  if (fs.existsSync(fullDir)) {
    moveToTrash(fullDir, dir);
  }
  state.artifact_archive.push({
    ...art,
    archived_at: now.toISOString(),
    reason: 'knowledge-audit stale harvested',
  });
  state.artifacts.splice(i, 1);
  applied.push({ action: 'archive', target: art.id, path: dir });
}

// 2. Delete orphan directories older than 30 days
function listOldDirs(dir, thresholdDays) {
  const full = path.join(wfRoot, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .map((f) => ({ name: f, full: path.join(full, f), stat: fs.statSync(path.join(full, f)) }))
    .filter((x) => x.stat.isDirectory() && daysBetween(x.stat.mtime, today) > thresholdDays)
    .map((x) => ({ rel: `${dir}/${x.name}`, full: x.full }));
}

const artifactPaths = new Set((state.artifacts || []).map((a) => a.path?.replace(/^\.workflow\//, '')).filter(Boolean));
const orphans = [...listOldDirs('scratch', 30), ...listOldDirs('.maestro', 30)]
  .filter((o) => !artifactPaths.has(o.rel));

for (const o of orphans) {
  moveToTrash(o.full, o.rel);
  applied.push({ action: 'delete', target: o.rel });
}

fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

// Update audit report
const reportPath = path.join(wfRoot, '.knowledge-audit', 'audit-report-2026-06-18.md');
if (fs.existsSync(reportPath)) {
  let report = fs.readFileSync(reportPath, 'utf8');
  const actionsTable = applied.map((a, i) => `| ${i + 1} | ${a.action} | ${a.target} | OK |`).join('\n');
  report = report.replace(
    '## Actions Applied\n_未执行任何变更。请在确认后使用 --mark / --delete / --purge 或手动处理。_',
    `## Actions Applied\n\n| # | Action | Target | Status |\n|---|---|---|---|\n${actionsTable}\n\n- Archived ${applied.filter((a) => a.action === 'archive').length} stale harvested artifacts\n- Deleted ${applied.filter((a) => a.action === 'delete').length} orphan directories\n`,
  );
  report = report.replace(
    '## Backup\n_无变更，未生成备份。_',
    `## Backup\n- Trash: ${trashDir}\n- State backup: ${stateBackupPath}\n`,
  );
  fs.writeFileSync(reportPath, report);
}

// Append audit-log.jsonl
const auditLogPath = path.join(wfRoot, '.knowledge-audit', 'audit-log.jsonl');
const auditEntries = applied.map((a) => ({
  audit_id: `AUD-${timestamp}`,
  finding_id: null,
  store: a.action === 'archive' ? 'artifact' : 'artifact',
  category: 'F',
  subtype: a.action === 'archive' ? 'T1-stale-harvested' : 'T4-orphan-directory',
  priority: a.action === 'archive' ? 'P1' : 'P2',
  target: { file: a.target },
  action: a.action,
  applied_at: now.toISOString(),
  backup_path: trashDir,
}));
fs.writeFileSync(auditLogPath, auditEntries.map((e) => JSON.stringify(e)).join('\n') + '\n', { flag: 'a' });

console.log(JSON.stringify({ archived: applied.filter((a) => a.action === 'archive').length, deleted: applied.filter((a) => a.action === 'delete').length, trash: trashDir }));
