# -*- coding: utf-8 -*-
"""`src.narrative.style_system` 覆盖测试。"""

import json

import pytest

from src.narrative.style_system import (
    DriftEvent,
    StyleAnalyzer,
    StyleDriftDetector,
    StyleMatchResult,
    StyleMatcher,
    StyleProfile,
    StyleVector,
)


def test_style_vector_array_roundtrip_and_length_guard():
    vector = StyleVector(vocabulary_richness=0.9, avg_word_length=0.4)
    arr = vector.to_array()

    assert len(arr) == 30
    cloned = StyleVector.from_array(arr)
    assert cloned.vocabulary_richness == pytest.approx(0.9)
    assert cloned.avg_word_length == pytest.approx(0.4)

    with pytest.raises(ValueError):
        StyleVector.from_array([0.1] * 29)


def test_style_vector_dict_roundtrip_distance_and_cosine():
    a = StyleVector(vocabulary_richness=0.2, avg_word_length=0.3)
    b = StyleVector(vocabulary_richness=0.6, avg_word_length=0.8)

    d = a.distance(b)
    assert d > 0
    assert a.cosine_similarity(b) <= 1.0

    rebuilt = StyleVector.from_dict(a.to_dict())
    assert rebuilt.vocabulary_richness == pytest.approx(a.vocabulary_richness)

    zero = StyleVector.from_array([0.0] * 30)
    assert zero.cosine_similarity(a) == 0.0


def test_style_profile_and_drift_event_to_dict():
    profile = StyleProfile(name="demo", vector=StyleVector(), sample_count=2, description="d", tags=["t"])
    data = profile.to_dict()
    rebuilt = StyleProfile.from_dict(data)

    assert rebuilt.name == "demo"
    assert rebuilt.sample_count == 2

    event = DriftEvent(
        position=10,
        segment_index=1,
        drift_magnitude=0.3,
        drifted_dimensions=["vocabulary_richness"],
        before_vector=StyleVector(),
        after_vector=StyleVector(vocabulary_richness=0.8),
        severity="moderate",
    )
    assert event.to_dict()["severity"] == "moderate"


def test_style_match_result_levels():
    assert StyleMatchResult("x", 0.95, 0.1, {}).match_level == "excellent"
    assert StyleMatchResult("x", 0.80, 0.2, {}).match_level == "good"
    assert StyleMatchResult("x", 0.65, 0.3, {}).match_level == "fair"
    assert StyleMatchResult("x", 0.45, 0.4, {}).match_level == "weak"
    assert StyleMatchResult("x", 0.20, 0.5, {}).match_level == "poor"


def test_style_analyzer_basic_paths_and_empty_text():
    analyzer = StyleAnalyzer()

    empty = analyzer.analyze("   ")
    assert isinstance(empty, StyleVector)

    text = "我喜欢这座城。你呢？\n\n风像刀，夜像海。"
    vector = analyzer.analyze(text)

    assert 0.0 <= vector.vocabulary_richness <= 1.0
    assert 0.0 <= vector.avg_sentence_length <= 1.0
    assert 0.0 <= vector.metaphor_density <= 1.0


def test_style_analyzer_parallel_detection():
    analyzer = StyleAnalyzer()

    assert analyzer._is_parallel(["春风吹", "夏雨落", "秋叶舞"])
    assert not analyzer._is_parallel(["短", "这是一个很长很长的句子", "中等"])


class _Resp:
    def __init__(self, content: str):
        self.content = content


class _LLMOK:
    async def ainvoke(self, _prompt):
        payload = {
            "rhetorical": {
                "metaphor_density": 0.9,
                "hyperbole_level": 0.7,
                "personification": 0.6,
            },
            "narrative": {
                "showing_vs_telling": 0.8,
                "description_density": 0.75,
            },
        }
        return _Resp(json.dumps(payload, ensure_ascii=False))


class _LLMFail:
    async def ainvoke(self, _prompt):
        raise RuntimeError("boom")


