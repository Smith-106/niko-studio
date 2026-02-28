"""
Nowledge Mem CLI - AI agent-friendly memory management.

This module re-exports the CLI from nmem-cli package.
The source of truth is in packages/nmem-cli/src/nmem_cli/cli.py

For standalone installation: pip install nmem-cli
"""

# Re-export everything from nmem_cli
from nmem_cli import main
from nmem_cli.cli import (
    # Core functions
    create_parser,
    set_json_mode,
    is_json_mode,
    get_api_url,
    output_json,
    print_error,
    print_success,
    # API functions
    api_get,
    api_post,
    api_delete,
    api_patch,
    # Utility functions
    format_date,
    truncate,
    format_score,
    format_importance,
    parse_time_filter,
    # Command functions
    cmd_status,
    cmd_stats,
    cmd_memories_list,
    cmd_memories_search,
    cmd_memories_show,
    cmd_memories_add,
    cmd_memories_update,
    cmd_memories_delete,
    cmd_threads_list,
    cmd_threads_show,
    cmd_threads_search,
    cmd_threads_create,
    cmd_threads_delete,
    cmd_models_status,
    cmd_models_download,
    cmd_models_reindex,
    cmd_serve,
    cmd_service_install,
    cmd_service_uninstall,
    cmd_service_status,
    cmd_service_start,
    cmd_service_stop,
    cmd_service_logs,
)

__all__ = [
    "main",
    "create_parser",
    "set_json_mode",
    "is_json_mode",
    "get_api_url",
    "output_json",
    "print_error",
    "print_success",
    "api_get",
    "api_post",
    "api_delete",
    "api_patch",
    "format_date",
    "truncate",
    "format_score",
    "format_importance",
    "parse_time_filter",
    "cmd_status",
    "cmd_stats",
    "cmd_memories_list",
    "cmd_memories_search",
    "cmd_memories_show",
    "cmd_memories_add",
    "cmd_memories_update",
    "cmd_memories_delete",
    "cmd_threads_list",
    "cmd_threads_show",
    "cmd_threads_search",
    "cmd_threads_create",
    "cmd_threads_delete",
    "cmd_models_status",
    "cmd_models_download",
    "cmd_models_reindex",
    "cmd_serve",
    "cmd_service_install",
    "cmd_service_uninstall",
    "cmd_service_status",
    "cmd_service_start",
    "cmd_service_stop",
    "cmd_service_logs",
]

if __name__ == "__main__":
    main()
