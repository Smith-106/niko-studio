"""
project-tech command - metadata refresh orchestration
=====================================================
"""

from __future__ import annotations

import json
from pathlib import Path

import click
from rich.console import Console
from rich.panel import Panel

from src.workflow.project_tech import refresh_project_tech_metadata


@click.command(name="project-tech-refresh")
@click.option(
    "--workspace",
    type=click.Path(path_type=Path, file_okay=False, resolve_path=True),
    default=".",
    show_default=True,
    help="Workspace root path",
)
@click.option(
    "--source",
    default="cli:manual",
    show_default=True,
    help="Metadata generation source label",
)
@click.option(
    "--ttl-hours",
    type=int,
    default=168,
    show_default=True,
    help="Freshness TTL in hours",
)
@click.option(
    "--json-output",
    is_flag=True,
    help="Print raw JSON output",
)
@click.pass_context
def project_tech_refresh_cmd(
    ctx: click.Context,
    workspace: Path,
    source: str,
    ttl_hours: int,
    json_output: bool,
) -> None:
    """Refresh `.workflow/project-tech.json` freshness metadata."""
    console: Console = ctx.obj.get("console", Console())

    try:
        result = refresh_project_tech_metadata(
            workspace,
            source=source,
            ttl_hours=ttl_hours,
        )
    except (FileNotFoundError, ValueError, OSError) as exc:
        console.print(f"[red]project-tech refresh failed:[/] {exc}")
        raise click.Abort() from exc

    if json_output:
        console.print_json(json.dumps(result, ensure_ascii=False))
        return

    freshness = result.get("freshness", {})
    language_counts = result.get("language_file_counts", {})

    summary_lines = [
        f"path: {result.get('path', '')}",
        f"generated_at: {freshness.get('generated_at', '')}",
        f"source: {freshness.get('source', '')}",
        f"schema_version: {freshness.get('schema_version', '')}",
        f"ttl_hours: {freshness.get('ttl_hours', '')}",
    ]
    if language_counts:
        summary_lines.append(
            "language_file_counts: "
            + ", ".join(f"{k}={v}" for k, v in sorted(language_counts.items()))
        )

    console.print(
        Panel(
            "\n".join(summary_lines),
            title="Project-Tech Refresh",
            border_style="green",
        )
    )
