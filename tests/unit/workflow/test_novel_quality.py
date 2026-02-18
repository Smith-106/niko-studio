"""Tests for novel quality heuristic evaluator."""

from src.workflow.novel_quality import evaluate_novel_quality, _compute_metrics, _recommendation


def test_evaluate_novel_quality_returns_complete_contract():
    content = (
        '"Don\'t move," he said. '
        "Rain hit the window, and cold light cut across her face. "
        "Because the lock was broken, she chose the darker stairwell. "
        "The threat was simple: one wrong step and the deal would collapse."
    )

    result = evaluate_novel_quality(content)

    assert set(result.keys()) == {
        "analysis_schema_version",
        "quality_score",
        "issues",
        "metrics",
        "publish_recommendation",
    }
    assert isinstance(result["quality_score"], float)
    assert isinstance(result["issues"], list)
    assert isinstance(result["metrics"], dict)
    assert result["publish_recommendation"] in {"pass", "revise", "block"}

    metric_keys = {
        "dialogue_ratio",
        "conflict_points",
        "visual_details",
        "template_sentence_ratio",
        "dimension_scores",
    }
    assert set(result["metrics"].keys()) == metric_keys



def test_evaluate_novel_quality_metric_boundaries():
    result = evaluate_novel_quality(
        "He saw the light in the rain. Because she resisted, the conflict escalated quickly."
    )

    assert 0.0 <= result["quality_score"] <= 100.0

    metrics = result["metrics"]
    assert 0.0 <= metrics["dialogue_ratio"] <= 1.0
    assert metrics["conflict_points"] >= 0
    assert metrics["visual_details"] >= 0
    assert 0.0 <= metrics["template_sentence_ratio"] <= 1.0

    dimension_scores = metrics["dimension_scores"]
    assert set(dimension_scores.keys()) == {
        "repetition",
        "tone",
        "clarity",
        "causality",
        "detail",
        "factuality",
    }
    for value in dimension_scores.values():
        assert 0.0 <= value <= 100.0



def test_evaluate_novel_quality_recommendation_pass():
    content = (
        '"Open the door," she whispered. '
        "Moonlight spilled across the wet street and painted sharp shadows under the arch. "
        "Because he betrayed the pact, the argument turned into open conflict. "
        "Therefore she crossed the square, eyes fixed on the only lit window."
    )

    result = evaluate_novel_quality(content)
    assert result["publish_recommendation"] == "pass"



def test_evaluate_novel_quality_recommendation_revise():
    content = (
        "Then he walked into the street. "
        "Then he looked at the door. "
        "Then he touched the handle. "
        "Then he waited in silence. "
        "The light in the corridor still felt cold."
    )

    result = evaluate_novel_quality(content)
    assert result["publish_recommendation"] == "revise"





def test_evaluate_novel_quality_empty_content_returns_block_contract():
    result = evaluate_novel_quality("   ")

    assert result["quality_score"] == 0.0
    assert result["publish_recommendation"] == "block"
    assert set(result.keys()) == {
        "analysis_schema_version",
        "quality_score",
        "issues",
        "metrics",
        "publish_recommendation",
    }

    assert isinstance(result["issues"], list)
    assert result["issues"]
    issue = result["issues"][0]
    assert set(issue.keys()) == {"severity", "type", "evidence", "suggestion"}




def test_compute_metrics_fallback_when_no_sentences_after_split():
    metrics = _compute_metrics("...")
    assert metrics["sentences"] == ["..."]


def test_recommendation_block_by_quality_or_high_issues_branch():
    metrics = {
        "template_sentence_ratio": 0.1,
    }
    issues = [{"severity": "high"}, {"severity": "high"}]
    assert _recommendation(metrics, 90.0, issues) == "block"
    assert _recommendation(metrics, 49.0, []) == "block"


def test_evaluate_novel_quality_repetition_degrades_to_block_in_extreme_case():
    content = " ".join(["Then he walked forward."] * 24)

    result = evaluate_novel_quality(content)

    assert result["metrics"]["template_sentence_ratio"] >= 0.8
    assert result["publish_recommendation"] == "block"
