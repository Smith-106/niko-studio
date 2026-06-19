"""Unit tests for scripts/start_gateway.py launcher.

Covers runtime resolution, argument parsing, and the two runtime branches
(Node default + legacy Python compatibility) without spawning real subprocesses.
"""

from __future__ import annotations

import builtins
import importlib.util
import runpy
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _load(relative_path: str, module_name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, PROJECT_ROOT / relative_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def start_gateway() -> ModuleType:
    return _load("scripts/start_gateway.py", "_test_start_gateway")


# ---------------------------------------------------------------------------
# _node_cmd
# ---------------------------------------------------------------------------


class TestNodeCmd:
    def test_returns_node_exe_on_windows(self, start_gateway, monkeypatch) -> None:
        monkeypatch.setattr(start_gateway.sys, "platform", "win32")
        assert start_gateway._node_cmd() == "node.exe"

    def test_returns_node_on_linux(self, start_gateway, monkeypatch) -> None:
        monkeypatch.setattr(start_gateway.sys, "platform", "linux")
        assert start_gateway._node_cmd() == "node"

    def test_returns_node_on_darwin(self, start_gateway, monkeypatch) -> None:
        monkeypatch.setattr(start_gateway.sys, "platform", "darwin")
        assert start_gateway._node_cmd() == "node"


# ---------------------------------------------------------------------------
# _resolve_runtime
# ---------------------------------------------------------------------------


class TestResolveRuntime:
    def test_explicit_node_returned_as_is(self, start_gateway, monkeypatch) -> None:
        monkeypatch.delenv("NIKO_GATEWAY_RUNTIME", raising=False)
        assert start_gateway._resolve_runtime("node") == "node"

    def test_explicit_python_returned_as_is(self, start_gateway, monkeypatch) -> None:
        monkeypatch.setenv("NIKO_GATEWAY_RUNTIME", "node")  # ignored when explicit
        assert start_gateway._resolve_runtime("python") == "python"

    def test_auto_with_env_node(self, start_gateway, monkeypatch) -> None:
        monkeypatch.setenv("NIKO_GATEWAY_RUNTIME", "node")
        assert start_gateway._resolve_runtime("auto") == "node"

    def test_auto_with_env_python(self, start_gateway, monkeypatch) -> None:
        monkeypatch.setenv("NIKO_GATEWAY_RUNTIME", "python")
        assert start_gateway._resolve_runtime("auto") == "python"

    def test_auto_with_env_uppercase(self, start_gateway, monkeypatch) -> None:
        monkeypatch.setenv("NIKO_GATEWAY_RUNTIME", "PYTHON")
        assert start_gateway._resolve_runtime("auto") == "python"

    def test_auto_defaults_to_node_when_env_empty(self, start_gateway, monkeypatch) -> None:
        monkeypatch.delenv("NIKO_GATEWAY_RUNTIME", raising=False)
        assert start_gateway._resolve_runtime("auto") == "node"

    def test_auto_defaults_to_node_when_env_invalid(self, start_gateway, monkeypatch) -> None:
        monkeypatch.setenv("NIKO_GATEWAY_RUNTIME", "haskell")
        assert start_gateway._resolve_runtime("auto") == "node"


# ---------------------------------------------------------------------------
# _build_parser
# ---------------------------------------------------------------------------


class TestBuildParser:
    def test_parses_default_arguments(self, start_gateway) -> None:
        args = start_gateway._build_parser().parse_args([])
        assert args.host is None
        assert args.port is None
        assert args.reload is False
        assert args.log_level == "info"
        assert args.env is None
        assert args.config is None
        assert args.runtime == "auto"

    def test_parses_full_argument_set(self, start_gateway) -> None:
        args = start_gateway._build_parser().parse_args(
            [
                "--host",
                "0.0.0.0",
                "--port",
                "8123",
                "--reload",
                "--log-level",
                "debug",
                "--env",
                "production",
                "--config",
                "/tmp/c.yaml",
                "--runtime",
                "python",
            ]
        )
        assert args.host == "0.0.0.0"
        assert args.port == 8123
        assert args.reload is True
        assert args.log_level == "debug"
        assert args.env == "production"
        assert args.config == "/tmp/c.yaml"
        assert args.runtime == "python"

    def test_invalid_env_rejected(self, start_gateway) -> None:
        with pytest.raises(SystemExit):
            start_gateway._build_parser().parse_args(["--env", "staging"])

    def test_invalid_runtime_rejected(self, start_gateway) -> None:
        with pytest.raises(SystemExit):
            start_gateway._build_parser().parse_args(["--runtime", "haskell"])

    def test_port_must_be_int(self, start_gateway) -> None:
        with pytest.raises(SystemExit):
            start_gateway._build_parser().parse_args(["--port", "not-a-number"])


# ---------------------------------------------------------------------------
# _load_dotenv_into
# ---------------------------------------------------------------------------


class TestLoadDotenvInto:
    def test_noops_when_env_file_is_missing(self, start_gateway, tmp_path) -> None:
        env = {"KEEP": "original"}

        start_gateway._load_dotenv_into(env, tmp_path)

        assert env == {"KEEP": "original"}

    def test_loads_supported_lines_without_overriding_existing_values(
        self, start_gateway, tmp_path
    ) -> None:
        (tmp_path / ".env").write_text(
            "\n".join(
                [
                    "# ignored comment",
                    "PLAIN=value",
                    "QUOTED_DOUBLE=\"quoted value\"",
                    "QUOTED_SINGLE='single quoted value'",
                    "SPACED = spaced value ",
                    "KEEP=from-file",
                    "INVALID_LINE",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        env = {"KEEP": "original"}

        start_gateway._load_dotenv_into(env, tmp_path)

        assert env == {
            "KEEP": "original",
            "PLAIN": "value",
            "QUOTED_DOUBLE": "quoted value",
            "QUOTED_SINGLE": "single quoted value",
            "SPACED": "spaced value",
        }


# ---------------------------------------------------------------------------
# _run_node_gateway
# ---------------------------------------------------------------------------


def _ns(**overrides) -> SimpleNamespace:
    base = dict(
        host=None, port=None, reload=False, log_level="info", env=None, config=None, runtime="auto"
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class TestRunNodeGateway:
    def test_returns_2_when_launcher_missing(
        self, start_gateway, tmp_path, monkeypatch, capsys
    ) -> None:
        monkeypatch.setattr(start_gateway, "NODE_GATEWAY_LAUNCHER", tmp_path / "missing")
        monkeypatch.setattr(start_gateway, "PROJECT_ROOT", tmp_path)
        rc = start_gateway._run_node_gateway(_ns())
        assert rc == 2
        out = capsys.readouterr().out
        assert "Node gateway launcher is unavailable" in out

    def test_invokes_subprocess_with_expected_env_and_command(
        self, start_gateway, tmp_path, monkeypatch
    ) -> None:
        launcher = tmp_path / "niko-gateway-node"
        launcher.write_text("#!/bin/sh\necho ok\n", encoding="utf-8")
        monkeypatch.setattr(start_gateway, "NODE_GATEWAY_LAUNCHER", launcher)
        monkeypatch.setattr(start_gateway, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(start_gateway, "_node_cmd", lambda: "node")

        captured: dict = {}

        def fake_run(cmd, cwd, env, check):
            captured["cmd"] = cmd
            captured["cwd"] = cwd
            captured["env"] = env
            captured["check"] = check
            return SimpleNamespace(returncode=0)

        monkeypatch.setattr(start_gateway.subprocess, "run", fake_run)

        rc = start_gateway._run_node_gateway(
            _ns(host="127.0.0.1", port=8123, env="production", config="/tmp/c.yaml")
        )

        assert rc == 0
        assert captured["cmd"] == ["node", str(launcher)]
        assert captured["cwd"] == str(tmp_path)
        assert captured["check"] is False
        env = captured["env"]
        assert env["NIKO_ENV"] == "production"
        assert env["NIKO_CONFIG_PATH"] == "/tmp/c.yaml"
        assert env["NIKO_GATEWAY_HOST"] == "127.0.0.1"
        assert env["NIKO_GATEWAY_PORT"] == "8123"
        assert env["NIKO_GATEWAY_RUNTIME"] == "node"

    def test_propagates_subprocess_returncode(self, start_gateway, tmp_path, monkeypatch) -> None:
        launcher = tmp_path / "niko-gateway-node"
        launcher.write_text("x", encoding="utf-8")
        monkeypatch.setattr(start_gateway, "NODE_GATEWAY_LAUNCHER", launcher)
        monkeypatch.setattr(start_gateway, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(start_gateway, "_node_cmd", lambda: "node")
        monkeypatch.setattr(
            start_gateway.subprocess, "run", lambda *a, **kw: SimpleNamespace(returncode=42)
        )
        assert start_gateway._run_node_gateway(_ns()) == 42

    def test_warns_when_reload_passed(self, start_gateway, tmp_path, monkeypatch, capsys) -> None:
        launcher = tmp_path / "niko-gateway-node"
        launcher.write_text("x", encoding="utf-8")
        monkeypatch.setattr(start_gateway, "NODE_GATEWAY_LAUNCHER", launcher)
        monkeypatch.setattr(start_gateway, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(start_gateway, "_node_cmd", lambda: "node")
        monkeypatch.setattr(
            start_gateway.subprocess, "run", lambda *a, **kw: SimpleNamespace(returncode=0)
        )
        start_gateway._run_node_gateway(_ns(reload=True))
        out = capsys.readouterr().out
        assert "--reload" in out

    def test_warns_when_log_level_overridden(
        self, start_gateway, tmp_path, monkeypatch, capsys
    ) -> None:
        launcher = tmp_path / "niko-gateway-node"
        launcher.write_text("x", encoding="utf-8")
        monkeypatch.setattr(start_gateway, "NODE_GATEWAY_LAUNCHER", launcher)
        monkeypatch.setattr(start_gateway, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(start_gateway, "_node_cmd", lambda: "node")
        monkeypatch.setattr(
            start_gateway.subprocess, "run", lambda *a, **kw: SimpleNamespace(returncode=0)
        )
        start_gateway._run_node_gateway(_ns(log_level="debug"))
        out = capsys.readouterr().out
        assert "--log-level" in out


# ---------------------------------------------------------------------------
# _run_legacy_python_gateway
# ---------------------------------------------------------------------------


class TestRunLegacyPythonGateway:
    def test_returns_2_when_legacy_source_missing(
        self, start_gateway, tmp_path, monkeypatch, capsys
    ) -> None:
        monkeypatch.setattr(start_gateway, "LEGACY_PY_GATEWAY", tmp_path / "absent.py")
        rc = start_gateway._run_legacy_python_gateway(_ns())
        assert rc == 2
        out = capsys.readouterr().out
        assert "Legacy Python runtime is unavailable" in out
        assert "--runtime python" in out

    def test_returns_1_when_legacy_dependencies_cannot_be_imported(
        self, start_gateway, tmp_path, monkeypatch, capsys
    ) -> None:
        legacy = tmp_path / "gateway.py"
        legacy.write_text("# stub", encoding="utf-8")
        monkeypatch.setattr(start_gateway, "LEGACY_PY_GATEWAY", legacy)

        original_import = builtins.__import__

        def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
            if name in {"uvicorn", "src.config"}:
                raise ImportError(f"blocked import: {name}")
            return original_import(name, globals, locals, fromlist, level)

        monkeypatch.setattr(builtins, "__import__", fake_import)

        rc = start_gateway._run_legacy_python_gateway(_ns())

        assert rc == 1
        out = capsys.readouterr().out
        assert "Legacy Python runtime dependency missing" in out
        assert "--runtime node" in out

    def test_runs_legacy_gateway_with_default_production_config(
        self, start_gateway, tmp_path, monkeypatch, capsys
    ) -> None:
        legacy = tmp_path / "gateway.py"
        legacy.write_text("# stub", encoding="utf-8")
        production_config = tmp_path / "config" / "niko-studio.production.yaml"
        production_config.parent.mkdir(parents=True)
        production_config.write_text("env: production\n", encoding="utf-8")
        monkeypatch.setattr(start_gateway, "LEGACY_PY_GATEWAY", legacy)
        monkeypatch.setattr(start_gateway, "PROJECT_ROOT", tmp_path)

        captured: dict[str, object] = {}
        uvicorn_module = ModuleType("uvicorn")
        uvicorn_module.run = lambda *args, **kwargs: captured.setdefault(
            "uvicorn", (args, kwargs)
        )
        src_module = ModuleType("src")
        src_module.__path__ = []
        config_module = ModuleType("src.config")

        def init_config(*, config_path=None, hot_reload=None) -> None:
            captured["init_config"] = (config_path, hot_reload)

        def ensure_environment(*, strict=False) -> None:
            captured["strict"] = strict

        def get_config_value(key: str, default):
            values = {
                "gateway.host": "0.0.0.0",
                "gateway.port": 9100,
                "env": "production",
            }
            return values.get(key, default)

        config_module.init_config = init_config
        config_module.ensure_environment = ensure_environment
        config_module.get_config_value = get_config_value
        src_module.config = config_module
        monkeypatch.setitem(sys.modules, "uvicorn", uvicorn_module)
        monkeypatch.setitem(sys.modules, "src", src_module)
        monkeypatch.setitem(sys.modules, "src.config", config_module)
        monkeypatch.delenv("NIKO_CONFIG_PATH", raising=False)

        rc = start_gateway._run_legacy_python_gateway(
            _ns(reload=True, log_level="warning", env="production")
        )

        assert rc == 0
        assert captured["init_config"] == (str(production_config), False)
        assert captured["strict"] is False
        args, kwargs = captured["uvicorn"]
        assert args == ("src.mcp.gateway:app",)
        assert kwargs == {
            "host": "0.0.0.0",
            "port": 9100,
            "reload": False,
            "log_level": "warning",
        }
        out = capsys.readouterr().out
        assert "--reload is ignored in production" in out
        assert "compatibility runtime" in out

    def test_runs_legacy_gateway_with_explicit_overrides_in_development(
        self, start_gateway, tmp_path, monkeypatch
    ) -> None:
        legacy = tmp_path / "gateway.py"
        legacy.write_text("# stub", encoding="utf-8")
        monkeypatch.setattr(start_gateway, "LEGACY_PY_GATEWAY", legacy)
        monkeypatch.setattr(start_gateway, "PROJECT_ROOT", tmp_path)

        captured: dict[str, object] = {}
        uvicorn_module = ModuleType("uvicorn")
        uvicorn_module.run = lambda *args, **kwargs: captured.setdefault(
            "uvicorn", (args, kwargs)
        )
        src_module = ModuleType("src")
        src_module.__path__ = []
        config_module = ModuleType("src.config")

        def init_config(*, config_path=None, hot_reload=None) -> None:
            captured["init_config"] = (config_path, hot_reload)

        def ensure_environment(*, strict=False) -> None:
            captured["strict"] = strict

        def get_config_value(key: str, default):
            values = {
                "gateway.host": "127.0.0.9",
                "gateway.port": 8001,
                "env": "development",
            }
            return values.get(key, default)

        config_module.init_config = init_config
        config_module.ensure_environment = ensure_environment
        config_module.get_config_value = get_config_value
        src_module.config = config_module
        monkeypatch.setitem(sys.modules, "uvicorn", uvicorn_module)
        monkeypatch.setitem(sys.modules, "src", src_module)
        monkeypatch.setitem(sys.modules, "src.config", config_module)

        rc = start_gateway._run_legacy_python_gateway(
            _ns(
                host="127.0.0.1",
                port=8124,
                reload=True,
                log_level="debug",
                config="custom-config.yaml",
            )
        )

        assert rc == 0
        assert captured["init_config"] == ("custom-config.yaml", False)
        assert captured["strict"] is False
        args, kwargs = captured["uvicorn"]
        assert args == ("src.mcp.gateway:app",)
        assert kwargs == {
            "host": "127.0.0.1",
            "port": 8124,
            "reload": True,
            "log_level": "debug",
        }


# ---------------------------------------------------------------------------
# main()
# ---------------------------------------------------------------------------


class TestMain:
    def test_main_routes_to_node_by_default(self, start_gateway, monkeypatch) -> None:
        seen: dict = {}

        def fake_node(args):
            seen["node"] = args
            return 0

        def fake_python(args):
            seen["python"] = args
            return 0

        monkeypatch.setattr(start_gateway, "_run_node_gateway", fake_node)
        monkeypatch.setattr(start_gateway, "_run_legacy_python_gateway", fake_python)
        monkeypatch.setattr(start_gateway.sys, "argv", ["start_gateway.py"])
        monkeypatch.delenv("NIKO_GATEWAY_RUNTIME", raising=False)

        with pytest.raises(SystemExit) as excinfo:
            start_gateway.main()
        assert excinfo.value.code == 0
        assert "node" in seen
        assert "python" not in seen

    def test_main_routes_to_python_when_explicit(
        self, start_gateway, tmp_path, monkeypatch
    ) -> None:
        legacy = tmp_path / "gateway.py"
        legacy.write_text("# stub", encoding="utf-8")
        monkeypatch.setattr(start_gateway, "LEGACY_PY_GATEWAY", legacy)

        seen: dict = {}

        def fake_python(_args):
            seen["py"] = True
            return 5

        def fake_node(_args):
            seen["node"] = True
            return 0

        monkeypatch.setattr(start_gateway, "_run_legacy_python_gateway", fake_python)
        monkeypatch.setattr(start_gateway, "_run_node_gateway", fake_node)
        monkeypatch.setattr(start_gateway.sys, "argv", ["start_gateway.py", "--runtime", "python"])

        with pytest.raises(SystemExit) as excinfo:
            start_gateway.main()
        assert excinfo.value.code == 5
        assert "py" in seen
        assert "node" not in seen

    def test_main_falls_back_to_node_when_legacy_missing(
        self, start_gateway, tmp_path, monkeypatch, capsys
    ) -> None:
        monkeypatch.setattr(start_gateway, "LEGACY_PY_GATEWAY", tmp_path / "absent.py")
        monkeypatch.setenv("NIKO_GATEWAY_RUNTIME", "python")
        seen: dict = {}

        def fake_node(_args):
            seen["node"] = True
            return 0

        def fail_python(_args):
            pytest.fail("python branch should not be invoked")

        monkeypatch.setattr(start_gateway, "_run_node_gateway", fake_node)
        monkeypatch.setattr(start_gateway, "_run_legacy_python_gateway", fail_python)
        monkeypatch.setattr(start_gateway.sys, "argv", ["start_gateway.py"])

        with pytest.raises(SystemExit) as excinfo:
            start_gateway.main()
        assert excinfo.value.code == 0
        assert "node" in seen
        out = capsys.readouterr().out
        assert "Falling back to node runtime" in out

    def test_module_entrypoint_executes_main_guard(self, monkeypatch) -> None:
        original_exists = Path.exists

        def fake_exists(path: Path) -> bool:
            if path.name == "niko-gateway-node":
                return False
            return original_exists(path)

        monkeypatch.setattr(Path, "exists", fake_exists)
        monkeypatch.setattr(sys, "argv", ["start_gateway.py"])
        monkeypatch.setenv("NIKO_GATEWAY_RUNTIME", "node")

        with pytest.raises(SystemExit) as excinfo:
            runpy.run_path(str(PROJECT_ROOT / "scripts" / "start_gateway.py"), run_name="__main__")

        assert excinfo.value.code == 2
