# -*- coding: utf-8 -*-
"""
Integration Tests - Service Layer (IMPL-006)

Tests for TokenService, BackupManager, ObsidianService integration.
"""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch
import sys

src_path = Path(__file__).parent.parent.parent / "src"
sys.path.insert(0, str(src_path))


class TestTokenServiceIntegration:
    """TokenService integration tests."""

    def test_token_service_estimate_and_record(self, tmp_path):
        """Test token estimation and usage recording."""
        from src.services.token_service import TokenService

        service = TokenService(db_path=str(tmp_path / "token.db"))

        # Estimate tokens
        tokens = service.estimate_tokens("Hello, this is a test message.")
        assert tokens > 0

        # Record usage
        service.record_usage(
            tokens=tokens,
            cost=0.01,
            model="gpt-4o",
            session_id="test-session"
        )

        # Verify history
        history = service.get_usage_history(session_id="test-session")
        assert len(history) == 1

        service.close()

    def test_token_service_budget_tracking(self, tmp_path):
        """Test budget tracking functionality."""
        from src.services.token_service import TokenService

        service = TokenService(db_path=str(tmp_path / "token.db"))

        service.set_budget("budget-session", 1.0)
        service.record_usage(tokens=500, cost=0.3, model="gpt-4o", session_id="budget-session")

        status = service.get_budget_status("budget-session")
        assert status.total_cost == 0.3
        assert status.remaining == 0.7

        service.close()


class TestBackupManagerIntegration:
    """BackupManager integration tests."""

    def test_backup_create_and_list(self, tmp_path):
        """Test backup creation and listing."""
        from src.services.backup_manager import BackupManager

        # Setup source directory
        source_dir = tmp_path / "source"
        source_dir.mkdir()
        (source_dir / "test.txt").write_text("test content")

        backup_dir = tmp_path / "backups"
        manager = BackupManager(backup_dir=str(backup_dir))

        # Create backup
        result = manager.create_backup(str(source_dir), compress=False)
        assert result["success"] is True
        assert "backup_id" in result

        # List backups
        backups = manager.list_backups()
        assert len(backups) >= 1

        manager.close()

    def test_backup_restore(self, tmp_path):
        """Test backup restore functionality."""
        from src.services.backup_manager import BackupManager

        # Setup
        source_dir = tmp_path / "source"
        source_dir.mkdir()
        (source_dir / "file.txt").write_text("original content")

        backup_dir = tmp_path / "backups"
        manager = BackupManager(backup_dir=str(backup_dir))

        # Create backup
        result = manager.create_backup(str(source_dir), compress=False)
        backup_id = result["backup_id"]

        # Restore to new location
        restore_dir = tmp_path / "restored"
        restore_result = manager.restore_backup(backup_id, str(restore_dir))
        assert restore_result["success"] is True

        manager.close()


class TestObsidianServiceIntegration:
    """ObsidianService integration tests."""

    def test_obsidian_service_initialization(self):
        """Test ObsidianService initialization."""
        from src.services.obsidian_service import ObsidianService

        service = ObsidianService()
        assert service is not None

    def test_obsidian_vault_discovery(self):
        """Test vault discovery (may return empty list if no vaults)."""
        from src.services.obsidian_service import ObsidianService

        service = ObsidianService()
        vaults = service.discover_vaults()

        # Should return a list (may be empty)
        assert isinstance(vaults, list)

    def test_obsidian_get_vault_by_name_not_found(self):
        """Test getting non-existent vault by name."""
        from src.services.obsidian_service import ObsidianService

        service = ObsidianService()
        vault = service.get_vault_by_name("NonExistentVault12345")
        assert vault is None


class TestServiceLayerConcurrency:
    """Test service layer under concurrent access."""

    def test_token_service_concurrent_records(self, tmp_path):
        """Test TokenService handles concurrent usage records."""
        from src.services.token_service import TokenService
        import threading

        service = TokenService(db_path=str(tmp_path / "token.db"))
        errors = []

        def record_usage(session_id: str):
            try:
                for i in range(5):
                    service.record_usage(
                        tokens=100,
                        cost=0.01,
                        model="gpt-4o",
                        session_id=session_id
                    )
            except Exception as e:
                errors.append(e)

        threads = [
            threading.Thread(target=record_usage, args=(f"session-{i}",))
            for i in range(3)
        ]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        service.close()
