"""
Config Endpoints Tests

Tests for GET/PUT /config, GET/PUT /config/secrets, POST /config/reload endpoints.
"""

import pytest
from unittest.mock import MagicMock, patch
from starlette.testclient import TestClient
import src.config as config_module


class TestGetConfig:
    """Tests for GET /config endpoint"""

    def test_get_config_returns_200(self, client_no_lifespan):
        """Test GET /config returns 200 status"""
        response = client_no_lifespan.get("/config")
        assert response.status_code == 200

    def test_get_config_returns_all_sections(self, client_no_lifespan):
        """Test GET /config returns all 10 config sections"""
        response = client_no_lifespan.get("/config")
        data = response.json()

        assert data["status"] == "ok"
        config = data["config"]

        # Verify all 10 sections are present
        expected_sections = [
            "agent", "memory", "workflow", "graph", "writing",
            "backup", "token", "obsidian", "gateway", "integration"
        ]
        for section in expected_sections:
            assert section in config, f"Missing section: {section}"

    def test_get_config_masks_secrets(self, client_no_lifespan, monkeypatch):
        """Test GET /config masks secret fields"""
        # Create mock config with secret values
        from dataclasses import dataclass, field
        from typing import List

        @dataclass
        class MockAgentConfig:
            default_model: str = "gpt-4o"
            google_api_key: str = "secret-google-key"
            openai_api_key: str = "secret-openai-key"
            max_cost_per_request: float = 1.0
            max_cost_per_session: float = 10.0
            max_tokens_per_request: int = 100000
            budget_warn_threshold: float = 0.8
            log_level: str = "INFO"

        @dataclass
        class MockBackupConfig:
            backup_dir: str = ".writing/backups"
            compress: bool = True
            max_backups: int = 50
            webdav_enabled: bool = False
            webdav_url: str = ""
            webdav_username: str = ""
            webdav_password: str = "secret-webdav-password"
            webdav_remote_path: str = "/backups"
            s3_enabled: bool = False
            s3_bucket: str = ""
            s3_prefix: str = "backups"
            s3_region: str = "us-east-1"

        @dataclass
        class MockAppConfig:
            app_name: str = "niko-studio"
            version: str = "0.1.0"
            debug: bool = False
            env: str = "development"
            data_dir: str = ".writing"
            log_dir: str = "logs"
            agent: MockAgentConfig = field(default_factory=MockAgentConfig)
            backup: MockBackupConfig = field(default_factory=MockBackupConfig)

        mock_config = MockAppConfig()

        # Patch get_config to return mock
        monkeypatch.setattr(config_module, "get_config", lambda: mock_config)

        response = client_no_lifespan.get("/config")
        data = response.json()

        assert data["status"] == "ok"
        config = data["config"]

        # Verify secrets are masked
        assert config["agent"]["google_api_key"] == "***MASKED***"
        assert config["agent"]["openai_api_key"] == "***MASKED***"
        assert config["backup"]["webdav_password"] == "***MASKED***"

    def test_get_config_masks_empty_secrets_as_empty(self, client_no_lifespan, monkeypatch):
        """Test GET /config does not mask empty secret fields"""
        from dataclasses import dataclass, field

        @dataclass
        class MockAgentConfig:
            default_model: str = "gpt-4o"
            google_api_key: str = ""  # Empty secret
            openai_api_key: str = ""  # Empty secret
            max_cost_per_request: float = 1.0
            max_cost_per_session: float = 10.0
            max_tokens_per_request: int = 100000
            budget_warn_threshold: float = 0.8
            log_level: str = "INFO"

        @dataclass
        class MockAppConfig:
            app_name: str = "niko-studio"
            version: str = "0.1.0"
            debug: bool = False
            env: str = "development"
            data_dir: str = ".writing"
            log_dir: str = "logs"
            agent: MockAgentConfig = field(default_factory=MockAgentConfig)

        mock_config = MockAppConfig()

        monkeypatch.setattr(config_module, "get_config", lambda: mock_config)

        response = client_no_lifespan.get("/config")
        data = response.json()

        # Empty secrets should remain empty (not masked)
        assert data["config"]["agent"]["google_api_key"] == ""
        assert data["config"]["agent"]["openai_api_key"] == ""


