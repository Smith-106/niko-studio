#!/usr/bin/env python
"""交付语义门禁脚本。用于自动确认是否存在明确的未交付信号。"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class GateRule:
    file_path: str
    needle: str
    reason: str
    must_exist: bool = True


RULES: tuple[GateRule, ...] = (
    GateRule(
        file_path="src-ts/workflow/workflow-engine.ts",
        needle="WorkflowDecision.NO_GO",
        reason="缺少 NO_GO 决策锚点，无法保证高风险写入的硬门禁。",
    ),
    GateRule(
        file_path="src-ts/workflow/workflow-engine.ts",
        needle="confirm_required: true",
        reason="缺少 confirm_required 强制确认锚点，高风险路径可能被绕过。",
    ),
    GateRule(
        file_path="src-ts/gateway-server.ts",
        needle="pattern: /^\\/chat\\/stream$/",
        reason="缺少 /chat/stream 路由锚点，主交付流式链路不完整。",
    ),
    GateRule(
        file_path="src-ts/gateway-server.ts",
        needle="pattern: /^\\/chat$/",
        reason="缺少 /chat 路由锚点，流式失败后的降级链路不完整。",
    ),
    GateRule(
        file_path="src-ts/gateway-server.ts",
        needle="pattern: /^\\/metrics$/",
        reason="缺少 /metrics 路由锚点，生产可观测守卫不可验证。",
    ),
    GateRule(
        file_path="src-ts/package.json",
        needle="\"test:phase4\"",
        reason="缺少 test:phase4 官方验证入口。",
    ),
    GateRule(
        file_path="src-ts/package.json",
        needle="\"test:coverage:phase4\"",
        reason="缺少 test:coverage:phase4 官方覆盖率验证入口。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle="\"build:sidecar\"",
        reason="缺少 desktop sidecar 构建入口。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle="\"check\": \"npm run typecheck && npm run build\"",
        reason="缺少 desktop 统一质量入口 check。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle="from src.",
        reason="release summary 仍依赖 legacy Python src 模块，权威路径回退。",
        must_exist=False,
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle="--cov=src",
        reason="baseline 覆盖率仍绑定 legacy src 树，未切换到 Phase4 TS 面。",
        must_exist=False,
    ),
)


def check_rule(rule: GateRule) -> str | None:
    target = PROJECT_ROOT / rule.file_path
    if not target.exists():
        return f"[FAIL] 缺少门禁目标文件：{rule.file_path}"

    content = target.read_text(encoding="utf-8", errors="replace")
    matched = rule.needle in content
    if rule.must_exist and not matched:
        return f"[FAIL] {rule.file_path}: {rule.reason} (missing anchor: {rule.needle})"
    if not rule.must_exist and matched:
        return f"[FAIL] {rule.file_path}: {rule.reason} (forbidden anchor: {rule.needle})"

    return None


def main() -> int:
    print("delivery gate: start")

    failures = [msg for rule in RULES if (msg := check_rule(rule))]
    if failures:
        print("delivery gate: blocked")
        for failure in failures:
            print(failure)
        return 1

    print("delivery gate: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
