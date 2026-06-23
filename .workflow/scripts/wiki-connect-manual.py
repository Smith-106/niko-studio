"""Wiki Connect — Stage 5 extended: manual high-value connections for scratch orphans."""
import json, os, re

BASE = os.path.join("C:", os.sep, "Users", "niko", "Desktop", "工作目录", "niko-studio", ".workflow")

# High-value manual connections based on content analysis
# Each tuple: (orphan_file_path, related_ids_to_add)
MANUAL_CONNECTIONS = {
    # roadmap → M24 scope spec + arch constraints
    "roadmap.md": [
        "spec:project:harvest-brainstorm-m24-scope",
        "spec:project:architecture-constraints",
    ],
    # ui-conventions → sibling specs
    "specs/ui-conventions.md": [
        "spec:project:coding-conventions",
        "spec:project:architecture-constraints",
    ],
    # scratch-20260614 consistency gaps → coding conventions (captures learnings)
    "scratch/20260614-debug-consistency-gaps/understanding.md": [
        "spec:project:coding-conventions-025",
        "spec:project:coding-conventions-026",
    ],
    "scratch/20260614-debug-interface-gaps/understanding.md": [
        "spec:project:coding-conventions-025",
        "spec:project:review-standards-001",
    ],
    "scratch/20260614-plan-interface-gaps-status-matrix/plan.md": [
        "spec:project:coding-conventions-025",
    ],
    "scratch/20260614-test-security-regression-uat/uat.md": [
        "spec:project:test-conventions",
        "spec:project:quality-rules",
    ],
    # scratch-20260616 test coverage → test conventions
    "scratch/20260616-analyze-test-coverage-analysis/analysis.md": [
        "spec:project:test-conventions",
    ],
    "scratch/20260616-analyze-test-coverage-context/context.md": [
        "spec:project:test-conventions",
    ],
    "scratch/20260616-analyze-test-coverage-discussion/discussion.md": [
        "spec:project:test-conventions",
    ],
    # scratch-20260618 M26 Phase 1 → retrospective knowhow + arch entries
    "scratch/20260618-analyze-p1-reader-simulation-anti-ai-flavor-analysis/analysis.md": [
        "knowhow-knw-retro-verification-green-not-healthy-2026-06-21",
        "knowhow-knw-retro-scope-deviation-deferred-record-2026-06-21",
    ],
    "scratch/20260618-analyze-p1-reader-simulation-anti-ai-flavor-context/context.md": [
        "spec:project:architecture-constraints-032",
    ],
    "scratch/20260618-analyze-p1-reader-simulation-anti-ai-flavor-discussion/discussion.md": [
        "spec:project:architecture-constraints-033",
    ],
    "scratch/20260618-plan-p1-reader-simulation-anti-ai-flavor-retrospective/retrospective.md": [
        "knowhow-knw-retro-rule-first-llm-enhancement-2026-06-21",
    ],
    # scratch-20260619 fix risks → quality rules
    "scratch/20260619-analyze-fix-remaining-risks-context/context.md": [
        "spec:project:quality-rules-003",
    ],
    "scratch/20260619-analyze-fix-remaining-risks-discussion/discussion.md": [
        "spec:project:quality-rules-003",
    ],
    "scratch/20260619-test-p1-reader-simulation-anti-ai-flavor-uat/uat.md": [
        "spec:project:test-conventions",
    ],
    # scratch-20260620 odyssey → arch constraints (shutdown/sigterm) + debug notes
    "scratch/20260620-debug-odyssey-nsis-install-file-lock-understanding/understanding.md": [
        "spec:project:debug-notes-007",
    ],
    "scratch/20260620-improve-odyssey-gateway-startup-chain-understanding/understanding.md": [
        "spec:project:architecture-constraints-036",
        "spec:project:coding-conventions-021",
    ],
}

applied = 0
skipped = 0

for rel_path, new_related in MANUAL_CONNECTIONS.items():
    full_path = os.path.join(BASE, rel_path)
    if not os.path.exists(full_path):
        # Try with .workflow prefix
        alt_path = os.path.join(BASE, ".workflow", rel_path)
        if os.path.exists(alt_path):
            full_path = alt_path
        else:
            print(f"  SKIP: file not found: {rel_path}")
            skipped += 1
            continue

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Parse frontmatter
    fm_match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not fm_match:
        print(f"  SKIP: no frontmatter in {rel_path}")
        skipped += 1
        continue

    fm_text = fm_match.group(1)
    existing_related = re.findall(r'^- "?([^"\n]+)"?', fm_text, re.DOTALL | re.MULTILINE)

    actually_new = [rid for rid in new_related if rid not in existing_related]
    if not actually_new:
        print(f"  SKIP: all related already exist in {rel_path}")
        skipped += 1
        continue

    # Add related entries
    related_lines = "\n".join(f'- "{rid}"' for rid in actually_new)
    if "related:" in fm_text:
        new_fm = fm_text + "\n" + related_lines
    else:
        new_fm = fm_text + "\nrelated:\n" + related_lines

    new_content = f"---\n{new_fm}\n---" + content[fm_match.end():]
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    applied += len(actually_new)
    print(f"  APPLIED: {rel_path} -> +{len(actually_new)} related: {', '.join(actually_new)}")

print(f"\nManual connections: {applied} applied, {skipped} skipped")
