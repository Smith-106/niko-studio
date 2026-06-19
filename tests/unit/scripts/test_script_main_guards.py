from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _exec_main_guard(
    relative_path: str,
    globals_dict: dict[str, object],
) -> None:
    script_path = PROJECT_ROOT / relative_path
    lines = script_path.read_text(encoding="utf-8").splitlines()
    start_line = next(
        index for index, line in enumerate(lines, start=1) if line.strip() == 'if __name__ == "__main__":'
    )
    guard_source = "\n" * (start_line - 1) + "\n".join(lines[start_line - 1 :]) + "\n"
    exec(compile(guard_source, str(script_path), "exec"), globals_dict)


@pytest.mark.parametrize(
    ("relative_path", "expected_code"),
    [
        ("scripts/check_authority_alignment.py", 17),
        ("scripts/delivery_gate.py", 19),
        ("scripts/finalize_release_state.py", 23),
        ("scripts/refresh_release_evidence.py", 29),
        ("scripts/run_local_pre_commit.py", 31),
    ],
)
def test_raise_system_exit_main_guards(relative_path: str, expected_code: int) -> None:
    calls: list[str] = []

    def fake_main() -> int:
        calls.append("main")
        return expected_code

    with pytest.raises(SystemExit) as excinfo:
        _exec_main_guard(relative_path, {"__name__": "__main__", "main": fake_main})

    assert excinfo.value.code == expected_code
    assert calls == ["main"]


@pytest.mark.parametrize(
    ("relative_path", "expected_code"),
    [
        ("scripts/check_i18n_keys.py", 5),
        ("scripts/check_versions.py", 7),
        ("scripts/run_targeted_pytest.py", 11),
    ],
)
def test_sys_exit_main_guards(relative_path: str, expected_code: int) -> None:
    calls: list[str] = []

    def fake_main() -> int:
        calls.append("main")
        return expected_code

    fake_sys = SimpleNamespace(exit=lambda code: (_ for _ in ()).throw(SystemExit(code)))

    with pytest.raises(SystemExit) as excinfo:
        _exec_main_guard(relative_path, {"__name__": "__main__", "main": fake_main, "sys": fake_sys})

    assert excinfo.value.code == expected_code
    assert calls == ["main"]


def test_plain_main_guard_invokes_main_without_exit() -> None:
    calls: list[str] = []

    def fake_main() -> None:
        calls.append("main")

    _exec_main_guard(
        "scripts/generate_signed_tauri_config.py",
        {"__name__": "__main__", "main": fake_main},
    )

    assert calls == ["main"]
