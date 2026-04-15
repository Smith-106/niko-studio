from __future__ import annotations

import importlib.util
import io
import json
import sys
from contextlib import redirect_stdout
from pathlib import Path
from types import ModuleType

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def load_script_module(relative_path: str, module_name: str) -> ModuleType:
    script_path = PROJECT_ROOT / relative_path
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def test_authority_alignment_checker_passes_current_repo() -> None:
    module = load_script_module(
        "scripts/check_authority_alignment.py",
        "test_check_authority_alignment_current_repo",
    )

    buffer = io.StringIO()
    with redirect_stdout(buffer):
        exit_code = module.main()

    payload = json.loads(buffer.getvalue())

    assert exit_code == 0
    assert payload["status"] == "PASS"
    assert payload["failed_rules"] == 0
    assert payload["checked_rules"] >= 20
    assert ".github/workflows/external-release-gate.yml" in payload["checked_files"]


def test_delivery_gate_rules_cover_authority_alignment_contract() -> None:
    module = load_script_module(
        "scripts/delivery_gate.py",
        "test_delivery_gate_rule_contract",
    )

    rule_map = {(rule.file_path, rule.needle, rule.must_exist) for rule in module.RULES}

    assert (
        ".github/workflows/external-release-gate.yml",
        "python scripts/check_authority_alignment.py",
        True,
    ) in rule_map
    assert (
        ".github/workflows/external-release-gate.yml",
        "npm run validate:package:dry-run",
        True,
    ) in rule_map
    assert (
        ".github/workflows/external-release-gate.yml",
        "uses: ./.github/workflows/writing-helper-acceptance.yml",
        True,
    ) in rule_map
    assert (
        "src-ts/mcp/routes/content.ts",
        r"pattern: /^\/chat\/stream$/",
        True,
    ) in rule_map
    assert (
        "src-ts/mcp/routes/platform.ts",
        r"pattern: /^\/metrics$/, handler: metricsEndpoint",
        True,
    ) in rule_map
    assert (
        ".github/workflows/writing-helper-acceptance.yml",
        "workflow_call:",
        True,
    ) in rule_map
    assert (
        "docs/release/RELEASE_NOTES.md",
        "用于内部验证；main 分支仍保留 authority alignment 与选定契约的阻断门禁",
        True,
    ) in rule_map
    assert (
        "docs/release/SIGN_OFF.md",
        "certificateThumbprint",
        True,
    ) in rule_map
    assert (
        "docs/SECURITY_VISIBILITY.md",
        "workflow / runtime / docs authority alignment 锚点",
        True,
    ) in rule_map
    assert (
        "src-ts/workflow/engine/risk.ts",
        "confirm_required: true",
        True,
    ) in rule_map
    assert any(
        file_path == "scripts/release_check_summary.py"
        and '"authority_alignment_signal"' in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert any(
        file_path == "scripts/release_check_summary.py"
        and '"desktop_packaging_dry_run"' in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert ("desktop/package.json", '"local:start"', True) in rule_map
    assert ("desktop/package.json", '"local:start:force"', True) in rule_map
    assert ("desktop/package.json", '"local:start:binary"', True) in rule_map
    assert ("desktop/package.json", '"local:start:binary:force"', True) in rule_map
    assert ("desktop/package.json", '"local:gateway"', True) in rule_map
    assert ("desktop/package.json", '"local:status"', True) in rule_map
    assert ("desktop/package.json", '"local:stop"', True) in rule_map
    assert ("desktop/package.json", '"local:selftest"', True) in rule_map
    assert ("README.md", "./scripts/start_desktop_local.ps1", True) in rule_map
    assert ("README.md", "./scripts/status_desktop_local.ps1", True) in rule_map
    assert ("README.md", "./scripts/stop_desktop_local.ps1", True) in rule_map
    assert ("README.md", "./scripts/selftest_desktop_local.ps1", True) in rule_map
    assert ("README.md", "npm --prefix desktop run local:start", True) in rule_map
    assert ("README.md", "local:start:binary:force", True) in rule_map
    assert ("README.md", "local:gateway", True) in rule_map
    assert ("README.md", "scripts\\start_desktop_local.cmd", True) in rule_map
    assert ("README.md", "scripts\\stop_desktop_local.cmd", True) in rule_map
    assert ("README.md", "scripts\\status_desktop_local.cmd", True) in rule_map
    assert ("README.md", "scripts\\selftest_desktop_local.cmd", True) in rule_map
    assert ("README.md", "-ForceDesktop", True) in rule_map
    assert ("desktop/README.md", "./scripts/start_desktop_local.ps1", True) in rule_map
    assert ("desktop/README.md", "./scripts/status_desktop_local.ps1", True) in rule_map
    assert ("desktop/README.md", "./scripts/stop_desktop_local.ps1", True) in rule_map
    assert ("desktop/README.md", "./scripts/selftest_desktop_local.ps1", True) in rule_map
    assert ("desktop/README.md", "npm run local:start", True) in rule_map
    assert ("desktop/README.md", "local:start:binary:force", True) in rule_map
    assert ("desktop/README.md", "local:gateway", True) in rule_map
    assert ("desktop/README.md", "scripts\\start_desktop_local.cmd", True) in rule_map
    assert ("desktop/README.md", "scripts\\stop_desktop_local.cmd", True) in rule_map
    assert ("desktop/README.md", "scripts\\status_desktop_local.cmd", True) in rule_map
    assert ("desktop/README.md", "scripts\\selftest_desktop_local.cmd", True) in rule_map
    assert ("desktop/README.md", "-ForceDesktop", True) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", "./scripts/start_desktop_local.ps1", True) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", "./scripts/status_desktop_local.ps1", True) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", "./scripts/stop_desktop_local.ps1", True) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", "./scripts/selftest_desktop_local.ps1", True) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        "npm --prefix desktop run local:start|local:start:force|local:start:binary|local:start:binary:force|local:gateway|local:status|local:stop|local:selftest",
        True,
    ) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", "local:gateway", True) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", "scripts\\\\start_desktop_local.cmd", True) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", "scripts\\\\stop_desktop_local.cmd", True) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", "scripts\\\\status_desktop_local.cmd", True) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", "scripts\\\\selftest_desktop_local.cmd", True) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", "-ForceDesktop", True) in rule_map


