"""Wiki Connect — Manual high-value connections via maestro wiki update CLI."""
import json, os, subprocess, sys

BASE = os.path.join("C:", os.sep, "Users", "niko", "Desktop", "工作目录", "niko-studio")
CWD = BASE

def run_maestro(*args):
    """Run maestro CLI command, return stdout."""
    result = subprocess.run(
        f'maestro {" ".join(args)}',
        capture_output=True, text=True, encoding="utf-8",
        cwd=CWD, shell=True,
    )
    return result.stdout.strip()

def get_related(wiki_id):
    """Get current related list for a wiki entry."""
    raw = run_maestro("wiki", "get", wiki_id, "--json")
    lines = raw.split("\n")
    json_lines = [l for l in lines if l.strip().startswith("{")]
    if not json_lines:
        return []
    try:
        d = json.loads(json_lines[0])
        return d.get("related", [])
    except:
        return []

def add_related(wiki_id, new_related_ids):
    """Add related IDs to a wiki entry via maestro wiki update."""
    existing = get_related(wiki_id)
    actually_new = [rid for rid in new_related_ids if rid not in existing]
    if not actually_new:
        return 0
    all_related = existing + actually_new
    # Build frontmatter JSON for update
    related_json = json.dumps(all_related, ensure_ascii=False)
    result = run_maestro("wiki", "update", wiki_id, "--frontmatter", f"related={related_json}")
    return len(actually_new)

# High-value manual connections
# (orphan_id, [related_ids_to_add])
CONNECTIONS = [
    # roadmap → M24 scope spec + arch
    ("roadmap-roadmap", [
        "spec:project:harvest-brainstorm-m24-scope",
        "spec:project:architecture-constraints",
    ]),
    # ui-conventions → sibling specs
    ("spec:project:ui-conventions", [
        "spec:project:coding-conventions",
        "spec:project:architecture-conventions",
    ]),
    # scratch-20260614 consistency gaps → coding conventions (ISS-002 learnings)
    ("scratch-20260614-debug-consistency-gaps-understanding", [
        "spec:project:coding-conventions-025",
        "spec:project:coding-conventions-026",
    ]),
    ("scratch-20260614-debug-interface-gaps-understanding", [
        "spec:project:coding-conventions-025",
        "spec:project:review-standards-001",
    ]),
    ("scratch-20260614-plan-interface-gaps-status-matrix", [
        "spec:project:coding-conventions-025",
    ]),
    ("scratch-20260614-test-security-regression-uat", [
        "spec:project:test-conventions",
    ]),
    # scratch-20260616 test coverage → test conventions
    ("scratch-20260616-analyze-test-coverage-analysis", [
        "spec:project:test-conventions",
    ]),
    ("scratch-20260616-analyze-test-coverage-context", [
        "spec:project:test-conventions",
    ]),
    ("scratch-20260616-analyze-test-coverage-discussion", [
        "spec:project:test-conventions",
    ]),
    # scratch-20260618 M26 Phase 1 → retrospective knowhow
    ("scratch-20260618-analyze-p1-reader-simulation-anti-ai-flavor-analysis", [
        "knowhow-knw-retro-verification-green-not-healthy-2026-06-21",
    ]),
    ("scratch-20260618-analyze-p1-reader-simulation-anti-ai-flavor-context", [
        "spec:project:architecture-constraints-032",
    ]),
    ("scratch-20260618-analyze-p1-reader-simulation-anti-ai-flavor-discussion", [
        "spec:project:architecture-constraints-033",
    ]),
    ("scratch-20260618-plan-p1-reader-simulation-anti-ai-flavor-retrospective", [
        "knowhow-knw-retro-rule-first-llm-enhancement-2026-06-21",
    ]),
    # scratch-20260619 fix risks
    ("scratch-20260619-analyze-fix-remaining-risks-context", [
        "spec:project:quality-rules-003",
    ]),
    ("scratch-20260619-analyze-fix-remaining-risks-discussion", [
        "spec:project:quality-rules-003",
    ]),
    ("scratch-20260619-test-p1-reader-simulation-anti-ai-flavor-uat", [
        "spec:project:test-conventions",
    ]),
    # scratch-20260620 odyssey
    ("scratch-20260620-debug-odyssey-nsis-install-file-lock-understanding", [
        "spec:project:debug-notes-007",
    ]),
    ("scratch-20260620-improve-odyssey-gateway-startup-chain-understanding", [
        "spec:project:architecture-constraints-036",
        "spec:project:coding-conventions-021",
    ]),
    # M10 multi-pass → revision architecture
    ("knowhow-doc-harvest-other-m10-multi-pass", [
        "spec:project:architecture-constraints-008",
    ]),
]

applied = 0
skipped = 0
errors = 0

for orphan_id, new_related_ids in CONNECTIONS:
    try:
        n = add_related(orphan_id, new_related_ids)
        if n > 0:
            applied += n
            print(f"  APPLIED: {orphan_id} -> +{n} related")
        else:
            skipped += 1
            print(f"  SKIP: {orphan_id} (already linked)")
    except Exception as e:
        errors += 1
        print(f"  ERROR: {orphan_id} -> {e}")

print(f"\nManual connections: {applied} applied, {skipped} skipped, {errors} errors")

# Re-check health
raw = run_maestro("wiki", "health", "--json")
lines = raw.split("\n")
json_lines = [l for l in lines if l.strip().startswith("{")]
if json_lines:
    try:
        h = json.loads(json_lines[0])
        print(f"\nHealth after manual connections: {h['score']}/100 | Orphans: {len(h['orphans'])} | Broken: {h['totals']['brokenLinks']}")
    except:
        print("Could not parse health data")
