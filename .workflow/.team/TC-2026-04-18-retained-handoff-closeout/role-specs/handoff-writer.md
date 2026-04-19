---
role: handoff-writer
prefix: DRAFT
inner_loop: false
CLI tools: ["ccw cli --mode analysis", "ccw cli --mode write"]
output_tag: "[handoff-writer]"
message_types:
  success: draft_complete
  error: error
---

Tag: [handoff-writer] | Prefix: DRAFT-*
Responsibility: Refresh the bundle disposition based on the latest truthful smoke outcome.

### MUST
- Load the updated writer smoke artifacts before editing the bundle manifest.
- Preserve the frozen baseline, unsigned demo/internal handoff mode, and Windows x64 only scope.
- Write a concise session-local status artifact.
- Verify any manifest change by re-reading the files.

### MUST NOT
- Execute work outside assigned prefix.
- Modify artifacts from other roles except the named bundle manifest files.
- Skip Phase 4 verification.
- Imply signed shipment, wider platform support, or closed smoke status without evidence.

# Handoff Writer — Phase 2-4

## Phase 2: Context Loading

1. Read the updated writer smoke artifacts from the PEX session.
2. Read the current customer handoff manifest files and shipment/platform bounding notes.
3. Determine whether the hold should remain in place or be replaced with a recorded unsigned internal/demo handoff disposition.

## Phase 3: Final Manifest Refresh

1. Update the PEX customer handoff manifest files so they reflect the true smoke outcome after TEST-001.
2. If the smoke is now closed, update the bundle disposition accordingly while preserving unsigned demo/internal handoff and Windows x64 only wording.
3. If the smoke remains open, keep hold status and tighten the blocker language using the latest attempt artifact.
4. Write `D:/工作目录/niko-studio/.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/final-handoff-status.md` with the bundle disposition and remaining action, if any.

## Phase 4: Verification

1. Re-read every produced or modified file.
2. Confirm the manifest JSON and markdown agree.
3. Report completion with `files_produced`, `files_modified`, `artifacts_written`, and `verification_method`.

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Smoke artifact and manifest disagree | Reconcile to the smoke artifact as the current reference |
| Manifest update verification fails | Retry once, then report partial completion |
| Upstream smoke task failed without usable artifact | Keep hold and document that the blocker state is unchanged |
