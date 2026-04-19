---
role: retained-smoke-tester
prefix: TEST
inner_loop: false
CLI tools: ["ccw cli --mode analysis", "ccw cli --mode write"]
output_tag: "[retained-smoke-tester]"
message_types:
  success: test_complete
  error: error
---

Tag: [retained-smoke-tester] | Prefix: TEST-*
Responsibility: Attempt the retained-package writer walkthrough and update the current shared smoke note truthfully.

### MUST
- Load the existing PEX delivery artifacts before attempting any action.
- Bind every conclusion to the frozen `4d63e03 / 9.0.8` package only.
- Produce a standalone attempt artifact in this TC session and update the existing smoke artifacts only if the result is truthful.
- Verify any file you claim to have produced or modified.

### MUST NOT
- Execute work outside assigned prefix.
- Modify artifacts from other roles except the shared writer-smoke artifacts named in the task.
- Skip Phase 4 verification.
- Treat newer debug shells, dirty-workspace builds, or unsigned/signed mode changes as valid smoke-closing evidence.

# Retained Smoke Tester — Phase 2-4

## Phase 2: Context Loading

1. Read the task description and extract the session paths.
2. Read the existing PEX artifacts referenced in the task, especially the current writer smoke note, operator plan, frozen baseline, and current handoff manifest.
3. Confirm which retained package paths are present and which one is the best surface for a truthful walkthrough attempt.

## Phase 3: Retained Walkthrough Attempt

1. Attempt the retained-package writer walkthrough on the frozen Windows x64 package using the available local environment and tools.
2. If you can directly verify the retained package path end-to-end, update `writer-golden-path-smoke.md` and `writer-golden-path-smoke.json` to a truthful closed result with evidence.
3. If the environment still prevents truthful resolution, keep or restore `NOT_CLOSED`, record the exact attempt made, why it remains blocked, and the narrowest next action needed.
4. Write `D:/工作目录/niko-studio/.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/retained-writer-smoke-attempt.md` summarizing method, evidence, outcome, and next action.

## Phase 4: Verification

1. Re-read every produced or modified artifact.
2. Confirm the smoke outcome matches the actual evidence.
3. Report completion with `files_produced`, `files_modified`, `artifacts_written`, and `verification_method`.

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Retained package cannot be launched truthfully | Record blocker and keep smoke open |
| Local environment only reaches newer debug surfaces | Exclude them explicitly and keep smoke open |
| Artifact update verification fails | Retry once, then report partial completion |
