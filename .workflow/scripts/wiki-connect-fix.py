"""Wiki Connect — Stage 2-5: Identify, score, and apply connection candidates."""
import json, os, re, subprocess, sys

BASE = os.path.join("C:", os.sep, "Users", "niko", "Desktop", "工作目录", "niko-studio", ".workflow")
CWD = os.path.join(BASE, "..")

def run_maestro(*args):
    """Run maestro CLI command, return stdout."""
    result = subprocess.run(
        f'maestro {" ".join(args)}',
        capture_output=True, text=True, encoding="utf-8",
        cwd=CWD, shell=True,
    )
    return result.stdout

# ============================================================
# Load wiki data
# ============================================================
raw = run_maestro("wiki", "list", "--json")
# Skip deprecated warning lines
lines = raw.strip().split("\n")
json_start = 0
for i, line in enumerate(lines):
    if line.strip().startswith("{"):
        json_start = i
        break
json_text = "\n".join(lines[json_start:])
entries = json.loads(json_text)["entries"]
id_to_entry = {e["id"]: e for e in entries}
all_ids = set(id_to_entry.keys())

# Load health baseline
raw2 = run_maestro("wiki", "health", "--json")
lines2 = raw2.strip().split("\n")
json_start2 = 0
for i, line in enumerate(lines2):
    if line.strip().startswith("{"):
        json_start2 = i
        break
json_text2 = "\n".join(lines2[json_start2:])
health_data = json.loads(json_text2)
baseline_score = health_data["score"]
orphan_ids = set(health_data["orphans"])
broken_links = health_data.get("brokenLinks", [])

print(f"Baseline: {baseline_score}/100 | Orphans: {len(orphan_ids)} | Broken links: {len(broken_links)}")

# ============================================================
# Stage 2: Identify Connection Candidates
# ============================================================
candidates = []

# --- 2a: Orphan Rescue ---
for orphan_id in sorted(orphan_ids):
    orphan = id_to_entry.get(orphan_id)
    if not orphan:
        continue
    orphan_tags = set(orphan.get("tags", []))
    orphan_title = orphan.get("title", "")
    orphan_type = orphan.get("type", "")
    orphan_category = orphan.get("category", "")

    for candidate_id, candidate in id_to_entry.items():
        if candidate_id in orphan_ids:
            continue
        if candidate_id == orphan_id:
            continue
        cand_tags = set(candidate.get("tags", []))
        shared_tags = orphan_tags & cand_tags
        tag_overlap = len(shared_tags) / max(len(orphan_tags | cand_tags), 1)
        same_category = 1.0 if (orphan_category and candidate.get("category") == orphan_category) else 0.0
        same_type = 1.0 if orphan_type == candidate.get("type") else 0.0

        o_words = set(re.findall(r'\w+', orphan_title.lower()))
        c_words = set(re.findall(r'\w+', candidate.get("title", "").lower()))
        title_overlap = len(o_words & c_words) / max(len(o_words | c_words), 1)

        score = 0.4 * tag_overlap + 0.3 * title_overlap + 0.2 * same_category + 0.1 * same_type
        if score >= 0.3:
            reason_parts = []
            if shared_tags:
                reason_parts.append(f"tag overlap ({', '.join(list(shared_tags)[:3])})")
            if same_category:
                reason_parts.append(f"same category ({orphan_category})")
            if title_overlap > 0.1:
                reason_parts.append("title keyword match")
            candidates.append({
                "source": orphan_id,
                "target": candidate_id,
                "score": round(score, 2),
                "reason": " + ".join(reason_parts) if reason_parts else "low relevance",
                "type": "orphan_rescue",
            })

# Sort and dedup
candidates.sort(key=lambda c: c["score"], reverse=True)
seen_pairs = set()
unique_candidates = []
for c in candidates:
    pair = (c["source"], c["target"])
    if pair not in seen_pairs:
        seen_pairs.add(pair)
        unique_candidates.append(c)

top_candidates = unique_candidates[:25]

print(f"\nConnection candidates found: {len(unique_candidates)} (showing top {len(top_candidates)})")

