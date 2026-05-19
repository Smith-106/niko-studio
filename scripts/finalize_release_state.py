#!/usr/bin/env python
"""Release-state sync and drift check for docs + local release summaries."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
README_PATH = PROJECT_ROOT / "README.md"
RELEASE_NOTES_PATH = PROJECT_ROOT / "docs" / "release" / "RELEASE_NOTES.md"
DOCS_SITE_RELEASE_SNAPSHOT_PATH = (
    PROJECT_ROOT / "docs-site" / "src" / "client" / "data" / "shared-doc-fragments.ts"
)
LOCAL_SUMMARY_PATH = PROJECT_ROOT / "release-check-summary.md"
LOCAL_ARTIFACT_PATH = (
    PROJECT_ROOT / ".workflow" / "evidence" / "release" / "release-readiness-artifact.json"
)
CURRENT_VERSION = "9.26.1"


@dataclass(frozen=True)
class ReleaseState:
    head_sha: str
    release_tag: str
    release_url: str
    asset_names: tuple[str, ...]


def run_cmd(cmd: list[str]) -> str:
    result = subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError((result.stdout or "") + ("\n" + result.stderr if result.stderr else ""))
    return (result.stdout or "").strip()


def load_release_state(tag: str) -> ReleaseState:
    head_sha = run_cmd(["git", "rev-parse", "HEAD"])
    payload = json.loads(
        run_cmd(["gh", "api", f"repos/Smith-106/niko-studio/releases/tags/{tag}"])
    )
    assets = tuple(asset["name"] for asset in payload.get("assets", []))
    return ReleaseState(
        head_sha=head_sha,
        release_tag=tag,
        release_url=str(payload["html_url"]),
        asset_names=assets,
    )


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def replace_once(text: str, pattern: str, replacement: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise RuntimeError(f"Expected exactly one replacement for pattern: {pattern}")
    return updated


def replace_optional(text: str, pattern: str, replacement: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count not in {0, 1}:
        raise RuntimeError(f"Expected at most one replacement for pattern: {pattern}")
    return updated


def sync_readme(text: str, state: ReleaseState) -> str:
    text = replace_optional(
        text,
        r"(?m)^- Current release tag: `[^`]+`$",
        f"- Current release tag: `{state.release_tag}`",
    )
    text = replace_optional(
        text,
        r"(?m)^- Current release commit: `[^`]+`$",
        f"- Current release commit: `{state.head_sha}`",
    )
    text = replace_optional(
        text,
        r"(?m)^- GitHub release: `[^`]+`$",
        f"- GitHub release: `{state.release_url}`",
    )
    text = replace_once(
        text,
        r"(?m)^\*Version [^|]+\| Updated: [^*]+\*$",
        f"*Version {CURRENT_VERSION} Platform Edition | Updated: 2026-05-19*",
    )
    return text


def sync_release_notes(text: str, state: ReleaseState) -> str:
    text = replace_optional(
        text,
        r"(?m)^- GitHub release：`[^`]+`$",
        f"- GitHub release：`{state.release_url}`",
    )
    text = replace_optional(
        text,
        r"(?m)^- Release tag：`[^`]+`$",
        f"- Release tag：`{state.release_tag}`",
    )
    text = replace_optional(
        text,
        r"(?m)^- Current-head release commit：`[^`]+`$",
        f"- Current-head release commit：`{state.head_sha}`",
    )
    return text


def sync_release_snapshot_fragment(text: str, state: ReleaseState) -> str:
    short_sha = state.head_sha[:7]
    text = replace_optional(
        text,
        r"Current release commit：<code>[^<]+</code>",
        f"Current release commit：<code>{short_sha}</code>",
    )
    text = replace_optional(
        text,
        r"https://github\.com/Smith-106/niko-studio/releases/tag/[^\"<]+",
        state.release_url,
    )
    return text


def sync_local_summary(text: str, state: ReleaseState) -> str:
    generated_at = datetime.now(timezone.utc).isoformat()
    text = replace_once(
        text,
        r'(?m)^  "generated_at": "[^"]+",$',
        f'  "generated_at": "{generated_at}",',
    )
    text = replace_once(
        text,
        r'(?m)^  "head_sha": "[^"]+",$',
        f'  "head_sha": "{state.head_sha}",',
    )
    text = replace_once(
        text,
        r"(?m)^- current_head_sha: .+$",
        f"- current_head_sha: {state.head_sha}",
    )
    text = replace_once(
        text,
        r"(?m)^- generated_at: .+$",
        f"- generated_at: {generated_at}",
    )
    text = replace_once(
        text,
        r"(?m)^- GitHub release `[^`]+` is aligned to commit `[^`]+`\.$",
        f"- GitHub release `{state.release_tag}` is aligned to commit `{state.head_sha}`.",
    )
    return text


def sync_local_artifact(payload: dict[str, object], state: ReleaseState) -> dict[str, object]:
    generated_at = datetime.now(timezone.utc).isoformat()
    payload["generated_at"] = generated_at
    payload["head_sha"] = state.head_sha
    release_evidence = payload.get("release_evidence")
    if isinstance(release_evidence, dict):
        release_evidence["generated_at"] = generated_at
        release_evidence["head_sha"] = state.head_sha
    trace = payload.get("trace")
    if isinstance(trace, dict):
        trace["trace_id"] = f"release-readiness-{generated_at}"
    return payload


def check_drift(text: str, patterns: list[str]) -> list[str]:
    failures: list[str] = []
    for pattern in patterns:
        if re.search(pattern, text, flags=re.MULTILINE):
            failures.append(pattern)
    return failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync release-facing docs and local GO artifacts.")
    parser.add_argument("--tag", default=f"v{CURRENT_VERSION}")
    parser.add_argument("--check", action="store_true", help="Validate drift only.")
    args = parser.parse_args(argv)

    state = load_release_state(args.tag)

    readme = read_text(README_PATH)
    release_notes = read_text(RELEASE_NOTES_PATH)
    release_snapshot_fragment = read_text(DOCS_SITE_RELEASE_SNAPSHOT_PATH)
    local_summary = read_text(LOCAL_SUMMARY_PATH)
    local_artifact = json.loads(LOCAL_ARTIFACT_PATH.read_text(encoding="utf-8"))

    next_readme = sync_readme(readme, state)
    next_release_notes = sync_release_notes(release_notes, state)
    next_release_snapshot_fragment = sync_release_snapshot_fragment(release_snapshot_fragment, state)
    next_local_summary = sync_local_summary(local_summary, state)
    next_local_artifact = sync_local_artifact(local_artifact, state)

    if args.check:
        failures: list[str] = []
        failures.extend(
            f"README:{pattern}"
            for pattern in check_drift(
                next_readme,
                [r"Version 9\.25\.8 Platform Edition", r"Current release commit: `ee391ee"],
            )
        )
        failures.extend(
            f"RELEASE_NOTES:{pattern}"
            for pattern in check_drift(next_release_notes, [r"Current-head release commit：`ee391ee"])
        )
        failures.extend(
            f"RELEASE_SNAPSHOT_FRAGMENT:{pattern}"
            for pattern in check_drift(next_release_snapshot_fragment, [r"Current release commit：<code>ee391ee</code>"])
        )
        failures.extend(
            f"LOCAL_ARTIFACT:{pattern}"
            for pattern in check_drift(
                json.dumps(next_local_artifact, ensure_ascii=False, indent=2),
                [r"head_sha=ad3ffb203b546c25bfff71c8209f1b99ae7ad720"],
            )
        )
        if failures:
            print(json.dumps({"status": "FAIL", "drift": failures}, ensure_ascii=False, indent=2))
            return 1
        print(json.dumps({"status": "PASS", "tag": state.release_tag, "head_sha": state.head_sha}, ensure_ascii=False, indent=2))
        return 0

    write_text(README_PATH, next_readme)
    write_text(RELEASE_NOTES_PATH, next_release_notes)
    write_text(DOCS_SITE_RELEASE_SNAPSHOT_PATH, next_release_snapshot_fragment)
    write_text(LOCAL_SUMMARY_PATH, next_local_summary)
    LOCAL_ARTIFACT_PATH.write_text(json.dumps(next_local_artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "tag": state.release_tag, "head_sha": state.head_sha, "assets": list(state.asset_names)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
