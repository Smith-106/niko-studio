const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = 'C:/Users/niko/Desktop/工作目录/niko-studio';
const wfRoot = path.join(repoRoot, '.workflow');
const now = new Date('2026-06-18T00:00:00+08:00');
const reportDate = '2026-06-18';

function hex8() {
  return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
}
function hashId(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);
}

const findings = [];

const categoryToFile = {
  coding: 'coding-conventions.md',
  arch: 'architecture-constraints.md',
  quality: 'quality-rules.md',
  debug: 'debug-notes.md',
  test: 'test-conventions.md',
  review: 'review-standards.md',
  learning: 'learnings.md',
  ui: 'ui-conventions.md',
};
const fileToCategory = Object.fromEntries(Object.entries(categoryToFile).map(([k, v]) => [v, k]));

const specDir = path.join(wfRoot, 'specs');
const specFiles = fs.readdirSync(specDir).filter((f) => f.endsWith('.md'));
const entries = [];
for (const sf of specFiles) {
  const content = fs.readFileSync(path.join(specDir, sf), 'utf8');
  const re = /<spec-entry\b([^>]*)>([\s\S]*?)<\/spec-entry>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const parseAttr = (name) => {
      const match = attrs.match(new RegExp(`${name}="([^"]*)"`));
      return match ? match[1] : '';
    };
    const id = parseAttr('id') || hashId(`${sf}:${parseAttr('title')}:${parseAttr('date')}`);
    entries.push({
      file: `specs/${sf}`,
      fileName: sf,
      id,
      category: parseAttr('category'),
      keywords: parseAttr('keywords').split(',').filter(Boolean),
      date: parseAttr('date'),
      title: parseAttr('title'),
      status: parseAttr('status'),
      supersedes: parseAttr('supersedes'),
      body,
    });
  }
}
const idMap = new Map(entries.map((e) => [e.id, e]));

// D: category mismatch
for (const e of entries) {
  const expected = fileToCategory[e.fileName];
  if (expected && e.category !== expected) {
    findings.push({
      id: `AUD-${hex8()}`,
      store: 'spec',
      category: 'D',
      subtype: 'category-mismatch',
      priority: 'P2',
      target: { file: e.file, line: null, entry_id: e.id },
      evidence: `文件 ${e.fileName} 期望 category="${expected}"，但条目 category="${e.category}"`,
      recommended_action: 'deprecate',
    });
  }
}

// D: empty keywords
for (const e of entries) {
  if (e.keywords.length === 0) {
    findings.push({
      id: `AUD-${hex8()}`,
      store: 'spec',
      category: 'D',
      subtype: 'empty-keywords',
      priority: 'P2',
      target: { file: e.file, entry_id: e.id },
      evidence: `条目缺少 keywords`,
      recommended_action: 'keep',
    });
  }
}

// D: dangling supersedes
for (const e of entries) {
  if (e.supersedes && !idMap.has(e.supersedes)) {
    findings.push({
      id: `AUD-${hex8()}`,
      store: 'spec',
      category: 'D',
      subtype: 'dangling-supersedes',
      priority: 'P0',
      target: { file: e.file, entry_id: e.id },
      evidence: `supersedes="${e.supersedes}" 不存在`,
      recommended_action: 'deprecate',
    });
  }
}

// D: cyclic supersedes
for (const e of entries) {
  if (!e.supersedes) continue;
  const visited = new Set();
  let cur = e.id;
  while (cur) {
    if (visited.has(cur)) {
      findings.push({
        id: `AUD-${hex8()}`,
        store: 'spec',
        category: 'D',
        subtype: 'cyclic-supersedes',
        priority: 'P0',
        target: { file: e.file, entry_id: e.id },
        evidence: `supersedes 链存在循环`,
        recommended_action: 'deprecate',
      });
      break;
    }
    visited.add(cur);
    cur = idMap.get(cur)?.supersedes;
  }
}

// D: status inversion (active references deprecated by content? skip)

