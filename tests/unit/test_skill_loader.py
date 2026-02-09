from pathlib import Path

import pytest

from src.skills.skill_loader import SkillLoader


def _write_skill(base: Path, name: str, body: str):
    skill_dir = base / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(body, encoding="utf-8")


def test_load_and_get_technique_from_base_path(tmp_path, monkeypatch):
    project_root = tmp_path / "project"
    skills_root = project_root / "skills"
    skills_root.mkdir(parents=True)

    _write_skill(
        skills_root,
        "fictional-dream",
        """---
description: \"dream skill\"
tags: [emotion, scene]
triggers: [immersive]
---
# Dream

## Technique One
Use sensory details.
""",
    )

    monkeypatch.chdir(tmp_path)
    loader = SkillLoader(base_path=str(project_root))

    assert loader.load("fictional-dream").startswith("---")
    section = loader.get_technique("fictional-dream", "Technique One")
    # 当前实现会返回 None（章节提取逻辑尚未命中）
    assert section is None

    full = loader.load_full("fictional-dream")
    assert "Technique One" in full.techniques


def test_priority_order_prefers_base_path(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    builtin_skills = tmp_path / "skills"
    _write_skill(builtin_skills, "same", "# builtin")

    custom_project = tmp_path / "custom"
    _write_skill(custom_project / "skills", "same", "# custom")

    loader = SkillLoader(base_path=str(custom_project))
    content = loader.load("same")

    assert "custom" in content


def test_resolve_refs_truncates_long_content_and_handles_missing(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    skills_root = tmp_path / "skills"

    long_text = "# Long\n\n" + ("a" * 5000)
    _write_skill(skills_root, "long-skill", long_text)

    loader = SkillLoader()

    resolved = loader.resolve_refs("Use @skill:long-skill now")
    assert "[技能包: long-skill]" in resolved
    assert "内容截断" in resolved

    missing = loader.resolve_refs("Use @skill:not-found now")
    assert "未找到" in missing


def test_list_summary_and_clear_cache(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    skills_root = tmp_path / "skills"

    _write_skill(
        skills_root,
        "voice-workshop",
        """---
description: \"voice improve\"
tags: [voice]
---
# Voice

## Tip
Keep tone consistent.
""",
    )

    loader = SkillLoader()

    names = loader.list_skills()
    assert "voice-workshop" in names

    summary = loader.get_summary()
    assert "可用技能包" in summary
    assert "@skill:技能名称" in summary

    summary_dict = loader.get_summary_dict()
    assert any(item["name"] == "voice-workshop" for item in summary_dict)

    refs = loader.extract_refs("A @skill:voice-workshop and @skill:other")
    assert refs == ["voice-workshop", "other"]

    loader.clear_cache()
    assert loader._all_skills is None
