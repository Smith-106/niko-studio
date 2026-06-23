"""Wiki Connect — Add body wikilinks to reduce orphan count."""
import os, re

BASE = os.path.join("C:", os.sep, "Users", "niko", "Desktop", "工作目录", "niko-studio", ".workflow")

# Scratch files that need wikilinks added to body
# (relative_path, [wikilink_ids_to_add])
BODY_LINKS = {
    "scratch/20260614-debug-consistency-gaps/understanding.md": [
        "spec:project:coding-conventions-025",
        "spec:project:coding-conventions-026",
    ],
    "scratch/20260614-debug-interface-gaps/understanding.md": [
        "spec:project:coding-conventions-025",
        "spec:project:review-standards-001",
    ],
    "scratch/20260614-plan-interface-gaps/plan.md": [
        "spec:project:coding-conventions-025",
    ],
    "scratch/20260614-test-security-regression/uat.md": [
        "spec:project:test-conventions",
    ],
    "scratch/20260616-analyze-test-coverage/analysis.md": [
        "spec:project:test-conventions",
    ],
    "scratch/20260616-analyze-test-coverage/context.md": [
        "spec:project:test-conventions",
    ],
    "scratch/20260616-analyze-test-coverage/discussion.md": [
        "spec:project:test-conventions",
    ],
    "scratch/20260618-analyze-P1-reader-simulation-anti-ai-flavor/analysis.md": [
        "knowhow-knw-retro-verification-green-not-healthy-2026-06-21",
    ],
    "scratch/20260618-analyze-P1-reader-simulation-anti-ai-flavor/context.md": [
        "spec:project:architecture-constraints-032",
    ],
    "scratch/20260618-analyze-P1-reader-simulation-anti-ai-flavor/discussion.md": [
        "spec:project:architecture-constraints-033",
    ],
    "scratch/20260618-plan-P1-reader-simulation-anti-ai-flavor/retrospective.md": [
        "knowhow-knw-retro-rule-first-llm-enhancement-2026-06-21",
    ],
    "scratch/20260619-analyze-fix-remaining-risks/context.md": [
        "spec:project:quality-rules-003",
    ],
    "scratch/20260619-analyze-fix-remaining-risks/discussion.md": [
        "spec:project:quality-rules-003",
    ],
    "scratch/20260619-test-P1-reader-simulation-anti-ai-flavor/uat.md": [
        "spec:project:test-conventions",
    ],
    "scratch/20260620-debug-odyssey-nsis-install-file-lock/understanding.md": [
        "spec:project:debug-notes-007",
    ],
    "scratch/20260620-improve-odyssey-gateway-startup-chain/understanding.md": [
        "spec:project:architecture-constraints-036",
        "spec:project:coding-conventions-021",
    ],
}

applied = 0
skipped = 0

for rel_path, wiki_ids in BODY_LINKS.items():
    full_path = os.path.join(BASE, rel_path)
    if not os.path.exists(full_path):
        print(f"  SKIP: file not found: {rel_path}")
        skipped += 1
        continue

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Build wikilinks section
    link_lines = []
    for wid in wiki_ids:
        if f"[[{wid}]]" not in content:
            link_lines.append(f"- [[{wid}]]")

    if not link_lines:
        print(f"  SKIP: all links already exist in {rel_path}")
        skipped += 1
        continue

    # Add a "Related" section at the end if not present
    related_section = "\n\n## Related\n" + "\n".join(link_lines) + "\n"

    if "## Related" in content:
        # Append to existing Related section
        new_content = content.replace("## Related", "## Related\n" + "\n".join(link_lines))
    else:
        new_content = content.rstrip() + related_section

    with open(full_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    applied += len(link_lines)
    print(f"  APPLIED: {rel_path} -> +{len(link_lines)} wikilinks")

print(f"\nBody wikilinks: {applied} applied, {skipped} skipped")
