"""
Niko Studio CLI - Main Entry Point
===================================

Click-based CLI application with command groups for:
- init: Project/session initialization
- run: Workflow execution
- chat: Interactive REPL
- evaluate: Content evaluation
- export: Export to various formats
- project-tech-refresh: Refresh workflow metadata profile
"""

import click
from rich.console import Console

from src import __version__

console = Console()


@click.group()
@click.version_option(version=__version__, prog_name="niko")
@click.pass_context
def cli(ctx: click.Context) -> None:
    """Niko Studio - AI Writing Workbench CLI

    Single authoritative workflow execution entrypoint:
    - `run` (uses `WorkflowEngine`)

    Other command groups provide supporting capabilities (init/chat/evaluate/export/runtime).
    """
    ctx.ensure_object(dict)
    ctx.obj["console"] = console


# Import and register commands
from src.cli.commands.init import init
from src.cli.commands.run import run
from src.cli.commands.chat import chat
from src.cli.commands.evaluate import evaluate
from src.cli.commands.export import export
from src.cli.commands.runtime import status_cmd, stats_cmd, search_cmd, serve_cmd
from src.cli.commands.project_tech import project_tech_refresh_cmd
from src.cli.commands.guided_draft import guided_draft

cli.add_command(init)
cli.add_command(run)
cli.add_command(chat)
cli.add_command(evaluate)
cli.add_command(export)
cli.add_command(status_cmd)
cli.add_command(stats_cmd)
cli.add_command(search_cmd)
cli.add_command(serve_cmd)
cli.add_command(project_tech_refresh_cmd)
cli.add_command(guided_draft)


def main() -> None:
    """CLI entry point."""
    cli(obj={})


if __name__ == "__main__":
    main()
