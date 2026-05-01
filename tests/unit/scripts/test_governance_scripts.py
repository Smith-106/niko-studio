from __future__ import annotations

import importlib.util
import io
import json
import os
import platform
import shutil
import subprocess
import sys
import textwrap
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def load_script_module(relative_path: str, module_name: str) -> ModuleType:
    script_path = PROJECT_ROOT / relative_path
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def run_node_cjs_and_capture(
    relative_path: str,
    *,
    env_overrides: dict[str, str | None] | None = None,
    argv: list[str] | None = None,
    platform_name: str | None = None,
    arch: str | None = None,
    exists_paths: dict[Path | str, bool] | None = None,
    json_files: dict[Path | str, object] | None = None,
    fail_commands: list[str] | None = None,
) -> dict[str, object]:
    node_binary = shutil.which("node")
    if node_binary is None:
        pytest.skip("node is required for governance script regression tests")

    script_path = PROJECT_ROOT / relative_path
    env = os.environ.copy()
    for key, value in (env_overrides or {}).items():
        if value is None:
            env.pop(key, None)
        else:
            env[key] = value

    payload = {
        "scriptPath": str(script_path),
        "argv": argv or [],
        "platform": platform_name,
        "arch": arch,
        "existsPaths": {str(Path(path)): exists for path, exists in (exists_paths or {}).items()},
        "jsonFiles": {str(Path(path)): value for path, value in (json_files or {}).items()},
        "failCommands": fail_commands or [],
    }
    env["CJS_TEST_PAYLOAD"] = json.dumps(payload)

    harness = textwrap.dedent(
        """
        const fs = require('fs');
        const path = require('path');
        const vm = require('vm');

        const payload = JSON.parse(process.env.CJS_TEST_PAYLOAD);
        const scriptPath = path.resolve(payload.scriptPath);
        const rawScriptSource = fs.readFileSync(scriptPath, 'utf8');
        const shebangNewlineIndex = rawScriptSource.indexOf(String.fromCharCode(10));
        const scriptSource = rawScriptSource.startsWith('#!')
          ? rawScriptSource.slice(shebangNewlineIndex >= 0 ? shebangNewlineIndex + 1 : rawScriptSource.length)
          : rawScriptSource;
        const logs = [];
        const errors = [];
        const commands = [];
        let exitCode = 0;

        const existsMap = new Map(
          Object.entries(payload.existsPaths || {}).map(([filePath, exists]) => [
            path.normalize(path.resolve(filePath)),
            exists,
          ]),
        );
        const jsonFileMap = new Map(
          Object.entries(payload.jsonFiles || {}).map(([filePath, value]) => [
            path.normalize(path.resolve(filePath)),
            typeof value === 'string' ? value : JSON.stringify(value),
          ]),
        );

        // ISS-20260430-001 follow-up: choose_sidecar.cjs gained
        // detectStalePythonBinaries (uses fs.statSync) and writeSidecarManifest
        // (uses fs.mkdirSync + fs.writeFileSync). validate_sidecar_contract.cjs
        // also uses fs.statSync for the version contract check. Without these
        // stubs the harness throws "fs.X is not a function" before reaching the
        // assertions the tests actually care about.
        //
        // Stub semantics:
        //  - statSync: for paths in existsMap (test-mocked) return a fake stat
        //              with mtimeMs=now (treats them as fresh — staleness
        //              detection won't false-positive against test fixtures).
        //              For real-disk paths, passthrough.
        //  - writeFileSync / mkdirSync: no-op. Tests don't currently inspect
        //              writes; if a future test needs to, capture into a Map.
        const fsStub = {
          existsSync(filePath) {
            const normalizedPath = path.normalize(path.resolve(filePath));
            if (existsMap.has(normalizedPath)) {
              return existsMap.get(normalizedPath);
            }
            return fs.existsSync(normalizedPath);
          },
          readFileSync(filePath, encoding) {
            const normalizedPath = path.normalize(path.resolve(filePath));
            if (jsonFileMap.has(normalizedPath)) {
              return jsonFileMap.get(normalizedPath);
            }
            return fs.readFileSync(normalizedPath, encoding);
          },
          statSync(filePath, options) {
            const normalizedPath = path.normalize(path.resolve(filePath));
            if (existsMap.has(normalizedPath)) {
              const nowMs = Date.now();
              return {
                mtimeMs: nowMs,
                ctimeMs: nowMs,
                atimeMs: nowMs,
                size: 0,
                isFile: () => true,
                isDirectory: () => false,
                isSymbolicLink: () => false,
              };
            }
            return fs.statSync(normalizedPath, options);
          },
          mkdirSync(_dirPath, _options) {
            // no-op: tests do not assert on directory creation
          },
          writeFileSync(_filePath, _data, _encoding) {
            // no-op: tests do not assert on file writes
          },
        };

        const childProcessStub = {
          execSync(command, options = {}) {
            commands.push({
              command,
              cwd: options.cwd ?? null,
              stdio: options.stdio ?? null,
            });
            if ((payload.failCommands || []).includes(command)) {
              const error = new Error(`Command failed: ${command}`);
              error.command = command;
              throw error;
            }
            return Buffer.from('');
          },
        };

        const sandboxProcess = {
          env: process.env,
          argv: ['node', scriptPath, ...(payload.argv || [])],
          platform: payload.platform || process.platform,
          arch: payload.arch || process.arch,
          exit(code = 0) {
            exitCode = code;
            throw new Error(`__EXIT__:${code}`);
          },
        };

        const sandbox = {
          console: {
            log: (...args) => logs.push(args.join(' ')),
            warn: (...args) => logs.push(args.join(' ')),
            error: (...args) => errors.push(args.join(' ')),
          },
          process: sandboxProcess,
          require(moduleName) {
            if (moduleName === 'path') {
              return path;
            }
            if (moduleName === 'fs') {
              return fsStub;
            }
            if (moduleName === 'child_process') {
              return childProcessStub;
            }
            return require(moduleName);
          },
          __filename: scriptPath,
          __dirname: path.dirname(scriptPath),
          module: { exports: {} },
          exports: {},
          Buffer,
        };

        try {
          vm.runInNewContext(
            `(function (exports, require, module, __filename, __dirname) {${scriptSource}\n})(exports, require, module, __filename, __dirname);`,
            sandbox,
            { filename: scriptPath },
          );
        } catch (error) {
          if (!String(error && error.message ? error.message : error).startsWith('__EXIT__:')) {
            throw error;
          }
        }

        process.stdout.write(JSON.stringify({ exitCode, logs, errors, commands }));
        """
    )

    result = subprocess.run(
        [node_binary, "-e", harness],
        cwd=PROJECT_ROOT,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )

    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def resolve_current_target_triple() -> str | None:
    machine = platform.machine().lower()

    if sys.platform == "win32":
        if machine in {"amd64", "x86_64"}:
            return "x86_64-pc-windows-msvc"
        if machine in {"arm64", "aarch64"}:
            return "aarch64-pc-windows-msvc"
    elif sys.platform == "darwin":
        if machine in {"amd64", "x86_64"}:
            return "x86_64-apple-darwin"
        if machine in {"arm64", "aarch64"}:
            return "aarch64-apple-darwin"
    elif sys.platform.startswith("linux"):
        if machine in {"amd64", "x86_64"}:
            return "x86_64-unknown-linux-gnu"
        if machine in {"arm64", "aarch64"}:
            return "aarch64-unknown-linux-gnu"

    return None


