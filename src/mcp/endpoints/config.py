"""
Config REST Endpoints

Configuration management HTTP endpoints for Desktop frontend.
"""

import logging
from typing import Any, Dict, List

from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("niko-gateway")

# Fields that should be masked in responses (secrets)
SECRET_FIELDS: List[str] = [
    "agent.google_api_key",
    "agent.openai_api_key",
    "backup.webdav_password",
]

# Fields that can be modified via API (whitelist)
# Exclude: host, port, paths, db configs, integration feature flags
MODIFIABLE_FIELDS: List[str] = [
    # Agent config
    "agent.default_model",
    "agent.max_cost_per_request",
    "agent.max_cost_per_session",
    "agent.max_tokens_per_request",
    "agent.budget_warn_threshold",
    "agent.log_level",
    # Memory config
    "memory.cache_enabled",
    "memory.cache_ttl",
    "memory.cache_max_size",
    "memory.chunk_size",
    "memory.chunk_overlap",
    # Workflow config
    "workflow.session_timeout",
    "workflow.max_concurrent_sessions",
    "workflow.checkpoint_enabled",
    "workflow.checkpoint_interval",
    "workflow.resume_strategy",
    "workflow.quality_mode",
    "workflow.quality_level",
    "workflow.degrade_on_timeout",
    "workflow.degrade_on_error",
    "workflow.critical_gate_always_on",
    "workflow.quality_phase_timeout_seconds",
    # Writing config
    "writing.character_depth_dimensions",
    "writing.max_character_traits",
    "writing.scene_coherence_threshold",
    "writing.contradiction_sensitivity",
    "writing.foreshadowing_max_distance",
    "writing.foreshadowing_reminder_threshold",
    "writing.style_vector_dimensions",
    "writing.style_sample_min_words",
    # Backup config
    "backup.backup_dir",
    "backup.compress",
    "backup.max_backups",
    "backup.webdav_enabled",
    "backup.webdav_url",
    "backup.webdav_username",
    "backup.webdav_remote_path",
    "backup.s3_enabled",
    "backup.s3_bucket",
    "backup.s3_prefix",
    "backup.s3_region",
    # Token config
    "token.default_budget",
    "token.budget_warn_threshold",
    # Obsidian config
    "obsidian.enabled",
    "obsidian.auto_discover",
    "obsidian.sync_on_startup",
    "obsidian.default_vault",
    # Gateway config (limited)
    "gateway.metrics_enabled",
    "gateway.ui_bridge_enabled",
]

MASKED_VALUE = "***MASKED***"


