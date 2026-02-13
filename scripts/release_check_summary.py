#!/usr/bin/env python
"""发布检查汇总脚本：版本一致性、baseline/e2e、coverage、生产配置与观测守卫。"""

from __future__ import annotations

import os
import re
import subprocess
import sys
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


def main() -> int:
    version_code, version_output = run_cmd([sys.executable, "scripts/check_versions.py"])

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

    baseline_status, baseline_passed = parse_pytest_counts(baseline_output)
    e2e_status, e2e_passed = parse_pytest_counts(e2e_output)

    coverage_xml = PROJECT_ROOT / "coverage.xml"
    codecov_state = "available" if coverage_xml.exists() else "missing"

    report = f"""# Release Check Summary

- Version check: {'PASS' if version_code == 0 else 'FAIL'}
- Baseline tests (unit+integration, not e2e): {'PASS' if baseline_code == 0 else 'FAIL'}
- e2e smoke: {'PASS' if e2e_code == 0 else 'FAIL'}
- Production guard (reload/cors): {'PASS' if prod_guard_code == 0 else 'FAIL'}
- Metrics guard (production): {'PASS' if metrics_guard_code == 0 else 'FAIL'}
- Codecov signal (coverage.xml): {codecov_state}

## Details

### 1) Version consistency

```text
{version_output}
```

### 2) Baseline tests

- status: {baseline_status}
- passed_count: {baseline_passed}

```text
{baseline_output}
```

### 3) e2e smoke

- status: {e2e_status}
- passed_count: {e2e_passed}

```text
{e2e_output}
```

### 4) Production guard (reload/cors)

```text
{prod_guard_output}
```

### 5) Metrics guard

```text
{metrics_guard_output}
```

### 6) Codecov prerequisite

- coverage.xml exists: {'yes' if coverage_xml.exists() else 'no'}
- expected CI upload policy:
  - internal: fail_ci_if_error=false
  - external: fail_ci_if_error=true (and CODECOV_TOKEN required)
"""

    REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"Report generated: {REPORT_PATH}")

    final_ok = (
        version_code == 0
        and baseline_code == 0
        and e2e_code == 0
        and prod_guard_code == 0
        and metrics_guard_code == 0
    )
    return 0 if final_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