def test_delivery_gate_passes_current_repo() -> None:
    module = load_script_module(
        "scripts/delivery_gate.py",
        "test_delivery_gate_current_repo",
    )

    buffer = io.StringIO()
    with redirect_stdout(buffer):
        exit_code = module.main()

    output = buffer.getvalue()

    assert exit_code == 0
    assert "delivery gate: ok" in output


def test_desktop_local_launcher_scripts_are_exposed_via_package_json() -> None:
    package_json = json.loads((PROJECT_ROOT / "desktop" / "package.json").read_text(encoding="utf-8"))
    scripts = package_json["scripts"]

    assert scripts["local:start"] == (
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/start_desktop_local.ps1"
    )
    assert scripts["local:start:force"] == (
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/start_desktop_local.ps1 -ForceDesktop"
    )
    assert scripts["local:start:binary"] == (
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/start_desktop_local.ps1 -BinaryDesktop"
    )
    assert scripts["local:start:binary:force"] == (
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/start_desktop_local.ps1 -BinaryDesktop -ForceDesktop"
    )
    assert scripts["local:gateway"] == (
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/start_desktop_local.ps1 -NoDesktop"
    )
    assert scripts["local:status"] == (
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/status_desktop_local.ps1"
    )
    assert scripts["local:stop"] == (
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/stop_desktop_local.ps1"
    )
    assert scripts["local:selftest"] == (
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/selftest_desktop_local.ps1"
    )


def test_desktop_local_launcher_wrapper_scripts_forward_to_matching_powershell_files() -> None:
    expected_wrappers = {
        "start_desktop_local": "start_desktop_local.ps1",
        "stop_desktop_local": "stop_desktop_local.ps1",
        "status_desktop_local": "status_desktop_local.ps1",
        "selftest_desktop_local": "selftest_desktop_local.ps1",
    }

    for stem, powershell_name in expected_wrappers.items():
        powershell_script = PROJECT_ROOT / "scripts" / powershell_name
        cmd_wrapper = PROJECT_ROOT / "scripts" / f"{stem}.cmd"

        assert powershell_script.exists(), f"Missing launcher script: {powershell_script}"
        assert cmd_wrapper.exists(), f"Missing wrapper script: {cmd_wrapper}"

        wrapper_text = cmd_wrapper.read_text(encoding="utf-8").replace("\r\n", "\n")
        assert wrapper_text == (
            "@echo off\n"
            "setlocal\n"
            f'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0{powershell_name}" %*\n'
        )


