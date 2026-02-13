#!/usr/bin/env python
"""交付语义门禁脚本。用于自动确认是否存在明确的未交付信号。"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class GateRule:
    file_path: str
    pattern: str
    reason: str


RULES: tuple[GateRule, ...] = (
    GateRule(
        file_path="src/workflow/adapters/novel_adapter.py",
        pattern=r"human_review_status\s*:\s*\"pending\"",
        reason="存在人工审阅 pending 状态，交付语义未收口。",
    ),
    GateRule(
        file_path="src/workflow/adapters/novel_adapter.py",
        pattern=r"\[待处理\]\s*人工审阅未完成",
        reason="存在显式“待处理”提示，交付语义未收口。",
    ),
)


def check_rule(rule: GateRule) -> str | None:
    target = PROJECT_ROOT / rule.file_path
    if not target.exists():
        return f"[FAIL] 缺少门禁目标文件：{rule.file_path}"

    content = target.read_text(encoding="utf-8", errors="replace")
    if re.search(rule.pattern, content, flags=re.MULTILINE):
        return f"[FAIL] {rule.file_path}: {rule.reason}"

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
