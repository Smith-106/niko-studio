import json, hashlib, datetime, os, re

BASE = os.path.join("C:", os.sep, "Users", "niko", "Desktop", "工作目录", "niko-studio", ".workflow")
now_iso = datetime.datetime.now().isoformat()
date_str = "2026-06-21"

# ============================================================
# Stage 6: Route outputs
# ============================================================

fragments = []

# From lite-plan (analysis-parallel-fix-2026-04-22)
fragments.append({
    "id": "HRV-" + hashlib.md5(b"recovery-parallel-strategy").hexdigest()[:8],
    "source_type": "lite-plan",
    "source_id": "analysis-parallel-fix-2026-04-22",
    "title": "Recovery parallel fix strategy",
    "category": "decision",
    "content": "WS1 (workspace-scoped mutex) + WS2 (quickRollback atomicity) can be implemented in parallel; WS3 (test matrix) depends on both for behavioral stability. Lock domain limited to git-mutating critical sections only to avoid throughput regression.",
    "tags": ["recovery", "parallel", "mutex", "atomicity"],
    "routed_to": "spec",
    "spec_type": "arch",
    "target_file": "architecture-constraints.md",
    "confidence": 0.8,
})

fragments.append({
    "id": "HRV-" + hashlib.md5(b"recovery-risk-mitigations").hexdigest()[:8],
    "source_type": "lite-plan",
    "source_id": "analysis-parallel-fix-2026-04-22",
    "title": "Recovery risk mitigations (lock scope / failure-path / flaky test)",
    "category": "pattern",
    "content": "R1: Lock domain limited to git-mutating critical sections to avoid throughput regression. R2: Failure-path semantics must preserve existing UI response contracts with explicit failure reason assertions. R3: New concurrent tests must use deterministic temp workspaces and strict teardown to avoid flakiness.",
    "tags": ["recovery", "risk", "mitigation", "test"],
    "routed_to": "spec",
    "spec_type": "debug",
    "target_file": "debug-notes.md",
    "confidence": 0.7,
})

fragments.append({
    "id": "HRV-" + hashlib.md5(b"recovery-completed-patterns").hexdigest()[:8],
    "source_type": "lite-plan",
    "source_id": "analysis-parallel-fix-2026-04-22",
    "title": "Recovery chain completed patterns (mutex/atomicity/test-matrix)",
    "category": "pattern",
    "content": "WS1: workspace-scoped async mutex serializes concurrent restore/rollback per workspace (commit 676fca89). WS2: quickRollback persistence only after successful restore, failure branch preserves consistency. WS3: expanded recovery test matrix with concurrency and failure injection.",
    "tags": ["recovery", "completed", "mutex", "atomicity"],
    "routed_to": "spec",
    "spec_type": "learning",
    "target_file": "learnings.md",
    "confidence": 0.7,
})

# From ISS-002/ISS-010 fix session
fragments.append({
    "id": "HRV-" + hashlib.md5(b"foreshadow-state-status-alignment").hexdigest()[:8],
    "source_type": "session",
    "source_id": "iss-002-iss-010-fix-session",
    "title": "Foreshadow state/status key alignment pattern",
    "category": "pattern",
    "content": "Foreshadow data model uses 'state' everywhere (Foreshadow interface, database $.state, foreshadowPlant writes state). API endpoint, service, and engine must all use consistent key name 'state' not 'status'. Mismatch causes query failures as the SQL json_extract uses $.state. ISS-20260618-002 fix: graphForeshadowsEndpoint body.status -> body.state, graphGetForeshadows parameter status -> state, graph-engine getForeshadows parameter status -> state.",
    "tags": ["consistency", "foreshadow", "api-key", "state"],
    "routed_to": "spec",
    "spec_type": "coding",
    "target_file": "coding-conventions.md",
    "confidence": 0.9,
})

fragments.append({
    "id": "HRV-" + hashlib.md5(b"character-profile-nested-flat-fallback").hexdigest()[:8],
    "source_type": "session",
    "source_id": "iss-002-iss-010-fix-session",
    "title": "Endpoint nested/flat dual fallback pattern",
    "category": "pattern",
    "content": "GraphEngine.getCharacter returns attributes nested in properties (data.properties.role), but some callers provide flat shapes (data.role). Endpoint must read props.xxx ?? data.xxx to handle both shapes. ISS-20260618-002 fix: characterProfileEndpoint reads props.role ?? data.role, with similar fallbacks for personality/background/motivation/relationships/growth/five_dimension_score.",
    "tags": ["consistency", "endpoint", "fallback", "nested-properties"],
    "routed_to": "spec",
    "spec_type": "coding",
    "target_file": "coding-conventions.md",
    "confidence": 0.9,
})

fragments.append({
    "id": "HRV-" + hashlib.md5(b"foreshadow-plant-planted-at-semantics").hexdigest()[:8],
    "source_type": "session",
    "source_id": "iss-002-iss-010-fix-session",
    "title": "foreshadowPlant planted_at/planted_time/scene_id semantic separation",
    "category": "pattern",
    "content": "foreshadowToDict/foreshadowFromDict contract: planted_at = scene identifier (where), planted_time = timestamp (when). foreshadowPlantEndpoint must store scene_id in planted_at (not timestamp), separate planted_time as ISO timestamp, and include scene_id in response. ISS-20260618-002 fix: planted_at=scene_id, planted_time=new Date().toISOString(), response adds scene_id field.",
    "tags": ["foreshadow", "endpoint", "semantics", "api-shape"],
    "routed_to": "spec",
    "spec_type": "coding",
    "target_file": "coding-conventions.md",
    "confidence": 0.9,
})

