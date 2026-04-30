# Contributing to Niko Studio

Thank you for your interest in contributing to Niko Studio! This guide covers the development workflow, quality gates, and conventions used in this project.

## Prerequisites

- **Node.js 20+** and **npm 10+**
- **Python 3.11+** (for release helpers, governance scripts, and the compatibility launcher)
- **Rust stable** with MSVC Windows target (only needed when building/running the Tauri desktop host)

## Getting Started

```bash
# 1. Clone the repository
git clone <repo-url>
cd niko-studio

# 2. Install Python dependencies
pip install -r requirements.txt
# or: uv sync

# 3. Install backend (gateway) dependencies
npm ci --prefix src-ts

# 4. Install desktop dependencies
npm ci --prefix desktop

# 5. Enable pre-commit hooks
git config core.hooksPath .githooks
```

## Pre-commit Hooks

The repository ships a lightweight pre-commit hook in `.githooks/pre-commit`. Enable it with:

```bash
git config core.hooksPath .githooks
```

The hook runs `python scripts/run_local_pre_commit.py`, which executes:

- `npm --prefix desktop run check:pre-commit` (ESLint + Prettier format check)
- `npm --prefix src-ts run check:pre-commit` (ESLint + Prettier format check)
- `python -m ruff check --select F,I scripts tests/unit/scripts` (Python lint)
- `python -m ruff format --check scripts tests/unit/scripts` (Python format check)

## Quality Gates

The project uses a four-tier quality gate system. Run progressively stricter gates depending on the scope of your change:

| Tier | Command | When to Run |
|------|---------|-------------|
| L1 Pre-commit | `npm --prefix desktop run check:pre-commit` | Automatically on every commit (via hook) |
| L2 Quick | `npm --prefix desktop run check:quick` | Before pushing — adds typecheck + tests |
| L3 Local release | `npm --prefix desktop run check:local` | Before opening a PR — full release gate |
| L4 Release evidence | `python scripts/release_check_summary.py` | Before tagging a release — produces retained evidence |

The same tiers apply to the backend:

```bash
npm --prefix src-ts run check:pre-commit   # L1
npm --prefix src-ts run check:quick         # L2
npm --prefix src-ts run check:local         # L3
```

## Testing

Tests are organized by tier. See [docs/testing/TEST_TIER_MATRIX.md](docs/testing/TEST_TIER_MATRIX.md) for the full L1-L4 matrix.

- **Desktop** (Vitest): `npm --prefix desktop run test`
- **Backend** (Vitest): `npm --prefix src-ts run test:phase4` (core baseline)
- **Python governance**: `python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py`
- **Coverage**: `npm --prefix src-ts run test:coverage:phase4`

## Branch Strategy

- **`main`** is the primary integration branch. All PRs merge to `main`.
- Create feature branches from `main` and open a Pull Request when ready.
- There is no long-lived `develop` branch.

## Code Style

- **TypeScript**: ESLint (shared `eslint.config.mjs`) + Prettier (shared `prettier.config.mjs`)
- Both `desktop/` and `src-ts/` enforce `--max-warnings 0`
- **Python**: `ruff` for linting (`--select F,I`) and formatting

## Commit & Changelog Conventions

- Use semantic versioning (e.g., `9.2.0`).
- Follow the existing `CHANGELOG.md` format:

```markdown
## [x.y.z] - YYYY-MM-DD

### Changed
- Description of what changed and why.

### Added
- New features.

### Fixed
- Bug fixes.
```

## Dependency Audit

Before submitting, check for known vulnerabilities:

```bash
npm --prefix desktop run audit:high
npm --prefix src-ts run audit:high
```

## Version Consistency

All version references must stay in sync. Verify with:

```bash
python scripts/check_versions.py
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
