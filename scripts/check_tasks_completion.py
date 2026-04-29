#!/usr/bin/env python
"""Task completion checker for roadmap markdown files."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TASKS_FILE = PROJECT_ROOT / "docs" / "TASKS_V10_OPTIMIZED.md"
CHECKBOX_PATTERN = re.compile(r"^\s*-\s*\[(?P<mark>[ xX])\]\s*(?P<text>.+?)\s*$")
HEADING_PATTERN = re.compile(r"^\s*#{1,6}\s*(?P<title>.+?)\s*$")
PHASE_PATTERN = re.compile(r"\bphase\s*(?P<phase>\d+)\b", re.IGNORECASE)
PHASE_PREFIX_PATTERN = re.compile(r"^(?P<phase>\d{1,2})(?:[.-]\d+)?\b")


@dataclass(frozen=True)
class PendingItem:
    line: int
    text: str
    phase_hint: str
    phase_order: int | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check roadmap completion by parsing markdown checkbox items.",
    )
    parser.add_argument(
        "--file",
        default=str(DEFAULT_TASKS_FILE),
        help="Target markdown file to scan.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with code 1 when unchecked items exist.",
    )
    parser.add_argument(
        "--preview-limit",
        type=int,
        default=10,
        help="How many pending items to include in preview output.",
    )
    parser.add_argument(
        "--output-json",
        default="",
        help="Optional path to write full JSON payload.",
    )
    parser.add_argument(
        "--export-queue",
        default="",
        help="Optional path to export deterministic queue JSON for unchecked items.",
    )
    return parser.parse_args()


def detect_phase_from_text(text: str) -> int | None:
    cleaned = text.strip().strip("`")
    match = PHASE_PREFIX_PATTERN.match(cleaned)
    if not match:
        return None
    return int(match.group("phase"))


def scan_markdown(file_path: Path) -> tuple[int, list[PendingItem], int]:
    checked = 0
    pending: list[PendingItem] = []

    content = file_path.read_text(encoding="utf-8", errors="replace").splitlines()
    current_phase: int | None = None

    for idx, line in enumerate(content, start=1):
        heading_match = HEADING_PATTERN.match(line)
        if heading_match:
            phase_match = PHASE_PATTERN.search(heading_match.group("title"))
            current_phase = int(phase_match.group("phase")) if phase_match else None

        checkbox_match = CHECKBOX_PATTERN.match(line)
        if not checkbox_match:
            continue
        if checkbox_match.group("mark").lower() == "x":
            checked += 1
            continue

        text = checkbox_match.group("text")
        inferred_phase = (
            current_phase if current_phase is not None else detect_phase_from_text(text)
        )
        phase_hint = f"Phase {inferred_phase}" if inferred_phase is not None else ""
        pending.append(
            PendingItem(
                line=idx,
                text=text,
                phase_hint=phase_hint,
                phase_order=inferred_phase,
            )
        )

    return checked, pending, len(content)


def build_payload(
    file_path: Path, checked: int, pending: list[PendingItem], total_lines: int, preview_limit: int
) -> dict[str, object]:
    total_tasks = checked + len(pending)
    ratio = round((checked / total_tasks) * 100, 2) if total_tasks else 100.0
    preview = [{"line": item.line, "text": item.text} for item in pending[: max(preview_limit, 0)]]

    return {
        "target_file": str(file_path),
        "total_lines": total_lines,
        "total_tasks": total_tasks,
        "total_checked": checked,
        "total_unchecked": len(pending),
        "completion_ratio": ratio,
        "pending_preview": preview,
    }


def to_project_relative(file_path: Path) -> str:
    try:
        return file_path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()
    except ValueError:
        return file_path.resolve().as_posix()


def build_queue_item_id(source_file: str, source_line: int) -> str:
    source_slug = re.sub(r"[^a-z0-9]+", "-", source_file.lower()).strip("-")
    return f"queue-{source_slug}-l{source_line:04d}"


def phase_to_priority(phase_order: int | None) -> str:
    if phase_order is None:
        return "P3"
    if phase_order <= 16:
        return "P1"
    if phase_order <= 18:
        return "P2"
    return "P3"


def build_queue_payload(file_path: Path, pending: list[PendingItem]) -> dict[str, object]:
    source_file = to_project_relative(file_path)
    sorted_pending = sorted(
        pending,
        key=lambda item: (
            item.phase_order if item.phase_order is not None else sys.maxsize,
            item.line,
            item.text,
        ),
    )

    queue_items: list[dict[str, object]] = []
    for item in sorted_pending:
        queue_items.append(
            {
                "id": build_queue_item_id(source_file, item.line),
                "title": item.text,
                "text": item.text,
                "source_file": source_file,
                "source_line": item.line,
                "phase_hint": item.phase_hint,
                "priority": phase_to_priority(item.phase_order),
                "status": "pending",
            }
        )

    return {
        "source_file": source_file,
        "total_items": len(queue_items),
        "items": queue_items,
    }


def main() -> int:
    args = parse_args()
    target_file = Path(args.file)
    if not target_file.is_absolute():
        target_file = PROJECT_ROOT / target_file

    if not target_file.exists():
        print(f"[FAIL] target file not found: {target_file}")
        return 2

    checked, pending, total_lines = scan_markdown(target_file)
    payload = build_payload(target_file, checked, pending, total_lines, args.preview_limit)

    print(
        "tasks completion: "
        f"checked={payload['total_checked']} "
        f"unchecked={payload['total_unchecked']} "
        f"ratio={payload['completion_ratio']}%"
    )
    print(json.dumps(payload, ensure_ascii=False, indent=2))

    if args.output_json:
        output_path = Path(args.output_json)
        if not output_path.is_absolute():
            output_path = PROJECT_ROOT / output_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.export_queue:
        queue_path = Path(args.export_queue)
        if not queue_path.is_absolute():
            queue_path = PROJECT_ROOT / queue_path
        queue_path.parent.mkdir(parents=True, exist_ok=True)
        queue_payload = build_queue_payload(target_file, pending)
        queue_path.write_text(
            json.dumps(queue_payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"queue exported: {queue_path}")

    if args.strict and payload["total_unchecked"] > 0:
        print("strict mode: pending tasks detected")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
