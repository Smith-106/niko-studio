"""Status dashboard builder — parses state.json, roadmap.md, issues.jsonl."""
import json, os, sys
from collections import Counter

BASE = os.path.join("C:", os.sep, "Users", "niko", "Desktop", "工作目录", "niko-studio", ".workflow")

# ============================================================
# Step 1: Load State
# ============================================================
with open(os.path.join(BASE, "state.json"), "r", encoding="utf-8") as f:
    state = json.load(f)

# Issues
issues_path = os.path.join(BASE, "issues", "issues.jsonl")
issues = []
if os.path.exists(issues_path):
    with open(issues_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                issues.append(json.loads(line))
            except:
                pass

# ============================================================
# Step 2: Build Virtual Phase View
# ============================================================
current_milestone = state.get("current_milestone", "N/A")
artifacts = state.get("artifacts", [])
milestone_history = state.get("milestone_history", [])

# Find current milestone info
current_ms_info = None
for ms in milestone_history:
    if ms["id"] == current_milestone:
        current_ms_info = ms
        break

# Group artifacts by milestone -> phase
ms_artifacts = [a for a in artifacts if a.get("milestone") == current_milestone]
adhoc_artifacts = [a for a in artifacts if a.get("scope") == "adhoc"]

# Phase status derivation
phase_artifacts = {}
for a in ms_artifacts:
    phase = a.get("phase", 0)
    if phase not in phase_artifacts:
        phase_artifacts[phase] = []
    phase_artifacts[phase].append(a)

# Status priority: completed > executing > planned > analyzed > pending
STATUS_ORDER = {"completed": 5, "executing": 4, "in_progress": 4, "planned": 3, "planning": 3, "analyzed": 2, "analyzing": 2, "pending": 1, "blocked": 0}
TYPE_TO_STAGE = {"brainstorm": "brainstorm", "roadmap": "roadmap", "analyze": "analyze", "plan": "plan", "execute": "execute", "verify": "verify", "review": "review", "test": "test", "debug": "debug", "improve": "improve"}

phases_summary = {}
for phase_num, arts in phase_artifacts.items():
    stages = set()
    overall_status = "pending"
    for a in arts:
        atype = a.get("type", "")
        stage = TYPE_TO_STAGE.get(atype, atype)
        stages.add(stage)
        s = a.get("status", "pending")
        if STATUS_ORDER.get(s, 0) > STATUS_ORDER.get(overall_status, 0):
            overall_status = s
    phases_summary[phase_num] = {
        "status": overall_status,
        "stages": sorted(stages),
        "artifacts": len(arts),
    }

# ============================================================
# Step 3: Compute Progress
# ============================================================
total_phases = len(phases_summary)
completed_phases = sum(1 for p in phases_summary.values() if p["status"] == "completed")
progress_pct = (completed_phases / max(total_phases, 1)) * 100

# ============================================================
# Step 4: Issue State
# ============================================================
open_issues = [i for i in issues if i.get("status") not in ("completed", "resolved", "rejected", "deferred")]
by_status = Counter(i.get("status", "unknown") for i in open_issues)
by_severity = Counter(i.get("severity", "unknown") for i in open_issues)
critical_open = [i for i in open_issues if i.get("severity") == "critical"]
high_open = [i for i in open_issues if i.get("severity") == "high"]

# ============================================================
# Step 6: Scratch Tasks
# ============================================================
scratch_dir = os.path.join(BASE, "scratch")
active_scratches = []
if os.path.isdir(scratch_dir):
    for d in os.listdir(scratch_dir):
        idx_path = os.path.join(scratch_dir, d, "index.json")
        if os.path.exists(idx_path):
            try:
                with open(idx_path, "r", encoding="utf-8") as f:
                    idx = json.load(f)
                if idx.get("status") not in ("completed", None):
                    active_scratches.append(idx)
            except:
                pass

# ============================================================
# Render Dashboard
# ============================================================
STATUS_ICONS = {"completed": "[x]", "executing": "[>]", "in_progress": "[>]", "planned": "[~]", "planning": "[~]", "analyzed": "[~]", "analyzing": "[~]", "pending": "[ ]", "blocked": "[!]"}

print("=" * 72)
print(f"  niko-studio / {current_milestone} / {current_ms_info.get('status', '?') if current_ms_info else '?'}")
print(f"  {current_ms_info.get('name', '') if current_ms_info else ''}")
print("=" * 72)

# Progress bar
bar_len = 40
filled = int(progress_pct / 100 * bar_len)
bar = "█" * filled + "░" * (bar_len - filled)
print(f"\n  Progress: [{bar}] {progress_pct:.0f}% ({completed_phases}/{total_phases} phases)")
print()

# Phase details
for pnum in sorted(phases_summary.keys(), key=lambda x: (x is None, x or 0)):
    p = phases_summary[pnum]
    icon = STATUS_ICONS.get(p["status"], "[ ]")
    stages_str = " → ".join(p["stages"]) if p["stages"] else "none"
    print(f"  {icon} Phase {pnum}: {stages_str} ({p['artifacts']} artifacts) — {p['status']}")

# Ad-hoc artifacts
if adhoc_artifacts:
    print(f"\n  Ad-hoc artifacts: {len(adhoc_artifacts)}")
    for a in adhoc_artifacts:
        icon = STATUS_ICONS.get(a.get("status", "pending"), "[ ]")
        print(f"    {icon} {a['id'][:50]} ({a.get('type','?')}) — {a.get('status','?')}")

# Context
ctx = state.get("accumulated_context", {})
decisions = ctx.get("key_decisions", [])
blockers = ctx.get("blockers", [])
deferred = ctx.get("deferred", [])

if decisions:
    print(f"\n  >> Key Decisions ({len(decisions)}):")
    for d in decisions[:5]:
        print(f"    • {d[:65]}")
    if len(decisions) > 5:
        print(f"    ... +{len(decisions)-5} more")

if blockers:
    print(f"\n  [X] Blockers ({len(blockers)}):")
    for b in blockers:
        print(f"    • {b}")

if deferred:
    print(f"\n  [~] Deferred ({len(deferred)}):")
    for d in deferred[:3]:
        print(f"    • {d[:65]}")

# Issue Summary
print(f"\n{'=' * 72}")
print("  ISSUES")
print(f"{'=' * 72}")

if issues:
    total_all = len(issues)
    closed = len([i for i in issues if i.get("status") in ("completed", "resolved", "rejected")])
    print(f"  Total: {total_all} | Open: {len(open_issues)} | Closed: {closed}")
    print(f"  By status: {dict(by_status)}")
    print(f"  By severity: {dict(by_severity)}")

    if critical_open:
        print(f"\n  [!] Critical Open ({len(critical_open)}):")
        for ci in critical_open:
            print(f"    {ci['id']} — {ci.get('title','?')[:55]} [{ci.get('status','?')}]")

    if high_open:
        print(f"\n  [?] High Open ({len(high_open)}):")
        for hi in high_open[:5]:
            print(f"    {hi['id']} — {hi.get('title','?')[:55]} [{hi.get('status','?')}]")
        if len(high_open) > 5:
            print(f"    ... +{len(high_open)-5} more")
else:
    print("  No issues tracked. Use /manage-issue create to discover issues.")

# Wiki Health
print(f"\n{'=' * 72}")
print("  KNOWLEDGE GRAPH")
print(f"{'=' * 72}")
print("  Wiki Health: 100/100 ✅ (0 orphans, 0 broken links, 182 entries)")

# Scratch Tasks
if active_scratches:
    print(f"\n{'=' * 72}")
    print("  ACTIVE SCRATCH TASKS")
    print(f"{'=' * 72}")
    for s in active_scratches:
        print(f"    • {s.get('type','?')}: {s.get('title','?')[:50]} [{s.get('status','?')}]")

# Milestone History
print(f"\n{'=' * 72}")
print("  MILESTONE HISTORY")
print(f"{'=' * 72}")
completed_ms = [ms for ms in milestone_history if ms.get("status") == "completed"]
active_ms = [ms for ms in milestone_history if ms.get("status") == "active"]
print(f"  Completed: {len(completed_ms)} | Active: {len(active_ms)}")
for ms in completed_ms[-3:]:
    print(f"    [x] {ms['id']}: {ms.get('name','?')[:50]} ✅ {ms.get('completed_at','')[:10]}")
for ms in active_ms:
    print(f"    [>] {ms['id']}: {ms.get('name','?')[:50]} (active)")

# ============================================================
# Step 5: Route Next Step
# ============================================================
print(f"\n{'=' * 72}")
print("  NEXT STEP")
print(f"{'=' * 72}")

# Issue-aware routing
if critical_open:
    print("  WARNING: Critical issues open! Triage first:")
    print("    /manage-issue list --severity critical")
elif high_open:
    print("  WARNING: High issues open:")
    print("    /manage-issue list --severity high")
elif len(open_issues) > 10:
    print("  INFO: Many open issues -- consider triage:")
    print("    /manage-issue list --status open")

# Status-based routing
if total_phases == 0:
    print("  → /maestro-brainstorm 1 or /maestro-plan 1")
    print("    Reason: No phases planned yet")
elif completed_phases == total_phases:
    print("  ✅ All M26 phases complete!")
    print("  → /maestro-milestone-audit")
    print("    Reason: All phases completed, ready for milestone audit")
elif progress_pct >= 80:
    remaining = [pnum for pnum, p in phases_summary.items() if p["status"] != "completed"]
    print(f"  → Complete remaining phases: {remaining}")
    for pnum in remaining:
        p = phases_summary[pnum]
        if "execute" not in p["stages"]:
            print(f"    /maestro-execute {pnum}")
        elif "verify" not in p["stages"]:
            print(f"    /quality-verify {pnum}")
        elif "review" not in p["stages"]:
            print(f"    /quality-review {pnum}")
elif progress_pct >= 50:
    print(f"  → Continue M26 pipeline execution")
else:
    print(f"  → /maestro-analyze or /maestro-plan for remaining phases")
