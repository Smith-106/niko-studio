#!/usr/bin/env python
"""Record installed-package E2E acceptance evidence for an exact retained artifact."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CHECKLIST_PATH = PROJECT_ROOT / "docs" / "operations" / "E2E_VERIFICATION.md"
RELEASE_EVIDENCE_DIR = PROJECT_ROOT / ".workflow" / "evidence" / "release"
PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH = RELEASE_EVIDENCE_DIR / "package-e2e-acceptance.json"


def _current_head_sha() -> str | None:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        return None
    head_sha = result.stdout.strip()
    return head_sha or None


def _current_version() -> str | None:
    package_json_path = PROJECT_ROOT / "desktop" / "package.json"
    try:
        payload = json.loads(package_json_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    version = payload.get("version")
    if isinstance(version, str):
        return version.strip() or None
    return None


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Record install/start/use acceptance for the exact retained desktop package artifact."
        )
    )
    parser.add_argument(
        "--artifact-path",
        type=Path,
        help="Path to the exact retained installer or package artifact that was manually validated.",
    )
    parser.add_argument(
        "--tester",
        help="Operator who completed the installed-package acceptance checklist.",
    )
    parser.add_argument(
        "--result",
        choices=("pass", "fail"),
        help="Acceptance result for the exact retained package artifact.",
    )
    parser.add_argument(
        "--notes",
        default="",
        help="Optional notes. Required when recording a FAIL result.",
    )
    parser.add_argument(
        "--install-verified",
        action="store_true",
        help="Confirm the exact retained package artifact installed successfully.",
    )
    parser.add_argument(
        "--launch-verified",
        action="store_true",
        help="Confirm the installed desktop application launched successfully.",
    )
    parser.add_argument(
        "--core-flow-verified",
        action="store_true",
        help="Confirm at least one install/start/use core flow completed successfully.",
    )
    parser.add_argument(
        "--shutdown-verified",
        action="store_true",
        help="Confirm shutdown / close behavior was validated successfully.",
    )
    return parser


def _print_guidance() -> None:
    print("Installed-package E2E verification checklist:")
    print(CHECKLIST_PATH.as_posix())
    print()
    print("Retained evidence artifact:")
    print(PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH.as_posix())
    print()
    print("Run this on the Windows host after validating the exact retained package artifact.")
    print("Example:")
    print(
        'npm --prefix desktop run package:e2e:checklist -- --artifact-path "desktop/src-tauri/target/release/bundle/nsis/<installer>.exe" --tester "<operator>" --result pass --install-verified --launch-verified --core-flow-verified --shutdown-verified'
    )


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    should_record = any(
        value
        for value in (
            args.artifact_path,
            args.tester,
            args.result,
            args.install_verified,
            args.launch_verified,
            args.core_flow_verified,
            args.shutdown_verified,
            args.notes.strip(),
        )
    )
    if not should_record:
        _print_guidance()
        return 0

    if args.artifact_path is None:
        parser.error("`--artifact-path` is required when recording package-level acceptance.")
    if not args.tester or not args.tester.strip():
        parser.error("`--tester` is required when recording package-level acceptance.")
    if args.result is None:
        parser.error("`--result` is required when recording package-level acceptance.")

    artifact_path = args.artifact_path.resolve()
    if not artifact_path.exists() or not artifact_path.is_file():
        parser.error(f"Package artifact does not exist: {artifact_path.as_posix()}")

    if args.result == "pass":
        required_flags = {
            "--install-verified": args.install_verified,
            "--launch-verified": args.launch_verified,
            "--core-flow-verified": args.core_flow_verified,
            "--shutdown-verified": args.shutdown_verified,
        }
        missing_flags = [flag for flag, enabled in required_flags.items() if not enabled]
        if missing_flags:
            parser.error(
                "PASS results must include all verification flags: " + ", ".join(missing_flags)
            )
    elif not args.notes.strip():
        parser.error("`--notes` is required when recording a FAIL result.")

    head_sha = _current_head_sha()
    if not head_sha:
        parser.error("Unable to determine current git HEAD.")

    version = _current_version()
    if not version:
        parser.error("Unable to determine desktop package version.")

    generated_at = datetime.now(timezone.utc).isoformat()
    artifact_sha256 = _sha256(artifact_path)
    artifact_size_bytes = artifact_path.stat().st_size
    normalized_result = args.result.upper()

    payload = {
        "artifact_type": "package_e2e_acceptance",
        "schema_version": "evidence.v2",
        "status": "PASS" if normalized_result == "PASS" else "FAIL",
        "generated_at": generated_at,
        "head_sha": head_sha,
        "version": version,
        "tester": args.tester.strip(),
        "artifact_path": artifact_path.as_posix(),
        "artifact_name": artifact_path.name,
        "artifact_kind": artifact_path.suffix.lower().lstrip(".") or "unknown",
        "artifact_sha256": artifact_sha256,
        "artifact_size_bytes": artifact_size_bytes,
        "checklist_path": CHECKLIST_PATH.as_posix(),
        "install_verified": bool(args.install_verified),
        "launch_verified": bool(args.launch_verified),
        "core_flow_verified": bool(args.core_flow_verified),
        "shutdown_verified": bool(args.shutdown_verified),
        "notes": args.notes.strip(),
        "trace": {
            "trace_id": f"package-e2e-{generated_at}",
            "session_id": "package-e2e-checklist",
            "run_id": "package-e2e-checklist",
            "artifact_path": PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH.as_posix(),
        },
    }

    RELEASE_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("Recorded package-level E2E acceptance evidence:")
    print(PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH.as_posix())
    print(f"status={payload['status']}")
    print(f"artifact={payload['artifact_path']}")
    print(f"artifact_sha256={payload['artifact_sha256']}")
    print(f"head_sha={payload['head_sha']}")
    print(f"version={payload['version']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