// C: ghost code refs
const pathRe = /\b(?:src|desktop|src-ts|server|components|pages|composables|stores|types|i18n|plugins|middleware|layouts|utils|assets|public)[\/\w.-]*\.(?:ts|tsx|vue|js|mjs|cjs|json|md)\b/g;
for (const e of entries) {
  const refs = new Set((e.body.match(pathRe) || []));
  for (const ref of refs) {
    if (!fs.existsSync(path.join(repoRoot, ref.replace(/^\//, '')))) {
      findings.push({
        id: `AUD-${hex8()}`,
        store: 'spec',
        category: 'C',
        subtype: 'ghost-code-ref',
        priority: 'P1',
        target: { file: e.file, entry_id: e.id },
        evidence: `引用不存在的路径 '${ref}'`,
        recommended_action: 'deprecate',
      });
    }
  }
}

// A: threshold conflicts
const thresholdRe = /(?:>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:>=|<=|>|<|=)/g;
const thresholdGroups = {};
for (const e of entries) {
  const matches = [...e.body.matchAll(thresholdRe)];
  if (!matches.length) continue;
  const key = `${e.fileName}:${e.category}`;
  if (!thresholdGroups[key]) thresholdGroups[key] = [];
  for (const m of matches) {
    thresholdGroups[key].push({ entry: e, value: parseFloat(m[1] || m[2]), raw: m[0] });
  }
}
for (const [key, vals] of Object.entries(thresholdGroups)) {
  for (let i = 0; i < vals.length; i++) {
    for (let j = i + 1; j < vals.length; j++) {
      const a = vals[i], b = vals[j];
      if (Math.abs(a.value - b.value) > 0.01 && a.entry.title !== b.entry.title) {
        findings.push({
          id: `AUD-${hex8()}`,
          store: 'spec',
          category: 'A',
          subtype: 'threshold-conflict',
          priority: 'P1',
          target: { file: a.entry.file, entry_id: a.entry.id },
          evidence: `阈值冲突：${a.raw} vs ${b.raw}（${b.entry.title}）`,
          recommended_action: 'deprecate',
        });
      }
    }
  }
}

// D: duplicate titles within same file
const titleMap = new Map();
for (const e of entries) {
  if (!e.title) continue;
  const key = `${e.fileName}:${e.title}`;
  if (titleMap.has(key)) {
    findings.push({
      id: `AUD-${hex8()}`,
      store: 'spec',
      category: 'D',
      subtype: 'duplicate-title',
      priority: 'P2',
      target: { file: e.file, entry_id: e.id },
      evidence: `标题 "${e.title}" 在 ${e.fileName} 中重复`,
      recommended_action: 'deprecate',
    });
  }
  titleMap.set(key, true);
}

findings.sort((a, b) => {
  const pMap = { P0: 0, P1: 1, P2: 2 };
  return pMap[a.priority] - pMap[b.priority];
});

const counts = { P0: 0, P1: 0, P2: 0 };
for (const f of findings) counts[f.priority]++;

const reportPath = path.join(wfRoot, `.knowledge-audit/audit-report-spec-${reportDate}.md`);
let report = `# Knowledge Audit Report — spec scope — ${reportDate}\n\n## Scope\n- Scope: spec\n- Filters: none\n\n## Detection Summary\n- Total findings: ${findings.length}\n- P0: ${counts.P0}, P1: ${counts.P1}, P2: ${counts.P2}\n\n## Findings\n\n| ID | Category | Priority | Target | Evidence | Recommended Action |\n|---|---|---|---|---|---|\n`;
for (const f of findings) {
  const target = f.target.entry_id || f.target.file;
  report += `| ${f.id} | ${f.category}-${f.subtype} | ${f.priority} | ${target} | ${f.evidence} | ${f.recommended_action} |\n`;
}
report += `\n## Actions Applied\n_未执行任何变更。_\n\n## Backup\n_无变更，未生成备份。_\n`;
fs.writeFileSync(reportPath, report);

console.log(JSON.stringify({ findings: findings.length, P0: counts.P0, P1: counts.P1, P2: counts.P2, report: reportPath }));
