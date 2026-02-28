"""
Nowledge Mem TUI - Terminal User Interface for memory management.

This module re-exports the TUI from nmem-cli package.
The source of truth is in packages/nmem-cli/src/nmem_cli/tui/

Launch with: nmem tui

For Textual dev mode:
    python -m textual run --dev nmem_cli.tui

For standalone installation: pip install nmem-cli
"""

# Re-export everything from nmem_cli.tui
from nmem_cli.tui import NowledgeMemApp, run_tui, app

__all__ = ["NowledgeMemApp", "run_tui", "app"]
