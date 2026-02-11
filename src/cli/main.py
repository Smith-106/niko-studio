"""
Niko Studio CLI - Main Entry Point
===================================

Click-based CLI application with command groups for:
- init: Project/session initialization
- run: Workflow execution
- chat: Interactive REPL
- evaluate: Content evaluation
- export: Export to various formats
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

    A multi-agent collaborative writing system with workflow orchestration,
    memory management, and narrative evaluation capabilities.
    """
    ctx.ensure_object(dict)
    ctx.obj["console"] = console


# Import and register commands
from src.cli.commands.init import init
from src.cli.commands.run import run
from src.cli.commands.chat import chat
from src.cli.commands.evaluate import evaluate
from src.cli.commands.export import export

cli.add_command(init)
cli.add_command(run)
cli.add_command(chat)
cli.add_command(evaluate)
cli.add_command(export)


def main() -> None:
    """CLI entry point."""
    cli(obj={})


if __name__ == "__main__":
    main()