def build_sidecar_contract_fixture(
    *,
    include_python_runtime: bool = False,
    external_bin: list[str] | None = None,
    capability_permissions: list[str] | None = None,
) -> tuple[dict[Path, bool], dict[Path, object]]:
    desktop_dir = PROJECT_ROOT / "desktop"
    bin_dir = desktop_dir / "src-tauri" / "bin"
    tauri_config_path = desktop_dir / "src-tauri" / "tauri.conf.json"
    capability_path = desktop_dir / "src-tauri" / "capabilities" / "main-desktop.json"
    legacy_python_entry = PROJECT_ROOT / "src" / "mcp" / "sidecar_entry.py"

    exists_paths: dict[Path, bool] = {
        bin_dir: True,
        legacy_python_entry: False,
        bin_dir / "niko-gateway-node": True,
    }
    if sys.platform == "win32":
        exists_paths[bin_dir / "niko-gateway-node.cmd"] = True
    if include_python_runtime:
        exists_paths[
            bin_dir / ("niko-gateway.exe" if sys.platform == "win32" else "niko-gateway")
        ] = True

    target_triple = resolve_current_target_triple()
    if target_triple is not None:
        packaged_python_name = f"niko-gateway-{target_triple}"
        if sys.platform == "win32":
            packaged_python_name += ".exe"
        exists_paths[bin_dir / packaged_python_name] = True

    json_files: dict[Path, object] = {
        tauri_config_path: {
            "app": {
                "security": {
                    "csp": "default-src 'self'; connect-src 'self' https: http://127.0.0.1:*; img-src 'self' asset: data:; script-src 'self'; style-src 'self' 'unsafe-inline'",
                    "devCsp": "default-src 'self'; script-src 'self' 'unsafe-eval'; connect-src 'self' http://localhost:* ws://localhost:*; img-src 'self' data:; style-src 'self' 'unsafe-inline'",
                    "capabilities": ["main-desktop"],
                    "freezePrototype": True,
                },
                "windows": [{"label": "main"}],
            },
            "bundle": {
                "externalBin": external_bin or ["bin/niko-gateway"],
            },
        },
        capability_path: {
            "identifier": "main-desktop",
            "windows": ["main"],
            "permissions": capability_permissions or ["core:default"],
        },
    }

    return exists_paths, json_files


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
        "desktop/package.json",
        '"local:pre-commit"',
        True,
    ) in rule_map
    assert (
        "src-ts/package.json",
        '"check:pre-commit"',
        True,
    ) in rule_map
    assert (
        ".pre-commit-config.yaml",
        "entry: python scripts/run_local_pre_commit.py",
        True,
    ) in rule_map
    assert (
        "docs/testing/TEST_TIER_MATRIX.md",
        "python -m pre_commit install",
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
    assert any(
        file_path == "scripts/release_check_summary.py"
        and '"writing_helper_acceptance_signal"' in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert any(
        file_path == "scripts/release_check_summary.py"
        and '"local_selftest_enforcement"' in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert any(
        file_path == "scripts/release_check_summary.py"
        and '"release_evidence": release_evidence,' in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert any(
        file_path == "scripts/release_check_summary.py"
        and "LOCAL_SELFTEST_REQUIRED_RELEASE_SOURCES" in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert any(
        file_path == "scripts/release_check_summary.py"
        and '("freshness_status", retained_evidence["freshness_status"])' in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert any(
        file_path == "scripts/release_check_summary.py"
        and '"delivery_contract": delivery_contract,' in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert any(
        file_path == "scripts/release_check_summary.py"
        and '"scorecard_dimensions": scorecard_dimensions,' in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert any(
        file_path == "scripts/release_check_summary.py"
        and "Single scorecard contract: functional + testing + release + governance must all be PASS before the repo can claim 100% completion."
        in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert any(
        file_path == "scripts/release_check_summary.py"
        and '"delivery_contract_100_signal",' in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert any(
        file_path == "scripts/release_check_summary.py"
        and '"gate_signal": "delivery_contract_100_signal"' in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert (
        "docs/release/SIGN_OFF.md",
        "100% completion contract",
        True,
    ) in rule_map
    assert (
        "docs/release/SIGN_OFF.md",
        "The release summary is the authoritative single scorecard for 100% completion.",
        True,
    ) in rule_map
    assert (
        "docs/release/SIGN_OFF.md",
        "issue_pending_blocker_signal` is blocking.",
        True,
    ) in rule_map
    assert (
        "docs/release/SIGN_OFF.md",
        "freshness_status: fresh",
        True,
    ) in rule_map
    assert (
        "docs/release/SIGN_OFF.md",
        "supersession_status: current",
        True,
    ) in rule_map
    assert (
        "docs/release/SIGN_OFF.md",
        ".workflow/evidence/release/release-readiness-artifact.json",
        True,
    ) in rule_map
    assert (
        "docs/release/SIGN_OFF.md",
        "`npm --prefix desktop run local:selftest` is the authoritative launcher smoke-test.",
        True,
    ) in rule_map
    assert (
        "docs/release/SIGN_OFF.md",
        "blocking `local_selftest_enforcement` signal",
        True,
    ) in rule_map
    assert (
        "docs/testing/TEST_TIER_MATRIX.md",
        "Treat `npm --prefix desktop run local:selftest` as mandatory whenever retained release evidence for the current HEAD is not already `fresh_current`",
        True,
    ) in rule_map
    assert (
        ".github/workflows/writing-helper-acceptance.yml",
        "writing-helper-acceptance.json",
        True,
    ) in rule_map
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
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        "./scripts/start_desktop_local.ps1",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        "./scripts/status_desktop_local.ps1",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        "./scripts/stop_desktop_local.ps1",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        "./scripts/selftest_desktop_local.ps1",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        "npm --prefix desktop run local:start|local:start:force|local:start:binary|local:start:binary:force|local:gateway|local:status|local:stop|local:selftest",
        True,
    ) in rule_map
    assert ("docs/operations/DESKTOP_RUNBOOK.md", "local:gateway", True) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        "scripts\\\\start_desktop_local.cmd",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        "scripts\\\\stop_desktop_local.cmd",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        "scripts\\\\status_desktop_local.cmd",
        True,
    ) in rule_map
    assert (
        "docs/operations/DESKTOP_RUNBOOK.md",
        "scripts\\\\selftest_desktop_local.cmd",
        True,
    ) in rule_map
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
    package_json = json.loads(
        (PROJECT_ROOT / "desktop" / "package.json").read_text(encoding="utf-8")
    )
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
    assert scripts["local:shell"] == "node scripts/run_local_vite_shell.cjs"
    assert scripts["local:status"] == (
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/status_desktop_local.ps1"
    )
    assert scripts["local:stop"] == (
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/stop_desktop_local.ps1"
    )
    assert scripts["local:selftest"] == (
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/selftest_desktop_local.ps1"
    )
    assert scripts["package:e2e:checklist"] == "python ../scripts/package_e2e_checklist.py"
    assert scripts["local:pre-commit"] == "python ../scripts/run_local_pre_commit.py"
    assert scripts["check:pre-commit"] == "npm run lint && npm run format:check"


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
    start_script = (PROJECT_ROOT / "scripts" / "start_desktop_local.ps1").read_text(
        encoding="utf-8"
    )
    selftest_script = (PROJECT_ROOT / "scripts" / "selftest_desktop_local.ps1").read_text(
        encoding="utf-8"
    )
    status_script = (PROJECT_ROOT / "scripts" / "status_desktop_local.ps1").read_text(
        encoding="utf-8"
    )
    stop_script = (PROJECT_ROOT / "scripts" / "stop_desktop_local.ps1").read_text(encoding="utf-8")

    assert "[Alias('Host')]" in start_script
    assert "[string]$GatewayHost = '127.0.0.1'" in start_script
    assert "[int]$PreferredPort = 8000" in start_script
    assert "[int]$FallbackPort = 8010" in start_script
    assert "[switch]$BinaryDesktop" in start_script
    assert "[switch]$NoDesktop" in start_script
    assert "[switch]$NoReuseGateway" in start_script
    assert "[switch]$ForceDesktop" in start_script
    assert (
        "$desktopExe = Join-Path $desktopDir 'src-tauri\\target\\debug\\niko-studio-desktop.exe'"
        in start_script
    )
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

    assert (
        "$statePath = Join-Path $projectRoot '.codex-run\\desktop-local-state.json'"
        in status_script
    )
    assert "foreach ($candidatePort in @(8000, 8010))" in status_script
    assert "Write-Host 'Niko Studio local status' -ForegroundColor Cyan" in status_script

    assert (
        "$statePath = Join-Path $projectRoot '.codex-run\\desktop-local-state.json'" in stop_script
    )
    assert 'Write-Host "State file not found: $statePath"' in stop_script
    assert (
        "Stop-ListenerOnPort -Port $state.gateway.port -Managed ([bool]$state.gateway.managed)"
        in stop_script
    )
    assert 'Write-Host "Removed state file: $statePath"' in stop_script


def test_writing_helper_acceptance_contract_uses_windows_powershell_and_bom_script() -> None:
    workflow_text = (
        (PROJECT_ROOT / ".github/workflows/writing-helper-acceptance.yml")
        .read_text(encoding="utf-8")
        .replace("\r\n", "\n")
    )
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
    assert "writing-helper-acceptance.json" in workflow_text
    assert (
        r"powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-writing-helper.ps1 -Strict -Port 18080 -Host 127.0.0.1"
        in sign_off_text
    )
    assert "[Alias('Host')]" in script_text
    assert "failed-writing-helper-cases.json" in script_text


def test_desktop_local_launcher_docs_share_same_entrypoints() -> None:
    root_readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")
    desktop_readme = (PROJECT_ROOT / "desktop" / "README.md").read_text(encoding="utf-8")
    runbook = (PROJECT_ROOT / "docs" / "operations" / "DESKTOP_RUNBOOK.md").read_text(
        encoding="utf-8"
    )

    assert "./scripts/start_desktop_local.ps1" in root_readme
    assert "./scripts/status_desktop_local.ps1" in root_readme
    assert "./scripts/stop_desktop_local.ps1" in root_readme
    assert "./scripts/selftest_desktop_local.ps1" in root_readme
    assert "npm --prefix desktop run local:start" in root_readme
    assert "local:start:force" in root_readme
    assert "local:start:binary" in root_readme
    assert "local:start:binary:force" in root_readme
    assert "local:gateway" in root_readme
    assert "local:shell" in root_readme
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
    assert "local:shell" in desktop_readme
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
    assert (
        "npm --prefix desktop run local:start|local:start:force|local:start:binary|local:start:binary:force|local:gateway|local:status|local:stop|local:selftest"
        in runbook
    )
    assert "local:gateway" in runbook
    assert "local:shell" in runbook
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
    assert ("desktop/package.json", r'"local:pre-commit"', True) in rule_map
    assert ("src-ts/package.json", r'"check:pre-commit"', True) in rule_map
    assert (
        ".pre-commit-config.yaml",
        r"entry: python scripts/run_local_pre_commit\.py",
        True,
    ) in rule_map
    assert (
        "docs/testing/TEST_TIER_MATRIX.md",
        r"python -m pre_commit install",
        True,
    ) in rule_map
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


def test_release_evidence_status_normalizer_maps_pytest_terms_to_release_contract() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_status_normalizer",
    )

    assert module.normalize_release_evidence_status("passed") == "PASS"
    assert module.normalize_release_evidence_status("failed") == "FAIL"
    assert module.normalize_release_evidence_status("PASS") == "PASS"


def test_writing_helper_acceptance_signal_returns_fail_for_parse_error() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_writing_helper_parse_error",
    )

    status, exit_code, detail = module.writing_helper_acceptance_signal(
        True,
        None,
        "6066c334d6954d29a126af413f6d53af6d39d99f",
        "Expecting value: line 1 column 1 (char 0)",
    )

    assert status == "FAIL"
    assert exit_code == 1
    assert "json_parse_error=Expecting value: line 1 column 1 (char 0)" in detail
    assert "decision=no_go" in detail


def test_writing_helper_acceptance_signal_returns_fail_for_missing_required_keys() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_writing_helper_missing_keys",
    )

    status, exit_code, detail = module.writing_helper_acceptance_signal(
        True,
        {
            "status": "PASS",
            "strict": True,
            "head_sha": "6066c334d6954d29a126af413f6d53af6d39d99f",
        },
        "6066c334d6954d29a126af413f6d53af6d39d99f",
        None,
    )

    assert status == "FAIL"
    assert exit_code == 1
    assert "missing_keys=generated_at,total_cases,passed_cases,failed_cases" in detail
    assert "decision=no_go" in detail


def test_writing_helper_acceptance_signal_returns_pass_for_fresh_current_artifact() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_writing_helper_fresh_current",
    )

    status, exit_code, detail = module.writing_helper_acceptance_signal(
        True,
        {
            "status": "PASS",
            "strict": True,
            "generated_at": "2026-04-17T11:30:00+00:00",
            "head_sha": "6066c334d6954d29a126af413f6d53af6d39d99f",
            "version": "9.0.8",
            "total_cases": 7,
            "passed_cases": 7,
            "failed_cases": 0,
            "failed_cases_path": None,
        },
        "6066c334d6954d29a126af413f6d53af6d39d99f",
        None,
        "9.0.8",
        now=datetime(2026, 4, 17, 12, 0, tzinfo=timezone.utc),
    )

    assert status == "PASS"
    assert exit_code == 0
    assert "freshness_status=fresh" in detail
    assert "supersession_status=current" in detail
    assert "evidence_state=fresh_current" in detail
    assert "decision=go" in detail


def test_writing_helper_acceptance_signal_returns_fail_for_stale_superseded_artifact() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_writing_helper_stale_superseded",
    )

    status, exit_code, detail = module.writing_helper_acceptance_signal(
        True,
        {
            "status": "PASS",
            "strict": True,
            "generated_at": "2026-04-15T09:00:00+00:00",
            "head_sha": "0b0662fa77b5785916e49cdc5850600706cea653",
            "version": "9.0.7",
            "total_cases": 7,
            "passed_cases": 7,
            "failed_cases": 0,
            "failed_cases_path": None,
        },
        "4d63e03db1f673379901fb827aff1a1f6947faa8",
        None,
        "9.0.8",
        now=datetime(2026, 4, 17, 12, 0, tzinfo=timezone.utc),
    )

    assert status == "FAIL"
    assert exit_code == 1
    assert "freshness_status=stale" in detail
    assert "supersession_status=superseded" in detail
    assert "evidence_state=stale_superseded" in detail
    assert "supersession_reasons=head_mismatch,version_mismatch" in detail
    assert "decision=no_go" in detail


def test_local_selftest_enforcement_signal_returns_pass_for_fresh_current_release_evidence() -> (
    None
):
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_local_selftest_pass",
    )

    release_evidence = {
        "status": "fresh_current",
        "evidence_sources": [
            {
                "source_id": "release_summary_report",
                "status": "PASS",
                "is_fresh": True,
                "is_current": True,
                "freshness_status": "fresh",
                "supersession_status": "current",
            },
            {
                "source_id": "authority_alignment",
                "status": "PASS",
                "is_fresh": True,
                "is_current": True,
                "freshness_status": "fresh",
                "supersession_status": "current",
            },
            {
                "source_id": "writing_helper_acceptance",
                "status": "PASS",
                "is_fresh": True,
                "is_current": True,
                "freshness_status": "fresh",
                "supersession_status": "current",
            },
            {
                "source_id": "governance_scripts_regression",
                "status": "PASS",
                "is_fresh": True,
                "is_current": True,
                "freshness_status": "fresh",
                "supersession_status": "current",
            },
        ],
    }

    status, exit_code, detail = module.local_selftest_enforcement_signal(release_evidence)

    assert status == "PASS"
    assert exit_code == 0
    assert "command=npm --prefix desktop run local:selftest" in detail
    assert "blocking_sources=none" in detail
    assert "proof_state=fresh_current" in detail
    assert "decision=optional_with_fresh_current_evidence" in detail


def test_local_selftest_enforcement_signal_returns_fail_for_non_green_release_evidence() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_local_selftest_fail",
    )

    release_evidence = {
        "status": "non_green",
        "evidence_sources": [
            {
                "source_id": "release_summary_report",
                "status": "PASS",
                "is_fresh": True,
                "is_current": True,
                "freshness_status": "fresh",
                "supersession_status": "current",
            },
            {
                "source_id": "authority_alignment",
                "status": "PASS",
                "is_fresh": True,
                "is_current": True,
                "freshness_status": "fresh",
                "supersession_status": "current",
            },
            {
                "source_id": "writing_helper_acceptance",
                "status": "PASS",
                "is_fresh": False,
                "is_current": True,
                "freshness_status": "stale",
                "supersession_status": "current",
            },
            {
                "source_id": "governance_scripts_regression",
                "status": "PASS",
                "is_fresh": True,
                "is_current": True,
                "freshness_status": "fresh",
                "supersession_status": "current",
            },
        ],
    }

    status, exit_code, detail = module.local_selftest_enforcement_signal(release_evidence)

    assert status == "FAIL"
    assert exit_code == 1
    assert "release_evidence_status=non_green" in detail
    assert "blocking_sources=writing_helper_acceptance:freshness=stale" in detail
    assert "proof_state=missing_or_non_green" in detail
    assert "decision=run_local_selftest_before_go" in detail


def test_package_e2e_acceptance_signal_returns_pass_for_fresh_current_artifact() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_package_e2e_pass",
    )

    payload = {
        "status": "PASS",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "head_sha": "deadbeef",
        "version": "9.0.8",
        "tester": "qa",
        "artifact_path": "desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.8_x64-setup.exe",
        "artifact_sha256": "abc123",
        "install_verified": True,
        "launch_verified": True,
        "core_flow_verified": True,
        "shutdown_verified": True,
        "notes": "",
    }

    status, exit_code, detail = module.package_e2e_acceptance_signal(
        True,
        payload,
        "deadbeef",
        None,
        current_version="9.0.8",
    )

    assert status == "PASS"
    assert exit_code == 0
    assert "artifact=.workflow/evidence/release/package-e2e-acceptance.json" in detail
    assert "decision=go" in detail


def test_package_e2e_acceptance_signal_returns_fail_for_missing_verification() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_package_e2e_fail",
    )

    payload = {
        "status": "PASS",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "head_sha": "deadbeef",
        "version": "9.0.8",
        "tester": "qa",
        "artifact_path": "desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.8_x64-setup.exe",
        "artifact_sha256": "abc123",
        "install_verified": True,
        "launch_verified": False,
        "core_flow_verified": True,
        "shutdown_verified": True,
        "notes": "",
    }

    status, exit_code, detail = module.package_e2e_acceptance_signal(
        True,
        payload,
        "deadbeef",
        None,
        current_version="9.0.8",
    )

    assert status == "FAIL"
    assert exit_code == 1
    assert "launch_verified=False" in detail
    assert "decision=no_go" in detail


