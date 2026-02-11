# -*- coding: utf-8 -*-
"""Writer agent tests - WriterInput, WriterOutput Pydantic models."""

import pytest
from src.agents.writer import WriterInput, WriterOutput


class TestWriterInput:
    def test_defaults(self):
        wi = WriterInput()
        assert wi.scene_id == "scene-001"
        assert wi.pov_character == "主角"
        assert wi.word_target == 2000

    def test_explicit_fields(self):
        wi = WriterInput(
            scene_id="s1", chapter_num=3, pov_character="Alice",
            objective="escape", conflict="guards", outcome="-",
            plot_beat="chase", emotional_arc="calm→panic",
        )
        assert wi.scene_id == "s1"
        assert wi.chapter_num == 3
        assert wi.outcome == "-"

    def test_from_scene_card(self):
        card = {
            "scene_id": "card-1",
            "pov_character": "Bob",
            "objective": "find treasure",
            "conflict": "traps",
            "outcome": "+",
            "plot_beat": "discovery",
            "chapter_num": 5,
        }
        wi = WriterInput(scene_card=card)
        assert wi.scene_id == "card-1"
        assert wi.pov_character == "Bob"
        assert wi.chapter_num == 5

    def test_scene_card_defaults(self):
        wi = WriterInput(scene_card={})
        assert wi.scene_id == "scene-001"
        assert wi.pov_character == "主角"

    def test_explicit_overrides_card(self):
        wi = WriterInput(scene_card={"scene_id": "card-1"}, scene_id="explicit-1")
        assert wi.scene_id == "explicit-1"

    def test_foreshadows(self):
        wi = WriterInput(foreshadows_to_plant=["f1"], foreshadows_to_harvest=["f2"])
        assert wi.foreshadows_to_plant == ["f1"]
        assert wi.foreshadows_to_harvest == ["f2"]


class TestWriterOutput:
    def test_basic(self):
        wo = WriterOutput(content="Chapter text here", wordcount=500)
        assert wo.content == "Chapter text here"
        assert wo.wordcount == 500

    def test_with_metadata(self):
        wo = WriterOutput(
            content="text", wordcount=100,
            characters_appeared=["Alice", "Bob"],
            locations=["forest"],
            foreshadows_planted=["f1"],
            sensory_types_used=["visual", "auditory"],
            forbidden_words_found=["突然"],
        )
        assert len(wo.characters_appeared) == 2
        assert "突然" in wo.forbidden_words_found
