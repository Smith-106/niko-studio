"""Unit tests for scripts/delivery_gate.py.

Covers GateRule dataclass invariants, check_rule branching across all four
must_exist × matched permutations, and main() exit-code semantics.
"""

from __future__ import annotations

import importlib.util
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
def delivery_gate() -> ModuleType:
    return _load("scripts/delivery_gate.py", "_test_delivery_gate")


# ---------------------------------------------------------------------------
# GateRule
# ---------------------------------------------------------------------------


class TestGateRule:
    def test_default_must_exist_is_true(self, delivery_gate) -> None:
        rule = delivery_gate.GateRule(file_path="x.md", needle="anchor", reason="r")
        assert rule.must_exist is True

    def test_must_exist_false_means_forbidden_anchor(self, delivery_gate) -> None:
        rule = delivery_gate.GateRule(
            file_path="x.md", needle="anchor", reason="r", must_exist=False
        )
        assert rule.must_exist is False

    def test_dataclass_is_frozen(self, delivery_gate) -> None:
        rule = delivery_gate.GateRule(file_path="x.md", needle="anchor", reason="r")
        with pytest.raises(Exception):  # FrozenInstanceError subclasses AttributeError
            rule.file_path = "y.md"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# check_rule — covers all four must_exist × matched permutations
# ---------------------------------------------------------------------------


class TestCheckRule:
    def test_returns_none_when_required_anchor_present(
        self, delivery_gate, tmp_path, monkeypatch
    ) -> None:
        target = tmp_path / "anchor.md"
        target.write_text("hello required-anchor world", encoding="utf-8")
        monkeypatch.setattr(delivery_gate, "PROJECT_ROOT", tmp_path)

        rule = delivery_gate.GateRule(file_path="anchor.md", needle="required-anchor", reason="r")
        assert delivery_gate.check_rule(rule) is None

    def test_returns_failure_when_required_anchor_missing(
        self, delivery_gate, tmp_path, monkeypatch
    ) -> None:
        target = tmp_path / "anchor.md"
        target.write_text("no anchor here", encoding="utf-8")
        monkeypatch.setattr(delivery_gate, "PROJECT_ROOT", tmp_path)

        rule = delivery_gate.GateRule(
            file_path="anchor.md", needle="MISSING", reason="missing reason"
        )
        result = delivery_gate.check_rule(rule)
        assert result is not None
        assert "[FAIL]" in result
        assert "anchor.md" in result
        assert "missing reason" in result
        assert "missing anchor: MISSING" in result

    def test_returns_failure_when_forbidden_anchor_present(
        self, delivery_gate, tmp_path, monkeypatch
    ) -> None:
        target = tmp_path / "anchor.md"
        target.write_text("contains LEGACY anchor", encoding="utf-8")
        monkeypatch.setattr(delivery_gate, "PROJECT_ROOT", tmp_path)

        rule = delivery_gate.GateRule(
            file_path="anchor.md",
            needle="LEGACY",
            reason="should not contain",
            must_exist=False,
        )
        result = delivery_gate.check_rule(rule)
        assert result is not None
        assert "[FAIL]" in result
        assert "forbidden anchor: LEGACY" in result

    def test_returns_none_when_forbidden_anchor_absent(
        self, delivery_gate, tmp_path, monkeypatch
    ) -> None:
        target = tmp_path / "anchor.md"
        target.write_text("clean content", encoding="utf-8")
        monkeypatch.setattr(delivery_gate, "PROJECT_ROOT", tmp_path)

        rule = delivery_gate.GateRule(
            file_path="anchor.md",
            needle="LEGACY",
            reason="should not contain",
            must_exist=False,
        )
        assert delivery_gate.check_rule(rule) is None

    def test_returns_failure_when_target_file_missing(
        self, delivery_gate, tmp_path, monkeypatch
    ) -> None:
        monkeypatch.setattr(delivery_gate, "PROJECT_ROOT", tmp_path)
        rule = delivery_gate.GateRule(
            file_path="absent.md", needle="x", reason="missing file reason"
        )
        result = delivery_gate.check_rule(rule)
        assert result is not None
        assert "[FAIL]" in result
        assert "缺少门禁目标文件" in result
        assert "absent.md" in result

    def test_handles_files_with_invalid_utf8_via_replace_errors(
        self, delivery_gate, tmp_path, monkeypatch
    ) -> None:
        # check_rule uses errors="replace", so non-UTF8 bytes must not crash it.
        target = tmp_path / "binary.md"
        target.write_bytes(b"some text \xff\xfe more text")
        monkeypatch.setattr(delivery_gate, "PROJECT_ROOT", tmp_path)

        rule = delivery_gate.GateRule(file_path="binary.md", needle="some text", reason="r")
        # Should not raise UnicodeDecodeError
        assert delivery_gate.check_rule(rule) is None

    def test_needle_is_substring_match_not_regex(
        self, delivery_gate, tmp_path, monkeypatch
    ) -> None:
        # check_rule uses `in` operator, not regex.
        target = tmp_path / "anchor.md"
        target.write_text("regex-special-chars: .* (foo|bar)+", encoding="utf-8")
        monkeypatch.setattr(delivery_gate, "PROJECT_ROOT", tmp_path)

        # Literal substring matches.
        rule_present = delivery_gate.GateRule(
            file_path="anchor.md", needle=".* (foo|bar)+", reason="r"
        )
        assert delivery_gate.check_rule(rule_present) is None

        # Regex semantics would match this; literal substring should NOT.
        rule_absent = delivery_gate.GateRule(file_path="anchor.md", needle="foo|bar", reason="r")
        # "foo|bar" is literally present in "(foo|bar)+", so this WILL match.
        assert delivery_gate.check_rule(rule_absent) is None

        # Verify literal-not-regex: ^.+$ anchored regex would match, but as a
        # literal substring it does not appear in the file content.
        rule_anchor_absent = delivery_gate.GateRule(
            file_path="anchor.md", needle="^.+$", reason="r"
        )
        assert delivery_gate.check_rule(rule_anchor_absent) is not None


