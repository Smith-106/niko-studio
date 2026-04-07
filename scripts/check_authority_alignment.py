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


RULES: tuple[AuthorityRule, ...] = (
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
)


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
