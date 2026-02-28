"""
guided-draft command - Guided Idea-to-Draft Session
===================================================

Runs a deterministic guided session from idea input to first draft output.
"""

import asyncio
import json
import re
from typing import Any, Dict, List, Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from src.cli.commands.genre_profile import (
    GENRE_CHOICES,
    merge_controls_with_genre,
)


STYLE_CHOICES = ("neutral", "cinematic", "lyrical", "minimal")
LENGTH_CHOICES = ("short", "medium", "long")
@click.command(name="guided-draft")
@click.option(
    "--idea",
    "-i",
    required=True,
    help="Idea input for guided draft generation",
)
@click.option(
    "--style",
    type=click.Choice(STYLE_CHOICES, case_sensitive=False),
    default="neutral",
    show_default=True,
    help="Draft style profile",
)
@click.option(
    "--length",
    type=click.Choice(LENGTH_CHOICES, case_sensitive=False),
    default="medium",
    show_default=True,
    help="Draft length profile",
)
@click.option(
    "--constraint",
    "constraints",
    multiple=True,
    help="Draft constraint (repeatable)",
)
@click.option(
    "--max-steps",
    type=int,
    default=20,
    show_default=True,
    help="Maximum execute iterations before stopping",
)
@click.option(
    "--genre",
    type=click.Choice(GENRE_CHOICES, case_sensitive=False),
    default="none",
    show_default=True,
    help="Optional genre profile for generation logic",
)
@click.option(
    "--json-output",
    is_flag=True,
    help="Print raw JSON output",
)
@click.option(
    "--session",
    default="",
    show_default=False,
    help="Existing session id to bind this guided draft run",
)
@click.option(
    "--namespace",
    default="",
    show_default=False,
    help="Optional session namespace for isolation",
)
@click.pass_context
def guided_draft(
    ctx: click.Context,
    idea: str,
    style: str,
    length: str,
    constraints: tuple[str, ...],
    max_steps: int,
    genre: str,
    json_output: bool,
    session: str,
    namespace: str,
) -> None:
    """Start a guided idea-to-draft session."""
    console: Console = ctx.obj.get("console", Console())

    cleaned_idea = idea.strip()
    if not cleaned_idea:
        raise click.BadParameter("idea cannot be empty", param_hint="--idea")

    if max_steps < 1:
        raise click.BadParameter("max-steps must be >= 1", param_hint="--max-steps")

    normalized_style = (style or "neutral").strip().lower()
    normalized_length = (length or "medium").strip().lower()
    normalized_constraints = [item.strip() for item in constraints if item and item.strip()]
    if len(normalized_constraints) != len(constraints):
        raise click.BadParameter("constraint cannot be empty", param_hint="--constraint")

    control_bundle = {
        "style": normalized_style,
        "length": normalized_length,
        "constraints": normalized_constraints,
    }
    merged_controls = merge_controls_with_genre(control_bundle, genre)

    asyncio.run(
        _run_guided_draft(
            console,
            cleaned_idea,
            controls=merged_controls,
            session=session,
            namespace=namespace,
            max_steps=max_steps,
            json_output=json_output,
        )
    )


def _controls_to_recommendations(controls: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        {
            "action": "set_generation_controls",
            "target": "draft",
            "params": {
                "style": controls.get("style", "neutral"),
                "length": controls.get("length", "medium"),
                "constraints": list(controls.get("constraints", [])),
            },
        }
    ]


def _normalize_namespace(namespace: str) -> str:
    normalized = re.sub(r"[^a-z0-9_-]+", "-", (namespace or "").strip().lower()).strip("-")
    return normalized