fragments.append({
    "id": "HRV-" + hashlib.md5(b"ai-templates-single-source-dedup").hexdigest()[:8],
    "source_type": "session",
    "source_id": "iss-002-iss-010-fix-session",
    "title": "AI template words shared module + Set dedup guard",
    "category": "pattern",
    "content": "When two independent modules share domain constants, extract a shared module (src-ts/reader/ai-templates.ts) exporting detection and replacement derived arrays. Add Set-based dedup guard: assertNoDuplicates() throws on duplicate label at module load time. ISS-20260621-010 fix: 52->38 Chinese entries (dedup 14), 41->41 English entries (add 16 missing replacements), detector/revision-service both import from shared module.",
    "tags": ["duplication", "single-source-of-truth", "ai-templates", "dedup"],
    "routed_to": "spec",
    "spec_type": "coding",
    "target_file": "coding-conventions.md",
    "confidence": 0.9,
})

# ============================================================
# Stage 7: Dedup check against harvest-log.jsonl
# ============================================================
harvested_titles = set()
log_path = os.path.join(BASE, "harvest", "harvest-log.jsonl")
if os.path.exists(log_path):
    with open(log_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                harvested_titles.add(entry.get("title", ""))
            except Exception:
                pass

skipped_dup = 0
filtered_fragments = []
for frag in fragments:
    if frag["title"] in harvested_titles:
        skipped_dup += 1
        print(f"[SKIP-DUP] {frag['title']}")
    else:
        filtered_fragments.append(frag)

print(f"\nDedup: {len(fragments)} total, {skipped_dup} skipped, {len(filtered_fragments)} to route")

# ============================================================
# Write spec entries to target files
# ============================================================
spec_groups = {}
for frag in filtered_fragments:
    tf = frag["target_file"]
    spec_groups.setdefault(tf, [])
    spec_groups[tf].append(frag)

written = 0
for target_file, frags in spec_groups.items():
    fp = os.path.join(BASE, "specs", target_file)
    if not os.path.exists(fp):
        print(f"  SKIP: specs/{target_file} does not exist")
        continue

    with open(fp, "r", encoding="utf-8") as f:
        content = f.read()

    # Build spec-entry blocks
    entries_text = "\n"
    for frag in frags:
        spec_type = frag.get("spec_type", "pattern")
        keywords = ",".join(frag["tags"][:5])
        # Escape quotes in content for attribute
        content_safe = frag["content"][:120].replace('"', "'")
        entry = f"""
<spec-entry category="{spec_type}" keywords="{keywords}" date="{date_str}" title="{frag['title']}" description="{content_safe}">
### {frag['title']}
{frag['content']}
</spec-entry>"""
        entries_text += entry

    # Append
    content = content.rstrip() + entries_text + "\n"

    with open(fp, "w", encoding="utf-8") as f:
        f.write(content)

    written += len(frags)
    print(f"  Written {len(frags)} entries to specs/{target_file}")

# ============================================================
# Update harvest-log.jsonl
# ============================================================
os.makedirs(os.path.join(BASE, "harvest"), exist_ok=True)
with open(log_path, "a", encoding="utf-8") as f:
    for frag in filtered_fragments:
        log_entry = {
            "fragment_id": frag["id"],
            "source_type": frag["source_type"],
            "source_id": frag["source_id"],
            "routed_to": frag["routed_to"],
            "target_id": f"spec-{frag['spec_type']}-{frag['id']}",
            "timestamp": now_iso,
            "title": frag["title"],
            "confidence": frag["confidence"],
        }
        f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")

# ============================================================
# Stage 8: Write harvest report
# ============================================================
report_lines = [
    f"# Harvest Report - {date_str} (Session 2)",
    "",
    "## Source",
    "- **Source 1**: analysis-parallel-fix-2026-04-22 (lite-plan)",
    "- **Source 2**: iss-002-iss-010-fix-session (current session fixes)",
    "",
    "## Extraction Summary",
    f"- Fragments found: {len(fragments)}",
    f"- Filtered by confidence: {len(filtered_fragments)}",
    f"- Duplicates skipped: {skipped_dup}",
    "",
    "## Routing Results",
    "",
    f"### Spec ({written} entries)",
    "| # | Type | Title | Target File | Status |",
    "|---|------|-------|-------------|--------|",
]

for i, frag in enumerate(filtered_fragments, 1):
    title_trunc = frag["title"][:50]
    report_lines.append(f'| {i} | {frag["spec_type"]} | {title_trunc} | specs/{frag["target_file"]} | ADDED |')

report_lines.extend([
    "",
    "## Skipped",
    "| Fragment | Reason |",
    "|----------|--------|",
])

if skipped_dup == 0:
    report_lines.append("| (none) | - |")
else:
    for frag in fragments:
        if frag["title"] in harvested_titles:
            report_lines.append(f"| {frag['title'][:50]} | Duplicate: already in harvest-log |")

report_path = os.path.join(BASE, "harvest", f"harvest-report-{date_str}-session2.md")
with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(report_lines) + "\n")

print(f"\n=== HARVEST COMPLETE ===")
print(f"Source: analysis-parallel-fix-2026-04-22 + ISS-002/010 fix session")
print(f"  Spec: {written} added, {skipped_dup} skipped (dup)")
print(f"  Report: .workflow/harvest/harvest-report-{date_str}-session2.md")
print(f"  Log:    .workflow/harvest/harvest-log.jsonl")
