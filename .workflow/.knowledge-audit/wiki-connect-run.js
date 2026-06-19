const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = 'C:/Users/niko/Desktop/工作目录/niko-studio';
const wfRoot = path.join(repoRoot, '.workflow');
const auditDir = path.join(wfRoot, '.knowledge-audit');
const now = new Date();

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(auditDir, name), 'utf8'));
}

const list = loadJson('wiki-list.json');
const graph = loadJson('wiki-graph.json');
const orphansJson = loadJson('wiki-orphans.json');
const health = loadJson('wiki-health.json');
const hubs = loadJson('wiki-hubs.json');

const entries = list.entries || [];
const entryMap = new Map(entries.map((e) => [e.id, e]));
const forward = graph.forwardLinks || {};
const backlinks = graph.backlinks || {};
const orphanIds = (orphansJson.orphans || []).map((o) => (typeof o === 'string' ? o : o.id));
const hubList = hubs.hubs || [];

function tagOverlap(a, b) {
  if (!a.tags || !b.tags || a.tags.length === 0 || b.tags.length === 0) return 0;
  const shared = a.tags.filter((t) => b.tags.includes(t)).length;
  return shared / Math.max(a.tags.length, b.tags.length);
}
function titleOverlap(a, b) {
  const aw = a.title.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const bw = b.title.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  if (!aw.length || !bw.length) return 0;
  const shared = aw.filter((w) => bw.includes(w)).length;
  return shared / Math.max(aw.length, bw.length);
}
function alreadyLinked(aid, bid) {
  const rel = entryMap.get(aid)?.related || [];
  return rel.includes(bid);
}

const suggestions = [];

// 2a Orphan rescue
for (const oid of orphanIds) {
  const o = entryMap.get(oid);
  if (!o) continue;
  const candidates = [];
  for (const e of entries) {
    if (e.id === oid) continue;
    const to = tagOverlap(o, e);
    const ti = titleOverlap(o, e);
    const catBonus = (o.category && e.category && o.category === e.category) ? 1 : 0;
    const typeBridge = o.type !== e.type ? 0.2 : 0;
    const score = 0.4 * to + 0.3 * ti + 0.2 * catBonus + 0.1 * typeBridge + (to > 0 ? 0.1 : 0);
    if (score >= 0.3) candidates.push({ source: oid, target: e.id, score, reason: `orphan rescue (${e.type})` });
  }
  candidates.sort((a, b) => b.score - a.score);
  suggestions.push(...candidates.slice(0, 2));
}

// 2b Missing bidirectional links
for (const [aid, targets] of Object.entries(forward)) {
  for (const bid of targets) {
    if (!alreadyLinked(bid, aid)) {
      const a = entryMap.get(aid);
      const b = entryMap.get(bid);
      const to = a && b ? tagOverlap(a, b) : 0;
      suggestions.push({ source: bid, target: aid, score: 0.5 + 0.4 * to, reason: 'reverse link' });
    }
  }
}

// 2c Transitive closure
for (const [aid, targets] of Object.entries(forward)) {
  for (const bid of targets) {
    const bTargets = forward[bid] || [];
    for (const cid of bTargets) {
      if (cid === aid || alreadyLinked(aid, cid)) continue;
      const a = entryMap.get(aid);
      const c = entryMap.get(cid);
      const to = a && c ? tagOverlap(a, c) : 0;
      if (to > 0) suggestions.push({ source: aid, target: cid, score: 0.4 + 0.4 * to, reason: 'transitive closure' });
    }
  }
}

// 2d Type bridge via tag overlap
for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const a = entries[i];
    const b = entries[j];
    if (a.type === b.type) continue;
    if (alreadyLinked(a.id, b.id) || alreadyLinked(b.id, a.id)) continue;
    const to = tagOverlap(a, b);
    if (to >= 0.5) {
      const score = 0.5 + 0.4 * to;
      suggestions.push({ source: a.id, target: b.id, score, reason: 'type bridge' });
    }
  }
}

// Deduplicate and rank
const seen = new Set();
const ranked = [];
for (const s of suggestions) {
  const key = `${s.source}->${s.target}`;
  if (seen.has(key)) continue;
  seen.add(key);
  ranked.push(s);
}
ranked.sort((a, b) => b.score - a.score);
const top = ranked.slice(0, 20);

// Apply updates
const updates = new Map();
for (const s of top) {
  if (!updates.has(s.source)) updates.set(s.source, new Set(entryMap.get(s.source)?.related || []));
  updates.get(s.source).add(s.target);
}

let applied = 0;
for (const [id, relatedSet] of updates) {
  const related = Array.from(relatedSet);
  if (related.length === (entryMap.get(id)?.related || []).length) continue;
  try {
    const fm = JSON.stringify({ related });
    execSync(`maestro wiki update '${id}' --frontmatter '${fm}'`, { cwd: repoRoot, stdio: 'ignore', shell: 'bash' });
    applied++;
  } catch (err) {
    console.error(`Failed to update ${id}: ${err.message}`);
  }
}

// Re-health
const newHealth = JSON.parse(execSync('maestro wiki health --json', { cwd: repoRoot, encoding: 'utf8' }));

// Report
const reportDate = now.toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
const reportPath = path.join(wfRoot, 'knowhow', `KNW-wiki-connections-${reportDate}.md`);
ensureDir(path.dirname(reportPath));
let report = `# Wiki Connections — ${reportDate}\n\n## Baseline\n\n`;
report += `- Health: ${health.score ?? health.health ?? 'N/A'}\n`;
report += `- Orphans: ${orphanIds.length}\n`;
report += `- Broken links: ${(graph.brokenLinks || []).length}\n\n`;
report += `## Suggestions (${top.length})\n\n| # | Score | Source | Target | Reason |\n|---|---|---|---|---|\n`;
for (let i = 0; i < top.length; i++) {
  const s = top[i];
  report += `| ${i + 1} | ${s.score.toFixed(2)} | ${s.source} | ${s.target} | ${s.reason} |\n`;
}
report += `\n## Applied\n- Updated entries: ${applied}\n- New health: ${newHealth.score ?? newHealth.health ?? 'N/A'}\n\n`;
report += `## Hubs\n${hubList.slice(0, 5).map((h) => `- ${h.id || h.entryId}: in-degree ${h.inDegree || h.in_degree || '?'}\n`).join('')}\n`;
fs.writeFileSync(reportPath, report);

console.log(JSON.stringify({ suggestions: top.length, applied, baselineHealth: health.score ?? health.health, newHealth: newHealth.score ?? newHealth.health, report: reportPath }));

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
