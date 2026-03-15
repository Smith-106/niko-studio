# -*- coding: utf-8 -*-

from __future__ import annotations

from types import SimpleNamespace

import src.mcp.sidecar_entry as sidecar_entry


def test_env_helpers_default_and_trim(monkeypatch):
    monkeypatch.delenv("X_STR", raising=False)
    assert sidecar_entry._get_env_str("X_STR", "d") == "d"

    monkeypatch.setenv("X_STR", "   ")
    assert sidecar_entry._get_env_str("X_STR", "d") == "d"

    monkeypatch.setenv("X_STR", "  ok ")
    assert sidecar_entry._get_env_str("X_STR", "d") == "ok"

    monkeypatch.delenv("X_INT", raising=False)
    assert sidecar_entry._get_env_int("X_INT", 7) == 7

    monkeypatch.setenv("X_INT", "bad")
    assert sidecar_entry._get_env_int("X_INT", 7) == 7

    monkeypatch.setenv("X_INT", " 8 ")
    assert sidecar_entry._get_env_int("X_INT", 7) == 8


def test_main_invokes_uvicorn_with_forced_reload_off(monkeypatch):
    calls = {}

    def _run(app, host, port, reload, log_level):
        calls.update({"app": app, "host": host, "port": port, "reload": reload, "log_level": log_level})

    monkeypatch.setenv("NIKO_GATEWAY_HOST", "127.0.0.1")
    monkeypatch.setenv("NIKO_GATEWAY_PORT", "9000")
    monkeypatch.delenv("NIKO_ENV", raising=False)
    monkeypatch.delenv("NIKO_CORS_DEV_ORIGINS", raising=False)

    monkeypatch.setitem(__import__("sys").modules, "uvicorn", SimpleNamespace(run=_run))
    monkeypatch.setitem(__import__("sys").modules, "src.mcp.gateway", SimpleNamespace(app=object()))

    sidecar_entry.main()

    assert calls["host"] == "127.0.0.1"
    assert calls["port"] == 9000
    assert calls["reload"] is False
    assert calls["log_level"] == "info"

    # sidecar policy writes env
    assert __import__("os").environ.get("NIKO_GATEWAY_RELOAD") == "0"
    assert __import__("os").environ.get("NIKO_ENV") == "development"
    assert __import__("os").environ.get("NIKO_CORS_DEV_ORIGINS")


def test_main_respects_existing_dev_cors(monkeypatch):
    calls = {}

    def _run(app, host, port, reload, log_level):
        calls.update({"app": app, "host": host, "port": port, "reload": reload, "log_level": log_level})

    monkeypatch.setenv("NIKO_GATEWAY_HOST", "127.0.0.1")
    monkeypatch.setenv("NIKO_GATEWAY_PORT", "9000")
    monkeypatch.setenv("NIKO_CORS_DEV_ORIGINS", "custom")

    monkeypatch.setitem(__import__("sys").modules, "uvicorn", SimpleNamespace(run=_run))
    monkeypatch.setitem(__import__("sys").modules, "src.mcp.gateway", SimpleNamespace(app=object()))

    sidecar_entry.main()

    assert __import__("os").environ.get("NIKO_CORS_DEV_ORIGINS") == "custom"


def test_module_main_guard_invokes_main(monkeypatch):
    import runpy

    calls = {}

    def _run(app, host, port, reload, log_level):
        calls.update({"app": app, "host": host, "port": port, "reload": reload, "log_level": log_level})

    monkeypatch.setenv("NIKO_GATEWAY_HOST", "127.0.0.1")
    monkeypatch.setenv("NIKO_GATEWAY_PORT", "9000")

    monkeypatch.setitem(__import__("sys").modules, "uvicorn", SimpleNamespace(run=_run))
    monkeypatch.setitem(__import__("sys").modules, "src.mcp.gateway", SimpleNamespace(app=object()))

    runpy.run_module("src.mcp.sidecar_entry", run_name="__main__")

    assert calls["host"] == "127.0.0.1"
    assert calls["port"] == 9000
    assert calls["reload"] is False
    assert calls["log_level"] == "info"