def test_desktop_local_powershell_scripts_preserve_public_parameter_contract() -> None:
    start_script = (PROJECT_ROOT / "scripts" / "start_desktop_local.ps1").read_text(encoding="utf-8")
    selftest_script = (PROJECT_ROOT / "scripts" / "selftest_desktop_local.ps1").read_text(encoding="utf-8")
    status_script = (PROJECT_ROOT / "scripts" / "status_desktop_local.ps1").read_text(encoding="utf-8")
    stop_script = (PROJECT_ROOT / "scripts" / "stop_desktop_local.ps1").read_text(encoding="utf-8")

    assert "[Alias('Host')]" in start_script
    assert "[string]$GatewayHost = '127.0.0.1'" in start_script
    assert "[int]$PreferredPort = 8000" in start_script
    assert "[int]$FallbackPort = 8010" in start_script
    assert "[switch]$BinaryDesktop" in start_script
    assert "[switch]$NoDesktop" in start_script
    assert "[switch]$NoReuseGateway" in start_script
    assert "[switch]$ForceDesktop" in start_script
    assert "$desktopExe = Join-Path $desktopDir 'src-tauri\\target\\debug\\niko-studio-desktop.exe'" in start_script
    assert "$statePath = Join-Path $logDir 'desktop-local-state.json'" in start_script

    assert "[Alias('Host')]" in selftest_script
    assert "[string]$GatewayHost = '127.0.0.1'" in selftest_script
    assert "[int]$PreferredPort = 18100" in selftest_script
    assert "[int]$FallbackPort = 18101" in selftest_script
    assert (
        "& (Join-Path $PSScriptRoot 'start_desktop_local.ps1') -NoDesktop -NoReuseGateway "
        "-GatewayHost $GatewayHost -PreferredPort $PreferredPort -FallbackPort $FallbackPort | Out-Host"
    ) in selftest_script
    assert "& (Join-Path $PSScriptRoot 'status_desktop_local.ps1') | Out-Host" in selftest_script
    assert "& (Join-Path $PSScriptRoot 'stop_desktop_local.ps1') | Out-Host" in selftest_script

    assert "$statePath = Join-Path $projectRoot '.codex-run\\desktop-local-state.json'" in status_script
    assert "foreach ($candidatePort in @(8000, 8010))" in status_script
    assert "Write-Host 'Niko Studio local status' -ForegroundColor Cyan" in status_script

    assert "$statePath = Join-Path $projectRoot '.codex-run\\desktop-local-state.json'" in stop_script
    assert 'Write-Host "State file not found: $statePath"' in stop_script
    assert "Stop-ListenerOnPort -Port $state.gateway.port -Managed ([bool]$state.gateway.managed)" in stop_script
    assert 'Write-Host "Removed state file: $statePath"' in stop_script


def test_writing_helper_acceptance_contract_uses_windows_powershell_and_bom_script() -> None:
    workflow_text = (
        PROJECT_ROOT / ".github/workflows/writing-helper-acceptance.yml"
    ).read_text(encoding="utf-8").replace("\r\n", "\n")
    sign_off_text = (PROJECT_ROOT / "docs/release/SIGN_OFF.md").read_text(encoding="utf-8")
    script_path = PROJECT_ROOT / "scripts" / "check-writing-helper.ps1"
    script_bytes = script_path.read_bytes()
    script_text = script_bytes.decode("utf-8-sig")

    assert script_bytes.startswith(b"\xef\xbb\xbf")
    assert "shell: powershell" in workflow_text
    assert (
        r"powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-writing-helper.ps1"
        in workflow_text
    )
    assert (
        r"powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-writing-helper.ps1 -Strict -Port 18080 -Host 127.0.0.1"
        in sign_off_text
    )
    assert "[Alias('Host')]" in script_text
    assert "failed-writing-helper-cases.json" in script_text


