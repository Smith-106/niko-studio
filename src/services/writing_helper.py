# -*- coding: utf-8 -*-
"""Safe writing-helper capabilities for Niko Studio."""

from __future__ import annotations

from typing import Any, Dict
import re

_ALLOWED_MODES = {"polish", "summarize", "outline", "rewrite", "expand"}
_SENTENCE_ENDINGS = ".!?。！？"
_CONCISE_HINTS = ("简洁", "精简", "更短", "concise", "shorter")
_FORMAL_HINTS = ("正式", "书面", "formal")
_CASUAL_HINTS = ("口语", "轻松", "casual")


def _normalize_whitespace(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[\t\f\v]+", " ", normalized)
    normalized = re.sub(r"[ ]{2,}", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _split_sentences(text: str) -> list[str]:
    matches = re.findall(r".+?[。！？.!?]|.+$", text)
    return [part.strip() for part in matches if part and part.strip()]


def _summarize_text(content: str, max_sentences: int) -> str:
    sentences = _split_sentences(content)
    if not sentences:
        return ""
    selected = sentences[: max(1, max_sentences)]
    return " ".join(selected).strip()


def _outline_text(content: str, max_items: int) -> list[str]:
    paragraphs = [item.strip() for item in content.split("\n") if item.strip()]
    if not paragraphs:
        return []

    outline: list[str] = []
    for paragraph in paragraphs:
        lead = _summarize_text(paragraph, 1)
        if lead:
            outline.append(lead)
        if len(outline) >= max(1, max_items):
            break
    return outline


def _normalize_punctuation_spacing(text: str) -> str:
    normalized = re.sub(r"[ \t]+([，。！？；：,.!?;:])", r"\1", text)
    normalized = re.sub(r"([,.;:!?])([^\s])", r"\1 \2", normalized)
    normalized = re.sub(r"([，。！？；：])[ \t]+", r"\1", normalized)
    return normalized


def _compress_redundant_phrases(text: str) -> str:
    compressed = text
    replacements = (
        (r"\b(in order to)\b", "to"),
        (r"\b(due to the fact that)\b", "because"),
        (r"为了能够", "为"),
        (r"为了可以", "为"),
        (r"非常非常", "非常"),
        (r"很很", "很"),
    )
    for pattern, replacement in replacements:
        compressed = re.sub(pattern, replacement, compressed, flags=re.IGNORECASE)
    compressed = re.sub(r"\b(\w+)\s+\1\b", r"\1", compressed, flags=re.IGNORECASE)
    return compressed


def _sentence_identity(sentence: str) -> str:
    compact = re.sub(r"\s+", "", sentence).lower()
    return compact.strip(_SENTENCE_ENDINGS)


def _dedupe_adjacent_sentences(text: str) -> str:
    lines = text.split("\n")
    deduped_lines: list[str] = []

    for line in lines:
        stripped_line = line.strip()
        if not stripped_line:
            deduped_lines.append("")
            continue

        sentences = _split_sentences(stripped_line)
        if not sentences:
            deduped_lines.append(stripped_line)
            continue

        deduped: list[str] = []
        previous_identity = ""
        for sentence in sentences:
            identity = _sentence_identity(sentence)
            if identity and identity == previous_identity:
                continue
            deduped.append(sentence)
            previous_identity = identity

        deduped_lines.append(" ".join(deduped).strip())

    merged = "\n".join(deduped_lines)
    merged = re.sub(r"\n{3,}", "\n\n", merged)
    return merged.strip()


def _apply_instruction_tone(text: str, instruction: str) -> str:
    normalized_instruction = _normalize_whitespace(instruction).lower()
    if not normalized_instruction:
        return text

    result = text

    concise_enabled = any(hint in normalized_instruction for hint in _CONCISE_HINTS)
    formal_enabled = any(hint in normalized_instruction for hint in _FORMAL_HINTS)
    casual_enabled = any(hint in normalized_instruction for hint in _CASUAL_HINTS)

    if concise_enabled:
        fillers = (
            r"\bactually\b",
            r"\bbasically\b",
            r"\bin fact\b",
            "其实",
            "基本上",
            "某种程度上",
        )
        for filler in fillers:
            result = re.sub(filler, "", result, flags=re.IGNORECASE)
        result = _compress_redundant_phrases(result)

    if formal_enabled and not casual_enabled:
        formal_map = {
            "can't": "cannot",
            "don't": "do not",
            "it's": "it is",
            "挺": "较为",
            "有点": "略微",
            "真的": "确实",
        }
        for src, target in formal_map.items():
            result = result.replace(src, target)

    if casual_enabled and not formal_enabled:
        casual_map = {
            "therefore": "so",
            "furthermore": "also",
            "因此": "所以",
            "此外": "还有",
            "较为": "挺",
            "略微": "有点",
        }
        for src, target in casual_map.items():
            result = result.replace(src, target)

    return _normalize_whitespace(result)


def _polish_text(content: str, instruction: str = "") -> str:
    polished = _normalize_whitespace(content)
    polished = _normalize_punctuation_spacing(polished)
    polished = _compress_redundant_phrases(polished)
    polished = _dedupe_adjacent_sentences(polished)
    polished = _apply_instruction_tone(polished, instruction)
    return _normalize_whitespace(polished)


def _rewrite_text(content: str, instruction: str = "") -> str:
    rewritten = _polish_text(content, instruction=instruction)
    sentences = _split_sentences(rewritten)
    if len(sentences) >= 2:
        rewritten = " ".join(sentences)
    return _normalize_whitespace(rewritten)


def _expand_text(content: str, instruction: str = "") -> str:
    expanded_base = _polish_text(content, instruction=instruction)
    sentences = _split_sentences(expanded_base)
    if not sentences:
        return expanded_base

    anchor = sentences[0]
    if anchor and anchor[-1] in _SENTENCE_ENDINGS:
        addition = f"进一步展开：{anchor}"
    else:
        addition = f"进一步展开：{anchor}。"
    return _normalize_whitespace(f"{expanded_base}\n\n{addition}")


def process_writing_helper(
    *,
    content: str,
    mode: str = "polish",
    max_sentences: int = 3,
    max_items: int = 6,
    instruction: str = "",
) -> Dict[str, Any]:
    normalized_content = _normalize_whitespace(content)
    normalized_mode = str(mode or "polish").strip().lower()
    normalized_instruction = instruction if isinstance(instruction, str) else ""

    if normalized_mode not in _ALLOWED_MODES:
        raise ValueError("mode must be one of: polish, summarize, outline, rewrite, expand")

    if normalized_mode == "polish":
        polished = _polish_text(normalized_content, instruction=normalized_instruction)
        return {
            "mode": "polish",
            "processed_text": polished,
            "stats": {
                "input_chars": len(content),
                "output_chars": len(polished),
            },
        }

    if normalized_mode == "rewrite":
        rewritten = _rewrite_text(normalized_content, instruction=normalized_instruction)
        return {
            "mode": "rewrite",
            "processed_text": rewritten,
            "stats": {
                "input_chars": len(content),
                "output_chars": len(rewritten),
            },
        }

    if normalized_mode == "expand":
        expanded = _expand_text(normalized_content, instruction=normalized_instruction)
        return {
            "mode": "expand",
            "processed_text": expanded,
            "stats": {
                "input_chars": len(content),
                "output_chars": len(expanded),
            },
        }

    if normalized_mode == "summarize":
        summary = _summarize_text(normalized_content, max_sentences=max_sentences)
        return {
            "mode": "summarize",
            "processed_text": summary,
            "stats": {
                "input_chars": len(content),
                "output_chars": len(summary),
                "max_sentences": max(1, max_sentences),
            },
        }

    outline = _outline_text(normalized_content, max_items=max_items)
    return {
        "mode": "outline",
        "outline": outline,
        "stats": {
            "input_chars": len(content),
            "items": len(outline),
            "max_items": max(1, max_items),
        },
    }
