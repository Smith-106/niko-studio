const fs = require('fs');
const path = require('path');

const repoRoot = 'C:/Users/niko/Desktop/工作目录/niko-studio';
const wfRoot = path.join(repoRoot, '.workflow');
const since = new Date('2026-05-01T00:00:00+08:00');
const now = new Date('2026-06-18T00:00:00+08:00');

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}
function daysBetween(a, b) {
  return Math.floor((b.getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}
function hex8() {
  return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
}

const findings = [];
const state = JSON.parse(fs.readFileSync(path.join(wfRoot, 'state.json'), 'utf8'));
const milestones = Object.fromEntries((state.milestones || []).map((m) => [m.id || m.name, m]));
const currentMilestone = state.current_milestone;
const artifactPaths = new Set((state.artifacts || []).map((a) => a.path?.replace(/^\.workflow\//, '')).filter(Boolean));
const harvestLog = readJsonl(path.join(wfRoot, 'harvest/harvest-log.jsonl'));
const harvestedSourceIds = new Set(harvestLog.map((r) => r.source_id));

// State artifacts since May 1
for (const art of state.artifacts || []) {
  const date = art.completed_at || art.created_at;
  if (!date || new Date(date) < since) continue;
  const age = daysBetween(date, now);
  const ms = milestones[art.milestone];
  if (ms && (ms.status === 'abandoned' || ms.status === 'superseded')) {
    findings.push({ id: `AUD-${hex8()}`, store: 'artifact', category: 'F', subtype: 'milestone-dead', priority: 'P0', target: { file: art.path || '', artifact_id: art.id }, evidence: `artifact ${art.id} 所属 milestone ${art.milestone} 状态为 ${ms.status}`, recommended_action: 'delete' });
    continue;
  }
  if (art.status === 'completed' && art.harvested === true && age > 7 && art.milestone !== currentMilestone) {
    findings.push({ id: `AUD-${hex8()}`, store: 'artifact', category: 'F', subtype: 'T1-stale-harvested', priority: 'P1', target: { file: art.path || '', artifact_id: art.id }, evidence: `已完成 ${age} 天、已 harvest、非当前 milestone`, recommended_action: 'delete' });
  }
  if (art.status === 'completed' && art.harvested !== true && age > 7 && art.milestone !== currentMilestone) {
    findings.push({ id: `AUD-${hex8()}`, store: 'artifact', category: 'F', subtype: 'T4-stale-unharvested', priority: 'P1', target: { file: art.path || '', artifact_id: art.id }, evidence: `已完成 ${age} 天、尚未 harvest、非当前 milestone`, recommended_action: 'keep' });
  }
}

// Orphan directories since May 1, older than 7 days
function listOldDirs(dir, thresholdDays) {
  const full = path.join(wfRoot, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .map((f) => ({ name: f, full: path.join(full, f), stat: fs.statSync(path.join(full, f)) }))
    .filter((x) => x.stat.isDirectory() && new Date(x.stat.mtime) >= since && daysBetween(x.stat.mtime, now) > thresholdDays)
    .map((x) => ({ rel: `${dir}/${x.name}`, full: x.full, mtime: x.stat.mtime }));
}
for (const o of [...listOldDirs('scratch', 7), ...listOldDirs('.maestro', 7)]) {
  if (artifactPaths.has(o.rel)) continue;
  const isHarvested = harvestedSourceIds.has(path.basename(o.rel));
  findings.push({
    id: `AUD-${hex8()}`,
    store: 'artifact',
    category: 'F',
    subtype: isHarvested ? 'T4-orphan-directory' : 'T4-orphan-unharvested',
    priority: isHarvested ? 'P2' : 'P1',
    target: { file: o.rel },
    evidence: isHarvested ? '磁盘目录存在但 state.json 无对应条目，且已有 harvest 记录' : '磁盘目录存在但 state.json 无对应条目，且无 harvest 记录',
    recommended_action: 'delete',
  });
}

findings.sort((a, b) => { const p = { P0: 0, P1: 1, P2: 2 }; return p[a.priority] - p[b.priority]; });

const counts = { P0: 0, P1: 0, P2: 0 };
for (const f of findings) counts[f.priority]++;

const reportDate = '2026-06-18';
const reportPath = path.join(wfRoot, `.knowledge-audit/audit-report-artifact-${reportDate}.md`);
let report = `# Knowledge Audit Report — artifact scope — ${reportDate}\n\n## Scope\n- Scope: artifact\n- Since: 2026-05-01\n\n## Detection Summary\n- Total findings: ${findings.length}\n- P0: ${counts.P0}, P1: ${counts.P1}, P2: ${counts.P2}\n\n## Findings\n\n| ID | Category | Priority | Target | Evidence | Recommended Action |\n|---|---|---|---|---|---|\n`;
for (const f of findings) {
  const target = f.target.artifact_id || f.target.file;
  report += `| ${f.id} | ${f.category}-${f.subtype} | ${f.priority} | ${target} | ${f.evidence} | ${f.recommended_action} |\n`;
}
report += `\n## Actions Applied\n_未执行任何变更。_\n\n## Backup\n_无变更，未生成备份。_\n`;
fs.writeFileSync(reportPath, report);

console.log(JSON.stringify({ findings: findings.length, P0: counts.P0, P1: counts.P1, P2: counts.P2, report: reportPath }));
