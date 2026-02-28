"""
runtime commands - Gateway orchestration
=======================================

Operational CLI commands that orchestrate gateway runtime endpoints.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional
from urllib import error, request

import click
from rich.console import Console
from rich.panel import Panel


def _gateway_request(
    path: str,
    *,
    method: str = "GET",
    payload: Optional[Dict[str, Any]] = None,
    gateway: str = "http://127.0.0.1:8000",
    timeout: int = 10,
) -> Dict[str, Any]:
    base = gateway.rstrip("/")
    url = f"{base}{path}"

    data = None
    headers = {"accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["content-type"] = "application/json"

    req = request.Request(url=url, method=method, data=data, headers=headers)
    with request.urlopen(req, timeout=timeout) as response:
        body = response.read().decode("utf-8")

    return json.loads(body) if body else {}


@click.command(name="status")
@click.option("--gateway", default="http://127.0.0.1:8000", show_default=True, help="Gateway base URL")
@click.option("--json-output", is_flag=True, help="Print raw JSON")
@click.pass_context
def status_cmd(ctx: click.Context, gateway: str, json_output: bool) -> None:
    """Show gateway health status."""
    console: Console = ctx.obj.get("console", Console())

    try:
        payload = _gateway_request("/health", gateway=gateway)
    except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        console.print(f"[red]status failed:[/] {exc}")
        raise click.Abort() from exc

    if json_output:
        console.print_json(json.dumps(payload, ensure_ascii=False))
        return

    runtime = payload.get("mcp_runtime", {})
    lines = [
        f"status: {payload.get('status', 'unknown')}",
        f"version: {payload.get('version', 'unknown')}",
        f"connection: {runtime.get('connection_state', 'unknown')}",
        f"reconnect_attempts: {runtime.get('reconnect_attempts', 0)}",
    ]
    console.print(Panel("\n".join(lines), title="Gateway Status", border_style="blue"))


@click.command(name="stats")
@click.option("--gateway", default="http://127.0.0.1:8000", show_default=True, help="Gateway base URL")
@click.option("--json-output", is_flag=True, help="Print raw JSON")
@click.pass_context
def stats_cmd(ctx: click.Context, gateway: str, json_output: bool) -> None:
    """Show gateway runtime metrics."""
    console: Console = ctx.obj.get("console", Console())

    try:
        payload = _gateway_request("/metrics", gateway=gateway)
    except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        console.print(f"[red]stats failed:[/] {exc}")
        raise click.Abort() from exc

    if json_output:
        console.print_json(json.dumps(payload, ensure_ascii=False))
        return

    metrics = payload.get("metrics", {})
    runtime = payload.get("runtime", {})
    lines = [
        f"requests_total: {metrics.get('requests_total', 0)}",
        f"requests_failed_total: {metrics.get('requests_failed_total', 0)}",
        f"latency_ms_avg: {metrics.get('latency_ms_avg', 0)}",
        f"latency_ms_max: {metrics.get('latency_ms_max', 0)}",
        f"session_id: {runtime.get('session_id', 'unknown')}",
    ]
    console.print(Panel("\n".join(lines), title="Gateway Metrics", border_style="green"))


@click.command(name="search")
@click.argument("query")
@click.option("--scope", default="all", show_default=True, help="Search scope")
@click.option("--limit", default=10, show_default=True, type=int, help="Max result count")
@click.option("--gateway", default="http://127.0.0.1:8000", show_default=True, help="Gateway base URL")
@click.option("--json-output", is_flag=True, help="Print raw JSON")
@click.pass_context
def search_cmd(
    ctx: click.Context,
    query: str,
    scope: str,
    limit: int,
    gateway: str,
    json_output: bool,
) -> None:
    """Search memories through gateway REST endpoint."""
    console: Console = ctx.obj.get("console", Console())

    payload = {"query": query, "scope": scope, "limit": limit}
    try:
        result = _gateway_request("/memory/search", method="POST", payload=payload, gateway=gateway)
    except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        console.print(f"[red]search failed:[/] {exc}")
        raise click.Abort() from exc

    if json_output:
        console.print_json(json.dumps(result, ensure_ascii=False))
        return

    if isinstance(result, list):
        count = len(result)
    elif isinstance(result, dict):
        items = result.get("items")
        count = len(items) if isinstance(items, list) else 0
    else:
        count = 0

    console.print(Panel(f"query: {query}\nresults: {count}", title="Gateway Search", border_style="cyan"))


def _resolve_gateway_host_port_for_cli() -> tuple[str, int]:
    from src.mcp.gateway import _resolve_gateway_host_port

    return _resolve_gateway_host_port()


def _resolve_reload_enabled_for_cli() -> bool:
    from src.mcp.gateway import _resolve_reload_enabled

    return _resolve_reload_enabled()


@click.command(name="serve")
@click.option("--host", default=None, help="Gateway host")
@click.option("--port", type=int, default=None, help="Gateway port")
@click.option("--reload/--no-reload", default=None, help="Enable or disable reload")
def serve_cmd(host: Optional[str], port: Optional[int], reload: Optional[bool]) -> None:
    """Serve the gateway process."""
    try:
        import uvicorn
    except ImportError as exc:
        raise click.ClickException(str(exc)) from exc

    try:
        default_host, default_port = _resolve_gateway_host_port_for_cli()
        effective_reload = _resolve_reload_enabled_for_cli() if reload is None else reload
    except ImportError as exc:
        raise click.ClickException(str(exc)) from exc

    effective_host = host or default_host
    effective_port = port or default_port

    uvicorn.run(
        "src.mcp.gateway:app",
        host=effective_host,
        port=effective_port,
        reload=effective_reload,
        log_level="info",
    )