def test_desktop_local_launcher_docs_share_same_entrypoints() -> None:
    root_readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")
    desktop_readme = (PROJECT_ROOT / "desktop" / "README.md").read_text(encoding="utf-8")
    runbook = (PROJECT_ROOT / "docs" / "operations" / "DESKTOP_RUNBOOK.md").read_text(encoding="utf-8")

    assert "./scripts/start_desktop_local.ps1" in root_readme
    assert "./scripts/status_desktop_local.ps1" in root_readme
    assert "./scripts/stop_desktop_local.ps1" in root_readme
    assert "./scripts/selftest_desktop_local.ps1" in root_readme
    assert "npm --prefix desktop run local:start" in root_readme
    assert "local:start:force" in root_readme
    assert "local:start:binary" in root_readme
    assert "local:start:binary:force" in root_readme
    assert "local:gateway" in root_readme
    assert "local:status" in root_readme
    assert "local:stop" in root_readme
    assert "local:selftest" in root_readme
    assert "scripts\\start_desktop_local.cmd" in root_readme
    assert "scripts\\stop_desktop_local.cmd" in root_readme
    assert "scripts\\status_desktop_local.cmd" in root_readme
    assert "scripts\\selftest_desktop_local.cmd" in root_readme

    assert "./scripts/start_desktop_local.ps1" in desktop_readme
    assert "./scripts/stop_desktop_local.ps1" in desktop_readme
    assert "./scripts/status_desktop_local.ps1" in desktop_readme
    assert "./scripts/selftest_desktop_local.ps1" in desktop_readme
    assert "npm run local:start" in desktop_readme
    assert "local:start:force" in desktop_readme
    assert "local:start:binary" in desktop_readme
    assert "local:start:binary:force" in desktop_readme
    assert "local:gateway" in desktop_readme
    assert "local:status" in desktop_readme
    assert "local:stop" in desktop_readme
    assert "local:selftest" in desktop_readme
    assert "scripts\\start_desktop_local.cmd" in desktop_readme
    assert "scripts\\stop_desktop_local.cmd" in desktop_readme
    assert "scripts\\status_desktop_local.cmd" in desktop_readme
    assert "scripts\\selftest_desktop_local.cmd" in desktop_readme
    assert "-ForceDesktop" in desktop_readme

    assert "./scripts/start_desktop_local.ps1" in runbook
    assert "./scripts/status_desktop_local.ps1" in runbook
    assert "./scripts/stop_desktop_local.ps1" in runbook
    assert "./scripts/selftest_desktop_local.ps1" in runbook
    assert "npm --prefix desktop run local:start|local:start:force|local:start:binary|local:start:binary:force|local:gateway|local:status|local:stop|local:selftest" in runbook
    assert "local:gateway" in runbook
    assert "scripts\\\\start_desktop_local.cmd" in runbook
    assert "scripts\\\\stop_desktop_local.cmd" in runbook
    assert "scripts\\\\status_desktop_local.cmd" in runbook
    assert "scripts\\\\selftest_desktop_local.cmd" in runbook
    assert "-ForceDesktop" in runbook


def test_authority_alignment_rules_cover_local_desktop_launcher_contract() -> None:
    module = load_script_module(
        "scripts/check_authority_alignment.py",
        "test_check_authority_alignment_local_desktop_launcher_contract",
    )

    rule_map = {(rule.file_path, rule.pattern, rule.required) for rule in module.RULES}

    assert ("desktop/package.json", r'"local:start"', True) in rule_map
    assert ("desktop/package.json", r'"local:start:force"', True) in rule_map
    assert ("desktop/package.json", r'"local:start:binary"', True) in rule_map
    assert ("desktop/package.json", r'"local:start:binary:force"', True) in rule_map
    assert ("desktop/package.json", r'"local:gateway"', True) in rule_map
    assert ("desktop/package.json", r'"local:status"', True) in rule_map
    assert ("desktop/package.json", r'"local:stop"', True) in rule_map
    assert ("desktop/package.json", r'"local:selftest"', True) in rule_map
    assert ("README.md", r"\./scripts/start_desktop_local\.ps1", True) in rule_map
    assert ("README.md", r"\./scripts/status_desktop_local\.ps1", True) in rule_map
    assert ("README.md", r"\./scripts/stop_desktop_local\.ps1", True) in rule_map
    assert ("README.md", r"\./scripts/selftest_desktop_local\.ps1", True) in rule_map
    assert ("README.md", r"npm --prefix desktop run local:start", True) in rule_map
    assert ("README.md", r"local:start:binary:force", True) in rule_map
    assert ("README.md", r"local:gateway", True) in rule_map
    assert ("README.md", r"scripts\\start_desktop_local\.cmd", True) in rule_map
    assert ("README.md", r"scripts\\stop_desktop_local\.cmd", True) in rule_map
    assert ("README.md", r"scripts\\status_desktop_local\.cmd", True) in rule_map
    assert ("README.md", r"scripts\\selftest_desktop_local\.cmd", True) in rule_map
    assert ("README.md", r"-ForceDesktop", True) in rule_map
    assert ("desktop/README.md", r"\./scripts/start_desktop_local\.ps1", True) in rule_map
    assert ("desktop/README.md", r"\./scripts/status_desktop_local\.ps1", True) in rule_map
    assert ("desktop/README.md", r"\./scripts/stop_desktop_local\.ps1", True) in rule_map
    assert ("desktop/README.md", r"\./scripts/selftest_desktop_local\.ps1", True) in rule_map
    assert ("desktop/README.md", r"npm run local:start", True) in rule_map
    assert ("desktop/README.md", r"local:start:binary:force", True) in rule_map
    assert ("desktop/README.md", r"local:gateway", True) in rule_map
    assert ("desktop/README.md", r"scripts\\start_desktop_local\.cmd", True) in rule_map
    assert ("desktop/README.md", r"scripts\\stop_desktop_local\.cmd", True) in rule_map
    assert ("desktop/README.md", r"scripts\\status_desktop_local\.cmd", True) in rule_map
    assert ("desktop/README.md", r"scripts\\selftest_desktop_local\.cmd", True) in rule_map
    assert ("desktop/README.md", r"-ForceDesktop", True) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        r"\./scripts/start_desktop_local\.ps1",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        r"\./scripts/status_desktop_local\.ps1",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        r"\./scripts/stop_desktop_local\.ps1",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        r"\./scripts/selftest_desktop_local\.ps1",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        r"npm --prefix desktop run local:start\|local:start:force\|local:start:binary\|local:start:binary:force\|local:gateway\|local:status\|local:stop\|local:selftest",
        True,
    ) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", r"local:gateway", True) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        r"scripts\\\\start_desktop_local\.cmd",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        r"scripts\\\\stop_desktop_local\.cmd",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        r"scripts\\\\status_desktop_local\.cmd",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        r"scripts\\\\selftest_desktop_local\.cmd",
        True,
    ) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", r"-ForceDesktop", True) in rule_map


