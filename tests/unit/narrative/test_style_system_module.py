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

@pytest.mark.asyncio
async def test_style_analyzer_analyze_with_llm_none_returns_base_vector():
    analyzer = StyleAnalyzer()
    vec = await analyzer.analyze_with_llm("简单文本")
    assert isinstance(vec, StyleVector)


def test_style_analyzer_private_branches_tokenize_and_empty_defaults():
    analyzer = StyleAnalyzer()

    tokens = analyzer._tokenize("abc 中 文 def")
    assert tokens == ["abc", "中", "文", "def"]

    assert analyzer._analyze_lexical("", []) == {
        "vocabulary_richness": 0.5,
        "avg_word_length": 0.5,
        "rare_word_ratio": 0.3,
        "technical_density": 0.2,
        "colloquial_ratio": 0.3,
    }
    assert analyzer._analyze_syntactic("", []) == {
        "avg_sentence_length": 0.5,
        "sentence_complexity": 0.5,
        "clause_ratio": 0.3,
        "passive_ratio": 0.2,
        "interrogative_ratio": 0.1,
    }
    assert analyzer._analyze_rhetorical("", []) == {
        "metaphor_density": 0.3,
        "parallelism_freq": 0.2,
        "rhetorical_question": 0.1,
        "hyperbole_level": 0.2,
        "personification": 0.2,
    }
    assert analyzer._analyze_rhythmic("", [], []) == {
        "avg_paragraph_length": 0.5,
        "punctuation_rhythm": 0.5,
        "pause_pattern": 0.5,
        "sentence_variation": 0.5,
        "dialogue_pacing": 0.5,
    }
    assert analyzer._analyze_tone("", []) == {
        "formality_level": 0.5,
        "emotional_valence": 0.5,
        "subjectivity": 0.5,
        "certainty_level": 0.5,
        "intimacy_level": 0.5,
    }
    assert analyzer._analyze_narrative("", []) == {
        "pov_consistency": 0.8,
        "tense_distribution": 0.5,
        "dialogue_ratio": 0.3,
        "description_density": 0.5,
        "showing_vs_telling": 0.5,
    }


def test_style_analyzer_parallel_short_circuit_len_lt_three():
    analyzer = StyleAnalyzer()
    assert analyzer._is_parallel(["一句", "二句"]) is False


class _ModerateAnalyzer:
    def __init__(self):
        self.i = 0
        self.vectors = [
            StyleVector(vocabulary_richness=0.10),
            StyleVector(vocabulary_richness=0.22),
            StyleVector(vocabulary_richness=0.22),
            StyleVector(vocabulary_richness=0.22),
        ]

    def analyze(self, _text):
        idx = min(self.i, len(self.vectors) - 1)
        self.i += 1
        return self.vectors[idx]


def test_style_drift_detector_moderate_severity_paths():
    detector = StyleDriftDetector(window_size=10, stride=10, threshold=0.05, analyzer=_ModerateAnalyzer())

    events = detector.detect("a" * 60)
    assert any(e.severity == "moderate" for e in events)

    reference_events = detector.detect_against_reference(
        "b" * 80,
        StyleVector(vocabulary_richness=0.10),
    )
    assert any(e.severity == "moderate" for e in reference_events)


def test_style_drift_detector_stability_score_default_weight_and_zero_max_events():
    detector = StyleDriftDetector(window_size=10, stride=10, threshold=0.05, analyzer=StyleAnalyzer())

    detector.detect = lambda _text: [
        DriftEvent(
            position=0,
            segment_index=0,
            drift_magnitude=0.2,
            drifted_dimensions=["vocabulary_richness"],
            before_vector=StyleVector(),
            after_vector=StyleVector(vocabulary_richness=1.0),
            severity="unknown",
        )
    ]

    score = detector.get_stability_score("")
    assert 0.0 <= score <= 1.0


def test_style_matcher_average_vectors_empty_list_returns_default_vector():
    matcher = StyleMatcher(analyzer=StyleAnalyzer())
    vec = matcher._average_vectors([])
    assert isinstance(vec, StyleVector)
    assert vec.vocabulary_richness == pytest.approx(0.5)


def test_style_analyzer_tokenize_flushes_english_before_cjk():
    analyzer = StyleAnalyzer()
    tokens = analyzer._tokenize("abc中")
    assert tokens == ["abc", "中"]


def test_style_analyzer_rhetorical_parallelism_increment_branch():
    analyzer = StyleAnalyzer()
    analyzer._is_parallel = lambda _s: True
    result = analyzer._analyze_rhetorical("风像刀，夜像海。", ["春风吹", "夏雨落", "秋叶舞"])
    assert result["parallelism_freq"] > 0.0


def test_style_analyzer_tone_and_narrative_non_default_branches():
    analyzer = StyleAnalyzer()

    tone = analyzer._analyze_tone("他一定会来，绝对不会错。", ["他一定会来"])
    assert tone["certainty_level"] > 0.5

    narrative = analyzer._analyze_narrative("了正在「你好」", ["了正在「你好」"])
    assert narrative["tense_distribution"] > 0.0
    assert narrative["dialogue_ratio"] > 0.0


class _SingleWindowAnalyzer:
    def analyze(self, _text):
        return StyleVector(vocabulary_richness=0.2)


class _MinorReferenceAnalyzer:
    def analyze(self, _text):
        return StyleVector(vocabulary_richness=0.16)


def test_style_drift_detector_detect_len_vectors_lt_two_branch():
    detector = StyleDriftDetector(window_size=30, stride=30, threshold=0.05, analyzer=_SingleWindowAnalyzer())
    assert detector.detect("x" * 60) == []


def test_style_drift_detector_reference_minor_severity_branch():
    detector = StyleDriftDetector(window_size=10, stride=10, threshold=0.05, analyzer=_MinorReferenceAnalyzer())
    events = detector.detect_against_reference("x" * 40, StyleVector(vocabulary_richness=0.1))
    assert events
    assert all(e.severity == "minor" for e in events)


@pytest.mark.asyncio
async def test_style_matcher_generate_style_guide_llm_exception_fallback():
    class _GuideFailLLM:
        async def ainvoke(self, _prompt):
            raise RuntimeError("x")

    matcher = StyleMatcher(analyzer=StyleAnalyzer(), llm=_GuideFailLLM())
    matcher.learn("fallback", ["文本"], description="desc")
    guide = await matcher.generate_style_guide("fallback")
    assert "# fallback 风格指南" in guide