def test_build_release_readiness_artifact_includes_release_evidence_metadata() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_release_evidence_artifact",
    )

    release_evidence = {
        "status": "fresh_current",
        "blocking_sources": [],
        "head_sha": "4d63e03db1f673379901fb827aff1a1f6947faa8",
        "version": "9.0.8",
        "generated_at": "2026-04-17T12:00:00+00:00",
        "freshness_window_hours": module.RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS,
        "evidence_sources": [
            {
                "source_id": "writing_helper_acceptance",
                "status": "PASS",
                "freshness_status": "fresh",
                "supersession_status": "current",
                "evidence_state": "fresh_current",
            },
            {
                "source_id": "package_e2e_acceptance",
                "status": "PASS",
                "freshness_status": "fresh",
                "supersession_status": "current",
                "evidence_state": "fresh_current",
            },
        ],
    }

    artifact = module._build_release_readiness_artifact(
        decision="GO",
        go_no_go_reasons=[],
        generated_at="2026-04-17T12:00:00+00:00",
        head_sha="4d63e03db1f673379901fb827aff1a1f6947faa8",
        version="9.0.8",
        checks=[],
        release_evidence=release_evidence,
        report_path=PROJECT_ROOT / "release-check-summary.md",
    )

    assert artifact["schema_version"] == module.RELEASE_EVIDENCE_SCHEMA_VERSION
    assert artifact["head_sha"] == "4d63e03db1f673379901fb827aff1a1f6947faa8"
    assert artifact["version"] == "9.0.8"
    assert artifact["freshness_window_hours"] == module.RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS
    assert artifact["release_evidence"] == release_evidence