class TestUpdateConfig:
    """Tests for PUT /config endpoint"""

    def test_update_config_modifiable_field_returns_200(self, client_no_lifespan, monkeypatch):
        """Test PUT /config with modifiable field returns 200"""
        mock_set = MagicMock()
        mock_get = MagicMock(return_value="gpt-4o")

        monkeypatch.setattr(config_module, "set_config_value", mock_set)
        monkeypatch.setattr(config_module, "get_config_value", mock_get)

        response = client_no_lifespan.put("/config", json={
            "fields": {
                "agent.default_model": "gpt-4o-mini"
            }
        })

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "agent.default_model" in data["updated"]
        mock_set.assert_called_once_with("agent.default_model", "gpt-4o-mini")

    def test_update_config_non_modifiable_field_returns_400(self, client_no_lifespan):
        """Test PUT /config with non-modifiable field returns 400"""
        response = client_no_lifespan.put("/config", json={
            "fields": {
                "gateway.port": 9000
            }
        })

        assert response.status_code == 400
        data = response.json()
        assert "errors" in data
        assert any(e["field"] == "gateway.port" for e in data["errors"])

    def test_update_config_empty_fields_returns_400(self, client_no_lifespan):
        """Test PUT /config with no fields returns 400"""
        response = client_no_lifespan.put("/config", json={
            "fields": {}
        })

        assert response.status_code == 400
        data = response.json()
        assert "error" in data

    def test_update_config_multiple_fields(self, client_no_lifespan, monkeypatch):
        """Test PUT /config with multiple fields"""
        mock_set = MagicMock()
        mock_get = MagicMock(return_value="default")

        monkeypatch.setattr(config_module, "set_config_value", mock_set)
        monkeypatch.setattr(config_module, "get_config_value", mock_get)

        response = client_no_lifespan.put("/config", json={
            "fields": {
                "workflow.quality_level": "ultra",
                "workflow.quality_mode": "manual",
                "agent.log_level": "DEBUG"
            }
        })

        assert response.status_code == 200
        data = response.json()
        assert len(data["updated"]) == 3


class TestGetSecrets:
    """Tests for GET /config/secrets endpoint"""

    def test_get_secrets_returns_200(self, client_no_lifespan):
        """Test GET /config/secrets returns 200 status"""
        response = client_no_lifespan.get("/config/secrets")
        assert response.status_code == 200

    def test_get_secrets_returns_all_secret_fields(self, client_no_lifespan):
        """Test GET /config/secrets returns all secret fields"""
        response = client_no_lifespan.get("/config/secrets")
        data = response.json()

        assert data["status"] == "ok"
        secrets = data["secrets"]

        expected_secrets = [
            "agent.google_api_key",
            "agent.openai_api_key",
            "backup.webdav_password"
        ]
        for secret in expected_secrets:
            assert secret in secrets
            assert "configured" in secrets[secret]
            assert "value" in secrets[secret]

    def test_get_secrets_masks_values(self, client_no_lifespan, monkeypatch):
        """Test GET /config/secrets never exposes actual values"""
        response = client_no_lifespan.get("/config/secrets")
        data = response.json()

        secrets = data["secrets"]
        for secret_path, info in secrets.items():
            # Values should always be masked or empty
            if info["configured"]:
                assert info["value"] == "***MASKED***"
            else:
                assert info["value"] == ""


class TestUpdateSecrets:
    """Tests for PUT /config/secrets endpoint"""

    def test_update_secrets_valid_field_returns_200(self, client_no_lifespan, monkeypatch):
        """Test PUT /config/secrets with valid secret field returns 200"""
        mock_set = MagicMock()

        monkeypatch.setattr(config_module, "set_config_value", mock_set)

        response = client_no_lifespan.put("/config/secrets", json={
            "secrets": {
                "agent.google_api_key": "new-api-key"
            }
        })

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "agent.google_api_key" in data["updated"]
        mock_set.assert_called_once_with("agent.google_api_key", "new-api-key")

    def test_update_secrets_non_secret_field_returns_400(self, client_no_lifespan):
        """Test PUT /config/secrets with non-secret field returns 400"""
        response = client_no_lifespan.put("/config/secrets", json={
            "secrets": {
                "agent.default_model": "new-model"
            }
        })

        assert response.status_code == 400
        data = response.json()
        assert "errors" in data
        assert any("not a secret field" in e["error"] for e in data["errors"])

    def test_update_secrets_empty_returns_400(self, client_no_lifespan):
        """Test PUT /config/secrets with no secrets returns 400"""
        response = client_no_lifespan.put("/config/secrets", json={
            "secrets": {}
        })

        assert response.status_code == 400
        data = response.json()
        assert "error" in data


class TestReloadConfig:
    """Tests for POST /config/reload endpoint"""

    def test_reload_config_returns_200(self, client_no_lifespan, monkeypatch):
        """Test POST /config/reload returns 200 status"""
        mock_manager = MagicMock()

        monkeypatch.setattr(config_module, "_config_manager", mock_manager)

        response = client_no_lifespan.post("/config/reload")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        mock_manager.reload.assert_called_once()

    def test_reload_config_no_manager_returns_500(self, client_no_lifespan, monkeypatch):
        """Test POST /config/reload returns 500 when manager not initialized"""
        monkeypatch.setattr(config_module, "_config_manager", None)

        response = client_no_lifespan.post("/config/reload")

        assert response.status_code == 500
        data = response.json()
        assert "error" in data
