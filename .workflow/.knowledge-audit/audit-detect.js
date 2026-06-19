const fs = require('fs');
const path = require('path');

const repoRoot = 'C:/Users/niko/Desktop/工作目录/niko-studio';
const wfRoot = path.join(repoRoot, '.workflow');
const now = new Date('2026-06-18T00:00:00+08:00');

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function daysBetween(a, b) {
  return Math.floor((b.getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function existsRel(p) {
  return fs.existsSync(path.join(repoRoot, p.replace(/^\//, '')));
}

function hex8() {
  return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
}

const findings = [];

// Load state
const state = JSON.parse(fs.readFileSync(path.join(wfRoot, 'state.json'), 'utf8'));
const milestones = Object.fromEntries((state.milestones || []).map((m) => [m.id || m.name, m]));
const currentMilestone = state.current_milestone;
const artifactPaths = new Set();
const artifactPathToId = {};
for (const art of state.artifacts || []) {
  if (art.path) {
    const norm = art.path.replace(/^\.workflow\//, '');
    artifactPaths.add(norm);
    artifactPathToId[norm] = art.id;
  }
}

// Load harvest-log
const harvestLog = readJsonl(path.join(wfRoot, 'harvest/harvest-log.jsonl'));
const harvestedSourceIds = new Set(harvestLog.map((r) => r.source_id));

// Load specs
const specDir = path.join(wfRoot, 'specs');
const specFiles = fs.readdirSync(specDir).filter((f) => f.endsWith('.md'));
const specEntries = [];
for (const sf of specFiles) {
  const content = fs.readFileSync(path.join(specDir, sf), 'utf8');
  const re = /<spec-entry\b([^>]*)>([\s\S]*?)<\/spec-entry>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const titleMatch = attrs.match(/title="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : '';
    const dateMatch = attrs.match(/date="([^"]+)"/);
    const date = dateMatch ? dateMatch[1] : '';
    specEntries.push({ file: `specs/${sf}`, title, date, body, attrs });
  }
}

// C-ghost code references in specs
const pathRe = /\b(?:src|desktop|src-ts|server|components|pages|composables|stores|types|i18n|plugins|middleware|layouts|utils|assets|public|\.workflow)[\/\w.-]*\.(?:ts|tsx|vue|js|mjs|cjs|json|md)\b/g;
for (const entry of specEntries) {
  const refs = new Set((entry.body.match(pathRe) || []));
  for (const ref of refs) {
    if (!existsRel(ref)) {
      findings.push({
        id: `AUD-${hex8()}`,
        store: 'spec',
        category: 'C',
        subtype: 'ghost-code-ref',
        priority: 'P1',
        target: { file: entry.file, entry_id: entry.title },
        evidence: `引用不存在的路径 '${ref}'`,
        recommended_action: 'deprecate',
      });
    }
  }
}

// H: accumulated_context key_decisions duplicated in specs
const keyDecisions = state.accumulated_context?.key_decisions || [];
for (const kd of keyDecisions) {
  const text = String(kd).trim();
  if (!text) continue;
  for (const entry of specEntries) {
    if (entry.body.includes(text)) {
      findings.push({
        id: `AUD-${hex8()}`,
        store: 'spec',
        category: 'H',
        subtype: 'accumulated-context-duplicates-spec',
        priority: 'P2',
        target: { file: 'state.json', entry_id: text.slice(0, 60) },
        evidence: `state.json accumulated_context.key_decisions 与 ${entry.file} 的 spec-entry '${entry.title}' 文本重复`,
        recommended_action: 'delete',
      });
      break;
    }
  }
}

// Artifact staleness / orphan / milestone-dead
const ageThreshold = 30;
for (const art of state.artifacts || []) {
  if (art.status !== 'completed') continue;
  const date = art.completed_at || art.created_at;
  const age = daysBetween(date, now);
  const isHarvested = art.harvested === true;
  const ms = milestones[art.milestone];
  const msDead = ms && (ms.status === 'abandoned' || ms.status === 'superseded');

  if (msDead) {
    findings.push({
      id: `AUD-${hex8()}`,
      store: 'artifact',
      category: 'F',
      subtype: 'milestone-dead',
      priority: 'P0',
      target: { file: art.path || '', artifact_id: art.id },
      evidence: `artifact ${art.id} 所属 milestone ${art.milestone} 状态为 ${ms.status}`,
      recommended_action: 'delete',
    });
    continue;
  }

  if (isHarvested && age > ageThreshold && art.milestone !== currentMilestone) {
    findings.push({
      id: `AUD-${hex8()}`,
      store: 'artifact',
      category: 'F',
      subtype: 'T1-stale-harvested',
      priority: 'P1',
      target: { file: art.path || '', artifact_id: art.id },
      evidence: `已完成 ${age} 天、已 harvest、非当前 milestone`,
      recommended_action: 'delete',
    });
  } else if (!isHarvested && age > ageThreshold && art.milestone !== currentMilestone) {
    findings.push({
      id: `AUD-${hex8()}`,
      store: 'artifact',
      category: 'F',
      subtype: 'T4-stale-unharvested',
      priority: 'P1',
      target: { file: art.path || '', artifact_id: art.id },
      evidence: `已完成 ${age} 天、尚未 harvest、非当前 milestone`,
      recommended_action: 'keep',
    });
  }
}

// Orphan directories on disk
function listDirs(dir) {
  const full = path.join(wfRoot, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((f) => fs.statSync(path.join(full, f)).isDirectory());
}
const scratchDirs = listDirs('scratch').map((d) => `scratch/${d}`);
const maestroDirs = listDirs('.maestro').map((d) => `.maestro/${d}`);
for (const d of [...scratchDirs, ...maestroDirs]) {
  if (!artifactPaths.has(d)) {
    findings.push({
      id: `AUD-${hex8()}`,
      store: 'artifact',
      category: 'F',
      subtype: 'T4-orphan-directory',
      priority: 'P2',
      target: { file: d },
      evidence: `磁盘目录存在但 state.json artifacts[] 中无对应条目`,
      recommended_action: 'delete',
    });
  }
}

// Knowhow drift / empty
const knowhowDir = path.join(wfRoot, 'knowhow');
if (fs.existsSync(knowhowDir)) {
  const kf = fs.readdirSync(knowhowDir).filter((f) => f.endsWith('.md'));
  for (const f of kf) {
    const stat = fs.statSync(path.join(knowhowDir, f));
    const age = daysBetween(stat.mtime, now);
    if (age > 90) {
      findings.push({
        id: `AUD-${hex8()}`,
        store: 'knowhow',
        category: 'G',
        subtype: 'stale-knowhow',
        priority: 'P2',
        target: { file: `knowhow/${f}` },
        evidence: `knowhow 文件 ${age} 天未修改`,
        recommended_action: 'deprecate',
      });
    }
  }
}

// Sort findings
findings.sort((a, b) => {
  const pMap = { P0: 0, P1: 1, P2: 2 };
  return pMap[a.priority] - pMap[b.priority];
});

// Write report
const reportDate = '2026-06-18';
const reportPath = path.join(wfRoot, `.knowledge-audit/audit-report-${reportDate}.md`);
let report = `# Knowledge Audit Report — ${reportDate}\n\n## Scope\n- Scope: all\n- Filters: none\n\n## Detection Summary\n- Total findings: ${findings.length}\n`;
const counts = { P0: 0, P1: 0, P2: 0 };
const byStore = { spec: 0, knowhow: 0, artifact: 0 };
for (const f of findings) {
  counts[f.priority]++;
  byStore[f.store]++;
}
report += `- By priority: P0 ${counts.P0}, P1 ${counts.P1}, P2 ${counts.P2}\n`;
report += `- By store: spec ${byStore.spec}, knowhow ${byStore.knowhow}, artifact ${byStore.artifact}\n\n`;
report += `## Findings\n\n| ID | Store | Category | Priority | Target | Evidence | Recommended Action |\n|---|---|---|---|---|---|---|\n`;
for (const f of findings) {
  const target = f.target.artifact_id || f.target.entry_id || f.target.file || '';
  report += `| ${f.id} | ${f.store} | ${f.category}-${f.subtype} | ${f.priority} | ${target} | ${f.evidence} | ${f.recommended_action} |\n`;
}
report += `\n## Actions Applied\n_未执行任何变更。请在确认后使用 --mark / --delete / --purge 或手动处理。_\n\n## Backup\n_无变更，未生成备份。_\n\n## Next Steps\n- 应用决策：/manage-knowledge-audit --scope all（带 --mark / --delete / --purge）\n- 抢救未抽取 artifact：/manage-harvest <artifact-id>\n- 验证 spec 现状：/spec-load --role implement\n`;
fs.writeFileSync(reportPath, report);

console.log(JSON.stringify({ findings: findings.length, P0: counts.P0, P1: counts.P1, P2: counts.P2, report: reportPath }));
