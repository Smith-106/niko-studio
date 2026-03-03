import pytest

from src.services.writing_helper import process_writing_helper


def test_process_writing_helper_polish_dedupes_and_normalizes():
    result = process_writing_helper(content="第一句。 第一句。\n\n\n第二句。", mode="polish")

    assert result["mode"] == "polish"
    assert result["processed_text"] == "第一句。 第二句。"
    assert result["stats"]["input_chars"] >= result["stats"]["output_chars"]


def test_process_writing_helper_polish_respects_instruction_concise():
    result = process_writing_helper(
        content="其实 这是 一个 非常非常 简单 的 例子。",
        mode="polish",
        instruction="请更简洁",
    )

    assert result["mode"] == "polish"
    assert "其实" not in result["processed_text"]
    assert "非常非常" not in result["processed_text"]


def test_process_writing_helper_rewrite_mode_returns_processed_text():
    result = process_writing_helper(content="第一句。 第一句。", mode="rewrite")

    assert result["mode"] == "rewrite"
    assert result["processed_text"] == "第一句。"
    assert result["stats"]["input_chars"] >= result["stats"]["output_chars"]


def test_process_writing_helper_expand_mode_appends_safe_expansion():
    result = process_writing_helper(content="第一句。", mode="expand")

    assert result["mode"] == "expand"
    assert "进一步展开：第一句。" in result["processed_text"]
    assert result["stats"]["output_chars"] >= result["stats"]["input_chars"]


def test_process_writing_helper_rejects_invalid_mode():
    with pytest.raises(ValueError, match="mode must be one of"):
        process_writing_helper(content="abc", mode="invalid")
