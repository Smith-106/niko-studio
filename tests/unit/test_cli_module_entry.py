# -*- coding: utf-8 -*-
"""`src.cli.__main__` 覆盖测试。"""

import runpy


def test_module_entry_calls_main_when_run_as_main(monkeypatch):
    import src.cli.main as cli_main

    called = {"count": 0}

    def fake_main():
        called["count"] += 1

    monkeypatch.setattr(cli_main, "main", fake_main)

    runpy.run_module("src.cli.__main__", run_name="__main__")

    assert called["count"] == 1


def test_cli_group_callback_sets_console_on_context():
    import click
    import src.cli.main as cli_main

    ctx = click.Context(cli_main.cli)
    ctx.obj = {}
    cli_main.cli.callback.__wrapped__(ctx)

    assert "console" in ctx.obj


def test_cli_main_function_invokes_group(monkeypatch):
    import src.cli.main as cli_main

    called = {"kwargs": None}

    def fake_cli(*args, **kwargs):
        called["kwargs"] = kwargs

    monkeypatch.setattr(cli_main, "cli", fake_cli)

    cli_main.main()

    assert called["kwargs"] == {"obj": {}}


def test_cli_main_runs_main_under_name_main(monkeypatch):
    import click.core

    called = {"count": 0}
    original_call = click.core.Command.__call__

    def fake_call(self, *args, **kwargs):
        called["count"] += 1
        return None

    monkeypatch.setattr(click.core.Command, "__call__", fake_call)

    try:
        runpy.run_module("src.cli.main", run_name="__main__")
    finally:
        monkeypatch.setattr(click.core.Command, "__call__", original_call)

    assert called["count"] >= 1


def test_cli_registers_guided_draft_command():
    import src.cli.main as cli_main

    assert "guided-draft" in cli_main.cli.commands


def test_cli_registers_runtime_route_commands():
    import src.cli.main as cli_main

    commands = cli_main.cli.commands
    for name in ("status", "stats", "search", "serve"):
        assert name in commands


def test_cli_command_registration_order_is_deterministic():
    import src.cli.main as cli_main

    command_names = list(cli_main.cli.commands.keys())
    expected = [
        "init",
        "run",
        "chat",
        "evaluate",
        "export",
        "status",
        "stats",
        "search",
        "serve",
        "guided-draft",
    ]
    assert command_names[: len(expected)] == expected


def test_cli_runtime_routes_bind_expected_command_objects():
    import src.cli.main as cli_main
    from src.cli.commands.runtime import status_cmd, stats_cmd, search_cmd, serve_cmd
    from src.cli.commands.guided_draft import guided_draft

    commands = cli_main.cli.commands
    assert commands["status"] is status_cmd
    assert commands["stats"] is stats_cmd
    assert commands["search"] is search_cmd
    assert commands["serve"] is serve_cmd
    assert commands["guided-draft"] is guided_draft


def test_cli_commands_package_exports_runtime_and_guided_routes():
    import src.cli.commands as commands_pkg

    for symbol in ("status_cmd", "stats_cmd", "search_cmd", "serve_cmd", "guided_draft"):
        assert symbol in commands_pkg.__all__
