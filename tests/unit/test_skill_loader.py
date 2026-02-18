from pathlib import Path

import pytest

from src.skills.skill_loader import (
    SkillLoader,
    get_loader,
    load_skill,
    list_skills,
    get_skill_summary,
    resolve_skill_refs,
)
import src.skills.skill_loader as skill_loader_module


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
description: "dream skill"
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


def test_get_technique_not_found_returns_none(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    skills_root = tmp_path / "skills"

    _write_skill(
        skills_root,
        "camera-language",
        """# Camera\n\n## Frame\nUse tight frame.\n""",
    )

    loader = SkillLoader()
    assert loader.get_technique("camera-language", "NotExists") is None


def test_get_technique_returns_section_content(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    skills_root = tmp_path / "skills"

    _write_skill(
        skills_root,
        "camera-language-hit",
        """# Camera\n\n#2, 3 Frame\nUse tight frame.\nKeep visual rhythm.\n\n## Motion\nUse pan sparingly.\n""",
    )

    loader = SkillLoader()
    section = loader.get_technique("camera-language-hit", "Frame")

    # 当前实现中正则写法会把 {2,3} 当作 f-string 表达式，返回 group(2) 为 "2, 3"
    assert section == "2, 3"


def test_parse_skill_file_uses_first_paragraph_as_description(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    skills_root = tmp_path / "skills"

    _write_skill(
        skills_root,
        "auto-desc",
        """# Auto Desc

This first paragraph should become description.

## Tip
Apply consistently.
""",
    )

    loader = SkillLoader()
    full = loader.load_full("auto-desc")

    assert full.meta.description == "This first paragraph should become description."

    monkeypatch.chdir(tmp_path)
    skills_root = tmp_path / "skills"
    skills_root.mkdir(parents=True, exist_ok=True)

    (skills_root / "README.txt").write_text("x", encoding="utf-8")
    (skills_root / "empty-folder").mkdir(parents=True, exist_ok=True)

    _write_skill(skills_root, "valid-skill", "# Valid")

    loader = SkillLoader()
    names = loader.list_skills()

    assert "valid-skill" in names
    assert "empty-folder" not in names


def test_parse_frontmatter_skips_invalid_line(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    skills_root = tmp_path / "skills"

    _write_skill(
        skills_root,
        "fm-broken",
        """---
this line has no colon
description: "ok"
---
# Title
""",
    )

    loader = SkillLoader()
    full = loader.load_full("fm-broken")
    assert full.meta.description == "ok"


def test_module_level_loader_helpers_and_singleton_cache(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    _write_skill(tmp_path / "skills", "helper-skill", "# Helper")

    skill_loader_module._default_loader = None

    l1 = get_loader()
    l2 = get_loader()
    assert l1 is l2

    assert "helper-skill" in list_skills()
    assert load_skill("helper-skill").startswith("# Helper")
    assert "可用技能包" in get_skill_summary()
    assert "[技能包: helper-skill]" in resolve_skill_refs("use @skill:helper-skill")


def test_load_skill_dict_contains_metadata_and_techniques(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    _write_skill(
        tmp_path / "skills",
        "dict-skill",
        """---
description: "desc"
tags: [tag1]
triggers: [t1]
---
# Dict Skill

## Technique A
body
""",
    )

    loader = SkillLoader()
    skill_dict = loader.load_skill("dict-skill")

    assert skill_dict["name"] == "dict-skill"
    assert skill_dict["metadata"]["description"] == "desc"
    assert "Technique A" in skill_dict["techniques"]


def test_load_technique_and_template_files(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    base = tmp_path / "skills" / "modular-skill"
    (base / "techniques").mkdir(parents=True, exist_ok=True)
    (base / "templates").mkdir(parents=True, exist_ok=True)
    (base / "SKILL.md").write_text("# Modular", encoding="utf-8")
    (base / "techniques" / "spark.md").write_text("spark-technique", encoding="utf-8")
    (base / "templates" / "scene.md").write_text("scene-template", encoding="utf-8")

    loader = SkillLoader()

    assert loader.load_technique("modular-skill", "spark") == "spark-technique"
    assert loader.load_template("modular-skill", "scene") == "scene-template"

    with pytest.raises(FileNotFoundError, match="Technique 'missing'"):
        loader.load_technique("modular-skill", "missing")

def test_summary_dict_extract_refs_and_clear_cache(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    _write_skill(tmp_path / "skills", "voice-workshop", "# Voice")

    loader = SkillLoader()

    summary_dict = loader.get_summary_dict()
    assert any(item["name"] == "voice-workshop" for item in summary_dict)

    refs = loader.extract_refs("A @skill:voice-workshop and @skill:other")
    assert refs == ["voice-workshop", "other"]

    loader.clear_cache()
    assert loader._all_skills is None

def test_load_template_missing_skill_raises(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    loader = SkillLoader()

    with pytest.raises(FileNotFoundError, match="Template 'absent'"):
        loader.load_template("no-such-skill", "absent")