@pytest.mark.asyncio
async def test_style_analyzer_analyze_with_llm_success_and_fallback():
    text = "他说，风在低语。"

    ok = StyleAnalyzer(llm=_LLMOK())
    vec_ok = await ok.analyze_with_llm(text)
    assert vec_ok.metaphor_density == pytest.approx(0.9)
    assert vec_ok.showing_vs_telling == pytest.approx(0.8)

    fail = StyleAnalyzer(llm=_LLMFail())
    vec_fail = await fail.analyze_with_llm(text)
    assert isinstance(vec_fail, StyleVector)


class _SeqAnalyzer:
    def __init__(self, vectors):
        self.vectors = vectors
        self.i = 0

    def analyze(self, _text):
        idx = min(self.i, len(self.vectors) - 1)
        self.i += 1
        return self.vectors[idx]



def test_style_drift_detector_detect_and_stability_score():
    vectors = [
        StyleVector(vocabulary_richness=0.1),
        StyleVector(vocabulary_richness=0.2),
        StyleVector(vocabulary_richness=0.8),
    ]
    detector = StyleDriftDetector(window_size=10, stride=10, threshold=0.05, analyzer=_SeqAnalyzer(vectors))

    events = detector.detect("a" * 60)
    assert len(events) >= 1
    assert events[0].severity in {"minor", "moderate", "severe"}

    score = detector.get_stability_score("a" * 60)
    assert 0.0 <= score <= 1.0



def test_style_drift_detector_short_text_and_reference_mode():
    detector = StyleDriftDetector(window_size=20, stride=10, threshold=0.01, analyzer=_SeqAnalyzer([StyleVector()]))
    assert detector.detect("short") == []

    ref_detector = StyleDriftDetector(
        window_size=10,
        stride=5,
        threshold=0.01,
        analyzer=_SeqAnalyzer([StyleVector(vocabulary_richness=0.9)] * 20),
    )
    events = ref_detector.detect_against_reference("x" * 100, StyleVector(vocabulary_richness=0.1))
    assert len(events) >= 1



def test_style_matcher_learn_match_and_profile_management():
    matcher = StyleMatcher(analyzer=StyleAnalyzer())

    with pytest.raises(ValueError):
        matcher.learn("empty", [])

    profile = matcher.learn("author_a", ["我喜欢海。", "风像刀。"], description="test", tags=["a"])
    assert profile.name == "author_a"
    assert "author_a" in matcher.list_profiles()
    assert matcher.get_profile("author_a") is not None

    result = matcher.match("我看见海。", "author_a")
    assert 0.0 <= result.similarity <= 1.0
    assert isinstance(result.suggestions, list)

    with pytest.raises(ValueError):
        matcher.match("x", "unknown")



def test_style_matcher_find_closest_and_import_export():
    matcher = StyleMatcher(analyzer=StyleAnalyzer())
    assert matcher.find_closest_style("abc") == ("", 0.0)

    matcher.learn("a", ["我走向远方。"])
    matcher.learn("b", ["你好吗？"])

    name, sim = matcher.find_closest_style("我向前走。")
    assert name in {"a", "b"}
    assert -1.0 <= sim <= 1.0

    exported = matcher.export_profiles()
    assert "a" in exported

    broken = {"ok": exported["a"], "bad": {"vector": {}}}
    imported_count = matcher.import_profiles(broken)
    assert imported_count >= 1


@pytest.mark.asyncio
async def test_style_matcher_generate_style_guide_paths():
    matcher = StyleMatcher(analyzer=StyleAnalyzer())
    matcher.learn("guide", ["我看见光。"], description="desc")

    with pytest.raises(ValueError):
        await matcher.generate_style_guide("missing")

    basic = await matcher.generate_style_guide("guide")
    assert "# guide 风格指南" in basic

    class _GuideLLM:
        async def ainvoke(self, _prompt):
            return _Resp("LLM guide")

    class _GuideFailLLM:
        async def ainvoke(self, _prompt):
            raise RuntimeError("x")

    llm_matcher = StyleMatcher(analyzer=StyleAnalyzer(), llm=_GuideLLM())
    llm_matcher.learn("x", ["文本"])
    assert await llm_matcher.generate_style_guide("x") == "LLM guide"

    fallback_matcher = StyleMatcher(analyzer=StyleAnalyzer(), llm=_GuideFailLLM())
    fallback_matcher.learn("y", ["文本"])
    fallback = await fallback_matcher.generate_style_guide("y")
    assert "# y 风格指南" in fallback
