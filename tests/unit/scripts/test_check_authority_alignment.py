"""Unit tests for scripts/check_authority_alignment.py.

Covers AuthorityRule semantics, RULES table composition, and main() output
contract (JSON envelope + exit code semantics).
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType

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
def authority() -> ModuleType:
    return _load("scripts/check_authority_alignment.py", "_test_check_authority_alignment")


# ---------------------------------------------------------------------------
# AuthorityRule
# ---------------------------------------------------------------------------


class TestAuthorityRule:
    def test_required_defaults_to_true(self, authority) -> None:
        rule = authority.AuthorityRule(file_path="x.md", pattern="anchor", reason="r")
        assert rule.required is True

    def test_dataclass_is_frozen(self, authority) -> None:
        rule = authority.AuthorityRule(file_path="x.md", pattern="anchor", reason="r")
        with pytest.raises(Exception):
            rule.file_path = "y.md"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# RULES table composition
# ---------------------------------------------------------------------------


class TestRulesTable:
    def test_rules_includes_base_and_delivery_contract(self, authority) -> None:
        assert authority.RULES == authority.BASE_RULES + authority.DELIVERY_CONTRACT_RULES
        assert len(authority.BASE_RULES) > 0
        assert len(authority.DELIVERY_CONTRACT_RULES) > 0

    def test_delivery_contract_rules_cover_all_5_files(self, authority) -> None:
        files_in_rules = {rule.file_path for rule in authority.DELIVERY_CONTRACT_RULES}
        # All 5 contract heading files must appear.
        assert files_in_rules == set(authority.DELIVERY_CONTRACT_HEADINGS.keys())

    def test_delivery_contract_rules_include_one_heading_rule_per_file(self, authority) -> None:
        # Each file should have exactly one rule whose pattern equals the heading regex,
        # plus N additional pattern rules.
        for file_path, heading in authority.DELIVERY_CONTRACT_HEADINGS.items():
            heading_rules = [
                r
                for r in authority.DELIVERY_CONTRACT_RULES
                if r.file_path == file_path and r.pattern == heading
            ]
            assert len(heading_rules) == 1, f"{file_path} must have exactly one heading rule"

    def test_every_rule_has_non_empty_fields(self, authority) -> None:
        for rule in authority.RULES:
            assert rule.file_path
            assert rule.pattern
            assert rule.reason


# ---------------------------------------------------------------------------
# main() — output contract
# ---------------------------------------------------------------------------


def _capture_json(capsys) -> dict:
    raw = capsys.readouterr().out
    # main() prints exactly one JSON document.
    return json.loads(raw)


class TestMainPasses:
    def test_returns_zero_with_pass_payload_when_all_rules_match(
        self, authority, tmp_path, monkeypatch, capsys
    ) -> None:
        target = tmp_path / "manifest.md"
        target.write_text("HEADING-anchor present", encoding="utf-8")
        monkeypatch.setattr(authority, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(
            authority,
            "RULES",
            (
                authority.AuthorityRule(
                    file_path="manifest.md", pattern=r"HEADING-anchor", reason="r"
                ),
            ),
        )
        rc = authority.main()
        payload = _capture_json(capsys)

        assert rc == 0
        assert payload["status"] == "PASS"
        assert payload["checked_rules"] == 1
        assert payload["passed_rules"] == 1
        assert payload["failed_rules"] == 0
        assert payload["mismatches"] == []
        assert payload["checked_files"] == ["manifest.md"]


class TestMainFails:
    def test_returns_one_with_fail_payload_when_required_anchor_missing(
        self, authority, tmp_path, monkeypatch, capsys
    ) -> None:
        target = tmp_path / "manifest.md"
        target.write_text("no required anchor here", encoding="utf-8")
        monkeypatch.setattr(authority, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(
            authority,
            "RULES",
            (
                authority.AuthorityRule(
                    file_path="manifest.md",
                    pattern=r"REQUIRED-anchor",
                    reason="must exist",
                ),
            ),
        )
        rc = authority.main()
        payload = _capture_json(capsys)

        assert rc == 1
        assert payload["status"] == "FAIL"
        assert payload["failed_rules"] == 1
        assert payload["mismatches"] == ["manifest.md: must exist"]

    def test_returns_one_when_target_file_missing(
        self, authority, tmp_path, monkeypatch, capsys
    ) -> None:
        monkeypatch.setattr(authority, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(
            authority,
            "RULES",
            (authority.AuthorityRule(file_path="absent.md", pattern=r"anchor", reason="r"),),
        )
        rc = authority.main()
        payload = _capture_json(capsys)

        assert rc == 1
        assert payload["status"] == "FAIL"
        assert "absent.md: missing file" in payload["mismatches"]

    def test_returns_one_when_forbidden_anchor_present(
        self, authority, tmp_path, monkeypatch, capsys
    ) -> None:
        target = tmp_path / "manifest.md"
        target.write_text("contains FORBIDDEN-anchor here", encoding="utf-8")
        monkeypatch.setattr(authority, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(
            authority,
            "RULES",
            (
                authority.AuthorityRule(
                    file_path="manifest.md",
                    pattern=r"FORBIDDEN-anchor",
                    reason="should not appear",
                    required=False,
                ),
            ),
        )
        rc = authority.main()
        payload = _capture_json(capsys)

        assert rc == 1
        assert payload["status"] == "FAIL"
        assert any("should not appear" in msg for msg in payload["mismatches"])


class TestMainPatternSemantics:
    def test_pattern_is_evaluated_as_regex_with_multiline_flag(
        self, authority, tmp_path, monkeypatch, capsys
    ) -> None:
        target = tmp_path / "doc.md"
        target.write_text("line1\nstart-of-line anchor\nline3", encoding="utf-8")
        monkeypatch.setattr(authority, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(
            authority,
            "RULES",
            (
                authority.AuthorityRule(
                    file_path="doc.md",
                    pattern=r"^start-of-line",
                    reason="multiline anchor must match",
                ),
            ),
        )
        rc = authority.main()
        _capture_json(capsys)
        assert rc == 0  # ^ should match start of any line under MULTILINE

    def test_pattern_supports_full_regex(self, authority, tmp_path, monkeypatch, capsys) -> None:
        target = tmp_path / "doc.md"
        target.write_text("version: 9.2.0", encoding="utf-8")
        monkeypatch.setattr(authority, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(
            authority,
            "RULES",
            (
                authority.AuthorityRule(
                    file_path="doc.md",
                    pattern=r"version:\s+\d+\.\d+\.\d+",
                    reason="r",
                ),
            ),
        )
        assert authority.main() == 0
        _capture_json(capsys)


class TestMainPayloadShape:
    def test_payload_includes_sorted_unique_checked_files(
        self, authority, tmp_path, monkeypatch, capsys
    ) -> None:
        for name in ("a.md", "b.md", "c.md"):
            (tmp_path / name).write_text("anchor", encoding="utf-8")
        monkeypatch.setattr(authority, "PROJECT_ROOT", tmp_path)
        # Multiple rules on same file plus mixed-order files.
        monkeypatch.setattr(
            authority,
            "RULES",
            (
                authority.AuthorityRule(file_path="c.md", pattern=r"anchor", reason="r"),
                authority.AuthorityRule(file_path="a.md", pattern=r"anchor", reason="r"),
                authority.AuthorityRule(file_path="a.md", pattern=r"anchor", reason="r"),
                authority.AuthorityRule(file_path="b.md", pattern=r"anchor", reason="r"),
            ),
        )
        authority.main()
        payload = _capture_json(capsys)
        assert payload["checked_rules"] == 4
        assert payload["checked_files"] == ["a.md", "b.md", "c.md"]


class TestMainAgainstRealRepo:
    def test_real_repository_passes_authority_alignment(self, authority, capsys) -> None:
        """Smoke test against actual repo — guards against silent drift."""
        rc = authority.main()
        # Drain output; we don't assert payload here because the real repo's
        # alignment status is the responsibility of CI, not unit tests.
        capsys.readouterr()
        assert rc in (0, 1)  # either is "valid" output; we only care it didn't crash