def _mask_secrets(config_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively mask secret fields in config dictionary.

    Args:
        config_dict: Configuration dictionary

    Returns:
        Configuration dictionary with secrets masked
    """
    result = {}

    for key, value in config_dict.items():
        if isinstance(value, dict):
            result[key] = _mask_secrets(value)
        else:
            result[key] = value

    # Mask secrets using dot notation paths
    for secret_path in SECRET_FIELDS:
        parts = secret_path.split(".")
        if len(parts) == 2:
            section, field = parts
            if section in result and field in result.get(section, {}):
                if result[section].get(field):  # Only mask non-empty values
                    result[section][field] = MASKED_VALUE

    return result


def _set_nested_value(config_dict: Dict[str, Any], key: str, value: Any) -> bool:
    """
    Set a nested value using dot notation.

    Args:
        config_dict: Configuration dictionary
        key: Dot-separated key path (e.g., "agent.default_model")
        value: Value to set

    Returns:
        True if successful, False if path not found
    """
    parts = key.split(".")
    if len(parts) != 2:
        return False

    section, field = parts
    if section not in config_dict:
        return False

    if field not in config_dict[section]:
        return False

    config_dict[section][field] = value
    return True


async def get_config(request: Request) -> JSONResponse:
    """
    Get current configuration with secrets masked.

    Returns:
        JSONResponse with configuration dictionary
    """
    from src.config import get_config

    try:
        config = get_config()
        # Convert to dict using dataclasses.asdict
        import dataclasses
        config_dict = dataclasses.asdict(config)

        # Mask secrets
        masked_config = _mask_secrets(config_dict)

        return JSONResponse({
            "status": "ok",
            "config": masked_config,
        })
    except Exception as e:
        logger.error(f"Failed to get config: {e}")
        return JSONResponse(
            {"error": f"Failed to get configuration: {str(e)}"},
            status_code=500
        )


async def update_config(request: Request) -> JSONResponse:
    """
    Update configuration fields.

    Request body:
        {
            "fields": {
                "agent.default_model": "gpt-4o-mini",
                "workflow.quality_level": "high"
            }
        }

    Returns:
        JSONResponse with updated fields and any errors
    """
    from src.config import get_config_value, set_config_value

    try:
        body = await request.json()
        fields = body.get("fields", {})

        if not fields:
            return JSONResponse(
                {"error": "No fields provided for update"},
                status_code=400
            )

        updated: List[str] = []
        errors: List[Dict[str, str]] = []

        for key, value in fields.items():
            # Validate field is modifiable
            if key not in MODIFIABLE_FIELDS:
                errors.append({
                    "field": key,
                    "error": f"Field '{key}' is not modifiable via API"
                })
                continue

            # Validate field exists
            current_value = get_config_value(key)
            if current_value is None and key not in [
                # These fields may have empty/None default values
                "backup.webdav_url",
                "backup.webdav_username",
                "backup.webdav_remote_path",
                "backup.s3_bucket",
                "backup.s3_prefix",
                "obsidian.default_vault",
            ]:
                # Check if it's a valid field path
                parts = key.split(".")
                if len(parts) != 2:
                    errors.append({
                        "field": key,
                        "error": f"Invalid field path: {key}"
                    })
                    continue

            # Set the value
            try:
                set_config_value(key, value)
                updated.append(key)
                logger.info(f"Config updated: {key} = {value}")
            except Exception as e:
                errors.append({
                    "field": key,
                    "error": str(e)
                })

        response: Dict[str, Any] = {"status": "ok"}
        if updated:
            response["updated"] = updated
        if errors:
            response["errors"] = errors

        return JSONResponse(response, status_code=200 if not errors else 400)

    except Exception as e:
        logger.error(f"Failed to update config: {e}")
        return JSONResponse(
            {"error": f"Failed to update configuration: {str(e)}"},
            status_code=500
        )


async def get_secrets(request: Request) -> JSONResponse:
    """
    Get secret fields status (masked values only).

    Returns:
        JSONResponse with secret field names and their masked status
    """
    from src.config import get_config_value

    try:
        secrets_status: Dict[str, Any] = {}

        for secret_path in SECRET_FIELDS:
            value = get_config_value(secret_path)
            # Only show if the secret is configured (non-empty)
            secrets_status[secret_path] = {
                "configured": bool(value),
                "value": MASKED_VALUE if value else ""
            }

        return JSONResponse({
            "status": "ok",
            "secrets": secrets_status,
        })
    except Exception as e:
        logger.error(f"Failed to get secrets: {e}")
        return JSONResponse(
            {"error": f"Failed to get secrets: {str(e)}"},
            status_code=500
        )


async def update_secrets(request: Request) -> JSONResponse:
    """
    Update secret configuration fields.

    Request body:
        {
            "secrets": {
                "agent.google_api_key": "new-key",
                "backup.webdav_password": "new-password"
            }
        }

    Returns:
        JSONResponse with updated secret field names
    """
    from src.config import set_config_value

    try:
        body = await request.json()
        secrets = body.get("secrets", {})

        if not secrets:
            return JSONResponse(
                {"error": "No secrets provided for update"},
                status_code=400
            )

        updated: List[str] = []
        errors: List[Dict[str, str]] = []

        for key, value in secrets.items():
            # Validate field is a secret field
            if key not in SECRET_FIELDS:
                errors.append({
                    "field": key,
                    "error": f"Field '{key}' is not a secret field"
                })
                continue

            # Set the value
            try:
                set_config_value(key, value)
                updated.append(key)
                logger.info(f"Secret updated: {key}")
            except Exception as e:
                errors.append({
                    "field": key,
                    "error": str(e)
                })

        response: Dict[str, Any] = {"status": "ok"}
        if updated:
            response["updated"] = updated
        if errors:
            response["errors"] = errors

        return JSONResponse(response, status_code=200 if not errors else 400)

    except Exception as e:
        logger.error(f"Failed to update secrets: {e}")
        return JSONResponse(
            {"error": f"Failed to update secrets: {str(e)}"},
            status_code=500
        )


async def reload_config(request: Request) -> JSONResponse:
    """
    Reload configuration from file.

    Returns:
        JSONResponse with reload status
    """
    from src.config import _config_manager

    try:
        if _config_manager is None:
            return JSONResponse(
                {"error": "Config manager not initialized"},
                status_code=500
            )

        _config_manager.reload()
        logger.info("Configuration reloaded from file")

        return JSONResponse({
            "status": "ok",
            "message": "Configuration reloaded successfully"
        })
    except Exception as e:
        logger.error(f"Failed to reload config: {e}")
        return JSONResponse(
            {"error": f"Failed to reload configuration: {str(e)}"},
            status_code=500
        )


__all__ = [
    "get_config",
    "update_config",
    "get_secrets",
    "update_secrets",
    "reload_config",
]
