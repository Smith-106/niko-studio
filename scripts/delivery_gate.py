#!/usr/bin/env python
"""交付语义门禁脚本。用于自动确认是否存在明确的未交付信号。"""

from __future__ import annotations

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
        file_path="src-ts/workflow/engine/risk.ts",
        needle="confirm_required: true",
        reason="缺少 confirm_required 强制确认锚点，高风险路径可能被绕过。",
    ),
    GateRule(
        file_path="src-ts/mcp/routes/content.ts",
        needle=r"pattern: /^\/chat\/stream$/",
        reason="缺少 /chat/stream 路由锚点，主交付流式链路不完整。",
    ),
    GateRule(
        file_path="src-ts/mcp/routes/content.ts",
        needle=r"pattern: /^\/chat$/",
        reason="缺少 /chat 路由锚点，流式失败后的降级链路不完整。",
    ),
    GateRule(
        file_path="src-ts/mcp/routes/platform.ts",
        needle=r"pattern: /^\/metrics$/, handler: metricsEndpoint",
        reason="缺少 /metrics 路由锚点，生产可观测守卫不可验证。",
    ),
    GateRule(
        file_path="src-ts/package.json",
        needle='"test:phase4"',
        reason="缺少 test:phase4 官方验证入口。",
    ),
    GateRule(
        file_path="src-ts/package.json",
        needle='"test:coverage:phase4"',
        reason="缺少 test:coverage:phase4 官方覆盖率验证入口。",
    ),
    GateRule(
        file_path="src-ts/package.json",
        needle='"check:pre-commit"',
        reason="缺少 src-ts 轻量 pre-commit 入口 check:pre-commit。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"local:pre-commit"',
        reason="缺少仓库级本地 pre-commit 入口 local:pre-commit。",
    ),
    GateRule(
        file_path=".pre-commit-config.yaml",
        needle="entry: python scripts/run_local_pre_commit.py",
        reason="缺少 pre-commit hook 配置入口。",
    ),
    GateRule(
        file_path="docs/testing/TEST_TIER_MATRIX.md",
        needle="python -m pre_commit install",
        reason="test tier matrix 未说明 pre-commit hook 安装入口。",
    ),
    GateRule(
        file_path="README.md",
        needle="python -m pre_commit install",
        reason="README 未说明 pre-commit hook 安装入口。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="python -m pre_commit install",
        reason="desktop README 未说明 pre-commit hook 安装入口。",
    ),
    GateRule(
        file_path="requirements.txt",
        needle="pre-commit>=3.8.0",
        reason="requirements 未声明 pre-commit 依赖。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"build:sidecar"',
        reason="缺少 desktop sidecar 构建入口。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"check:local"',
        reason="缺少 desktop 本地基线入口 check:local，桌面端无法在本地复现当前质量校验链路。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"check": "npm run typecheck && npm run build"',
        reason="缺少 desktop 统一质量入口 check。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"validate:package:dry-run"',
        reason="缺少 desktop packaging dry-run 入口。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"local:start"',
        reason="缺少 desktop 本地启动器入口 local:start。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"local:start:force"',
        reason="缺少 desktop 本地启动器入口 local:start:force。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"local:start:binary"',
        reason="缺少 desktop 本地启动器入口 local:start:binary。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"local:start:binary:force"',
        reason="缺少 desktop 本地启动器入口 local:start:binary:force。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"local:gateway"',
        reason="缺少 desktop 本地启动器入口 local:gateway。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"local:status"',
        reason="缺少 desktop 本地启动器入口 local:status。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"local:stop"',
        reason="缺少 desktop 本地启动器入口 local:stop。",
    ),
    GateRule(
        file_path="desktop/package.json",
        needle='"local:selftest"',
        reason="缺少 desktop 本地启动器入口 local:selftest。",
    ),
    GateRule(
        file_path="README.md",
        needle="./scripts/start_desktop_local.ps1",
        reason="README 未暴露本地桌面启动器 start 入口。",
    ),
    GateRule(
        file_path="README.md",
        needle="./scripts/status_desktop_local.ps1",
        reason="README 未暴露本地桌面启动器 status 入口。",
    ),
    GateRule(
        file_path="README.md",
        needle="./scripts/stop_desktop_local.ps1",
        reason="README 未暴露本地桌面启动器 stop 入口。",
    ),
    GateRule(
        file_path="README.md",
        needle="./scripts/selftest_desktop_local.ps1",
        reason="README 未暴露本地桌面启动器 selftest 入口。",
    ),
    GateRule(
        file_path="README.md",
        needle="npm --prefix desktop run local:start",
        reason="README 未暴露 npm 本地桌面启动入口。",
    ),
    GateRule(
        file_path="README.md",
        needle="local:start:binary:force",
        reason="README 未暴露 npm 二进制强制启动入口 local:start:binary:force。",
    ),
    GateRule(
        file_path="README.md",
        needle="local:gateway",
        reason="README 未暴露 npm gateway-only 启动入口 local:gateway。",
    ),
    GateRule(
        file_path="README.md",
        needle="scripts\\start_desktop_local.cmd",
        reason="README 未暴露 cmd 本地桌面启动器 start 入口。",
    ),
    GateRule(
        file_path="README.md",
        needle="scripts\\stop_desktop_local.cmd",
        reason="README 未暴露 cmd 本地桌面启动器 stop 入口。",
    ),
    GateRule(
        file_path="README.md",
        needle="scripts\\status_desktop_local.cmd",
        reason="README 未暴露 cmd 本地桌面启动器 status 入口。",
    ),
    GateRule(
        file_path="README.md",
        needle="scripts\\selftest_desktop_local.cmd",
        reason="README 未暴露 cmd 本地桌面启动器 selftest 入口。",
    ),
    GateRule(
        file_path="README.md",
        needle="-ForceDesktop",
        reason="README 未说明 ForceDesktop 多实例 override。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="./scripts/start_desktop_local.ps1",
        reason="desktop README 未暴露本地桌面启动器 start 入口。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="./scripts/status_desktop_local.ps1",
        reason="desktop README 未暴露本地桌面启动器 status 入口。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="./scripts/stop_desktop_local.ps1",
        reason="desktop README 未暴露本地桌面启动器 stop 入口。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="./scripts/selftest_desktop_local.ps1",
        reason="desktop README 未暴露本地桌面启动器 selftest 入口。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="npm run local:start",
        reason="desktop README 未暴露 npm 本地桌面启动入口。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="local:start:binary:force",
        reason="desktop README 未暴露 npm 二进制强制启动入口 local:start:binary:force。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="local:gateway",
        reason="desktop README 未暴露 npm gateway-only 启动入口 local:gateway。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="scripts\\start_desktop_local.cmd",
        reason="desktop README 未暴露 cmd 本地桌面启动器 start 入口。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="scripts\\stop_desktop_local.cmd",
        reason="desktop README 未暴露 cmd 本地桌面启动器 stop 入口。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="scripts\\status_desktop_local.cmd",
        reason="desktop README 未暴露 cmd 本地桌面启动器 status 入口。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="scripts\\selftest_desktop_local.cmd",
        reason="desktop README 未暴露 cmd 本地桌面启动器 selftest 入口。",
    ),
    GateRule(
        file_path="desktop/README.md",
        needle="-ForceDesktop",
        reason="desktop README 未说明 ForceDesktop 多实例 override。",
    ),
    GateRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        needle="./scripts/start_desktop_local.ps1",
        reason="desktop runbook 未暴露本地桌面启动器 start 入口。",
    ),
    GateRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        needle="./scripts/status_desktop_local.ps1",
        reason="desktop runbook 未暴露本地桌面启动器 status 入口。",
    ),
    GateRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        needle="./scripts/stop_desktop_local.ps1",
        reason="desktop runbook 未暴露本地桌面启动器 stop 入口。",
    ),
    GateRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        needle="./scripts/selftest_desktop_local.ps1",
        reason="desktop runbook 未暴露本地桌面启动器 selftest 入口。",
    ),
    GateRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        needle="npm --prefix desktop run local:start|local:start:force|local:start:binary|local:start:binary:force|local:gateway|local:status|local:stop|local:selftest",
        reason="desktop runbook 未暴露 npm 本地桌面启动入口集合。",
    ),
    GateRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        needle="local:gateway",
        reason="desktop runbook 未说明 npm gateway-only 启动入口。",
    ),
    GateRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        needle="scripts\\\\start_desktop_local.cmd",
        reason="desktop runbook 未暴露 cmd 本地桌面启动器 start 入口。",
    ),
    GateRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        needle="scripts\\\\stop_desktop_local.cmd",
        reason="desktop runbook 未暴露 cmd 本地桌面启动器 stop 入口。",
    ),
    GateRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        needle="scripts\\\\status_desktop_local.cmd",
        reason="desktop runbook 未暴露 cmd 本地桌面启动器 status 入口。",
    ),
    GateRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        needle="scripts\\\\selftest_desktop_local.cmd",
        reason="desktop runbook 未暴露 cmd 本地桌面启动器 selftest 入口。",
    ),
    GateRule(
        file_path="docs/operations/DESKTOP_RUNBOOK.md",
        needle="-ForceDesktop",
        reason="desktop runbook 未说明 ForceDesktop 多实例 override。",
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
    GateRule(
        file_path=".github/workflows/external-release-gate.yml",
        needle="python scripts/check_authority_alignment.py",
        reason="external release gate 未执行 authority alignment 检查，workflow/runtime/docs 口径可能漂移。",
    ),
    GateRule(
        file_path=".github/workflows/external-release-gate.yml",
        needle="npm run validate:package:dry-run",
        reason="external release gate 未执行 desktop packaging dry-run。",
    ),
    GateRule(
        file_path=".github/workflows/external-release-gate.yml",
        needle="uses: ./.github/workflows/writing-helper-acceptance.yml",
        reason="external release gate 未复用 writing-helper acceptance 工作流。",
    ),
    GateRule(
        file_path=".github/workflows/writing-helper-acceptance.yml",
        needle="workflow_call:",
        reason="writing-helper acceptance 工作流未暴露为可复用 release gate。",
    ),
    GateRule(
        file_path=".github/workflows/writing-helper-acceptance.yml",
        needle="uses: actions/setup-node@",
        reason="writing-helper acceptance 未显式准备 Node authoritative runtime。",
    ),
    GateRule(
        file_path=".github/workflows/writing-helper-acceptance.yml",
        needle="working-directory: src-ts",
        reason="writing-helper acceptance 未显式安装 src-ts 依赖，Node-first gateway 无法稳定启动。",
    ),
    GateRule(
        file_path="docs/release/RELEASE_NOTES.md",
        needle="权威对齐检查通过",
        reason="release notes 未把 authority alignment 作为 external Go/No-Go 条件。",
    ),
    GateRule(
        file_path="docs/release/RELEASE_NOTES.md",
        needle="用于内部验证；main 分支仍保留 authority alignment 与选定契约的阻断门禁",
        reason="release notes 的 internal 矩阵行未体现 main 分支仍有阻断门禁。",
    ),
    GateRule(
        file_path="docs/SECURITY_VISIBILITY.md",
        needle="权威对齐检查：`python scripts/check_authority_alignment.py`",
        reason="安全可见化清单未暴露 authority alignment 本地检查入口。",
    ),
    GateRule(
        file_path="docs/SECURITY_VISIBILITY.md",
        needle="workflow / runtime / docs authority alignment 锚点",
        reason="安全可见化清单未将 authority alignment 归入交付语义门禁覆盖范围。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle='"authority_alignment_signal"',
        reason="release summary 未将 authority_alignment_signal 视为 P0 blocking 信号。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle='"desktop_packaging_dry_run"',
        reason="release summary 未将 desktop packaging dry-run 视为 P0 blocking 信号。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle='"delivery_contract": delivery_contract,',
        reason="release summary 未把 100% delivery contract 写入 machine-readable contract。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle='"scorecard_dimensions": scorecard_dimensions,',
        reason="release summary 未把单一 100% scorecard 维度写入 machine-readable contract。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle="Single scorecard contract: functional + testing + release + governance must all be PASS before the repo can claim 100% completion.",
        reason="release summary 未声明单一 100% scorecard 合约。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle='"delivery_contract_100_signal",',
        reason="release summary 未暴露 100% delivery contract blocking signal。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle='"gate_signal": "delivery_contract_100_signal"',
        reason="release summary 未声明 100% delivery contract 的 blocking signal 名称。",
    ),
    GateRule(
        file_path="docs/release/SIGN_OFF.md",
        needle="100% completion contract",
        reason="release sign-off 文档未声明 100% completion contract。",
    ),
    GateRule(
        file_path="docs/release/SIGN_OFF.md",
        needle="The release summary is the authoritative single scorecard for 100% completion.",
        reason="release sign-off 文档未声明 release summary 是 100% completion 的权威 scorecard。",
    ),
    GateRule(
        file_path="docs/release/SIGN_OFF.md",
        needle="issue_pending_blocker_signal` is blocking.",
        reason="release sign-off 文档未声明 issue pending 是 blocking release gate。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle='"writing_helper_acceptance_signal"',
        reason="release summary 未将 writing-helper acceptance 视为 P0 blocking 信号。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle='"local_selftest_enforcement"',
        reason="release summary 未暴露 local:selftest enforcement blocking 信号。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle='"release_evidence": release_evidence,',
        reason="release summary 未把 retained release evidence 元数据写入 machine-readable contract。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle="LOCAL_SELFTEST_REQUIRED_RELEASE_SOURCES",
        reason="release summary 未将 local:selftest enforcement 绑定到 retained release evidence 来源集合。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle='("freshness_status", retained_evidence["freshness_status"])',
        reason="release summary 未显式输出 retained evidence freshness_status。",
    ),
    GateRule(
        file_path="scripts/release_check_summary.py",
        needle='("supersession_status", retained_evidence["supersession_status"])',
        reason="release summary 未显式输出 retained evidence supersession_status。",
    ),
    GateRule(
        file_path="docs/release/SIGN_OFF.md",
        needle="certificateThumbprint",
        reason="release sign-off 文档未显式记录签名先决条件。",
    ),
    GateRule(
        file_path="docs/release/SIGN_OFF.md",
        needle="check-writing-helper.ps1 -Strict -Port 18080 -Host 127.0.0.1",
        reason="release sign-off 文档未暴露 writing-helper acceptance 本地执行命令。",
    ),
    GateRule(
        file_path="docs/release/SIGN_OFF.md",
        needle=".workflow/evidence/release/writing-helper-acceptance.json",
        reason="release sign-off 文档未声明 retained writing-helper acceptance artifact。",
    ),
    GateRule(
        file_path="docs/release/SIGN_OFF.md",
        needle="freshness_status: fresh",
        reason="release sign-off 文档未声明 retained evidence freshness green-state 合约。",
    ),
    GateRule(
        file_path="docs/release/SIGN_OFF.md",
        needle="supersession_status: current",
        reason="release sign-off 文档未声明 retained evidence supersession green-state 合约。",
    ),
    GateRule(
        file_path="docs/release/SIGN_OFF.md",
        needle=".workflow/evidence/release/release-readiness-artifact.json",
        reason="release sign-off 文档未声明 retained release-readiness artifact 元数据锚点。",
    ),
    GateRule(
        file_path="docs/release/SIGN_OFF.md",
        needle="`npm --prefix desktop run local:selftest` is the authoritative launcher smoke-test.",
        reason="release sign-off 文档未声明 authoritative local:selftest smoke-test 入口。",
    ),
    GateRule(
        file_path="docs/release/SIGN_OFF.md",
        needle="blocking `local_selftest_enforcement` signal",
        reason="release sign-off 文档未声明 local:selftest enforcement 的 blocking signal。",
    ),
    GateRule(
        file_path="docs/testing/TEST_TIER_MATRIX.md",
        needle="Treat `npm --prefix desktop run local:selftest` as mandatory whenever retained release evidence for the current HEAD is not already `fresh_current`",
        reason="test tier matrix 未声明 retained evidence 驱动的 local:selftest 强制条件。",
    ),
    GateRule(
        file_path=".github/workflows/writing-helper-acceptance.yml",
        needle="writing-helper-acceptance.json",
        reason="writing-helper acceptance 工作流未保留 acceptance evidence artifact。",
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
