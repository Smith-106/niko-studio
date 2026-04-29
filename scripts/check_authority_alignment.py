#!/usr/bin/env python
"""Check current authority alignment across workflows, runtime tooling, and docs."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class AuthorityRule:
    file_path: str
    pattern: str
    reason: str
    required: bool = True


DELIVERY_CONTRACT_HEADINGS: dict[str, str] = {
    "README.md": r"## Writer-First Desktop Delivery Contract",
    "desktop/README.md": r"## 当前交付契约",
    "docs/release/RELEASE_NOTES.md": r"## 当前交付契约（与 README / desktop README 一致）",
    "docs/operations/DESKTOP_RUNBOOK.md": r"## Delivery Contract",
    "docs/operations/ROLLBACK.md": r"## 回退目标契约",
}

DELIVERY_CONTRACT_FILE_LABELS: dict[str, str] = {
    "README.md": "README",
    "desktop/README.md": "Desktop README",
    "docs/release/RELEASE_NOTES.md": "Release notes",
    "docs/operations/DESKTOP_RUNBOOK.md": "Desktop runbook",
    "docs/operations/ROLLBACK.md": "Rollback runbook",
}

DELIVERY_CONTRACT_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        r"`Supported runtime`: `desktop/` \+ Tauri host \+ local `src-ts/` Node/TypeScript gateway",
        "must declare the supported desktop runtime contract.",
    ),
    (
        r"`Supported launcher`: `python scripts/start_gateway.py`.*Node/TypeScript gateway by default\.",
        "must declare the supported launcher semantics.",
    ),
    (
        r"`Advisory compatibility surfaces`: explicit `--runtime python` legacy override, legacy `src/mcp/\*\*` sources, and Streamlit validation flows",
        "must bound compatibility surfaces as advisory only.",
    ),
    (
        r"`Deprecated surface` \(removed\): browser-first web entry has been removed from the codebase\.",
        "must label the browser-first web path as deprecated and removed.",
    ),
)

DELIVERY_CONTRACT_RULES: tuple[AuthorityRule, ...] = tuple(
    AuthorityRule(
        file_path=file_path,
        pattern=heading_pattern,
        reason=f"{DELIVERY_CONTRACT_FILE_LABELS[file_path]} must include the aligned delivery-contract section.",
    )
    for file_path, heading_pattern in DELIVERY_CONTRACT_HEADINGS.items()
) + tuple(
    AuthorityRule(
        file_path=file_path,
        pattern=pattern,
        reason=f"{DELIVERY_CONTRACT_FILE_LABELS[file_path]} {reason}",
    )
    for file_path in DELIVERY_CONTRACT_FILE_LABELS
    for pattern, reason in DELIVERY_CONTRACT_PATTERNS
)


BASE_RULES: tuple[AuthorityRule, ...] = (
    AuthorityRule(
        file_path="README.md",
        pattern=r"### 当前权威地图",
        reason="README must expose a current authority map.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"main 分支的 authority alignment / selected contract hard gates",
        reason="README must describe the internal CI hard-gate authority semantics.",
    ),
    AuthorityRule(
        file_path="docs/INDEX.md",
        pattern=r"当前运行时 / 构建权威：`desktop \+ src-ts`",
        reason="Docs index must identify the current runtime/build authority.",
    ),
    AuthorityRule(
        file_path="docs/INDEX.md",
        pattern=r"main 分支仍保留 authority alignment 与选定契约的阻断门禁",
        reason="Docs index must describe internal main-branch blocking gate semantics.",
    ),
    AuthorityRule(
        file_path="docs/workflow-entrypoint-inventory.md",
        pattern=r"不代表当前 `desktop \+ src-ts` 运行/发布权威入口",
        reason="Workflow entrypoint inventory must be bounded as historical migration reference.",
    ),
    AuthorityRule(
        file_path="scripts/start_gateway.py",
        pattern=r"compatibility-only override",
        reason="Gateway launcher must describe python as compatibility-only override.",
    ),
    AuthorityRule(
        file_path="scripts/start_gateway.py",
        pattern=r"authoritative Node/TypeScript gateway runtime",
        reason="Gateway launcher must describe Node/TypeScript as authoritative.",
    ),
    AuthorityRule(
        file_path="desktop/scripts/choose_sidecar.cjs",
        pattern=r"AUTHORITATIVE_RUNTIME = 'node'",
        reason="Sidecar selector must encode Node as the authoritative runtime.",
    ),
    AuthorityRule(
        file_path="desktop/scripts/choose_sidecar.cjs",
        pattern=r"Compatibility override active",
        reason="Sidecar selector must emit explicit compatibility-override messaging for python.",
    ),
    AuthorityRule(
        file_path=".github/workflows/integration-tests.yml",
        pattern=r"desktop-sidecar-hard-fail:",
        reason="Internal CI must include a promoted main-branch sidecar hard gate.",
    ),
    AuthorityRule(
        file_path=".github/workflows/integration-tests.yml",
        pattern=r"Verify desktop sidecar contract artifact \(advisory lane\)",
        reason="Internal CI must keep an explicit advisory lane label for broad observation.",
    ),
    AuthorityRule(
        file_path=".github/workflows/integration-tests.yml",
        pattern=r"authority-alignment-advisory:",
        reason="Internal CI must run the authority alignment checker automatically.",
    ),
    AuthorityRule(
        file_path=".github/workflows/integration-tests.yml",
        pattern=r"authority-alignment-hard-fail:",
        reason="Internal CI main branch must promote authority alignment to a blocking gate.",
    ),
    AuthorityRule(
        file_path=".github/workflows/integration-tests.yml",
        pattern=r"python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q",
        reason="Internal CI must run governance script regression tests automatically.",
    ),
    AuthorityRule(
        file_path=".github/workflows/external-release-gate.yml",
        pattern=r"Run authority alignment check",
        reason="External release gate must run the authority alignment checker automatically.",
    ),
    AuthorityRule(
        file_path=".github/workflows/external-release-gate.yml",
        pattern=r"python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q --junitxml=governance-scripts.junit.xml",
        reason="External release gate must run governance script regression tests automatically.",
    ),
    AuthorityRule(
        file_path="desktop/SIDECAR_IMPLEMENTATION_SUMMARY.md",
        pattern=r"main hard gate",
        reason="Sidecar implementation summary must document the main-branch hard gate.",
    ),
    AuthorityRule(
        file_path="docs/SECURITY_VISIBILITY.md",
        pattern=r"权威对齐检查：`python scripts/check_authority_alignment.py`",
        reason="Security visibility checklist must expose the local authority alignment check.",
    ),
    AuthorityRule(
        file_path="docs/SECURITY_VISIBILITY.md",
        pattern=r"workflow / runtime / docs authority alignment 锚点",
        reason="Security visibility must describe authority alignment as part of delivery-gate coverage.",
    ),
    AuthorityRule(
        file_path="docs/SECURITY_VISIBILITY.md",
        pattern=r"治理脚本回归：`python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q`",
        reason="Security visibility checklist must expose the local governance script regression command.",
    ),
    AuthorityRule(
        file_path="docs/release/RELEASE_NOTES.md",
        pattern=r"\| internal \| 内部 dry-run / 日常集成验证 \| 可跳过 \| 告警，不阻断 \| 用于内部验证；main 分支仍保留 authority alignment 与选定契约的阻断门禁 \|",
        reason="Release matrix must describe internal validation as still having main-branch blocking gates.",
    ),
    AuthorityRule(
        file_path="docs/release/RELEASE_NOTES.md",
        pattern=r"治理脚本回归日志：`python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q`",
        reason="Release notes must include governance script regression evidence in the release chain.",
    ),
    AuthorityRule(
        file_path="docs/release/RELEASE_NOTES.md",
        pattern=r"权威对齐检查通过",
        reason="Release notes must include authority alignment in the external Go/No-Go contract.",
    ),
    AuthorityRule(
        file_path="docs/release/RELEASE_NOTES.md",
        pattern=r"main 分支仍保留 authority alignment 与选定高风险契约的 blocking checks",
        reason="Release notes must describe internal main-branch blocking semantics clearly.",
    ),
    AuthorityRule(
        file_path="desktop/package.json",
        pattern=r'"local:start"',
        reason="Desktop package manifest must expose the local:start launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/package.json",
        pattern=r'"local:start:force"',
        reason="Desktop package manifest must expose the local:start:force launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/package.json",
        pattern=r'"local:start:binary"',
        reason="Desktop package manifest must expose the local:start:binary launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/package.json",
        pattern=r'"local:start:binary:force"',
        reason="Desktop package manifest must expose the local:start:binary:force launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/package.json",
        pattern=r'"local:gateway"',
        reason="Desktop package manifest must expose the local:gateway launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/package.json",
        pattern=r'"local:status"',
        reason="Desktop package manifest must expose the local:status launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/package.json",
        pattern=r'"local:stop"',
        reason="Desktop package manifest must expose the local:stop launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/package.json",
        pattern=r'"local:selftest"',
        reason="Desktop package manifest must expose the local:selftest launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/package.json",
        pattern=r'"local:pre-commit"',
        reason="Desktop package manifest must expose the local:pre-commit hook entrypoint.",
    ),
    AuthorityRule(
        file_path="src-ts/package.json",
        pattern=r'"check:pre-commit"',
        reason="src-ts package manifest must expose the check:pre-commit hook entrypoint.",
    ),
    AuthorityRule(
        file_path=".pre-commit-config.yaml",
        pattern=r"entry: python scripts/run_local_pre_commit\.py",
        reason="pre-commit hook config must route to the shared local pre-commit helper.",
    ),
    AuthorityRule(
        file_path="docs/testing/TEST_TIER_MATRIX.md",
        pattern=r"python -m pre_commit install",
        reason="Test tier matrix must document the pre-commit install step.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"\./scripts/start_desktop_local\.ps1",
        reason="README must document the local desktop launcher start entrypoint.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"\./scripts/status_desktop_local\.ps1",
        reason="README must document the local desktop launcher status entrypoint.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"\./scripts/stop_desktop_local\.ps1",
        reason="README must document the local desktop launcher stop entrypoint.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"\./scripts/selftest_desktop_local\.ps1",
        reason="README must document the local desktop launcher selftest entrypoint.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"npm --prefix desktop run local:start",
        reason="README must document the npm-based local desktop launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"local:start:binary:force",
        reason="README must document the npm-based binary-force local desktop launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"local:gateway",
        reason="README must document the npm-based gateway-only local launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"scripts\\start_desktop_local\.cmd",
        reason="README must document the cmd-based local desktop launcher start entrypoint.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"scripts\\stop_desktop_local\.cmd",
        reason="README must document the cmd-based local desktop launcher stop entrypoint.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"scripts\\status_desktop_local\.cmd",
        reason="README must document the cmd-based local desktop launcher status entrypoint.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"scripts\\selftest_desktop_local\.cmd",
        reason="README must document the cmd-based local desktop launcher selftest entrypoint.",
    ),
    AuthorityRule(
        file_path="README.md",
        pattern=r"-ForceDesktop",
        reason="README must document the ForceDesktop duplicate-window override.",
    ),
    AuthorityRule(
        file_path="desktop/README.md",
        pattern=r"\./scripts/start_desktop_local\.ps1",
        reason="Desktop README must document the local desktop launcher start entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/README.md",
        pattern=r"\./scripts/status_desktop_local\.ps1",
        reason="Desktop README must document the local desktop launcher status entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/README.md",
        pattern=r"\./scripts/stop_desktop_local\.ps1",
        reason="Desktop README must document the local desktop launcher stop entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/README.md",
        pattern=r"\./scripts/selftest_desktop_local\.ps1",
        reason="Desktop README must document the local desktop launcher selftest entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/README.md",
        pattern=r"npm run local:start",
        reason="Desktop README must document the npm-based local desktop launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/README.md",
        pattern=r"local:start:binary:force",
        reason="Desktop README must document the npm-based binary-force local desktop launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/README.md",
        pattern=r"local:gateway",
        reason="Desktop README must document the npm-based gateway-only local launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/README.md",
        pattern=r"scripts\\start_desktop_local\.cmd",
        reason="Desktop README must document the cmd-based local desktop launcher start entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/README.md",
        pattern=r"scripts\\stop_desktop_local\.cmd",
        reason="Desktop README must document the cmd-based local desktop launcher stop entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/README.md",
        pattern=r"scripts\\status_desktop_local\.cmd",
        reason="Desktop README must document the cmd-based local desktop launcher status entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/README.md",
        pattern=r"scripts\\selftest_desktop_local\.cmd",
        reason="Desktop README must document the cmd-based local desktop launcher selftest entrypoint.",
    ),
    AuthorityRule(
        file_path="desktop/README.md",
        pattern=r"-ForceDesktop",
        reason="Desktop README must document the ForceDesktop duplicate-window override.",
    ),
    AuthorityRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        pattern=r"\./scripts/start_desktop_local\.ps1",
        reason="Desktop runbook must document the local desktop launcher start entrypoint.",
    ),
    AuthorityRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        pattern=r"\./scripts/status_desktop_local\.ps1",
        reason="Desktop runbook must document the local desktop launcher status entrypoint.",
    ),
    AuthorityRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        pattern=r"\./scripts/stop_desktop_local\.ps1",
        reason="Desktop runbook must document the local desktop launcher stop entrypoint.",
    ),
    AuthorityRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        pattern=r"\./scripts/selftest_desktop_local\.ps1",
        reason="Desktop runbook must document the local desktop launcher selftest entrypoint.",
    ),
    AuthorityRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        pattern=r"npm --prefix desktop run local:start\|local:start:force\|local:start:binary\|local:start:binary:force\|local:gateway\|local:status\|local:stop\|local:selftest",
        reason="Desktop runbook must document the npm-based local desktop launcher entrypoints.",
    ),
    AuthorityRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        pattern=r"local:gateway",
        reason="Desktop runbook must document the npm-based gateway-only local launcher entrypoint.",
    ),
    AuthorityRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        pattern=r"scripts\\\\start_desktop_local\.cmd",
        reason="Desktop runbook must document the cmd-based local desktop launcher start entrypoint.",
    ),
    AuthorityRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        pattern=r"scripts\\\\stop_desktop_local\.cmd",
        reason="Desktop runbook must document the cmd-based local desktop launcher stop entrypoint.",
    ),
    AuthorityRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        pattern=r"scripts\\\\status_desktop_local\.cmd",
        reason="Desktop runbook must document the cmd-based local desktop launcher status entrypoint.",
    ),
    AuthorityRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        pattern=r"scripts\\\\selftest_desktop_local\.cmd",
        reason="Desktop runbook must document the cmd-based local desktop launcher selftest entrypoint.",
    ),
    AuthorityRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        pattern=r"-ForceDesktop",
        reason="Desktop runbook must document the ForceDesktop duplicate-window override.",
    ),
)

RULES: tuple[AuthorityRule, ...] = BASE_RULES + DELIVERY_CONTRACT_RULES


def main() -> int:
    mismatches: list[str] = []
    checked_files: set[str] = set()

    for rule in RULES:
        checked_files.add(rule.file_path)
        target = PROJECT_ROOT / rule.file_path
        if not target.exists():
            mismatches.append(f"{rule.file_path}: missing file")
            continue

        content = target.read_text(encoding="utf-8", errors="replace")
        matched = bool(re.search(rule.pattern, content, flags=re.MULTILINE))
        if rule.required and not matched:
            mismatches.append(f"{rule.file_path}: {rule.reason}")
        elif not rule.required and matched:
            mismatches.append(f"{rule.file_path}: {rule.reason}")

    payload = {
        "status": "PASS" if not mismatches else "FAIL",
        "checked_rules": len(RULES),
        "passed_rules": len(RULES) - len(mismatches),
        "failed_rules": len(mismatches),
        "checked_files": sorted(checked_files),
        "mismatches": mismatches,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if not mismatches else 1


if __name__ == "__main__":
    raise SystemExit(main())
