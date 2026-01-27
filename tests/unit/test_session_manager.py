import pytest
import json
from pathlib import Path
import sys

# Ensure src is in path
sys.path.insert(0, "src")

from workflow.session.session_manager import SessionManager, ContentType, SessionInfo

class TestSessionManager:
    @pytest.fixture
    def manager(self, tmp_path):
        return SessionManager(base_path=str(tmp_path))

    def test_init_session(self, manager):
        info = manager.init("test_session")
        assert info.stats_cached is True
        assert info.total_words == 0
        assert info.chapter_count == 0

    def test_write_chapter_updates_stats(self, manager):
        manager.init("test_session")

        # Add first chapter
        content1 = "Hello World" # 11 chars
        manager.write("test_session", ContentType.CHAPTER, content1, id="1")

        stats = manager.stats("test_session")
        assert stats["chapter_count"] == 1
        assert stats["total_words"] == 11

        # Add second chapter
        content2 = "Python" # 6 chars
        manager.write("test_session", ContentType.CHAPTER, content2, id="2")

        stats = manager.stats("test_session")
        assert stats["chapter_count"] == 2
        assert stats["total_words"] == 17

    def test_modify_chapter_updates_stats(self, manager):
        manager.init("test_session")
        manager.write("test_session", ContentType.CHAPTER, "Hello", id="1") # 5

        # Modify
        manager.write("test_session", ContentType.CHAPTER, "Hello World", id="1") # 11

        stats = manager.stats("test_session")
        assert stats["chapter_count"] == 1
        assert stats["total_words"] == 11

        # Modify to shorter
        manager.write("test_session", ContentType.CHAPTER, "Hi", id="1") # 2

        stats = manager.stats("test_session")
        assert stats["chapter_count"] == 1
        assert stats["total_words"] == 2

    def test_stats_recalculation_when_not_cached(self, manager):
        manager.init("test_session")
        manager.write("test_session", ContentType.CHAPTER, "Test", id="1")

        # Manually invalidate cache
        info = manager._load_session_info("test_session")
        info.stats_cached = False
        info.total_words = 0
        info.chapter_count = 0
        manager._save_session_info("test_session", info)

        # Stats should recalculate
        stats = manager.stats("test_session")
        assert stats["total_words"] == 4
        assert stats["chapter_count"] == 1

        # Verify it updated the cache
        info = manager._load_session_info("test_session")
        assert info.stats_cached is True
        assert info.total_words == 4

    def test_write_other_content_does_not_affect_stats(self, manager):
        manager.init("test_session")
        manager.write("test_session", ContentType.OUTLINE, "Outline content")

        stats = manager.stats("test_session")
        assert stats["chapter_count"] == 0
        assert stats["total_words"] == 0