def test_authority_alignment_signal_helper_returns_fail_for_nonzero_exit() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_authority_fail",
    )

    status, exit_code, detail = module.authority_alignment_signal(
        1,
        {
            "checked_rules": 20,
            "passed_rules": 19,
            "failed_rules": 1,
            "checked_files": ["README.md"],
            "mismatches": ["README.md: missing anchor"],
        },
        None,
    )

    assert status == "FAIL"
    assert exit_code == 1
    assert "failed_rules=1" in detail
    assert "mismatches=README.md: missing anchor" in detail


def test_authority_alignment_signal_helper_returns_pass_for_clean_payload() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_authority_pass",
    )

    status, exit_code, detail = module.authority_alignment_signal(
        0,
        {
            "status": "PASS",
            "checked_rules": 20,
            "passed_rules": 20,
            "failed_rules": 0,
            "checked_files": ["README.md", "docs/INDEX.md"],
            "mismatches": [],
        },
        None,
    )

    assert status == "PASS"
    assert exit_code == 0
    assert "checked_rules=20" in detail
    assert "failed_rules=0" in detail
    assert "checked_files=2" in detail


def test_release_summary_and_sign_off_share_desktop_authoritative_gate() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_desktop_gate_contract",
    )

    sign_off_text = (PROJECT_ROOT / "docs/release/SIGN_OFF.md").read_text(encoding="utf-8")
    summary_source = (PROJECT_ROOT / "scripts/release_check_summary.py").read_text(encoding="utf-8")
    package_json = json.loads((PROJECT_ROOT / "desktop/package.json").read_text(encoding="utf-8"))

    assert module.DESKTOP_AUTHORITATIVE_LOCAL_GATE_COMMAND == "npm --prefix desktop run check:local"
    assert module.DESKTOP_AUTHORITATIVE_LOCAL_GATE_ARGS == [
        "npm.cmd",
        "--prefix",
        "desktop",
        "run",
        "check:local",
    ]
    assert "The authoritative desktop local gate is `npm --prefix desktop run check:local`." in sign_off_text
    assert "`python scripts/release_check_summary.py` reruns this exact command" in sign_off_text
    assert package_json["scripts"]["check:local"] == "npm run check:release"
    assert "run_cmd(DESKTOP_AUTHORITATIVE_LOCAL_GATE_ARGS)" in summary_source
    assert '("command", DESKTOP_AUTHORITATIVE_LOCAL_GATE_COMMAND)' in summary_source
    assert "desktop_authoritative_local_gate" in summary_source
