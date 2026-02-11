"""
Premise Validator Tests

Tests for PremiseType, Premise, PremiseAlignment, PremiseValidationResult,
and PremiseValidator pure logic methods.
"""

import pytest
import asyncio
from src.narrative.premise_validator import (
    PremiseType,
    Premise,
    PremiseAlignment,
    PremiseValidationResult,
    PremiseValidator,
)


# ============================================================
# PremiseType Enum
# ============================================================

class TestPremiseType:

    def test_values(self):
        assert PremiseType.CHAIN_REACTION.value == "chain_reaction"
        assert PremiseType.REVERSAL.value == "reversal"
        assert PremiseType.SITUATIONAL.value == "situational"

    def test_count(self):
        assert len(PremiseType) == 3


# ============================================================
# Premise
# ============================================================

class TestPremise:

    def test_basic(self):
        p = Premise(
            character_trait="obsessive love",
            conflict="social pressure",
            conclusion="death",
            premise_type=PremiseType.REVERSAL,
            full_statement="Obsessive love leads to death"
        )
        assert p.character_trait == "obsessive love"
        assert p.premise_type == PremiseType.REVERSAL

    def test_from_statement(self):
        p = Premise.from_statement("Greed destroys everything")
        assert p.full_statement == "Greed destroys everything"
        assert p.premise_type == PremiseType.REVERSAL
        assert p.character_trait == ""
        assert p.conflict == ""
        assert p.conclusion == ""

    def test_from_statement_custom_type(self):
        p = Premise.from_statement("A chain of events", PremiseType.CHAIN_REACTION)
        assert p.premise_type == PremiseType.CHAIN_REACTION


# ============================================================
# PremiseAlignment
# ============================================================

class TestPremiseAlignment:

    def test_defaults(self):
        pa = PremiseAlignment(scene_id="s1", alignment_score=7.0,
                              contribution="advances conflict")
        assert pa.evidence == []
        assert pa.drift_detected is False
        assert pa.drift_description is None

    def test_with_drift(self):
        pa = PremiseAlignment(scene_id="s2", alignment_score=3.0,
                              contribution="minimal",
                              drift_detected=True,
                              drift_description="scene doesn't advance premise")
        assert pa.drift_detected is True


# ============================================================
# PremiseValidationResult
# ============================================================

class TestPremiseValidationResult:

    def test_empty_alignments(self):
        p = Premise.from_statement("test")
        r = PremiseValidationResult(premise=p, scene_alignments=[])
        assert r.overall_alignment == 0.0
        assert r.drift_count == 0

    def test_with_alignments(self):
        p = Premise.from_statement("test")
        alignments = [
            PremiseAlignment(scene_id="s1", alignment_score=8.0, contribution="c1"),
            PremiseAlignment(scene_id="s2", alignment_score=6.0, contribution="c2"),
        ]
        r = PremiseValidationResult(premise=p, scene_alignments=alignments)
        # (8+6)/2 * 10 = 70
        assert r.overall_alignment == 70.0
        assert r.drift_count == 0

    def test_with_drifts(self):
        p = Premise.from_statement("test")
        alignments = [
            PremiseAlignment(scene_id="s1", alignment_score=8.0, contribution="c1"),
            PremiseAlignment(scene_id="s2", alignment_score=3.0, contribution="c2",
                             drift_detected=True),
            PremiseAlignment(scene_id="s3", alignment_score=2.0, contribution="c3",
                             drift_detected=True),
        ]
        r = PremiseValidationResult(premise=p, scene_alignments=alignments)
        assert r.drift_count == 2


# ============================================================
# PremiseValidator
# ============================================================

