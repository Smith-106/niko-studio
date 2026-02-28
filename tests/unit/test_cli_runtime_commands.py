# -*- coding: utf-8 -*-
"""Runtime CLI command tests."""

import json
from unittest.mock import patch

from click.testing import CliRunner
from rich.console import Console

from src.cli.commands.runtime import search_cmd, serve_cmd, stats_cmd, status_cmd


class _FakeHttpResponse:
    def __init__(self, payload):
        self._payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False

    def read(self):
        return json.dumps(self._payload, ensure_ascii=False).encode("utf-8")


class TestRuntimeCliCommands:
    def test_runtime_command_names_are_stable(self):
        assert status_cmd.name == "status"
        assert stats_cmd.name == "stats"
        assert search_cmd.name == "search"
        assert serve_cmd.name == "serve"

    def test_status_command_plain_output(self):
        runner = CliRunner()
        payload = {
            "status": "healthy",
            "version": "1.0.0",
            "mcp_runtime": {"connection_state": "connected", "reconnect_attempts": 0},
        }

        with patch("src.cli.commands.runtime.request.urlopen", return_value=_FakeHttpResponse(payload)):
            result = runner.invoke(status_cmd, ["--gateway", "http://test"], obj={"console": Console(record=True)})

        assert result.exit_code == 0
        assert "healthy" in result.output

    def test_status_command_json_output(self):
        runner = CliRunner()
        payload = {
            "status": "healthy",
            "version": "1.0.0",
            "mcp_runtime": {"connection_state": "connected", "reconnect_attempts": 0},
        }

        with patch("src.cli.commands.runtime.request.urlopen", return_value=_FakeHttpResponse(payload)):
            result = runner.invoke(status_cmd, ["--json-output"], obj={"console": Console(record=True)})

        assert result.exit_code == 0
        assert '"status": "healthy"' in result.output

    def test_status_command_routes_health_endpoint(self):
        runner = CliRunner()
        payload = {
            "status": "healthy",
            "version": "1.0.0",
            "mcp_runtime": {"connection_state": "connected", "reconnect_attempts": 0},
        }

        with patch("src.cli.commands.runtime._gateway_request", return_value=payload) as mock_gateway:
            result = runner.invoke(status_cmd, ["--gateway", "http://test"], obj={"console": Console(record=True)})

        assert result.exit_code == 0
        mock_gateway.assert_called_once_with("/health", gateway="http://test")

    def test_stats_command_plain_output(self):
        runner = CliRunner()
        payload = {
            "status": "ok",
            "metrics": {
                "requests_total": 5,
                "requests_failed_total": 1,
                "latency_ms_avg": 12.3,
                "latency_ms_max": 25.0,
            },
            "runtime": {"session_id": "gw-1"},
        }

        with patch("src.cli.commands.runtime.request.urlopen", return_value=_FakeHttpResponse(payload)):
            result = runner.invoke(stats_cmd, [], obj={"console": Console(record=True)})

        assert result.exit_code == 0
        assert "requests_total" in result.output

    def test_stats_command_routes_metrics_endpoint(self):
        runner = CliRunner()
        payload = {
            "status": "ok",
            "metrics": {
                "requests_total": 5,
                "requests_failed_total": 1,
                "latency_ms_avg": 12.3,
                "latency_ms_max": 25.0,
            },
            "runtime": {"session_id": "gw-1"},
        }

        with patch("src.cli.commands.runtime._gateway_request", return_value=payload) as mock_gateway:
            result = runner.invoke(stats_cmd, ["--gateway", "http://test"], obj={"console": Console(record=True)})

        assert result.exit_code == 0
        mock_gateway.assert_called_once_with("/metrics", gateway="http://test")

    def test_search_command_counts_results(self):
        runner = CliRunner()
        payload = [{"id": "a"}, {"id": "b"}]

        with patch("src.cli.commands.runtime.request.urlopen", return_value=_FakeHttpResponse(payload)):
            result = runner.invoke(search_cmd, ["hero", "--scope", "all", "--limit", "2"], obj={"console": Console(record=True)})

        assert result.exit_code == 0
        assert "results: 2" in result.output

    def test_search_command_json_output(self):
        runner = CliRunner()
        payload = {"items": [{"id": "a"}]}

        with patch("src.cli.commands.runtime.request.urlopen", return_value=_FakeHttpResponse(payload)):
            result = runner.invoke(search_cmd, ["hero", "--json-output"], obj={"console": Console(record=True)})

        assert result.exit_code == 0
        assert '"items"' in result.output

    def test_search_command_routes_expected_payload(self):
        runner = CliRunner()
        payload = {"items": [{"id": "a"}, {"id": "b"}]}

        with patch("src.cli.commands.runtime._gateway_request", return_value=payload) as mock_gateway:
            result = runner.invoke(
                search_cmd,
                ["hero", "--scope", "all", "--limit", "2", "--gateway", "http://test"],
                obj={"console": Console(record=True)},
            )

        assert result.exit_code == 0
        mock_gateway.assert_called_once_with(
            "/memory/search",
            method="POST",
            payload={"query": "hero", "scope": "all", "limit": 2},
            gateway="http://test",
        )

    def test_search_command_plain_and_json_surfaces_align(self):
        runner = CliRunner()
        payload = {"items": [{"id": "x"}]}

        with patch("src.cli.commands.runtime._gateway_request", return_value=payload):
            plain = runner.invoke(search_cmd, ["hero"], obj={"console": Console(record=True)})

        with patch("src.cli.commands.runtime._gateway_request", return_value=payload):
            raw = runner.invoke(search_cmd, ["hero", "--json-output"], obj={"console": Console(record=True)})

        assert plain.exit_code == 0
        assert raw.exit_code == 0
        assert "results: 1" in plain.output
        assert '"items"' in raw.output

    def test_serve_command_uses_gateway_defaults(self):
        runner = CliRunner()

        with patch("src.cli.commands.runtime._resolve_gateway_host_port_for_cli", return_value=("0.0.0.0", 9000)):
            with patch("src.cli.commands.runtime._resolve_reload_enabled_for_cli", return_value=False):
                with patch("uvicorn.run") as mock_run:
                    result = runner.invoke(serve_cmd, [])

        assert result.exit_code == 0
        mock_run.assert_called_once()
        kwargs = mock_run.call_args.kwargs
        assert kwargs["host"] == "0.0.0.0"
        assert kwargs["port"] == 9000
        assert kwargs["reload"] is False