def test_release_check_summary_main_handles_preliminary_decision_before_evidence_sources(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_main_preliminary_decision",
    )

    release_dir = tmp_path / "release-evidence"
    report_path = tmp_path / "release-check-summary.md"
    readiness_path = release_dir / "release-readiness-artifact.json"
    authority_path = release_dir / "authority-alignment.json"
    writing_helper_path = release_dir / "writing-helper-acceptance.json"
    governance_junit_path = release_dir / "governance-scripts.junit.xml"
    production_guard_junit_path = release_dir / "vitest-production-guard.xml"
    e2e_junit_path = release_dir / "vitest-e2e.xml"
    package_e2e_path = release_dir / "package-e2e-acceptance.json"

    release_dir.mkdir(parents=True, exist_ok=True)
    writing_helper_path.write_text(
        json.dumps(
            {
                "status": "PASS",
                "strict": True,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "head_sha": "deadbeef",
                "version": "9.0.8",
                "total_cases": 7,
                "passed_cases": 7,
                "failed_cases": 0,
                "failed_cases_path": None,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    package_e2e_path.write_text(
        json.dumps(
            {
                "status": "PASS",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "head_sha": "deadbeef",
                "version": "9.0.8",
                "tester": "qa",
                "artifact_path": "desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.8_x64-setup.exe",
                "artifact_sha256": "abc123",
                "install_verified": True,
                "launch_verified": True,
                "core_flow_verified": True,
                "shutdown_verified": True,
                "notes": "",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(module, "REPORT_PATH", report_path)
    monkeypatch.setattr(module, "RELEASE_EVIDENCE_DIR", release_dir)
    monkeypatch.setattr(module, "RELEASE_READINESS_ARTIFACT_PATH", readiness_path)
    monkeypatch.setattr(module, "AUTHORITY_ALIGNMENT_ARTIFACT_PATH", authority_path)
    monkeypatch.setattr(module, "WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH", writing_helper_path)
    monkeypatch.setattr(module, "PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH", package_e2e_path)
    monkeypatch.setattr(module, "GOVERNANCE_JUNIT_PATH", governance_junit_path)
    monkeypatch.setattr(module, "PRODUCTION_GUARD_JUNIT_PATH", production_guard_junit_path)
    monkeypatch.setattr(module, "E2E_JUNIT_PATH", e2e_junit_path)

    def fake_run_cmd(cmd: list[str], env: dict[str, str] | None = None) -> tuple[int, str]:
        del env
        command = " ".join(cmd)
        if cmd[:3] == ["git", "rev-parse", "HEAD"]:
            return 0, "deadbeef"
        if "scripts/check_versions.py" in command:
            return 0, "版本一致性检查通过。"
        if "scripts/delivery_gate.py" in command:
            return 0, "delivery gate: ok"
        if "scripts/check_tasks_completion.py" in command:
            return 0, json.dumps(
                {
                    "total_checked": 10,
                    "total_unchecked": 0,
                    "completion_ratio": 100.0,
                },
                ensure_ascii=False,
            )
        if "scripts/check_authority_alignment.py" in command:
            return 0, json.dumps(
                {
                    "status": "PASS",
                    "checked_rules": 20,
                    "passed_rules": 20,
                    "failed_rules": 0,
                    "checked_files": ["README.md"],
                    "mismatches": [],
                },
                ensure_ascii=False,
            )
        if "test:coverage:phase4" in command:
            return 0, "64 passed"
        if "build:sidecar" in command:
            return 0, "1 passed"
        if "validate:sidecar-contract" in command:
            return 0, "1 passed"
        if "validate:package:dry-run" in command:
            return 0, "1 passed"
        if "ensure-deps" in command:
            return 0, "ok"
        if "check:local" in command:
            return 0, "270 passed"
        if "tests/mcp/workflow-endpoints.integration.test.ts" in command:
            return 0, "10 passed"
        raise AssertionError(f"unexpected command: {command}")

    monkeypatch.setattr(module, "run_cmd", fake_run_cmd)
    monkeypatch.setattr(module, "_run_governance_scripts_regression", lambda path: (0, "19 passed"))
    monkeypatch.setattr(module, "_run_release_runtime_guard", lambda path: (0, "4 passed"))

    buffer = io.StringIO()
    with redirect_stdout(buffer):
        exit_code = module.main()

    assert exit_code in {0, 1}
    assert report_path.exists()
    assert readiness_path.exists()
    assert authority_path.exists()
    report_text = report_path.read_text(encoding="utf-8")
    assert "- Decision:" in report_text


def test_release_check_summary_main_binds_desktop_check_to_authoritative_gate_only(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_desktop_check_binding",
    )

    release_dir = tmp_path / "release-evidence"
    report_path = tmp_path / "release-check-summary.md"
    readiness_path = release_dir / "release-readiness-artifact.json"
    authority_path = release_dir / "authority-alignment.json"
    writing_helper_path = release_dir / "writing-helper-acceptance.json"
    governance_junit_path = release_dir / "governance-scripts.junit.xml"
    production_guard_junit_path = release_dir / "vitest-production-guard.xml"
    e2e_junit_path = release_dir / "vitest-e2e.xml"
    package_e2e_path = release_dir / "package-e2e-acceptance.json"

    release_dir.mkdir(parents=True, exist_ok=True)
    writing_helper_path.write_text(
        json.dumps(
            {
                "status": "PASS",
                "strict": True,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "head_sha": "deadbeef",
                "version": "9.0.8",
                "total_cases": 7,
                "passed_cases": 7,
                "failed_cases": 0,
                "failed_cases_path": None,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    package_e2e_path.write_text(
        json.dumps(
            {
                "status": "PASS",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "head_sha": "deadbeef",
                "version": "9.0.8",
                "tester": "qa",
                "artifact_path": "desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.8_x64-setup.exe",
                "artifact_sha256": "abc123",
                "install_verified": True,
                "launch_verified": True,
                "core_flow_verified": True,
                "shutdown_verified": True,
                "notes": "",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(module, "REPORT_PATH", report_path)
    monkeypatch.setattr(module, "RELEASE_EVIDENCE_DIR", release_dir)
    monkeypatch.setattr(module, "RELEASE_READINESS_ARTIFACT_PATH", readiness_path)
    monkeypatch.setattr(module, "AUTHORITY_ALIGNMENT_ARTIFACT_PATH", authority_path)
    monkeypatch.setattr(module, "WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH", writing_helper_path)
    monkeypatch.setattr(module, "PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH", package_e2e_path)
    monkeypatch.setattr(module, "GOVERNANCE_JUNIT_PATH", governance_junit_path)
    monkeypatch.setattr(module, "PRODUCTION_GUARD_JUNIT_PATH", production_guard_junit_path)
    monkeypatch.setattr(module, "E2E_JUNIT_PATH", e2e_junit_path)

    def fake_run_cmd(cmd: list[str], env: dict[str, str] | None = None) -> tuple[int, str]:
        del env
        command = " ".join(cmd)
        if cmd[:3] == ["git", "rev-parse", "HEAD"]:
            return 0, "deadbeef"
        if "scripts/check_versions.py" in command:
            return 0, "versions ok"
        if "scripts/delivery_gate.py" in command:
            return 0, "delivery ok"
        if "scripts/check_tasks_completion.py" in command:
            return 0, json.dumps(
                {
                    "total_checked": 10,
                    "total_unchecked": 0,
                    "completion_ratio": 100.0,
                },
                ensure_ascii=False,
            )
        if "scripts/check_authority_alignment.py" in command:
            return 0, json.dumps(
                {
                    "status": "PASS",
                    "checked_rules": 20,
                    "passed_rules": 20,
                    "failed_rules": 0,
                    "checked_files": ["README.md"],
                    "mismatches": [],
                },
                ensure_ascii=False,
            )
        if "test:coverage:phase4" in command:
            return 0, "64 passed"
        if "build:sidecar" in command:
            return 0, "1 passed"
        if "validate:sidecar-contract" in command:
            return 0, "1 passed"
        if "validate:package:dry-run" in command:
            return 0, "1 passed"
        if "ensure-deps" in command:
            return 1, "bootstrap failed"
        if "check:local" in command:
            return 0, "270 passed"
        if "tests/mcp/workflow-endpoints.integration.test.ts" in command:
            return 0, "10 passed"
        raise AssertionError(f"unexpected command: {command}")

    monkeypatch.setattr(module, "run_cmd", fake_run_cmd)
    monkeypatch.setattr(module, "_run_governance_scripts_regression", lambda path: (0, "19 passed"))
    monkeypatch.setattr(module, "_run_release_runtime_guard", lambda path: (0, "4 passed"))

    with redirect_stdout(io.StringIO()):
        exit_code = module.main()

    readiness = json.loads(readiness_path.read_text(encoding="utf-8"))
    checks = readiness["checks"]
    desktop_check = next(check for check in checks if check["check_id"] == "desktop_check")

    assert exit_code in {0, 1}
    assert desktop_check["status"] == "PASS"
    assert desktop_check["exit_code"] == 0


def test_delivery_contract_100_signal_tracks_scorecard_completion() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_delivery_contract_signal",
    )

    contract = module._build_delivery_contract(
        [
            {"dimension_id": "functional", "status": "PASS"},
            {"dimension_id": "testing", "status": "PASS"},
            {"dimension_id": "release", "status": "FAIL"},
            {"dimension_id": "governance", "status": "PASS"},
        ]
    )

    status, exit_code, detail = module.delivery_contract_100_signal(contract)

    assert contract["contract_id"] == "ISS-20260423-001"
    assert contract["label"] == "100% delivery contract"
    assert contract["gate_signal"] == "delivery_contract_100_signal"
    assert contract["required_dimensions"] == 4
    assert contract["passed_dimensions"] == 3
    assert contract["failed_dimensions"] == ["release"]
    assert contract["completion_percent"] == 75.0
    assert status == "FAIL"
    assert exit_code == 1
    assert "contract_id=ISS-20260423-001" in detail
    assert "passed_dimensions=3" in detail
    assert "failed_dimensions=release" in detail
    assert "completion_percent=75.0" in detail
    assert "decision=no_go" in detail


def test_local_pre_commit_gate_contract_is_exposed() -> None:
    desktop_package = json.loads(
        (PROJECT_ROOT / "desktop/package.json").read_text(encoding="utf-8")
    )
    src_ts_package = json.loads((PROJECT_ROOT / "src-ts/package.json").read_text(encoding="utf-8"))
    hook_config = (PROJECT_ROOT / ".pre-commit-config.yaml").read_text(encoding="utf-8")
    helper_source = (PROJECT_ROOT / "scripts/run_local_pre_commit.py").read_text(encoding="utf-8")
    root_readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")
    desktop_readme = (PROJECT_ROOT / "desktop/README.md").read_text(encoding="utf-8")
    tier_matrix = (PROJECT_ROOT / "docs/testing/TEST_TIER_MATRIX.md").read_text(encoding="utf-8")
    requirements = (PROJECT_ROOT / "requirements.txt").read_text(encoding="utf-8")

    assert desktop_package["scripts"]["check:pre-commit"] == "npm run lint && npm run format:check"
    assert (
        desktop_package["scripts"]["local:pre-commit"]
        == "python ../scripts/run_local_pre_commit.py"
    )
    assert src_ts_package["scripts"]["check:pre-commit"] == "npm run lint && npm run format:check"
    assert src_ts_package["scripts"]["check:local"] == "npm run check:release"
    assert "entry: python scripts/run_local_pre_commit.py" in hook_config
    assert "pass_filenames: false" in hook_config
    assert '"desktop", "run", "check:pre-commit"' in helper_source
    assert '"src-ts", "run", "check:pre-commit"' in helper_source
    assert '"ruff"' in helper_source
    assert "pre-commit>=3.8.0" in requirements
    assert "npm --prefix desktop run local:pre-commit" in root_readme
    assert "python -m pre_commit install" in root_readme
    assert "npm run local:pre-commit" in desktop_readme
    assert "python -m pre_commit install" in desktop_readme
    assert "python -m pre_commit install" in tier_matrix
    assert "npm --prefix desktop run local:pre-commit" in tier_matrix
    assert "Local pre-commit gate" in tier_matrix


def test_release_summary_and_sign_off_share_desktop_authoritative_gate() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_desktop_gate_contract",
    )

    sign_off_text = (PROJECT_ROOT / "docs/release/SIGN_OFF.md").read_text(encoding="utf-8")
    summary_source = (PROJECT_ROOT / "scripts/release_check_summary.py").read_text(encoding="utf-8")
    package_json = json.loads((PROJECT_ROOT / "desktop/package.json").read_text(encoding="utf-8"))
    root_readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")
    desktop_readme = (PROJECT_ROOT / "desktop/README.md").read_text(encoding="utf-8")

    assert module.DESKTOP_AUTHORITATIVE_LOCAL_GATE_COMMAND == "npm --prefix desktop run check:local"
    assert module.DESKTOP_AUTHORITATIVE_LOCAL_GATE_ARGS == [
        "npm.cmd",
        "--prefix",
        "desktop",
        "run",
        "check:local",
    ]
    refresh_helper_source = (PROJECT_ROOT / "scripts/refresh_release_evidence.py").read_text(
        encoding="utf-8"
    )
    package_e2e_source = (PROJECT_ROOT / "scripts/package_e2e_checklist.py").read_text(
        encoding="utf-8"
    )

    assert (
        package_json["scripts"]["release:evidence:refresh"]
        == "python ../scripts/refresh_release_evidence.py"
    )
    assert (
        package_json["scripts"]["package:e2e:checklist"]
        == "python ../scripts/package_e2e_checklist.py"
    )
    assert "npm --prefix desktop run release:evidence:refresh" in sign_off_text
    assert "npm --prefix desktop run package:e2e:checklist" in sign_off_text
    assert (
        "This helper runs the authoritative launcher smoke-test, starts the authoritative gateway"
        in sign_off_text
    )
    assert (
        "python scripts/start_gateway.py --host 127.0.0.1 --port 18080 --log-level warning"
        not in sign_off_text
    )
    assert 'run_step(\n        "desktop local self-test"' in refresh_helper_source
    assert "check-writing-helper.ps1" in refresh_helper_source
    assert "scripts/release_check_summary.py" in refresh_helper_source
    assert "NIKO_GATEWAY_RUNTIME" in refresh_helper_source
    assert "Gateway health ready" in refresh_helper_source
    assert "local:selftest" in refresh_helper_source
    assert "package-e2e-acceptance.json" in package_e2e_source
    assert "--artifact-path" in package_e2e_source
    assert "--tester" in package_e2e_source
    assert "--install-verified" in package_e2e_source
    assert "--launch-verified" in package_e2e_source
    assert "--core-flow-verified" in package_e2e_source
    assert "--shutdown-verified" in package_e2e_source
    assert "`python scripts/release_check_summary.py` reruns this exact command" in sign_off_text
    assert (
        "`npm --prefix desktop run local:selftest` is the authoritative launcher smoke-test."
        in sign_off_text
    )
    assert package_json["scripts"]["check:pre-commit"] == "npm run lint && npm run format:check"
    assert (
        package_json["scripts"]["local:pre-commit"] == "python ../scripts/run_local_pre_commit.py"
    )
    assert "run_cmd(DESKTOP_AUTHORITATIVE_LOCAL_GATE_ARGS)" in summary_source
    assert '("command", DESKTOP_AUTHORITATIVE_LOCAL_GATE_COMMAND)' in summary_source
    assert "desktop_authoritative_local_gate" in summary_source
    assert "local_selftest_enforcement" in summary_source
    assert "LOCAL_SELFTEST_REQUIRED_RELEASE_SOURCES" in summary_source
    assert "writing_helper_acceptance_signal" in summary_source
    assert "package_e2e_acceptance_signal" in summary_source
    assert "PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH" in summary_source
    assert "package_e2e_acceptance_artifact" in summary_source
    assert "package_e2e_checklist" in summary_source
    assert "WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH" in summary_source
    assert '"release_evidence": release_evidence,' in summary_source
    assert '"scorecard_dimensions": scorecard_dimensions,' in summary_source
    assert (
        "Single scorecard contract: functional + testing + release + governance must all be PASS before the repo can claim 100% completion."
        in summary_source
    )
    assert '"gate_signal": "delivery_contract_100_signal"' in summary_source
    assert "freshness_window_hours" in summary_source
    assert "supersession_status" in summary_source
    assert "## Retained Release Evidence" in summary_source
    assert "100% completion contract" in sign_off_text
    assert (
        "The release summary is the authoritative single scorecard for 100% completion."
        in sign_off_text
    )
    assert "issue_pending_blocker_signal` is blocking." in sign_off_text
    assert ".workflow/evidence/release/writing-helper-acceptance.json" in sign_off_text
    assert ".workflow/evidence/release/package-e2e-acceptance.json" in sign_off_text
    assert ".workflow/evidence/release/release-readiness-artifact.json" in sign_off_text
    assert "freshness_status: fresh" in sign_off_text
    assert "supersession_status: current" in sign_off_text
    assert "blocking `local_selftest_enforcement` signal" in sign_off_text
    assert "package:e2e:checklist" in root_readme
    assert "package:e2e:checklist" in desktop_readme


def test_signed_release_path_uses_generated_tauri_config_without_repo_config_edit() -> None:
    package_json = json.loads((PROJECT_ROOT / "desktop/package.json").read_text(encoding="utf-8"))
    signing_source = (PROJECT_ROOT / "scripts/generate_signed_tauri_config.py").read_text(
        encoding="utf-8"
    )
    gitignore_text = (PROJECT_ROOT / ".gitignore").read_text(encoding="utf-8")
    code_signing_text = (PROJECT_ROOT / "docs/operations/CODE_SIGNING.md").read_text(
        encoding="utf-8"
    )
    sign_off_text = (PROJECT_ROOT / "docs/release/SIGN_OFF.md").read_text(encoding="utf-8")

    assert (
        package_json["scripts"]["tauri:build:signed"]
        == "npm run build:sidecar && python ../scripts/generate_signed_tauri_config.py --run-build"
    )
    assert "parser.add_argument(" in signing_source
    assert '"--run-build"' in signing_source
    assert (
        'env["TAURI_CONFIG"] = str(config_path.relative_to(DESKTOP_DIR)).replace("\\\\", "/")'
        in signing_source
    )
    assert '[_npm_cmd(), "run", "tauri", "--", "build"]' in signing_source
    assert "desktop/src-tauri/tauri.signed.local.generated.json" in gitignore_text
    assert "generate a temporary signed config" in code_signing_text
    assert "Do not edit `tauri.conf.json` in-place on release hosts." in code_signing_text
    assert "Run `python scripts/generate_signed_tauri_config.py`" in sign_off_text
    assert "Run `npm --prefix desktop run tauri:build:signed`" in sign_off_text

    result = run_node_cjs_and_capture(
        "desktop/scripts/choose_sidecar.cjs",
        env_overrides={"NIKO_GATEWAY_RUNTIME": None},
    )

    logs = "\n".join(result["logs"])
    commands = result["commands"]

    assert result["exitCode"] == 0
    assert "Runtime selection: NIKO_GATEWAY_RUNTIME=node" in logs
    assert "Authoritative runtime active: Node-first sidecar path" in logs
    assert "Building Node sidecar (default runtime)..." in logs
    assert "Validating sidecar contract..." in logs
    assert "✅ Sidecar build complete" in logs
    assert commands == [
        {
            "command": "npm run build:sidecar:node",
            "cwd": str(PROJECT_ROOT / "desktop"),
            "stdio": "inherit",
        },
        {
            "command": "npm run validate:sidecar-contract",
            "cwd": str(PROJECT_ROOT / "desktop"),
            "stdio": "inherit",
        },
    ]


@pytest.mark.parametrize("runtime_value", ["NODE", " node "])
def test_sidecar_selector_normalizes_supported_node_values(runtime_value: str) -> None:
    result = run_node_cjs_and_capture(
        "desktop/scripts/choose_sidecar.cjs",
        env_overrides={"NIKO_GATEWAY_RUNTIME": runtime_value},
    )

    logs = "\n".join(result["logs"])
    commands = result["commands"]

    assert result["exitCode"] == 0
    assert "Runtime selection: NIKO_GATEWAY_RUNTIME=node" in logs
    assert "Unknown runtime" not in logs
    assert commands[0]["command"] == "npm run build:sidecar:node"
    assert commands[1]["command"] == "npm run validate:sidecar-contract"


@pytest.mark.parametrize("runtime_value", ["PYTHON", " python "])
def test_sidecar_selector_normalizes_supported_python_values(runtime_value: str) -> None:
    result = run_node_cjs_and_capture(
        "desktop/scripts/choose_sidecar.cjs",
        env_overrides={"NIKO_GATEWAY_RUNTIME": runtime_value},
    )

    logs = "\n".join(result["logs"])
    commands = result["commands"]

    assert result["exitCode"] == 0
    assert "Runtime selection: NIKO_GATEWAY_RUNTIME=python" in logs
    assert (
        "Compatibility override active: Python sidecar is not the authoritative default runtime"
        in logs
    )
    assert commands[0]["command"] == "npm run build:sidecar:python"
    assert commands[1]["command"] == "npm run validate:sidecar-contract"


def test_sidecar_selector_falls_back_to_node_for_unknown_runtime() -> None:
    result = run_node_cjs_and_capture(
        "desktop/scripts/choose_sidecar.cjs",
        env_overrides={"NIKO_GATEWAY_RUNTIME": "  ruby  "},
    )

    logs = "\n".join(result["logs"])
    commands = result["commands"]

    assert result["exitCode"] == 0
    assert "Runtime selection: NIKO_GATEWAY_RUNTIME=node" in logs
    assert 'Unknown runtime "  ruby  ", falling back to authoritative node runtime' in logs
    assert "Authoritative runtime active: Node-first sidecar path" in logs
    assert commands[0]["command"] == "npm run build:sidecar:node"
    assert commands[1]["command"] == "npm run validate:sidecar-contract"


def test_sidecar_selector_honors_python_compatibility_override() -> None:
    result = run_node_cjs_and_capture(
        "desktop/scripts/choose_sidecar.cjs",
        env_overrides={"NIKO_GATEWAY_RUNTIME": " python "},
    )

    logs = "\n".join(result["logs"])
    commands = result["commands"]

    assert result["exitCode"] == 0
    assert "Runtime selection: NIKO_GATEWAY_RUNTIME=python" in logs
    assert (
        "Compatibility override active: Python sidecar is not the authoritative default runtime"
        in logs
    )
    assert "Building Python sidecar (explicit compatibility runtime)..." in logs
    assert "Validating sidecar contract..." in logs
    assert commands[0]["command"] == "npm run build:sidecar:python"
    assert commands[1]["command"] == "npm run validate:sidecar-contract"


def test_sidecar_selector_exits_when_validation_fails_after_build() -> None:
    result = run_node_cjs_and_capture(
        "desktop/scripts/choose_sidecar.cjs",
        env_overrides={"NIKO_GATEWAY_RUNTIME": None},
        fail_commands=["npm run validate:sidecar-contract"],
    )

    logs = "\n".join(result["logs"])
    commands = result["commands"]

    assert result["exitCode"] == 1
    assert commands == [
        {
            "command": "npm run build:sidecar:node",
            "cwd": str(PROJECT_ROOT / "desktop"),
            "stdio": "inherit",
        },
        {
            "command": "npm run validate:sidecar-contract",
            "cwd": str(PROJECT_ROOT / "desktop"),
            "stdio": "inherit",
        },
    ]
    assert "❌ Contract validation failed" in logs
    assert "✅ Sidecar build complete" not in logs


def test_sidecar_contract_validator_keeps_node_authority_and_python_packaging_contract() -> None:
    exists_paths, json_files = build_sidecar_contract_fixture()
    result = run_node_cjs_and_capture(
        "desktop/scripts/validate_sidecar_contract.cjs",
        argv=["--strict"],
        exists_paths=exists_paths,
        json_files=json_files,
    )

    logs = "\n".join(result["logs"])

    assert result["exitCode"] == 0
    assert "Validation scope: node runtime" in logs
    assert "node (Node.js sidecar (standalone proxy))" in logs
    assert "Desktop security boundary" in logs
    assert "Runtime / packaging matrix" in logs
    assert "Authoritative local runtime: node" in logs
    assert "Packaged compatibility runtime: python" in logs
    assert "authoritative local runtime remains node-first" in logs
    assert "packaged externalBin stays on the python compatibility sidecar" in logs
    assert "node sidecar is repo-local only and not claimed as a packaged binary" in logs
    assert "✅ All contracts validated successfully" in logs


def test_sidecar_contract_validator_all_runtimes_reports_both_contract_sets() -> None:
    exists_paths, json_files = build_sidecar_contract_fixture(include_python_runtime=True)
    result = run_node_cjs_and_capture(
        "desktop/scripts/validate_sidecar_contract.cjs",
        argv=["--strict", "--all-runtimes"],
        exists_paths=exists_paths,
        json_files=json_files,
    )

    logs = "\n".join(result["logs"])

    assert result["exitCode"] == 0
    assert "Validation scope: all runtimes" in logs
    assert "python (Python sidecar (PyInstaller output))" in logs
    assert "node (Node.js sidecar (standalone proxy))" in logs
    assert "Packaged compatibility runtime: python" in logs
    assert "✅ All contracts validated successfully" in logs


def test_sidecar_contract_validator_defaults_invalid_runtime_to_node_scope() -> None:
    exists_paths, json_files = build_sidecar_contract_fixture()
    result = run_node_cjs_and_capture(
        "desktop/scripts/validate_sidecar_contract.cjs",
        argv=["--strict"],
        env_overrides={"NIKO_GATEWAY_RUNTIME": " ruby "},
        exists_paths=exists_paths,
        json_files=json_files,
    )

    logs = "\n".join(result["logs"])

    assert result["exitCode"] == 0
    assert "Validation scope: node runtime" in logs
    assert "python (Python sidecar (PyInstaller output))" not in logs
    assert "node (Node.js sidecar (standalone proxy))" in logs


def test_sidecar_contract_validator_fails_strict_mode_when_packaged_binary_switches_to_node() -> (
    None
):
    exists_paths, json_files = build_sidecar_contract_fixture(
        external_bin=["bin/niko-gateway-node"]
    )
    result = run_node_cjs_and_capture(
        "desktop/scripts/validate_sidecar_contract.cjs",
        argv=["--strict"],
        exists_paths=exists_paths,
        json_files=json_files,
    )

    logs = "\n".join(result["logs"])
    errors = "\n".join(result["errors"])

    assert result["exitCode"] == 1
    assert "packaged externalBin stays on the python compatibility sidecar" in logs
    assert "externalBin=bin/niko-gateway-node" in logs
    assert "Contract validation FAILED (strict mode)" in errors


def test_sidecar_contract_validator_fails_strict_mode_when_capability_boundary_expands() -> None:
    exists_paths, json_files = build_sidecar_contract_fixture(
        capability_permissions=["core:default", "shell:allow-open"]
    )
    result = run_node_cjs_and_capture(
        "desktop/scripts/validate_sidecar_contract.cjs",
        argv=["--strict"],
        exists_paths=exists_paths,
        json_files=json_files,
    )

    logs = "\n".join(result["logs"])
    errors = "\n".join(result["errors"])

    assert result["exitCode"] == 1
    assert "frontend capability is limited to core invoke access" in logs
    assert "permissions=core:default, shell:allow-open" in logs
    assert "Contract validation FAILED (strict mode)" in errors