class TestPremiseValidator:

    def test_init(self):
        v = PremiseValidator()
        assert v.llm is None
        assert v.current_premise is None
        assert v.scene_alignments == []

    # --- parse_premise (no LLM) ---

    def test_parse_premise_no_llm(self):
        v = PremiseValidator()
        p = asyncio.get_event_loop().run_until_complete(
            v.parse_premise("Greed destroys everything")
        )
        assert p.full_statement == "Greed destroys everything"
        # no-LLM path uses from_statement which doesn't set current_premise
        assert v.current_premise is None

    # --- validate_scene ---

    def test_validate_scene_no_premise(self):
        v = PremiseValidator()
        with pytest.raises(ValueError, match="parse_premise"):
            asyncio.get_event_loop().run_until_complete(
                v.validate_scene("s1", "content")
            )

    def test_validate_scene_no_llm(self):
        v = PremiseValidator()
        # Manually set current_premise since no-LLM parse doesn't set it
        v.current_premise = Premise.from_statement("test")
        alignment = asyncio.get_event_loop().run_until_complete(
            v.validate_scene("s1", "scene content")
        )
        assert alignment.scene_id == "s1"
        assert alignment.alignment_score == 7.0
        assert alignment.drift_detected is False
        # no-LLM path returns mock without appending to scene_alignments
        assert len(v.scene_alignments) == 0

    # --- track_premise_progress ---

    def test_track_progress_no_premise(self):
        v = PremiseValidator()
        with pytest.raises(ValueError, match="parse_premise"):
            asyncio.get_event_loop().run_until_complete(
                v.track_premise_progress("summary")
            )

    def test_track_progress_no_llm(self):
        v = PremiseValidator()
        v.current_premise = Premise.from_statement("test")
        result = asyncio.get_event_loop().run_until_complete(
            v.track_premise_progress("summary")
        )
        assert result["proof_progress"] == 50.0
        assert "remaining_elements" in result

    # --- detect_premise_drift ---

    def test_detect_drift_none(self):
        v = PremiseValidator()
        v.scene_alignments = [
            PremiseAlignment(scene_id="s1", alignment_score=8.0, contribution="c"),
        ]
        drifts = v.detect_premise_drift()
        assert len(drifts) == 0

    def test_detect_drift_found(self):
        v = PremiseValidator()
        v.scene_alignments = [
            PremiseAlignment(scene_id="s1", alignment_score=8.0, contribution="c"),
            PremiseAlignment(scene_id="s2", alignment_score=2.0, contribution="c",
                             drift_detected=True, drift_description="off track"),
        ]
        drifts = v.detect_premise_drift()
        assert len(drifts) == 1
        assert drifts[0].scene_id == "s2"

    # --- get_validation_result ---

    def test_get_validation_result_no_premise(self):
        v = PremiseValidator()
        with pytest.raises(ValueError, match="parse_premise"):
            v.get_validation_result()

    def test_get_validation_result_no_drifts(self):
        v = PremiseValidator()
        v.current_premise = Premise.from_statement("test")
        v.scene_alignments = [
            PremiseAlignment(scene_id="s1", alignment_score=8.0, contribution="good"),
        ]
        result = v.get_validation_result()
        assert result.overall_alignment == 80.0
        assert result.drift_count == 0
        assert len(result.critical_issues) == 0

    def test_get_validation_result_with_drifts(self):
        v = PremiseValidator()
        v.current_premise = Premise.from_statement("test")
        v.scene_alignments = [
            PremiseAlignment(scene_id="s1", alignment_score=8.0, contribution="ok"),
            PremiseAlignment(scene_id="s2", alignment_score=2.0, contribution="bad",
                             drift_detected=True, drift_description="went off"),
        ]
        result = v.get_validation_result()
        assert result.drift_count == 1
        assert len(result.critical_issues) == 1
        assert len(result.realignment_suggestions) == 1

    # --- suggest_realignment ---

    def test_suggest_realignment_not_found(self):
        v = PremiseValidator()
        suggestions = v.suggest_realignment("nonexistent")
        assert "未找到" in suggestions[0]

    def test_suggest_realignment_no_drift(self):
        v = PremiseValidator()
        v.scene_alignments = [
            PremiseAlignment(scene_id="s1", alignment_score=8.0, contribution="good"),
        ]
        suggestions = v.suggest_realignment("s1")
        assert "对齐良好" in suggestions[0]

    def test_suggest_realignment_with_drift(self):
        v = PremiseValidator()
        v.current_premise = Premise.from_statement("test premise")
        v.scene_alignments = [
            PremiseAlignment(scene_id="s1", alignment_score=3.0, contribution="low",
                             drift_detected=True, drift_description="drifted"),
        ]
        suggestions = v.suggest_realignment("s1")
        assert len(suggestions) >= 3

    # --- reset ---

    def test_reset(self):
        v = PremiseValidator()
        asyncio.get_event_loop().run_until_complete(v.parse_premise("test"))
        v.scene_alignments.append(
            PremiseAlignment(scene_id="s1", alignment_score=5.0, contribution="c")
        )
        v.reset()
        assert v.current_premise is None
        assert v.scene_alignments == []

    # --- mock_alignment ---

    def test_mock_alignment(self):
        v = PremiseValidator()
        a = v._mock_alignment("scene-x")
        assert a.scene_id == "scene-x"
        assert a.alignment_score == 7.0
        assert a.drift_detected is False
