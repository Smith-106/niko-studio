# -*- coding: utf-8 -*-
"""
ObsidianService Tests

Tests for VaultInfo, NoteInfo, ObsidianService (discover, structure,
files, notes, search, sync, read_note), factory functions.
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path
from datetime import datetime

from src.services.obsidian_service import (
    ObsidianService,
    VaultInfo,
    NoteInfo,
    _get_obsidian_config_path,
    get_obsidian_service,
    reset_obsidian_service,
)


# ============================================================
# VaultInfo
# ============================================================

class TestVaultInfo:

    def test_basic(self):
        vi = VaultInfo(
            name="test", path="/vault", last_modified=datetime.now(),
            file_count=10, folder_count=3, total_size_bytes=1000
        )
        assert vi.name == "test"
        assert vi.file_count == 10

    def test_defaults(self):
        vi = VaultInfo(
            name="v", path="/v", last_modified=datetime.now(),
            file_count=0
        )
        assert vi.folder_count == 0
        assert vi.total_size_bytes == 0
        assert vi.metadata == {}


# ============================================================
# NoteInfo
# ============================================================

class TestNoteInfo:

    def test_basic(self):
        ni = NoteInfo(
            name="note", path="/vault/note.md",
            relative_path="note.md", size_bytes=100
        )
        assert ni.name == "note"
        assert ni.tags == []
        assert ni.links == []

    def test_with_tags(self):
        ni = NoteInfo(
            name="note", path="/p", relative_path="r",
            size_bytes=10, tags=["t1", "t2"]
        )
        assert len(ni.tags) == 2


# ============================================================
# _get_obsidian_config_path
# ============================================================

class TestGetConfigPath:

    @patch("src.services.obsidian_service.sys")
    def test_win32(self, mock_sys):
        mock_sys.platform = "win32"
        with patch.dict("os.environ", {"APPDATA": "C:\\Users\\test\\AppData\\Roaming"}):
            result = _get_obsidian_config_path()
            assert result is not None
            assert "obsidian" in str(result).lower()

    @patch("src.services.obsidian_service.sys")
    def test_darwin(self, mock_sys):
        mock_sys.platform = "darwin"
        result = _get_obsidian_config_path()
        assert result is not None
        assert "obsidian" in str(result).lower()

    @patch("src.services.obsidian_service.sys")
    def test_linux(self, mock_sys):
        mock_sys.platform = "linux"
        result = _get_obsidian_config_path()
        assert result is not None
        assert "obsidian" in str(result).lower()

    @patch("src.services.obsidian_service.sys")
    def test_win32_no_appdata(self, mock_sys):
        mock_sys.platform = "win32"
        with patch.dict("os.environ", {}, clear=True):
            result = _get_obsidian_config_path()
            assert result is None


# ============================================================
# ObsidianService init
# ============================================================

class TestObsidianServiceInit:

    def test_init(self):
        svc = ObsidianService()
        assert svc._vault_cache == {}

    def test_init_with_config(self):
        svc = ObsidianService(config={"key": "val"})
        assert svc._config == {"key": "val"}


# ============================================================
# _get_vault_info
# ============================================================

class TestGetVaultInfo:

    def test_nonexistent(self):
        svc = ObsidianService()
        assert svc._get_vault_info("/nonexistent/path") is None

    def test_valid_vault(self, tmp_path):
        vault = tmp_path / "my_vault"
        vault.mkdir()
        (vault / ".obsidian").mkdir()
        (vault / "note.md").write_text("content", encoding="utf-8")
        (vault / "sub").mkdir()

        svc = ObsidianService()
        info = svc._get_vault_info(str(vault))
        assert info is not None
        assert info.name == "my_vault"
        assert info.file_count >= 1


# ============================================================
# get_vault_structure
# ============================================================

class TestGetVaultStructure:

    def test_nonexistent(self):
        svc = ObsidianService()
        result = svc.get_vault_structure("/nonexistent")
        assert "error" in result

    def test_valid_structure(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "note.md").write_text("content", encoding="utf-8")
        sub = vault / "folder"
        sub.mkdir()
        (sub / "sub_note.md").write_text("sub", encoding="utf-8")

        svc = ObsidianService()
        result = svc.get_vault_structure(str(vault))
        assert result["name"] == "vault"
        assert result["type"] == "directory"
        assert len(result["children"]) >= 1

    def test_max_depth(self, tmp_path):
        vault = tmp_path / "vault"
        current = vault
        for i in range(5):
            current = current / f"level{i}"
            current.mkdir(parents=True, exist_ok=True)

        svc = ObsidianService()
        result = svc.get_vault_structure(str(vault), max_depth=2)
        assert result is not None

    def test_hidden_files_skipped(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / ".hidden").write_text("h", encoding="utf-8")
        (vault / "visible.md").write_text("v", encoding="utf-8")

        svc = ObsidianService()
        result = svc.get_vault_structure(str(vault))
        names = [c["name"] for c in result["children"]]
        assert ".hidden" not in names
        assert "visible.md" in names


# ============================================================
# get_files
# ============================================================

class TestGetFiles:

    def test_nonexistent(self):
        svc = ObsidianService()
        assert svc.get_files("/nonexistent") == []

    def test_recursive(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "a.md").write_text("a", encoding="utf-8")
        sub = vault / "sub"
        sub.mkdir()
        (sub / "b.md").write_text("b", encoding="utf-8")

        svc = ObsidianService()
        files = svc.get_files(str(vault), "*.md", recursive=True)
        assert len(files) == 2

    def test_non_recursive(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "a.md").write_text("a", encoding="utf-8")
        sub = vault / "sub"
        sub.mkdir()
        (sub / "b.md").write_text("b", encoding="utf-8")

        svc = ObsidianService()
        files = svc.get_files(str(vault), "*.md", recursive=False)
        assert len(files) == 1

    def test_skip_obsidian_dir(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        obs = vault / ".obsidian"
        obs.mkdir()
        (obs / "config.md").write_text("c", encoding="utf-8")
        (vault / "note.md").write_text("n", encoding="utf-8")

        svc = ObsidianService()
        files = svc.get_files(str(vault), "*.md")
        assert len(files) == 1

    def test_pattern_filter(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "a.md").write_text("a", encoding="utf-8")
        (vault / "b.txt").write_text("b", encoding="utf-8")

        svc = ObsidianService()
        files = svc.get_files(str(vault), "*.txt")
        assert len(files) == 1


# ============================================================
# get_notes
# ============================================================

class TestGetNotes:

    def test_nonexistent(self):
        svc = ObsidianService()
        assert svc.get_notes("/nonexistent") == []

    def test_basic(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "note.md").write_text("# Title\n\ncontent", encoding="utf-8")

        svc = ObsidianService()
        notes = svc.get_notes(str(vault))
        assert len(notes) == 1
        assert notes[0].name == "note"

    def test_with_folder(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        sub = vault / "folder"
        sub.mkdir()
        (sub / "note.md").write_text("content", encoding="utf-8")

        svc = ObsidianService()
        notes = svc.get_notes(str(vault), folder="folder")
        assert len(notes) == 1

    def test_limit(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        for i in range(5):
            (vault / f"note{i}.md").write_text(f"content {i}", encoding="utf-8")

        svc = ObsidianService()
        notes = svc.get_notes(str(vault), limit=2)
        assert len(notes) == 2


# ============================================================
# _extract_tags
# ============================================================

class TestExtractTags:

    def test_inline_tags(self):
        svc = ObsidianService()
        content = "Some text #tag1 and #tag2 here"
        tags = svc._extract_tags(content)
        assert "tag1" in tags
        assert "tag2" in tags

    def test_frontmatter_tags_array(self):
        svc = ObsidianService()
        content = '---\ntags: [a, b, c]\n---\ncontent'
        tags = svc._extract_tags(content)
        assert "a" in tags

    def test_frontmatter_tags_list(self):
        svc = ObsidianService()
        content = '---\ntags:\n  - tag1\n  - tag2\n---\ncontent'
        tags = svc._extract_tags(content)
        assert "tag1" in tags

    def test_no_tags(self):
        svc = ObsidianService()
        tags = svc._extract_tags("plain text without tags")
        assert len(tags) == 0


# ============================================================
# _extract_links
# ============================================================

class TestExtractLinks:

    def test_wiki_links(self):
        svc = ObsidianService()
        content = "See [[other note]] and [[another|alias]]."
        links = svc._extract_links(content)
        assert "other note" in links
        assert "another" in links

    def test_no_links(self):
        svc = ObsidianService()
        links = svc._extract_links("no links here")
        assert len(links) == 0


# ============================================================
# read_note
# ============================================================

class TestReadNote:

    def test_read_existing(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "note.md").write_text("content here", encoding="utf-8")

        svc = ObsidianService()
        content = svc.read_note(str(vault), "note.md")
        assert content == "content here"

    def test_auto_add_extension(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "note.md").write_text("content", encoding="utf-8")

        svc = ObsidianService()
        content = svc.read_note(str(vault), "note")
        assert content == "content"

    def test_not_found(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()

        svc = ObsidianService()
        with pytest.raises(FileNotFoundError):
            svc.read_note(str(vault), "nonexistent.md")


# ============================================================
# search_notes
# ============================================================

class TestSearchNotes:

    def test_search_by_name(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "python.md").write_text("python content", encoding="utf-8")
        (vault / "java.md").write_text("java content", encoding="utf-8")

        svc = ObsidianService()
        results = svc.search_notes(str(vault), "python")
        assert len(results) >= 1
        assert results[0].name == "python"

    def test_search_by_content(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "note.md").write_text("unique searchable keyword", encoding="utf-8")

        svc = ObsidianService()
        results = svc.search_notes(str(vault), "searchable")
        assert len(results) >= 1

    def test_search_no_match(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "note.md").write_text("nothing", encoding="utf-8")

        svc = ObsidianService()
        results = svc.search_notes(str(vault), "nonexistent_xyz")
        assert len(results) == 0

    def test_search_limit(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        for i in range(10):
            (vault / f"note{i}.md").write_text("searchword content", encoding="utf-8")

        svc = ObsidianService()
        results = svc.search_notes(str(vault), "searchword", limit=3)
        assert len(results) <= 3

    def test_search_content_disabled(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "note.md").write_text("unique keyword in content", encoding="utf-8")

        svc = ObsidianService()
        results = svc.search_notes(str(vault), "unique", search_content=False)
        assert len(results) == 0


# ============================================================
# sync_to_knowledge_layer
# ============================================================

class TestSyncToKnowledgeLayer:

    def test_sync_with_sync_file(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "note.md").write_text("content", encoding="utf-8")

        mock_kl = MagicMock()
        mock_kl.sync_file.return_value = {"success": True}

        svc = ObsidianService()
        result = svc.sync_to_knowledge_layer(str(vault), mock_kl)
        assert result["success"] is True
        assert result["synced_count"] == 1

    def test_sync_fallback_add_document(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "note.md").write_text("content", encoding="utf-8")

        mock_kl = MagicMock(spec=[])  # no sync_file
        mock_kl.add_document = MagicMock()

        svc = ObsidianService()
        result = svc.sync_to_knowledge_layer(str(vault), mock_kl)
        assert result["synced_count"] == 1

    def test_sync_with_error(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "note.md").write_text("content", encoding="utf-8")

        mock_kl = MagicMock()
        mock_kl.sync_file.return_value = {"success": False, "error": "fail"}

        svc = ObsidianService()
        result = svc.sync_to_knowledge_layer(str(vault), mock_kl)
        assert result["success"] is False
        assert result["failed_count"] == 1

    def test_sync_with_folder(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        sub = vault / "docs"
        sub.mkdir()
        (sub / "note.md").write_text("content", encoding="utf-8")

        mock_kl = MagicMock()
        mock_kl.sync_file.return_value = {"success": True}

        svc = ObsidianService()
        result = svc.sync_to_knowledge_layer(str(vault), mock_kl, folder="docs")
        assert result["synced_count"] == 1


# ============================================================
# get_vault_by_name / get_vault_by_path
# ============================================================

class TestVaultLookup:

    def test_by_path(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / ".obsidian").mkdir()
        (vault / "note.md").write_text("content", encoding="utf-8")

        svc = ObsidianService()
        info = svc.get_vault_by_path(str(vault))
        assert info is not None
        assert info.name == "vault"

    def test_by_path_cache(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / ".obsidian").mkdir()
        (vault / "note.md").write_text("content", encoding="utf-8")

        svc = ObsidianService()
        info1 = svc.get_vault_by_path(str(vault))
        info2 = svc.get_vault_by_path(str(vault))
        assert info1 is info2  # cached


# ============================================================
# close
# ============================================================

class TestClose:

    def test_close_clears_cache(self):
        svc = ObsidianService()
        svc._vault_cache = {"a": MagicMock()}
        svc.close()
        assert svc._vault_cache == {}


# ============================================================
# Singleton
# ============================================================

class TestSingleton:

    def test_get_and_reset(self):
        reset_obsidian_service()
        svc1 = get_obsidian_service()
        assert isinstance(svc1, ObsidianService)

        svc2 = get_obsidian_service()
        assert svc1 is svc2

        reset_obsidian_service()
        svc3 = get_obsidian_service()
        assert svc3 is not svc1
