# -*- coding: utf-8 -*-
"""Safe writing-helper capabilities for Niko Studio."""

from __future__ import annotations

from typing import Any, Dict
import re

_ALLOWED_MODES = {"polish", "summarize", "outline"}


def _normalize_whitespace(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[\t\f\v]+", " ", normalized)
    normalized = re.sub(r"[ ]{2,}", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[。！？.!?])\s+", text)
    return [part.strip() for part in parts if part and part.strip()]


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


def process_writing_helper(
    *,
    content: str,
    mode: str = "polish",
    max_sentences: int = 3,
    max_items: int = 6,
) -> Dict[str, Any]:
    normalized_content = _normalize_whitespace(content)
    normalized_mode = str(mode or "polish").strip().lower()

    if normalized_mode not in _ALLOWED_MODES:
        raise ValueError("mode must be one of: polish, summarize, outline")

    if normalized_mode == "polish":
        return {
            "mode": "polish",
            "processed_text": normalized_content,
            "stats": {
                "input_chars": len(content),
                "output_chars": len(normalized_content),
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
