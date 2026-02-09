"""
evaluate command - Content Evaluation
=====================================

Evaluates writing content using the Critic agent and evaluation system.
"""

import asyncio
import click
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn


@click.command()
@click.argument("file", type=click.Path(exists=True), required=False)
@click.option(
    "--text", "-t",
    help="Text content to evaluate (alternative to file)"
)
@click.option(
    "--format", "-f",
    type=click.Choice(["full", "lock", "quality", "summary"]),
    default="full",
    help="Evaluation output format"
)
@click.option(
    "--output", "-o",
    type=click.Path(),
    help="Output file for evaluation results"
)
@click.pass_context
def evaluate(
    ctx: click.Context,
    file: str,
    text: str,
    format: str,
    output: str
) -> None:
    """Evaluate writing content quality.

    Provides LOCK scores (Lead, Objective, Confrontation, Knockout)
    and 8-dimensional quality assessment.

    Examples:
        niko evaluate chapter.md
        niko evaluate --text "Your content here"
        niko evaluate chapter.md --format lock
    """
    console: Console = ctx.obj.get("console", Console())

    # Get content
    if file:
        content = Path(file).read_text(encoding="utf-8")
        source = file
    elif text:
        content = text
        source = "inline"
    else:
        console.print("[red]Error:[/] Provide either a file or --text")
        return

    console.print(f"\n[bold blue]Niko Studio - Content Evaluation[/]")
    console.print(f"[dim]Source:[/] {source}")
    console.print(f"[dim]Length:[/] {len(content)} characters")

    # Run evaluation
    asyncio.run(_evaluate_content(console, content, format, output))


async def _evaluate_content(
    console: Console,
    content: str,
    format: str,
    output: str
) -> None:
    """Run content evaluation."""

    # Try to use actual evaluators
    lock_scores = {}
    quality_scores = {}
    analysis = ""

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        progress.add_task("Evaluating content...", total=None)

        try:
            from src.narrative.evaluators.critic_engine import CriticEngine
            critic = CriticEngine()
            result = await critic.evaluate(content)
            lock_scores = result.get("lock_scores", {})
            quality_scores = result.get("quality_scores", {})
            analysis = result.get("analysis", "")
        except ImportError:
            # Fallback: Generate mock scores based on content analysis
            lock_scores = _analyze_lock(content)
            quality_scores = _analyze_quality(content)
            analysis = "Evaluation performed with basic analysis (CriticEngine not available)"

    # Display results based on format
    if format in ["full", "lock"]:
        _display_lock_scores(console, lock_scores)

    if format in ["full", "quality"]:
        _display_quality_scores(console, quality_scores)

    if format in ["full", "summary"]:
        console.print("\n[bold]Analysis:[/]")
        console.print(Panel(analysis or "No detailed analysis available", border_style="dim"))

    # Calculate overall score
    lock_total = sum(lock_scores.values()) if lock_scores else 0
    quality_avg = sum(quality_scores.values()) / len(quality_scores) if quality_scores else 0

    summary = f"""
[bold]LOCK Score:[/] {lock_total}/40 {'[green](Pass)[/]' if lock_total >= 28 else '[red](Needs Work)[/]'}
[bold]Quality Avg:[/] {quality_avg:.1f}/100 {'[green](Good)[/]' if quality_avg >= 70 else '[yellow](Fair)[/]'}
"""
    console.print(Panel(summary, title="[bold]Summary[/]", border_style="blue"))

    # Save output if requested
    if output:
        import json
        result_data = {
            "lock_scores": lock_scores,
            "quality_scores": quality_scores,
            "lock_total": lock_total,
            "quality_average": quality_avg,
            "analysis": analysis
        }
        Path(output).write_text(
            json.dumps(result_data, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )
        console.print(f"\n[green]Results saved to {output}[/]")


def _display_lock_scores(console: Console, scores: dict) -> None:
    """Display LOCK scores."""
    table = Table(title="LOCK System Scores")
    table.add_column("Dimension", style="cyan")
    table.add_column("Score", justify="right", style="white")
    table.add_column("Max", justify="right", style="dim")
    table.add_column("Status", style="green")

    labels = {
        "L": "Lead (Hook/Opening)",
        "O": "Objective (Goal/Stakes)",
        "C": "Confrontation (Conflict)",
        "K": "Knockout (Resolution)"
    }

    for key, label in labels.items():
        score = scores.get(key, scores.get(f"{key} ({label.split()[0]})", 0))
        status = "[green]Good[/]" if score >= 7 else "[yellow]Fair[/]" if score >= 5 else "[red]Weak[/]"
        table.add_row(label, str(score), "10", status)

    console.print(table)


def _display_quality_scores(console: Console, scores: dict) -> None:
    """Display 8-dimensional quality scores."""
    table = Table(title="8-Dimensional Quality Assessment")
    table.add_column("Dimension", style="cyan")
    table.add_column("Score", justify="right", style="white")
    table.add_column("Status", style="green")

    for dim, score in scores.items():
        status = "[green]Excellent[/]" if score >= 80 else "[yellow]Good[/]" if score >= 60 else "[red]Improve[/]"
        table.add_row(dim, f"{score}/100", status)

    console.print(table)


def _analyze_lock(content: str) -> dict:
    """Basic LOCK analysis."""
    # Simple heuristics for demonstration
    words = content.split()
    word_count = len(words)

    # L: Check for strong opening
    first_para = content[:500] if len(content) > 500 else content
    l_score = min(10, 5 + (3 if "?" in first_para else 0) + (2 if len(first_para) > 100 else 0))

    # O: Check for goal/stakes indicators
    goal_words = ["must", "need", "want", "goal", "mission", "find", "save", "stop"]
    o_score = min(10, 5 + sum(2 for w in goal_words if w in content.lower()))

    # C: Check for conflict indicators
    conflict_words = ["but", "however", "against", "fight", "struggle", "conflict", "obstacle"]
    c_score = min(10, 4 + sum(1 for w in conflict_words if w in content.lower()))

    # K: Check for resolution structure
    k_score = min(10, 5 + (3 if word_count > 500 else 0) + (2 if "finally" in content.lower() or "end" in content.lower() else 0))

    return {
        "L": l_score,
        "O": o_score,
        "C": c_score,
        "K": k_score
    }


def _analyze_quality(content: str) -> dict:
    """Basic quality analysis."""
    words = content.split()
    sentences = content.count(".") + content.count("!") + content.count("?")
    avg_sentence_len = len(words) / max(sentences, 1)

    # Sensory words
    sensory = sum(1 for w in ["see", "hear", "feel", "smell", "taste", "touch"] if w in content.lower())

    # Dialogue
    dialogue_count = content.count('"') // 2

    return {
        "Sensory Balance": min(100, 50 + sensory * 10),
        "Visual Quality": min(100, 60 + (10 if len(content) > 1000 else 0)),
        "Dialogue Quality": min(100, 40 + dialogue_count * 5),
        "Character Consistency": 75,  # Would need context
        "Pacing Control": min(100, 70 if 10 < avg_sentence_len < 25 else 50),
        "Emotional Tension": min(100, 60 + (content.count("!") * 5)),
        "Narrative Logic": 70,  # Would need context
        "Style Consistency": 75   # Would need context
    }