# ============================================================
# Stage 4: Present Suggestions
# ============================================================
print(f"\n== Wiki Connection Suggestions ==")
print(f"Baseline health: {baseline_score}/100 | Orphans: {len(orphan_ids)} | Broken links: {len(broken_links)}")
print()
print(f"{'#':>3}  {'Score':>5}  {'Source':<55} -> {'Target':<55} {'Reason'}")
print("-" * 170)

for i, c in enumerate(top_candidates, 1):
    src_short = c["source"][:53]
    tgt_short = c["target"][:53]
    print(f"{i:>3}  {c['score']:>5.2f}  {src_short:<55} -> {tgt_short:<55} {c['reason']}")

print()
print(f"\nBroken link fixes needed: {len(broken_links)}")
for bl in broken_links:
    print(f"  FIX: {bl.get('sourceId','')} -- remove broken link -> '{bl.get('target','')}'")

# ============================================================
# Stage 5: Apply Connections (--fix)
# ============================================================
applied = 0
skipped = 0

# Fix broken links: remove broken wikilinks from body text
for bl in broken_links:
    src_id = bl.get("sourceId", "")
    tgt = bl.get("target", "")
    entry = id_to_entry.get(src_id, {})
    src_path = entry.get("source", {}).get("path", "")
    if not src_path:
        continue
    full_path = os.path.join(BASE, src_path)
    if not os.path.exists(full_path):
        continue
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    # Remove lines containing broken [[target]] wikilinks
    target_escaped = re.escape(tgt)
    new_content = re.sub(rf'\n?- \[\[{target_escaped}\]\]', '', content)
    new_content = new_content.replace(f"[[{tgt}]]", "")
    if new_content != content:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"  FIXED broken link: removed '{tgt}' from {src_path}")
        applied += 1
    else:
        print(f"  SKIP broken link: target not in body of {src_path}")
        skipped += 1

# Apply orphan rescue: add related links to orphans
orphan_connections = {}
for c in top_candidates:
    src = c["source"]
    if src not in orphan_connections:
        orphan_connections[src] = []
    orphan_connections[src].append(c["target"])

for orphan_id, targets in orphan_connections.items():
    orphan = id_to_entry.get(orphan_id)
    if not orphan:
        continue
    src_path = orphan.get("source", {}).get("path", "")
    if not src_path:
        continue
    full_path = os.path.join(BASE, src_path)
    if not os.path.exists(full_path):
        continue

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Parse frontmatter
    fm_match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not fm_match:
        continue

    fm_text = fm_match.group(1)
    existing_related = re.findall(r'^- "?([^"\n]+)"?', fm_text, re.MULTILINE)

    new_related = []
    for t in targets[:3]:
        if t not in existing_related:
            new_related.append(t)

    if not new_related:
        continue

    # Add to frontmatter
    related_lines = "\n".join(f'- "{t}"' for t in new_related)
    if "related:" in fm_text:
        new_fm = fm_text + "\n" + related_lines
    else:
        new_fm = fm_text + "\nrelated:\n" + related_lines

    new_content = f"---\n{new_fm}\n---" + content[fm_match.end():]
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    applied += len(new_related)
    print(f"  APPLIED: {orphan_id} -> +{len(new_related)} related links")

# ============================================================
# Stage 5b: Re-check health
# ============================================================
raw3 = run_maestro("wiki", "health", "--json")
lines3 = raw3.strip().split("\n")
json_start3 = 0
for i, line in enumerate(lines3):
    if line.strip().startswith("{"):
        json_start3 = i
        break
json_text3 = "\n".join(lines3[json_start3:])
health_data2 = json.loads(json_text3)
new_score = health_data2["score"]
new_orphans = len(health_data2["orphans"])
new_broken = health_data2["totals"]["brokenLinks"]

print(f"\n== Wiki Connect Complete ==")
print(f"Suggestions:  {len(unique_candidates)} ({applied} applied, {skipped} skipped)")
print(f"Health:       {baseline_score} -> {new_score} ({new_score - baseline_score:+d})")
print(f"Orphans:      {len(orphan_ids)} -> {new_orphans} ({new_orphans - len(orphan_ids):+d})")
print(f"Broken links: {len(broken_links)} -> {new_broken} ({new_broken - len(broken_links):+d})")
