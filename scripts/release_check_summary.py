#!/usr/bin/env python
"""Release readiness summary with deterministic Go/No-Go contract."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = PROJECT_ROOT / "release-check-summary.md"


def run_cmd(cmd: list[str], env: dict[str, str] | None = None) -> tuple[int, str]:
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)

    result = subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=merged_env,
    )
    output = (result.stdout or "") + ("\n" + result.stderr if result.stderr else "")
    return result.returncode, output.strip()


def parse_pytest_counts(output: str) -> tuple[str, str]:
    match = re.search(r"(\d+)\s+passed", output)
    if match:
        return "passed", match.group(1)
    if "failed" in output.lower():
        fail_match = re.search(r"(\d+)\s+failed", output)
        return "failed", fail_match.group(1) if fail_match else "unknown"
    return "unknown", "0"


def parse_first_json_object(output: str) -> tuple[dict[str, object] | None, str | None]:
    decoder = json.JSONDecoder()
    for index, char in enumerate(output):
        if char != "{":
            continue
        try:
            payload, _ = decoder.raw_decode(output[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            return payload, None
        return None, "json payload is not an object"
    return None, "json payload not found in output"


def build_check_result(
    check_id: str,
    priority: str,
    blocking: bool,
    exit_code: int,
    detail: str,
    status_override: str | None = None,
) -> dict[str, object]:
    status = status_override if status_override else ("PASS" if exit_code == 0 else "FAIL")
    return {
        "check_id": check_id,
        "priority": priority,
        "blocking": blocking,
        "status": status,
        "exit_code": exit_code,
        "detail": detail,
    }


def main() -> int:
    version_code, version_output = run_cmd([sys.executable, "scripts/check_versions.py"])
    delivery_code, delivery_output = run_cmd([sys.executable, "scripts/delivery_gate.py"])

    baseline_code, baseline_output = run_cmd([
        sys.executable,
        "-m",
        "pytest",
        "-o",
        "addopts=",
        "tests/unit",
        "tests/integration",
        "-m",
        "not e2e",
        "--cov=src",
        "--cov-report=xml",
        "--cov-fail-under=80",
        "-q",
        "--tb=no",
    ])

    desktop_bootstrap_code, desktop_bootstrap_output = run_cmd([
        "npm.cmd",
        "--prefix",
        "desktop",
        "run",
        "ensure-deps",
    ])
    desktop_check_code, desktop_check_output = run_cmd([
        "npm.cmd",
        "--prefix",
        "desktop",
        "run",
        "check",
    ])
    desktop_code = desktop_bootstrap_code if desktop_bootstrap_code != 0 else desktop_check_code
    desktop_output = "\n\n".join(part for part in [desktop_bootstrap_output, desktop_check_output] if part)

    e2e_code, e2e_output = run_cmd([
        sys.executable,
        "-m",
        "pytest",
        "-o",
        "addopts=",
        "-m",
        "e2e",
        "tests/integration/test_e2e_workflow.py",
        "-q",
        "--tb=no",
    ])

    prod_guard_code, prod_guard_output = run_cmd([
        sys.executable,
        "-c",
        (
            "from src.mcp.gateway import _resolve_reload_enabled, _resolve_cors_origins;"
            "from src.config import init_config;"
            "init_config(config_path='config/niko-studio.production.yaml', hot_reload=False);"
            "assert _resolve_reload_enabled() is False;"
            "origins = _resolve_cors_origins();"
            "assert origins and all(o not in {'*','http://localhost:3000','http://127.0.0.1:3000'} for o in origins);"
            "print('production guard ok')"
        ),
    ], env={
        "NIKO_ENV": "production",
        "NIKO_CORS_PROD_ORIGINS": "https://app.example.com,https://gray.example.com",
    })

    metrics_guard_code, metrics_guard_output = run_cmd([
        sys.executable,
        "-c",
        (
            "from src.config import init_config, get_config_value;"
            "init_config(config_path='config/niko-studio.production.yaml', hot_reload=False);"
            "assert bool(get_config_value('gateway.metrics_enabled', True)) is True;"
            "print('metrics guard ok')"
        ),
    ], env={
        "NIKO_ENV": "production",
        "NIKO_GATEWAY_METRICS_ENABLED": "true",
    })

    tasks_code, tasks_output = run_cmd([sys.executable, "scripts/check_tasks_completion.py"])
    tasks_payload, tasks_parse_error = parse_first_json_object(tasks_output)

    tasks_checked = tasks_payload.get("total_checked") if tasks_payload else None
    tasks_unchecked = tasks_payload.get("total_unchecked") if tasks_payload else None
    tasks_ratio = tasks_payload.get("completion_ratio") if tasks_payload else None

    if tasks_code != 0:
        tasks_status = "FAIL"
        tasks_detail = f"checker_exit={tasks_code}, json_parse_error={tasks_parse_error or 'none'}"
    elif not tasks_payload:
        tasks_status = "WARN"
        tasks_detail = f"checker_exit=0, json_parse_error={tasks_parse_error or 'unknown'}"
    elif isinstance(tasks_unchecked, int) and tasks_unchecked == 0:
        tasks_status = "PASS"
        tasks_detail = (
            f"checked={tasks_checked}, unchecked={tasks_unchecked}, completion_ratio={tasks_ratio}%"
        )
    else:
        tasks_status = "WARN"
        tasks_detail = (
            f"checked={tasks_checked}, unchecked={tasks_unchecked}, completion_ratio={tasks_ratio}%"
        )

    coverage_xml = PROJECT_ROOT / "coverage.xml"
    coverage_exists = coverage_xml.exists()
    codecov_token_present = bool(os.environ.get("CODECOV_TOKEN", "").strip())
    codecov_strict_mode = codecov_token_present

    if coverage_exists:
        codecov_status = "PASS"
        codecov_exit = 0
        codecov_detail = "coverage.xml available"
    elif codecov_strict_mode:
        codecov_status = "FAIL"
        codecov_exit = 1
        codecov_detail = "coverage.xml missing in strict mode"
    else:
        codecov_status = "WARN"
        codecov_exit = 0
        codecov_detail = "coverage.xml missing, soft mode without CODECOV_TOKEN"

    baseline_status, baseline_passed = parse_pytest_counts(baseline_output)
    e2e_status, e2e_passed = parse_pytest_counts(e2e_output)

    checks = [
        build_check_result("version_consistency", "P0", True, version_code, "scripts/check_versions.py"),
        build_check_result("delivery_semantic_gate", "P0", True, delivery_code, "scripts/delivery_gate.py"),
        build_check_result(
            "baseline_tests_and_coverage",
            "P0",
            True,
            baseline_code,
            f"status={baseline_status}, passed_count={baseline_passed}",
        ),
        build_check_result("desktop_check", "P0", True, desktop_code, "npm --prefix desktop run check"),
        build_check_result(
            "external_e2e_smoke",
            "P1",
            False,
            e2e_code,
            f"status={e2e_status}, passed_count={e2e_passed}",
        ),
        build_check_result("production_guard", "P1", False, prod_guard_code, "reload/cors production guards"),
        build_check_result("metrics_guard", "P1", False, metrics_guard_code, "gateway metrics production guard"),
        build_check_result(
            "codecov_signal",
            "P1",
            False,
            codecov_exit,
            f"strict_mode={str(codecov_strict_mode).lower()}, token_present={str(codecov_token_present).lower()}, {codecov_detail}",
            status_override=codecov_status,
        ),
        build_check_result(
            "tasks_completion_signal",
            "P1",
            False,
            tasks_code,
            tasks_detail,
            status_override=tasks_status,
        ),
    ]

    no_go_reasons = [
        check["check_id"]
        for check in checks
        if check["blocking"] and check["status"] != "PASS"
    ]
    decision = "GO" if not no_go_reasons else "NO_GO"

    machine_payload = {
        "decision": decision,
        "go_no_go_reasons": no_go_reasons,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }

    table_lines = [
        "| check_id | priority | blocking | status |",
        "|---|---|---|---|",
    ]
    table_lines.extend(
        f"| {item['check_id']} | {item['priority']} | {str(item['blocking']).lower()} | {item['status']} |"
        for item in checks
    )
    table = "\n".join(table_lines)

    report = f"""# Release Check Summary

