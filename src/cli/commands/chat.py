"""
chat command - Interactive REPL
===============================

Provides an interactive chat interface for the writing workbench.
"""

import asyncio
import click
from pathlib import Path
from datetime import datetime
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.prompt import Prompt


@click.command()
@click.option(
    "--session", "-s",
    help="Session ID to resume (optional)"
)
@click.option(
    "--level", "-l",
    type=click.Choice(["1", "2", "3", "4", "5"]),
    default="3",
    help="Default workflow level"
)
@click.option(
    "--model", "-m",
    default="gemini-2.0-flash",
    help="LLM model to use"
)
@click.pass_context
def chat(ctx: click.Context, session: str, level: str, model: str) -> None:
    """Start an interactive chat session.

    Commands within chat:
    - /help: Show available commands
    - /level N: Change workflow level
    - /save: Save current session
    - /export: Export conversation
    - /clear: Clear screen
    - /quit or /exit: Exit chat
    """
    console: Console = ctx.obj.get("console", Console())

    # Generate or use session ID
    session_id = session or f"chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    console.print(Panel.fit(
        "[bold blue]Niko Studio - Interactive Chat[/]\n\n"
        f"Session: [cyan]{session_id}[/]\n"
        f"Level: [green]L{level}[/] | Model: [yellow]{model}[/]\n\n"
        "[dim]Type /help for commands, /quit to exit[/]",
        border_style="blue"
    ))

    # Run async chat loop
    asyncio.run(_chat_loop(console, session_id, int(level), model))


async def _chat_loop(
    console: Console,
    session_id: str,
    level: int,
    model: str
) -> None:
    """Main chat REPL loop."""

    # Initialize memory engine
    memory_engine = None
    try:
        from src.memory.unified_memory import UnifiedMemoryEngine
        niko_dir = Path(".niko")
        if niko_dir.exists():
            db_path = niko_dir / "memory" / "memory.db"
            memory_engine = UnifiedMemoryEngine(db_path=str(db_path))
    except ImportError:
        pass

    # Initialize workflow engine
    workflow_engine = None
    try:
        from src.workflow.workflow_engine import WorkflowEngine
        workflow_engine = WorkflowEngine()
    except ImportError:
        pass

    history = []
    current_level = level

    while True:
        try:
            # Get user input
            user_input = Prompt.ask("\n[bold cyan]You[/]")

            if not user_input.strip():
                continue

            # Handle commands
            if user_input.startswith("/"):
                cmd_result = await _handle_command(
                    console, user_input, session_id, current_level, history, memory_engine
                )
                if cmd_result == "exit":
                    break
                elif cmd_result and cmd_result.startswith("level:"):
                    current_level = int(cmd_result.split(":")[1])
                continue

            # Store user message
            history.append({"role": "user", "content": user_input})

            # Store in memory
            if memory_engine:
                await memory_engine.add(
                    content=user_input,
                    layer="session",
                    session_id=session_id,
                    source="user"
                )

            # Process with workflow
            if workflow_engine:
                try:
                    routing = await workflow_engine.route(user_input)
                    effective_level = routing["level"]

                    console.print(f"\n[dim]Routing: {effective_level}[/]")

                    # For L1, provide quick response
                    if "L1" in effective_level:
                        response = f"Quick response to: {user_input[:50]}..."
                    else:
                        # Execute workflow
                        plan = await workflow_engine.plan(user_input, level=effective_level)
                        console.print(f"[dim]Plan created: {plan['plan_id']} ({plan['total_steps']} steps)[/]")

                        # Execute steps
                        result = None
                        while True:
                            result = await workflow_engine.execute(plan["plan_id"])
                            if "error" in result or result.get("plan_status") == "completed":
                                break

                        response = f"Workflow completed: {plan['plan_id']}"
                        if result and "result" in result:
                            response += f"\nResult: {result['result']}"

                except Exception as e:
                    response = f"Workflow error: {e}"
            else:
                # Fallback response
                response = f"[Simulation] Processing: {user_input[:100]}..."

            # Display response
            console.print(f"\n[bold green]Niko[/]")
            console.print(Markdown(response))

            # Store assistant message
            history.append({"role": "assistant", "content": response})

            if memory_engine:
                await memory_engine.add(
                    content=response,
                    layer="session",
                    session_id=session_id,
                    source="agent"
                )

        except KeyboardInterrupt:
            console.print("\n[yellow]Use /quit to exit[/]")
        except EOFError:
            break

    # Cleanup
    if memory_engine:
        memory_engine.close()

    console.print("\n[dim]Session ended. Goodbye![/]")


async def _handle_command(
    console: Console,
    command: str,
    session_id: str,
    level: int,
    history: list,
    memory_engine
) -> str:
    """Handle chat commands."""

    cmd = command.lower().strip()

    if cmd in ["/quit", "/exit", "/q"]:
        return "exit"

    elif cmd == "/help":
        help_text = """
**Available Commands:**
- `/help` - Show this help
- `/level N` - Change workflow level (1-5)
- `/save` - Save session to disk
- `/export` - Export conversation
- `/clear` - Clear screen
- `/status` - Show session status
- `/quit` - Exit chat
"""
        console.print(Markdown(help_text))

    elif cmd.startswith("/level"):
        parts = cmd.split()
        if len(parts) == 2 and parts[1].isdigit():
            new_level = int(parts[1])
            if 1 <= new_level <= 5:
                console.print(f"[green]Level changed to L{new_level}[/]")
                return f"level:{new_level}"
        console.print("[red]Usage: /level N (1-5)[/]")

    elif cmd == "/clear":
        console.clear()

    elif cmd == "/status":
        console.print(f"\n[bold]Session Status:[/]")
        console.print(f"  Session ID: {session_id}")
        console.print(f"  Level: L{level}")
        console.print(f"  Messages: {len(history)}")
        if memory_engine:
            console.print(f"  Memory: Connected")

    elif cmd == "/save":
        # Save history to file
        import json
        save_path = Path(".niko") / "sessions" / f"{session_id}.json"
        save_path.parent.mkdir(parents=True, exist_ok=True)
        save_path.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
        console.print(f"[green]Session saved to {save_path}[/]")

    elif cmd == "/export":
        # Export as markdown
        export_path = Path(".niko") / "exports" / f"{session_id}.md"
        export_path.parent.mkdir(parents=True, exist_ok=True)

        md_content = f"# Chat Session: {session_id}\n\n"
        for msg in history:
            role = "**You:**" if msg["role"] == "user" else "**Niko:**"
            md_content += f"{role}\n{msg['content']}\n\n---\n\n"

        export_path.write_text(md_content, encoding="utf-8")
        console.print(f"[green]Exported to {export_path}[/]")

    else:
        console.print(f"[red]Unknown command: {cmd}[/] (try /help)")

    return ""
