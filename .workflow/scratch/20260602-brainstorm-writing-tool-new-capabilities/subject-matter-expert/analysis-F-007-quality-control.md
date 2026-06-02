# F-007 — Quality Control Mechanism

> Role: subject-matter-expert | Related decisions: SME-01, SA-05, PM-05, UX-03

## Architecture

Quality Control implements a two-tier constraint system (see SA-05): hard constraints from Craft Analysis Services (enforced, blocking) and soft constraints from the creativity spectrum (advisory, non-blocking). Hard constraints map directly to the four quality dimensions (see SME-01): plot coherence, character consistency, style consistency, and pacing/tension.

The hard constraint engine calls existing CAS detectors and evaluates their outputs against configurable thresholds. Violations block AI output in Auto/Guided modes and generate warnings in Directed mode. The soft constraint engine evaluates output against the creativity spectrum setting (Conservative / Balanced / Creative / Experimental), providing advisory feedback on style alignment.

## Interface Contract

- `checkQuality(text: string, context: QualityContext): QualityReport` — runs both hard and soft constraint checks
- `QualityContext { storyBibleId: string, sessionId: string, creativityLevel: CreativitySpectrum }` — context for constraint evaluation
- `QualityReport { hardConstraints: HardConstraintResult[], softConstraints: SoftConstraintResult[], overallScore: number, pass: boolean }` — combined report
- `HardConstraintResult { dimension: QualityDimension, score: number, threshold: number, violations: Violation[], passed: boolean }` — per-dimension hard result
- `SoftConstraintResult { creativityAlignment: number, styleNotes: string[] }` — creativity spectrum alignment

Consumers: Co-Writing Engine (all three modes), Reader Simulation (editorial analysis feeds into hard constraints), Writing Workspace (displays quality indicators).

## Constraints (RFC 2119)

- Quality Control MUST implement exactly four hard constraint dimensions: plot coherence, character consistency, style consistency, and pacing/tension (see SME-01)
- Hard constraint violations MUST block AI output in Auto and Guided modes; violations MUST generate advisory warnings in Directed mode (see SA-05)
- Hard constraint thresholds MUST be configurable per dimension; default thresholds MUST be set conservatively (favor blocking over passing marginal output)
- Soft constraints from the creativity spectrum MUST be advisory only; they MUST NOT block AI output under any circumstances
- The creativity spectrum control MUST offer four labeled presets: Conservative, Balanced, Creative, Experimental (see UX-03)
- Quality reports MUST be included in all AI output metadata (see SME-03)
- Hard constraint checks MUST reference Story Bible data for character consistency and plot coherence dimensions

## Test Approach

- Unit: Each dimension's constraint checker correctly evaluates sample text; threshold comparison produces correct pass/fail
- Integration: Quality Control gate correctly blocks Auto/Guided output on hard constraint failure; advisory warnings generated for Directed mode
- Quality benchmark: Constraint accuracy measured against expert-annotated quality assessments
- Edge cases: Text at exact threshold boundary, multiple simultaneous dimension failures, creativity spectrum at Experimental with hard constraint conflict

## TODOs

- Define default threshold values for each of the four hard constraint dimensions
- Design the soft constraint evaluation algorithm for creativity spectrum alignment
- Specify how CAS detector outputs map to dimension scores
- Determine blocking behavior: block entirely or block-and-regenerate
- Define how Reader Simulation editorial analysis feeds into hard constraint evaluation
