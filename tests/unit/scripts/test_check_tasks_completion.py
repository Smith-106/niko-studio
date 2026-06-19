from __future__ import annotations

import importlib.util
import json
import runpy
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _load(relative_path: str, module_name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, PROJECT_ROOT / relative_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def check_tasks_completion() -> ModuleType:
    return _load("scripts/check_tasks_completion.py", "_test_check_tasks_completion")


def test_detect_phase_from_text_supports_prefix_and_ignores_non_phases(check_tasks_completion) -> None:
    assert check_tasks_completion.detect_phase_from_text("16.2 ship package workflow") == 16
    assert check_tasks_completion.detect_phase_from_text("`18.4 close release`") == 18
    assert check_tasks_completion.detect_phase_from_text("backlog item without prefix") is None


def test_scan_markdown_builds_pending_items_from_heading_and_prefix(
    check_tasks_completion, tmp_path: Path
) -> None:
    markdown = tmp_path / "tasks.md"
    markdown.write_text(
        "\n".join(
            [
                "# Phase 16 Delivery",
                "- [x] Finished release checklist",
                "- [ ] Review sign-off copy",
                "## Misc",
                "- [ ] 19.1 Publish release note",
            ]
        ),
        encoding="utf-8",
    )

    checked, pending, total_lines = check_tasks_completion.scan_markdown(markdown)

    assert checked == 1
    assert total_lines == 5
    assert [item.text for item in pending] == [
        "Review sign-off copy",
        "19.1 Publish release note",
    ]
    assert pending[0].phase_hint == "Phase 16"
    assert pending[0].phase_order == 16
    assert pending[1].phase_hint == "Phase 19"
    assert pending[1].phase_order == 19


def test_build_payload_reports_ratio_and_preview(check_tasks_completion, tmp_path: Path) -> None:
    pending = [
      check_tasks_completion.PendingItem(line=4, text="Queued A", phase_hint="Phase 16", phase_order=16),
      check_tasks_completion.PendingItem(line=9, text="Queued B", phase_hint="", phase_order=None),
    ]

    payload = check_tasks_completion.build_payload(tmp_path / "tasks.md", 3, pending, 40, 1)

    assert payload["total_tasks"] == 5
    assert payload["total_checked"] == 3
    assert payload["total_unchecked"] == 2
    assert payload["completion_ratio"] == 60.0
    assert payload["pending_preview"] == [{"line": 4, "text": "Queued A"}]


def test_path_and_queue_helpers_build_stable_identifiers(check_tasks_completion, tmp_path: Path) -> None:
    inside = PROJECT_ROOT / "docs" / "TASKS.md"
    outside = tmp_path / "external.md"

    assert check_tasks_completion.to_project_relative(inside) == "docs/TASKS.md"
    assert check_tasks_completion.to_project_relative(outside) == outside.resolve().as_posix()
    assert (
        check_tasks_completion.build_queue_item_id("docs/TASKS V10.md", 23)
        == "queue-docs-tasks-v10-md-l0023"
    )
    assert check_tasks_completion.phase_to_priority(None) == "P3"
    assert check_tasks_completion.phase_to_priority(16) == "P1"
    assert check_tasks_completion.phase_to_priority(18) == "P2"
    assert check_tasks_completion.phase_to_priority(19) == "P3"


def test_build_queue_payload_sorts_pending_items(check_tasks_completion, tmp_path: Path) -> None:
    file_path = PROJECT_ROOT / "docs" / "TASKS.md"
    pending = [
        check_tasks_completion.PendingItem(line=12, text="Later", phase_hint="Phase 19", phase_order=19),
        check_tasks_completion.PendingItem(line=7, text="Sooner", phase_hint="Phase 16", phase_order=16),
        check_tasks_completion.PendingItem(line=20, text="Unknown", phase_hint="", phase_order=None),
    ]

    payload = check_tasks_completion.build_queue_payload(file_path, pending)

    assert payload["source_file"] == "docs/TASKS.md"
    assert payload["total_items"] == 3
    assert [item["title"] for item in payload["items"]] == ["Sooner", "Later", "Unknown"]
    assert payload["items"][0]["priority"] == "P1"
    assert payload["items"][1]["priority"] == "P3"
    assert payload["items"][2]["priority"] == "P3"


def test_main_handles_missing_file(check_tasks_completion, monkeypatch, capsys) -> None:
    monkeypatch.setattr(
        check_tasks_completion,
        "parse_args",
        lambda: SimpleNamespace(
            file="missing.md",
            strict=False,
            preview_limit=10,
            output_json="",
            export_queue="",
        ),
    )

    assert check_tasks_completion.main() == 2
    assert "[FAIL] target file not found" in capsys.readouterr().out


def test_main_writes_json_and_queue_and_respects_strict_mode(
    check_tasks_completion, tmp_path: Path, monkeypatch, capsys
) -> None:
    tasks_file = tmp_path / "tasks.md"
    tasks_file.write_text(
        "\n".join(
            [
                "# Phase 16 Delivery",
                "- [x] Finished item",
                "- [ ] Remaining item",
            ]
        ),
        encoding="utf-8",
    )
    output_json = tmp_path / "artifacts" / "summary.json"
    export_queue = tmp_path / "artifacts" / "queue.json"

    monkeypatch.setattr(check_tasks_completion, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(
        check_tasks_completion,
        "parse_args",
        lambda: SimpleNamespace(
            file=str(tasks_file),
            strict=True,
            preview_limit=5,
            output_json=str(output_json),
            export_queue=str(export_queue),
        ),
    )

    assert check_tasks_completion.main() == 1

    payload = json.loads(output_json.read_text(encoding="utf-8"))
    queue_payload = json.loads(export_queue.read_text(encoding="utf-8"))

    assert payload["total_checked"] == 1
    assert payload["total_unchecked"] == 1
    assert queue_payload["total_items"] == 1
    assert queue_payload["items"][0]["title"] == "Remaining item"

    output = capsys.readouterr().out
    assert "tasks completion: checked=1 unchecked=1 ratio=50.0%" in output
    assert "queue exported:" in output
    assert "strict mode: pending tasks detected" in output


def test_parse_args_reads_optional_flags(check_tasks_completion, monkeypatch) -> None:
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "check_tasks_completion.py",
            "--file",
            "docs/TASKS.md",
            "--strict",
            "--preview-limit",
            "3",
            "--output-json",
            "artifacts/summary.json",
            "--export-queue",
            "artifacts/queue.json",
        ],
    )

    args = check_tasks_completion.parse_args()

    assert args.file == "docs/TASKS.md"
    assert args.strict is True
    assert args.preview_limit == 3
    assert args.output_json == "artifacts/summary.json"
    assert args.export_queue == "artifacts/queue.json"


