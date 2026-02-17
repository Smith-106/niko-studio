# -*- coding: utf-8 -*-
"""Tests for CharacterStateAnalyzer."""

from src.narrative.analyzers.base import AnalysisType, AnalysisResult
from src.narrative.analyzers.character_state_analyzer import CharacterStateAnalyzer


def test_properties(mock_llm_client):
    analyzer = CharacterStateAnalyzer(llm_client=mock_llm_client)
    assert analyzer.name == "CharacterStateAnalyzer"
    assert analyzer.analysis_type == AnalysisType.CHARACTER_STATE
    assert "角色" in analyzer.description


def test_quick_analyze_returns_structured_result(sample_good_content):
    analyzer = CharacterStateAnalyzer()
    result = analyzer.quick_analyze(sample_good_content)

    assert isinstance(result, AnalysisResult)
    assert result.analysis_type == AnalysisType.CHARACTER_STATE
    assert result.metadata["segment_count"] >= 1
    assert "average_agency" in result.metadata


def test_quick_analyze_extracts_states(sample_good_content):
    analyzer = CharacterStateAnalyzer()
    result = analyzer.quick_analyze(sample_good_content)

    assert result.count > 0
    first = result.items[0]
    assert first.position >= 0
    assert 0.0 <= first.agency_score <= 1.0


def test_dominant_emotions(sample_good_content):
    analyzer = CharacterStateAnalyzer()
    emotions = analyzer.get_dominant_emotions(sample_good_content)

    assert isinstance(emotions, list)
    assert all(e in {"positive", "negative", "neutral"} for e in emotions)