async def _run_guided_draft(
    console: Console,
    idea: str,
    *,
    controls: Optional[Dict[str, Any]] = None,
    session: str = "",
    namespace: str = "",
    max_steps: int,
    json_output: bool,
) -> None:
    try:
        from src.workflow.workflow_engine import WorkflowEngine
    except ImportError:
        console.print("[red]Error:[/] WorkflowEngine not available")
        return

    normalized_controls = controls or {"style": "neutral", "length": "medium", "constraints": []}
    control_recommendations = _controls_to_recommendations(normalized_controls)

    try:
        engine = WorkflowEngine(session_namespace=namespace)
    except TypeError:
        engine = WorkflowEngine()

    normalized_namespace = _normalize_namespace(namespace)
    if session and normalized_namespace and not session.startswith(f"{normalized_namespace}--"):
        console.print("[red]Error:[/] session does not match namespace isolation boundary")
        return
    stage_trace: List[Dict[str, Any]] = []

    stage_trace.append({"stage": "validate_input", "status": "completed", "controls": normalized_controls})

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        progress.add_task("Routing guided session...", total=None)
        routing = await engine.route(idea)

    stage_trace.append(
        {
            "stage": "route",
            "status": "completed",
            "level": routing.get("level"),
            "level_slug": routing.get("level_slug"),
        }
    )

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        progress.add_task("Planning deterministic draft workflow...", total=None)
        try:
            plan = await engine.plan(idea, level="L3-Standard", recommendations=control_recommendations)
        except TypeError:
            plan = await engine.plan(idea, level="L3-Standard")

    if session:
        engine.plan_sessions[plan["plan_id"]] = session

    stage_trace.append(
        {
            "stage": "plan",
            "status": "completed",
            "plan_id": plan.get("plan_id"),
            "level": plan.get("level"),
        }
    )

    draft_output: Optional[Dict[str, Any]] = None
    execute_count = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        progress.add_task("Executing guided stages...", total=None)

        for _ in range(max_steps):
            result = await engine.execute(plan["plan_id"])
            execute_count += 1

            if "error" in result:
                console.print(f"[red]Error:[/] {result['error']}")
                return

            step_name = result.get("step_name") or "unknown"
            step_status = result.get("status") or "unknown"
            stage_trace.append(
                {
                    "stage": "execute",
                    "status": step_status,
                    "step_name": step_name,
                    "plan_status": result.get("plan_status"),
                }
            )

            if step_name == "generate_draft" and step_status == "completed":
                payload = result.get("result")
                if isinstance(payload, dict):
                    draft_output = payload
                break

            if result.get("plan_status") == "completed":
                break

    if draft_output is None:
        final_status = engine.get_plan_status(plan["plan_id"])
        for step in final_status.get("steps", []):
            if step.get("name") == "generate_draft" and isinstance(step.get("output"), dict):
                draft_output = step["output"]
                break

    if draft_output is None:
        console.print("[red]Error:[/] Guided session ended before draft generation")
        return

    output_payload = {
        "idea": idea,
        "controls": normalized_controls,
        "plan_id": plan.get("plan_id"),
        "level": plan.get("level"),
        "routing": {
            "level": routing.get("level"),
            "level_slug": routing.get("level_slug"),
            "reason": routing.get("reason"),
        },
        "execute_iterations": execute_count,
        "stage_trace": stage_trace,
        "draft": draft_output.get("draft", ""),
        "section_count": draft_output.get("section_count", 0),
    }

    if json_output:
        console.print_json(json.dumps(output_payload, ensure_ascii=False))
        return

    draft_text = output_payload["draft"]
    stage_lines = [f"- {item['stage']}: {item['status']}" for item in stage_trace]
    panel_text = (
        f"[bold]Plan ID:[/] {output_payload['plan_id']}\n"
        f"[bold]Level:[/] {output_payload['level']}\n"
        f"[bold]Style:[/] {normalized_controls['style']}\n"
        f"[bold]Length:[/] {normalized_controls['length']}\n"
        f"[bold]Constraints:[/] {len(normalized_controls['constraints'])}\n"
        f"[bold]Execute Iterations:[/] {execute_count}\n\n"
        f"[bold]Stage Trace:[/]\n" + "\n".join(stage_lines)
    )
    console.print(Panel(panel_text, title="[green]Guided Session Complete[/]", border_style="green"))

    if draft_text:
        console.print("\n[bold]First Draft:[/]")
        console.print(draft_text)