def test_main_resolves_relative_paths_and_returns_zero_without_pending_items(
    check_tasks_completion, tmp_path: Path, monkeypatch, capsys
) -> None:
    tasks_file = tmp_path / "tasks.md"
    tasks_file.write_text(
        "\n".join(
            [
                "# Phase 16 Delivery",
                "- [x] Finished item",
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(check_tasks_completion, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(
        check_tasks_completion,
        "parse_args",
        lambda: SimpleNamespace(
            file="tasks.md",
            strict=False,
            preview_limit=5,
            output_json="artifacts/summary.json",
            export_queue="artifacts/queue.json",
        ),
    )

    assert check_tasks_completion.main() == 0

    payload = json.loads((tmp_path / "artifacts" / "summary.json").read_text(encoding="utf-8"))
    queue_payload = json.loads((tmp_path / "artifacts" / "queue.json").read_text(encoding="utf-8"))

    assert payload["total_checked"] == 1
    assert payload["total_unchecked"] == 0
    assert queue_payload["total_items"] == 0
    assert "strict mode: pending tasks detected" not in capsys.readouterr().out


def test_script_main_entrypoint_raises_system_exit_with_main_result(tmp_path: Path, monkeypatch) -> None:
    tasks_file = tmp_path / "tasks.md"
    tasks_file.write_text("- [x] Done\n", encoding="utf-8")

    monkeypatch.setattr(
        sys,
        "argv",
        [
            "check_tasks_completion.py",
            "--file",
            str(tasks_file),
        ],
    )

    with pytest.raises(SystemExit) as excinfo:
        runpy.run_path(str(PROJECT_ROOT / "scripts" / "check_tasks_completion.py"), run_name="__main__")

    assert excinfo.value.code == 0
