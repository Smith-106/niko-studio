"""
init command - Project/Session Initialization
==============================================

Creates project structure and initializes session management.
"""

import click
from pathlib import Path
from datetime import datetime
from rich.console import Console
from rich.panel import Panel


@click.command()
@click.option(
    "--name", "-n",
    required=True,
    help="Project or session name"
)
@click.option(
    "--template", "-t",
    type=click.Choice(["novel", "short-story", "screenplay", "custom"]),
    default="novel",
    help="Project template type"
)
@click.option(
    "--path", "-p",
    type=click.Path(),
    default=".",
    help="Project root path"
)
@click.pass_context
def init(ctx: click.Context, name: str, template: str, path: str) -> None:
    """Initialize a new Niko Studio project or session.

    Creates the .niko/ directory structure with:
    - sessions/: Session data storage
    - memory/: Memory database
    - config/: Project configuration
    - drafts/: Draft versions
    """
    console: Console = ctx.obj.get("console", Console())
    project_path = Path(path).resolve()
    niko_dir = project_path / ".niko"

    console.print(f"\n[bold blue]Initializing Niko Studio project:[/] {name}")

    # Create directory structure
    dirs_to_create = [
        niko_dir / "sessions",
        niko_dir / "memory",
        niko_dir / "config",
        niko_dir / "drafts",
        niko_dir / "exports",
    ]

    for dir_path in dirs_to_create:
        dir_path.mkdir(parents=True, exist_ok=True)
        console.print(f"  [green]+[/] Created: {dir_path.relative_to(project_path)}")

    # Create session directory
    session_id = f"sess_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    session_dir = niko_dir / "sessions" / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    # Create project config
    config_content = f"""# Niko Studio Project Configuration
# Generated: {datetime.now().isoformat()}

project:
  name: "{name}"
  template: "{template}"
  created_at: "{datetime.now().isoformat()}"

memory:
  db_path: ".niko/memory/memory.db"
  vector_db_path: ".niko/memory/vectors.db"

workflow:
  default_level: 3
  max_revisions: 5

agents:
  commander:
    enabled: true
  architect:
    enabled: true
  writer:
    enabled: true
  critic:
    enabled: true
"""

    config_file = niko_dir / "config" / "project.yaml"
    config_file.write_text(config_content, encoding="utf-8")
    console.print(f"  [green]+[/] Created: {config_file.relative_to(project_path)}")

    # Initialize memory engine
    try:
        from src.memory.unified_memory import UnifiedMemoryEngine

        db_path = niko_dir / "memory" / "memory.db"
        engine = UnifiedMemoryEngine(db_path=str(db_path))
        console.print(f"  [green]+[/] Initialized memory engine")
        engine.close()
    except ImportError:
        console.print("  [yellow]![/] Memory engine not available (missing dependencies)")
    except Exception as e:
        console.print(f"  [yellow]![/] Memory engine init warning: {e}")

    # Summary panel
    summary = f"""
[bold]Project:[/] {name}
[bold]Template:[/] {template}
[bold]Session:[/] {session_id}
[bold]Location:[/] {niko_dir}
"""
    console.print(Panel(summary, title="[green]Project Initialized[/]", border_style="green"))

    console.print("\n[dim]Next steps:[/]")
    console.print("  1. Run [bold]niko chat[/] to start an interactive session")
    console.print("  2. Run [bold]niko run --task 'Your task'[/] to execute a workflow")
    console.print("")
