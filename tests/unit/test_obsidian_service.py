import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from src.services.obsidian_service import ObsidianService


def test_discover_vaults_from_config_and_cache(tmp_path):
    vault_dir = tmp_path / "vault-a"
    (vault_dir / ".obsidian").mkdir(parents=True)
    (vault_dir / "a.md").write_text("# A", encoding="utf-8")

    cfg_dir = tmp_path / "obsidian-config"
    cfg_dir.mkdir()
    (cfg_dir / "obsidian.json").write_text(
        json.dumps({"vaults": {"id-1": {"path": str(vault_dir)}}}),
        encoding="utf-8",
    )

    service = ObsidianService()
    service._config_path = cfg_dir

    first = service.discover_vaults(refresh=True)
    assert len(first) == 1
    assert first[0].name == "vault-a"

    service._vault_cache = {"cached": first[0]}
    second = service.discover_vaults(refresh=False)
    assert second == [first[0]]

    service.close()


def test_get_files_and_get_notes_extract_tags_and_links(tmp_path):
    vault_dir = tmp_path / "vault-b"
    (vault_dir / ".obsidian").mkdir(parents=True)
    notes_dir = vault_dir / "notes"
    notes_dir.mkdir()

    (vault_dir / ".obsidian" / "hidden.md").write_text("hidden", encoding="utf-8")
    content = """---
tags: [alpha, beta]
---
# My Note
text #inline and [[TargetPage|alias]]
"""
    (notes_dir / "note.md").write_text(content, encoding="utf-8")

    service = ObsidianService()

    files = service.get_files(str(vault_dir), pattern="*.md", recursive=True)
    assert all(".obsidian" not in str(path) for path in files)
    assert any(path.name == "note.md" for path in files)

    notes = service.get_notes(str(vault_dir), folder="notes")
    assert len(notes) == 1
    assert set(notes[0].tags) >= {"alpha", "beta", "inline"}
    assert notes[0].links == ["TargetPage"]

    service.close()


def test_read_note_auto_suffix_and_missing_file(tmp_path):
    vault_dir = tmp_path / "vault-c"
    vault_dir.mkdir()
    (vault_dir / "daily.md").write_text("hello", encoding="utf-8")

    service = ObsidianService()

    assert service.read_note(str(vault_dir), "daily") == "hello"

    with pytest.raises(FileNotFoundError):
        service.read_note(str(vault_dir), "missing")

    service.close()


def test_search_notes_matches_name_and_content(tmp_path):
    vault_dir = tmp_path / "vault-d"
    vault_dir.mkdir()
    (vault_dir / "project-plan.md").write_text("release checklist", encoding="utf-8")
    (vault_dir / "random.md").write_text("contains secret keyword", encoding="utf-8")

    service = ObsidianService()

    by_name = service.search_notes(str(vault_dir), "project", search_content=False)
    assert [n.name for n in by_name] == ["project-plan"]

    by_content = service.search_notes(str(vault_dir), "keyword", search_content=True)
    assert {n.name for n in by_content} == {"random"}

    service.close()


def test_sync_to_knowledge_layer_with_sync_file_and_fallback(tmp_path):
    vault_dir = tmp_path / "vault-e"
    vault_dir.mkdir()
    (vault_dir / "one.md").write_text("one", encoding="utf-8")
    (vault_dir / "two.md").write_text("two", encoding="utf-8")

    service = ObsidianService()

    layer_with_sync = SimpleNamespace(
        sync_file=lambda _path: {"success": True},
    )
    result_sync = service.sync_to_knowledge_layer(str(vault_dir), layer_with_sync)
    assert result_sync["success"] is True
    assert result_sync["synced_count"] == 2

    captured = []

    class _FallbackLayer:
        def add_document(self, content, metadata):
            captured.append((content, metadata))

    result_fallback = service.sync_to_knowledge_layer(str(vault_dir), _FallbackLayer())
    assert result_fallback["success"] is True
    assert len(captured) == 2
    assert all(item[1]["source"] == "obsidian" for item in captured)

    service.close()