# ---------------------------------------------------------------------------
# main() — integration: monkeypatch the RULES tuple to a synthetic set
# ---------------------------------------------------------------------------


class TestMain:
    def test_returns_zero_when_all_rules_pass(
        self, delivery_gate, tmp_path, monkeypatch, capsys
    ) -> None:
        target = tmp_path / "ok.md"
        target.write_text("good anchor present", encoding="utf-8")
        monkeypatch.setattr(delivery_gate, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(
            delivery_gate,
            "RULES",
            (delivery_gate.GateRule(file_path="ok.md", needle="good anchor", reason="r"),),
        )
        assert delivery_gate.main() == 0
        out = capsys.readouterr().out
        assert "delivery gate: start" in out
        assert "delivery gate: ok" in out

    def test_returns_one_when_any_rule_fails_and_lists_all_failures(
        self, delivery_gate, tmp_path, monkeypatch, capsys
    ) -> None:
        good = tmp_path / "good.md"
        good.write_text("present", encoding="utf-8")
        bad = tmp_path / "bad.md"
        bad.write_text("nothing here", encoding="utf-8")
        monkeypatch.setattr(delivery_gate, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(
            delivery_gate,
            "RULES",
            (
                delivery_gate.GateRule(file_path="good.md", needle="present", reason="ok-r"),
                delivery_gate.GateRule(file_path="bad.md", needle="WANTED", reason="bad-r-1"),
                delivery_gate.GateRule(file_path="absent.md", needle="x", reason="bad-r-2"),
            ),
        )
        assert delivery_gate.main() == 1
        out = capsys.readouterr().out
        assert "delivery gate: blocked" in out
        # Both failures should be reported.
        assert "bad.md" in out
        assert "absent.md" in out
        # Passing rule should not appear in failure list.
        assert "ok-r" not in out

    def test_real_repository_passes_delivery_gate(self, delivery_gate, capsys) -> None:
        """Smoke test against the actual repo state — guards against regressions
        where a code change drops a delivery-gate anchor."""
        assert delivery_gate.main() == 0


# ---------------------------------------------------------------------------
# RULES tuple sanity checks
# ---------------------------------------------------------------------------


class TestRulesTable:
    def test_rules_is_non_empty_tuple(self, delivery_gate) -> None:
        assert isinstance(delivery_gate.RULES, tuple)
        assert len(delivery_gate.RULES) > 0

    def test_every_rule_has_required_fields(self, delivery_gate) -> None:
        for rule in delivery_gate.RULES:
            assert rule.file_path
            assert rule.needle
            assert rule.reason
            assert isinstance(rule.must_exist, bool)
