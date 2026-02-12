#!/usr/bin/env python
"""发布检查汇总脚本：版本一致性、e2e、coverage 文件状态。"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = PROJECT_ROOT / "release-check-summary.md"


def run_cmd(cmd: list[str]) -> tuple[int, str]:
    result = subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    output = (result.stdout or "") + ("\n" + result.stderr if result.stderr else "")
    return result.returncode, output.strip()


def parse_e2e_counts(output: str) -> tuple[str, str]:
    match = re.search(r"(\d+)\s+passed", output)
    if match:
        return "passed", match.group(1)
    if "failed" in output.lower():
        fail_match = re.search(r"(\d+)\s+failed", output)
        return "failed", fail_match.group(1) if fail_match else "unknown"
    return "unknown", "0"


def main() -> int:
    version_code, version_output = run_cmd([sys.executable, "scripts/check_versions.py"])

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

    e2e_status, e2e_passed = parse_e2e_counts(e2e_output)

    coverage_xml = PROJECT_ROOT / "coverage.xml"
    codecov_state = "available" if coverage_xml.exists() else "missing"

    report = f"""# Release Check Summary

- Version check: {'PASS' if version_code == 0 else 'FAIL'}
- e2e smoke: {'PASS' if e2e_code == 0 else 'FAIL'}
- Codecov signal (coverage.xml): {codecov_state}

## Details

### 1) Version consistency

```text
{version_output}
```

### 2) e2e smoke

- status: {e2e_status}
- passed_count: {e2e_passed}

```text
{e2e_output}
```

### 3) Codecov prerequisite

- coverage.xml exists: {'yes' if coverage_xml.exists() else 'no'}
- expected CI upload policy:
  - internal: fail_ci_if_error=false
  - external: fail_ci_if_error=true
"""

    REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"Report generated: {REPORT_PATH}")

    final_ok = version_code == 0 and e2e_code == 0
    return 0 if final_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