- Decision: {decision}
- Go/No-Go rule: any P0 FAIL => NO_GO
- Codecov strict mode: {'enabled' if codecov_strict_mode else 'disabled'}

## Deterministic Check Results

{table}

## Machine-Readable Decision

```json
{json.dumps(machine_payload, ensure_ascii=False, indent=2)}
```

## Details

### 1) version_consistency

```text
{version_output}
```

### 2) delivery_semantic_gate

```text
{delivery_output}
```

### 3) baseline_tests_and_coverage

- status: {baseline_status}
- passed_count: {baseline_passed}

```text
{baseline_output}
```

### 4) desktop_check

```text
{desktop_output}
```

### 5) external_e2e_smoke

- status: {e2e_status}
- passed_count: {e2e_passed}

```text
{e2e_output}
```

### 6) production_guard

```text
{prod_guard_output}
```

### 7) metrics_guard

```text
{metrics_guard_output}
```

### 8) codecov_signal

- strict_mode: {'true' if codecov_strict_mode else 'false'}
- token_present: {'true' if codecov_token_present else 'false'}
- coverage.xml exists: {'yes' if coverage_exists else 'no'}

### 9) tasks_completion_signal

- checker_exit: {tasks_code}
- status: {tasks_status}
- checked: {tasks_checked if tasks_checked is not None else 'n/a'}
- unchecked: {tasks_unchecked if tasks_unchecked is not None else 'n/a'}
- completion_ratio: {str(tasks_ratio) + '%' if tasks_ratio is not None else 'n/a'}
- json_parse_error: {tasks_parse_error if tasks_parse_error else 'none'}

### 10) CI Integration Tests latest

- policy: do not write back dynamic run_id / run_url to repository files.
- source_of_truth: GitHub Actions `Integration Tests` latest result.
- workflow_url: https://github.com/Smith-106/niko-studio/actions/workflows/integration-tests.yml
"""

    REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"Report generated: {REPORT_PATH}")
    return 0 if decision == "GO" else 1


if __name__ == "__main__":
    raise SystemExit(main())
