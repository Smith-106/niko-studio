"""
run command - Workflow Execution
================================

Executes writing workflows with configurable levels (L1-L5).
"""

import asyncio
import click
from pathlib import Path
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel
from rich.table import Table


@click.command()
@click.option(
    "--task", "-t",
    required=True,
    help="Task description to execute"
)
@click.option(
    "--level", "-l",
    type=click.Choice(["1", "2", "3", "4", "5", "auto"]),
    default="auto",
    help="Workflow level (1-5 or auto)"
)
@click.option(
    "--session", "-s",
    help="Session ID to use (optional)"
)
@click.option(
    "--dry-run",
    is_flag=True,
    help="Show plan without executing"
)
@click.pass_context
def run(ctx: click.Context, task: str, level: str, session: str, dry_run: bool) -> None:
    """Execute a writing workflow.

    Workflow levels:
    - L1: Quick response (direct answer)
    - L2: Paragraph generation (with skill matching)
    - L3: Chapter creation (plan-act mode)
    - L4: Multi-chapter (state management)
    - L5: Full orchestration (outline to draft)
    """
    console: Console = ctx.obj.get("console", Console())

    console.print(f"\n[bold blue]Niko Studio - Workflow Execution[/]")
    console.print(f"[dim]Task:[/] {task[:100]}{'...' if len(task) > 100 else ''}")

    # Run async workflow
    asyncio.run(_run_workflow(console, task, level, session, dry_run))


async def _run_workflow(
    console: Console,
    task: str,
    level: str,
    session: str,
    dry_run: bool
) -> None:
    """Execute workflow asynchronously."""

    try:
        from src.workflow.workflow_engine import WorkflowEngine
    except ImportError:
        console.print("[red]Error:[/] WorkflowEngine not available")
        return

    engine = WorkflowEngine()

    # Route task to appropriate level
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        progress.add_task("Analyzing task complexity...", total=None)
        routing = await engine.route(task)

    # Display routing result
    console.print(f"\n[bold]Routing Result:[/]")
    console.print(f"  Level: [cyan]{routing['level']}[/]")
    console.print(f"  Description: {routing['description']}")
    console.print(f"  Reason: {routing['reason']}")

    # Override level if specified
    if level != "auto":
        level_map = {
            "1": "L1-Rapid",
            "2": "L2-Lite",
            "3": "L3-Standard",
            "4": "L4-Brainstorm",
            "5": "L5-Coordinator"
        }
        routing["level"] = level_map.get(level, routing["level"])
        console.print(f"  [yellow]Override:[/] Using {routing['level']}")

    # Generate plan
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        progress.add_task("Generating execution plan...", total=None)
        plan = await engine.plan(task, level=routing["level"])

    # Display plan
    table = Table(title=f"Execution Plan: {plan['plan_id']}")
    table.add_column("Step", style="cyan")
    table.add_column("Name", style="white")
    table.add_column("Description", style="dim")
    table.add_column("Status", style="green")

    for step in plan["steps"]:
        table.add_row(
            step["id"].split("-")[-1],
            step["name"],
            step["description"],
            step["status"]
        )

    console.print(table)

    if dry_run:
        console.print("\n[yellow]Dry run mode - execution skipped[/]")
        return

    # Execute plan
    console.print("\n[bold]Executing workflow...[/]")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task_progress = progress.add_task("Executing steps...", total=len(plan["steps"]))

        while True:
            result = await engine.execute(plan["plan_id"])

            if "error" in result:
                console.print(f"[red]Error:[/] {result['error']}")
                break

            if result.get("status") == "completed" or result.get("plan_status") == "completed":
                progress.update(task_progress, completed=len(plan["steps"]))
                break

            progress.update(
                task_progress,
                advance=1,
                description=f"Completed: {result.get('step_name', 'step')}"
            )

    # Final status
    final_status = engine.get_plan_status(plan["plan_id"])

    summary = f"""
[bold]Plan ID:[/] {final_status['plan_id']}
[bold]Status:[/] [green]{final_status['status']}[/]
[bold]Progress:[/] {final_status['progress']}
"""
    console.print(Panel(summary, title="[green]Workflow Complete[/]", border_style="green"))
