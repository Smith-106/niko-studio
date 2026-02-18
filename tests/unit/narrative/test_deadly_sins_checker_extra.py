# -*- coding: utf-8 -*-
"""Extra branch tests for DeadlySinsChecker."""

import pytest

from src.narrative.evaluators.deadly_sins_checker import DeadlySinsChecker
from src.narrative.evaluators.base import Severity


@pytest.fixture()
def checker():
    return DeadlySinsChecker()


@pytest.mark.asyncio
async def test_evaluate_detects_no_major_and_good_summary_branch(checker):
    content = (
        "因此我们认为结论先行。"
        "第一点因为证据充分所以推进。"
        "第二点因此继续。"
        "看到颜色和光线，听到声音，感觉温度，触摸冰冷。"
        "为什么会这样？如何解决？"
        "主角决定行动并坚持面对挑战。"
        "一方面他犹豫，另一方面仍然出发。"
        "正式语气贯穿全文。"
        "\n\n首先段落一。\n\n其次段落二。\n\n此外段落三。"
    )
    result = await checker.evaluate(content, context={"premise": "结论 证据 推进"})

    assert result.score > 60
    assert "整体质量良好" in result.summary


@pytest.mark.asyncio
async def test_check_apathetic_coward_conflict_append_branch(checker):
    content = "主角只能被迫承受，无奈地忍受。" + ("x" * 600)

    result = checker._check_apathetic_coward(content, {})

    assert result.detected is True
    assert "缺乏内心冲突的展现" in result.diagnosis


@pytest.mark.asyncio
async def test_check_aimless_plotting_detect_from_causal_only_branch(checker):
    content = "场景孤立，没有因果连接。" * 10

    result = checker._check_aimless_plotting(content, {"premise": "场景 因果"})

    assert result.detected is True
    assert "因果关联" in result.diagnosis


@pytest.mark.asyncio
async def test_check_aimless_plotting_no_detection_with_premise_alignment(checker):
    content = "因为目标清晰，所以行动推进，结果达成。" * 5

    result = checker._check_aimless_plotting(content, {"premise": "目标 行动 推进"})

    assert result.detected is False
    assert result.diagnosis == "情节紧扣预设，因果链条清晰"


@pytest.mark.asyncio
async def test_check_faceless_narration_second_branch_appended(checker):
    content = "然而你懂的。" + ("我" * 6) + ("你" * 6)

    result = checker._check_faceless_narration(content, {})

    assert result.detected is True
    assert "叙述视角不统一" in result.diagnosis


@pytest.mark.asyncio
async def test_check_faceless_narration_second_branch_only_path(checker):
    content = ("我" * 6) + ("你" * 6)

    result = checker._check_faceless_narration(content, {})

    assert result.detected is True
    assert result.diagnosis == "叙述视角混乱，第一人称与第二人称频繁切换"


@pytest.mark.asyncio
async def test_check_chaotic_presentation_append_and_format_branch(checker):
    long_para = "a" * 520
    content = "\n\n".join([long_para, long_para, "短段落", "短段落", "短段落"])

    result = checker._check_chaotic_presentation(content, {})

    assert result.detected is True
    assert "段落之间缺乏过渡" in result.diagnosis
    assert "缺乏格式化元素" in result.diagnosis


@pytest.mark.asyncio
async def test_quick_scan_structure_and_emotion_branches(checker):
    result = checker.quick_scan("没有结构也没有感官词")

    assert result.score == 50
    codes = {issue.code for issue in result.issues}
    assert "DEADLY_SIN_STRUCTURAL_DRIFT" in codes
    assert "DEADLY_SIN_EMOTIONAL_VACUUM" in codes


@pytest.mark.asyncio
async def test_quick_scan_no_issue_path(checker):
    content = "首先我们看到线索，并且听到回声，感觉温度变化。"

    result = checker.quick_scan(content)

    assert result.score == 70
    assert result.issues == []


def test_description_property(checker):
    assert checker.description == "七个致命错误检查器 - 写作质量的最终防线"


def test_check_structural_drift_only_structure_missing_branch(checker):
    content = "因此我们认为核心观点已给出，但文本没有编号结构。"

    result = checker._check_structural_drift(content, {})

    assert result.detected is True
    assert result.diagnosis == "论证缺乏清晰的层次结构"


def test_check_emotional_vacuum_abstract_only_branch(checker):
    content = "高兴难过害怕愤怒紧张激动悲伤恐惧。" * 2

    result = checker._check_emotional_vacuum(content, {})

    assert result.detected is True
    assert result.diagnosis == "缺乏感官细节，读者难以'感受'场景；过多直接陈述情感而非展示"


def test_check_apathetic_coward_passive_only_branch(checker):
    content = "角色决定行动并选择前进，但随后被迫忍受无奈承受。"

    result = checker._check_apathetic_coward(content, {})

    assert result.detected is True
    assert result.diagnosis == "角色过于被动，只是忍受而非行动"


def test_check_emotional_vacuum_abstract_only_without_initial_detection(checker):
    content = "看到听到感觉" + ("高兴难过害怕愤怒紧张激动悲伤恐惧" * 2)

    result = checker._check_emotional_vacuum(content, {})

    assert result.detected is True
    assert result.diagnosis == "过多直接陈述情感，而非用细节展示"


def test_check_chaotic_presentation_transition_only_branch(checker):
    paragraphs = ["段落A", "段落B", "段落C", "段落D"]
    content = "\n\n".join(paragraphs)

    result = checker._check_chaotic_presentation(content, {})

    assert result.detected is True
    assert result.diagnosis == "段落之间缺乏过渡词，跳跃感强"


def test_check_chaotic_presentation_format_only_branch(checker):
    paragraph = "内容" * 200
    content = "\n\n".join([paragraph, paragraph, paragraph])

    result = checker._check_chaotic_presentation(content, {})

    assert result.detected is True
    assert result.diagnosis == "长文缺乏格式化元素（标题、列表等）"
    major = checker._check_structural_drift("普通叙述没有结构标记", {})
    summary_major = checker._generate_summary(65.0, [major], [], [major])
    assert "主要问题" in summary_major

    critical_like = checker._check_structural_drift("无结论无结构", {})
    critical_like.severity = Severity.CRITICAL
    critical_like.detected = True
    summary_critical = checker._generate_summary(30.0, [critical_like], [critical_like], [])
    assert "严重问题" in summary_critical
