# -*- coding: utf-8 -*-
"""CLI 命令单元测试（高收益覆盖补充）。"""

import json
import sys
import types
from pathlib import Path
from unittest.mock import patch

import pytest
from click.testing import CliRunner
from rich.console import Console

from src.cli.commands.chat import _chat_loop, _handle_command, chat as chat_cmd
from src.cli.commands.evaluate import (
    _analyze_lock,
    _analyze_quality,
    _evaluate_content,
    evaluate as evaluate_cmd,
)
from src.cli.commands.export import (
    _export_docx,
    _export_html,
    _export_json,
    _export_markdown,
    _export_text,
    export as export_cmd,
)
from src.cli.commands.init import init as init_cmd
from src.cli.commands.run import _run_workflow, run as run_cmd
from src.cli.commands.guided_draft import _run_guided_draft, guided_draft


class TestExportHelpers:
    def test_export_markdown_session_with_meta(self):
        data = [
            {"role": "user", "content": "你好"},
            {"role": "assistant", "content": "世界"},
        ]

        result = _export_markdown(data, template="plain", include_meta=True, is_session=True)

        assert "exported:" in result
        assert "template: plain" in result
        assert "**You:**" in result
        assert "**Niko:**" in result

    def test_export_markdown_screenplay_template(self):
        result = _export_markdown(
            {"content": "INT. ROOM - NIGHT"},
            template="screenplay",
            include_meta=False,
            is_session=False,
        )

        assert "# SCREENPLAY" in result
        assert "```" in result

    def test_export_markdown_novel_template(self):
        result = _export_markdown(
            {"content": "chapter text"},
            template="novel",
            include_meta=False,
            is_session=False,
        )

        assert "# Chapter" in result
        assert "chapter text" in result

    def test_export_json_include_meta(self):
        raw = {"content": "abc"}

        result = json.loads(_export_json(raw, include_meta=True))

        assert "metadata" in result
        assert result["data"]["content"] == "abc"

    def test_export_text_session(self):
        data = [
            {"role": "user", "content": "u"},
            {"role": "assistant", "content": "a"},
        ]

        result = _export_text(data, is_session=True)

        assert "[You]" in result
        assert "[Niko]" in result

    def test_export_html_session_with_meta(self):
        data = [{"role": "assistant", "content": "hello"}]

        result = _export_html(data, template="plain", include_meta=True, is_session=True)

        assert "<h1>Chat Session</h1>" in result
        assert "class=\"meta\"" in result
        assert "<strong>Niko:</strong>" in result

    def test_export_html_novel_template(self):
        result = _export_html(
            {"content": "line1\nline2"},
            template="novel",
            include_meta=False,
            is_session=False,
        )

        assert "<h1>Chapter</h1>" in result
        assert "line1<br>line2" in result

    def test_export_docx_fallback_when_docx_missing(self):
        original_import = __import__

        def fake_import(name, *args, **kwargs):
            if name == "docx":
                raise ImportError("docx unavailable")
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=fake_import):
            result = _export_docx(
                {"content": "fallback"},
                template="plain",
                output_path=Path("out.docx"),
                is_session=False,
            )

        assert result is not None
        assert "python-docx not installed" in result

    def test_export_docx_success_path_with_fake_docx(self, tmp_path):
        class FakeRun:
            def __init__(self):
                self.bold = False
                self.italic = False

        class FakeParagraph:
            def __init__(self):
                self.runs = []

            def add_run(self, text):
                run = FakeRun()
                self.runs.append((text, run))
                return run

        class FakeDocument:
            last_saved = None

            def add_heading(self, *_args, **_kwargs):
                return None

            def add_paragraph(self, *_args, **_kwargs):
                return FakeParagraph()

            def save(self, path):
                self.__class__.last_saved = path

        fake_docx = types.SimpleNamespace(Document=FakeDocument)
        fake_shared = types.SimpleNamespace(Inches=lambda *_a, **_k: None, Pt=lambda *_a, **_k: None)

        with patch.dict(sys.modules, {"docx": fake_docx, "docx.shared": fake_shared}):
            result = _export_docx(
                [{"role": "user", "content": "u"}],
                template="plain",
                output_path=tmp_path / "ok.docx",
                is_session=True,
            )

        assert result is None
        assert FakeDocument.last_saved is not None

    def test_export_docx_success_non_session_paragraph_split(self, tmp_path):
        class FakeRun:
            def __init__(self):
                self.bold = False
                self.italic = False

        class FakeParagraph:
            def __init__(self):
                self.runs = []

            def add_run(self, text):
                run = FakeRun()
                self.runs.append((text, run))
                return run

        class FakeDocument:
            paragraph_calls = 0

            def add_heading(self, *_args, **_kwargs):
                return None

            def add_paragraph(self, *_args, **_kwargs):
                self.__class__.paragraph_calls += 1
                return FakeParagraph()

            def save(self, _path):
                return None

        fake_docx = types.SimpleNamespace(Document=FakeDocument)
        fake_shared = types.SimpleNamespace(Inches=lambda *_a, **_k: None, Pt=lambda *_a, **_k: None)

        with patch.dict(sys.modules, {"docx": fake_docx, "docx.shared": fake_shared}):
            _export_docx(
                {"content": "para1\n\npara2"},
                template="plain",
                output_path=tmp_path / "ok2.docx",
                is_session=False,
            )

        assert FakeDocument.paragraph_calls >= 3


class TestExportCommand:
    def test_export_command_auto_output_avoids_overwrite(self, tmp_path):
        src = tmp_path / "chapter.md"
        src.write_text("hello", encoding="utf-8")

        runner = CliRunner()
        result = runner.invoke(
            export_cmd,
            [str(src), "--format", "md"],
            obj={"console": Console(record=True)},
        )

        assert result.exit_code == 0
        assert (tmp_path / "chapter_export.md").exists()

    def test_export_command_handles_invalid_json_source(self, tmp_path):
        src = tmp_path / "bad.json"
        src.write_text("{bad json", encoding="utf-8")
        out = tmp_path / "out.txt"

        runner = CliRunner()
        result = runner.invoke(
            export_cmd,
            [str(src), "--format", "txt", "--output", str(out)],
            obj={"console": Console(record=True)},
        )

        assert result.exit_code == 0
        assert out.exists()
        assert "{bad json" in out.read_text(encoding="utf-8")

    def test_export_command_json_format_branch(self, tmp_path):
        src = tmp_path / "data.json"
        src.write_text(json.dumps({"content": "hello"}, ensure_ascii=False), encoding="utf-8")
        out = tmp_path / "out.json"

        runner = CliRunner()
        result = runner.invoke(
            export_cmd,
            [str(src), "--format", "json", "--output", str(out), "--include-meta"],
            obj={"console": Console(record=True)},
        )

        assert result.exit_code == 0
        parsed = json.loads(out.read_text(encoding="utf-8"))
        assert "metadata" in parsed

    def test_export_command_html_format_branch(self, tmp_path):
        src = tmp_path / "note.md"
        src.write_text("line1\nline2", encoding="utf-8")
        out = tmp_path / "out.html"

        runner = CliRunner()
        result = runner.invoke(
            export_cmd,
            [str(src), "--format", "html", "--output", str(out), "--template", "novel"],
            obj={"console": Console(record=True)},
        )

        assert result.exit_code == 0
        html = out.read_text(encoding="utf-8")
        assert "<h1>Chapter</h1>" in html

    def test_export_command_docx_direct_write_branch(self, tmp_path):
        class FakeDocument:
            def add_heading(self, *_args, **_kwargs):
                return None

            def add_paragraph(self, *_args, **_kwargs):
                class P:
                    def add_run(self, _text):
                        class R:
                            bold = False
                            italic = False

                        return R()

                return P()

            def save(self, path):
                Path(path).write_text("fake-docx", encoding="utf-8")

        fake_docx = types.SimpleNamespace(Document=FakeDocument)
        fake_shared = types.SimpleNamespace(Inches=lambda *_a, **_k: None, Pt=lambda *_a, **_k: None)

        src = tmp_path / "session.json"
        src.write_text(json.dumps([{"role": "user", "content": "hello"}], ensure_ascii=False), encoding="utf-8")
        out = tmp_path / "out.docx"

        runner = CliRunner()
        with patch.dict(sys.modules, {"docx": fake_docx, "docx.shared": fake_shared}):
            result = runner.invoke(
                export_cmd,
                [str(src), "--format", "docx", "--output", str(out)],
                obj={"console": Console(record=True)},
            )

        assert result.exit_code == 0
        assert out.exists()
    def test_export_command_json_source_with_role_sets_session_detection(self, tmp_path):
        src = tmp_path / "role.json"
        src.write_text(json.dumps({"role": "user", "content": "hello"}, ensure_ascii=False), encoding="utf-8")
        out = tmp_path / "out.txt"

        runner = CliRunner()
        result = runner.invoke(
            export_cmd,
            [str(src), "--format", "txt", "--output", str(out)],
            obj={"console": Console(record=True)},
        )

        assert result.exit_code == 0
        assert "hello" in out.read_text(encoding="utf-8")

    def test_export_callback_unsupported_format_branch(self, tmp_path):
        src = tmp_path / "a.txt"
        src.write_text("content", encoding="utf-8")
        out = tmp_path / "out.bad"

        callback = export_cmd.callback
        while hasattr(callback, "__wrapped__"):
            callback = callback.__wrapped__

        console = Console(record=True)
        fake_ctx = types.SimpleNamespace(obj={"console": console})

        callback(
            fake_ctx,
            source=str(src),
            format="bad-format",
            output=str(out),
            template="plain",
            include_meta=False,
        )

        output = console.export_text()
        assert "Unsupported format" in output
        assert not out.exists()


class TestInitCommand:
    def test_init_creates_structure_and_config(self, tmp_path):
        runner = CliRunner()

        result = runner.invoke(
            init_cmd,
            ["--name", "demo", "--template", "novel", "--path", str(tmp_path)],
            obj={"console": Console(record=True)},
        )

        assert result.exit_code == 0
        niko_dir = tmp_path / ".niko"
        assert (niko_dir / "sessions").exists()
        assert (niko_dir / "memory").exists()
        assert (niko_dir / "config" / "project.yaml").exists()

    def test_init_memory_engine_importerror_branch(self, tmp_path):
        runner = CliRunner()
        original_import = __import__

        def fake_import(name, *args, **kwargs):
            if name == "src.memory.unified_memory":
                raise ImportError("missing memory module")
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=fake_import):
            result = runner.invoke(
                init_cmd,
                ["--name", "demo2", "--template", "custom", "--path", str(tmp_path)],
                obj={"console": Console(record=True)},
            )

        assert result.exit_code == 0
        assert "Memory engine not available" in result.output

    def test_init_memory_engine_exception_branch(self, tmp_path):
        runner = CliRunner()

        class FakeMemoryEngine:
            def __init__(self, db_path):
                self.db_path = db_path

            def close(self):
                return None

        fake_module = types.SimpleNamespace(UnifiedMemoryEngine=FakeMemoryEngine)

        with patch.dict(sys.modules, {"src.memory.unified_memory": fake_module}):
            with patch.object(FakeMemoryEngine, "__init__", side_effect=RuntimeError("boom")):
                result = runner.invoke(
                    init_cmd,
                    ["--name", "demo3", "--template", "screenplay", "--path", str(tmp_path)],
                    obj={"console": Console(record=True)},
                )

        assert result.exit_code == 0
        assert "Memory engine init warning" in result.output

    def test_evaluate_requires_file_or_text(self):
        runner = CliRunner()
        result = runner.invoke(evaluate_cmd, [], obj={"console": Console(record=True)})

        assert result.exit_code == 0
        assert "Provide either a file or --text" in result.output

    def test_analyze_lock_returns_expected_keys(self):
        text = "Must find the truth, but obstacles remain. Finally, the end!"
        scores = _analyze_lock(text)

        assert set(scores.keys()) == {"L", "O", "C", "K"}
        assert all(0 <= v <= 10 for v in scores.values())

    def test_analyze_quality_returns_eight_dimensions(self):
        scores = _analyze_quality("He said \"hello\". They see and feel the rain.")

        assert len(scores) == 8
        assert "Dialogue Quality" in scores

    @pytest.mark.asyncio
    async def test_evaluate_content_fallback_without_critic_engine(self):
        original_import = __import__

        def fake_import(name, *args, **kwargs):
            if name == "src.narrative.evaluators.critic_engine":
                raise ImportError("mock missing")
            return original_import(name, *args, **kwargs)

        console = Console(record=True)
        with patch("builtins.__import__", side_effect=fake_import):
            await _evaluate_content(console, "test content", "summary", None)

        assert "Evaluation performed with basic analysis" in console.export_text()

    @pytest.mark.asyncio
    async def test_evaluate_content_saves_output_file(self, tmp_path):
        out = tmp_path / "eval.json"
        console = Console(record=True)

        original_import = __import__

        def fake_import(name, *args, **kwargs):
            if name == "src.narrative.evaluators.critic_engine":
                raise ImportError("mock missing")
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=fake_import):
            await _evaluate_content(console, "hello world", "lock", str(out))

        saved = json.loads(out.read_text(encoding="utf-8"))
        assert "lock_scores" in saved
        assert "quality_average" in saved


    def test_evaluate_command_with_text_invokes_asyncio(self):
        runner = CliRunner()
        calls = {"count": 0}

        def _consume(coro):
            calls["count"] += 1
            coro.close()

        with patch("src.cli.commands.evaluate.asyncio.run", side_effect=_consume):
            result = runner.invoke(
                evaluate_cmd,
                ["--text", "hello", "--format", "summary"],
                obj={"console": Console(record=True)},
            )

        assert result.exit_code == 0
        assert calls["count"] == 1

    def test_evaluate_command_with_file_invokes_asyncio(self, tmp_path):
        src = tmp_path / "input.txt"
        src.write_text("abc", encoding="utf-8")
        runner = CliRunner()
        calls = {"count": 0}

        def _consume(coro):
            calls["count"] += 1
            coro.close()

        with patch("src.cli.commands.evaluate.asyncio.run", side_effect=_consume):
            result = runner.invoke(
                evaluate_cmd,
                [str(src), "--format", "quality"],
                obj={"console": Console(record=True)},
            )

        assert result.exit_code == 0
        assert calls["count"] == 1

    @pytest.mark.asyncio
    async def test_evaluate_content_uses_critic_engine_when_available(self):
        class FakeCritic:
            async def evaluate(self, _content):
                return {
                    "lock_scores": {"L": 8, "O": 8, "C": 8, "K": 8},
                    "quality_scores": {"Style": 90, "Logic": 80},
                    "analysis": "ok",
                }

        fake_module = types.SimpleNamespace(CriticEngine=FakeCritic)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.narrative.evaluators.critic_engine": fake_module}):
            await _evaluate_content(console, "x", "full", None)

        output = console.export_text()
        assert "LOCK Score:" in output
        assert "Quality Avg:" in output
        assert "ok" in output
    @pytest.mark.asyncio
    async def test_run_workflow_importerror(self):
        original_import = __import__

        def fake_import(name, *args, **kwargs):
            if name == "src.workflow.workflow_engine":
                raise ImportError("missing")
            return original_import(name, *args, **kwargs)

        console = Console(record=True)
        with patch("builtins.__import__", side_effect=fake_import):
            await _run_workflow(console, "task", "auto", None, False)

        assert "WorkflowEngine not available" in console.export_text()

    @pytest.mark.asyncio
    async def test_run_workflow_dry_run(self):
        class FakeWorkflowEngine:
            instances = []

            def __init__(self):
                self.execute_calls = 0
                self.__class__.instances.append(self)

            async def route(self, task):
                return {"level": "L3-Standard", "description": "d", "reason": "r"}

            async def plan(self, task, level=None):
                return {
                    "plan_id": "p1",
                    "steps": [{"id": "step-1", "name": "n", "description": "d", "status": "pending"}],
                }

            async def execute(self, plan_id):
                self.execute_calls += 1
                return {"plan_status": "completed", "status": "completed"}

            def get_plan_status(self, plan_id):
                return {"plan_id": plan_id, "status": "completed", "progress": "1/1"}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_workflow(console, "task", "auto", None, True)

        assert "Dry run mode - execution skipped" in console.export_text()
        assert FakeWorkflowEngine.instances[0].execute_calls == 0

    @pytest.mark.asyncio
    async def test_run_workflow_full_execution_with_level_override(self):
        class FakeWorkflowEngine:
            def __init__(self):
                self.execute_calls = 0

            async def route(self, task):
                return {"level": "L2-Lite", "description": "d", "reason": "r"}

            async def plan(self, task, level=None):
                return {
                    "plan_id": "p2",
                    "steps": [{"id": "step-1", "name": "n", "description": "d", "status": "pending"}],
                }

            async def execute(self, plan_id):
                self.execute_calls += 1
                return {"plan_status": "completed", "status": "completed", "step_name": "n"}

            def get_plan_status(self, plan_id):
                return {"plan_id": plan_id, "status": "completed", "progress": "1/1"}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_workflow(console, "task", "1", None, False)

        output = console.export_text()
        assert "Override:" in output
        assert "Workflow Complete" in output

    @pytest.mark.asyncio
    async def test_run_workflow_execute_error_branch(self):
        class FakeWorkflowEngine:
            async def route(self, task):
                return {"level": "L3-Standard", "description": "d", "reason": "r"}

            async def plan(self, task, level=None):
                return {
                    "plan_id": "p3",
                    "steps": [{"id": "step-1", "name": "n", "description": "d", "status": "pending"}],
                }

            async def execute(self, plan_id):
                return {"error": "boom"}

            def get_plan_status(self, plan_id):
                return {"plan_id": plan_id, "status": "failed", "progress": "0/1"}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_workflow(console, "task", "auto", None, False)

        assert "Error:" in console.export_text()

    @pytest.mark.asyncio
    async def test_run_workflow_passes_namespace_to_engine(self):
        class FakeWorkflowEngine:
            captured_namespace = None

            def __init__(self, session_namespace=""):
                self.__class__.captured_namespace = session_namespace

            async def route(self, task):
                return {"level": "L3-Standard", "description": "d", "reason": "r"}

            async def plan(self, task, level=None, recommendations=None):
                return {
                    "plan_id": "p-ns",
                    "steps": [{"id": "step-1", "name": "n", "description": "d", "status": "pending"}],
                }

            async def execute(self, plan_id):
                return {"plan_status": "completed", "status": "completed"}

            def get_plan_status(self, plan_id):
                return {"plan_id": plan_id, "status": "completed", "progress": "1/1"}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_workflow(console, "task", "auto", None, False, namespace="novel-a")

        assert FakeWorkflowEngine.captured_namespace == "novel-a"

    @pytest.mark.asyncio
    async def test_run_workflow_rejects_session_namespace_mismatch(self):
        class FakeWorkflowEngine:
            def __init__(self, session_namespace=""):
                self.plan_sessions = {}

            async def route(self, task):
                return {"level": "L3-Standard", "description": "d", "reason": "r"}

            async def plan(self, task, level=None, recommendations=None):
                return {
                    "plan_id": "p-mismatch",
                    "steps": [{"id": "step-1", "name": "n", "description": "d", "status": "pending"}],
                }

            async def execute(self, plan_id):
                return {"plan_status": "completed", "status": "completed"}

            def get_plan_status(self, plan_id):
                return {"plan_id": plan_id, "status": "completed", "progress": "1/1"}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_workflow(
                console,
                "task",
                "auto",
                "novel-b--workflow-existing",
                False,
                namespace="novel-a",
            )

        assert "session does not match namespace isolation boundary" in console.export_text()

    @pytest.mark.asyncio
    async def test_run_workflow_binds_explicit_session_to_plan(self):
        class FakeWorkflowEngine:
            instance = None

            def __init__(self, session_namespace=""):
                self.plan_sessions = {}
                self.__class__.instance = self

            async def route(self, task):
                return {"level": "L3-Standard", "description": "d", "reason": "r"}

            async def plan(self, task, level=None, recommendations=None):
                return {
                    "plan_id": "p-bind",
                    "steps": [{"id": "step-1", "name": "n", "description": "d", "status": "pending"}],
                }

            async def execute(self, plan_id):
                return {"plan_status": "completed", "status": "completed"}

            def get_plan_status(self, plan_id):
                return {"plan_id": plan_id, "status": "completed", "progress": "1/1"}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_workflow(
                console,
                "task",
                "auto",
                "novel-a--workflow-existing",
                False,
                namespace="novel-a",
            )

        assert FakeWorkflowEngine.instance.plan_sessions["p-bind"] == "novel-a--workflow-existing"

    @pytest.mark.asyncio
    async def test_run_workflow_passes_genre_recommendation(self):
        class FakeWorkflowEngine:
            captured_recommendations = None

            async def route(self, task):
                return {"level": "L3-Standard", "description": "d", "reason": "r"}

            async def plan(self, task, level=None, recommendations=None):
                self.__class__.captured_recommendations = recommendations
                return {
                    "plan_id": "p-genre",
                    "steps": [{"id": "step-1", "name": "n", "description": "d", "status": "pending"}],
                }

            async def execute(self, plan_id):
                return {"plan_status": "completed", "status": "completed"}

            def get_plan_status(self, plan_id):
                return {"plan_id": plan_id, "status": "completed", "progress": "1/1"}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_workflow(console, "task", "auto", None, False, genre="mystery")

        recommendations = FakeWorkflowEngine.captured_recommendations
        assert isinstance(recommendations, list)
        assert recommendations[0]["action"] == "set_quality_controls"
        assert recommendations[1]["action"] == "set_generation_controls"
        assert recommendations[1]["params"]["style"] == "cinematic"
        assert recommendations[1]["params"]["length"] == "medium"
        assert recommendations[1]["params"]["constraints"][0] == "Maintain clue consistency across all scenes"

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "genre,expected_style,expected_length",
        [
            ("sci-fi", "neutral", "medium"),
            ("科幻", "neutral", "medium"),
            ("none", None, None),
        ],
    )
    async def test_run_workflow_genre_alias_matrix(self, genre, expected_style, expected_length):
        class FakeWorkflowEngine:
            captured_recommendations = None

            async def route(self, task):
                return {"level": "L3-Standard", "description": "d", "reason": "r"}

            async def plan(self, task, level=None, recommendations=None):
                self.__class__.captured_recommendations = recommendations
                return {
                    "plan_id": "p-genre-matrix",
                    "steps": [{"id": "step-1", "name": "n", "description": "d", "status": "pending"}],
                }

            async def execute(self, plan_id):
                return {"plan_status": "completed", "status": "completed"}

            def get_plan_status(self, plan_id):
                return {"plan_id": plan_id, "status": "completed", "progress": "1/1"}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_workflow(console, "task", "auto", None, False, genre=genre)

        recommendations = FakeWorkflowEngine.captured_recommendations
        assert isinstance(recommendations, list)
        assert recommendations[0]["action"] == "set_quality_controls"
        if expected_style is None:
            assert len(recommendations) == 1
        else:
            assert recommendations[1]["action"] == "set_generation_controls"
            assert recommendations[1]["params"]["style"] == expected_style
            assert recommendations[1]["params"]["length"] == expected_length


    @pytest.mark.asyncio
    async def test_run_workflow_progress_update_branch(self):
        class FakeWorkflowEngine:
            def __init__(self):
                self.calls = 0

            async def route(self, task):
                return {"level": "L3-Standard", "description": "d", "reason": "r"}

            async def plan(self, task, level=None):
                return {
                    "plan_id": "p4",
                    "steps": [
                        {"id": "step-1", "name": "n1", "description": "d", "status": "pending"},
                        {"id": "step-2", "name": "n2", "description": "d", "status": "pending"},
                    ],
                }

            async def execute(self, plan_id):
                self.calls += 1
                if self.calls == 1:
                    return {"status": "running", "step_name": "step-x"}
                return {"plan_status": "completed", "status": "completed"}

            def get_plan_status(self, plan_id):
                return {"plan_id": plan_id, "status": "completed", "progress": "2/2"}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_workflow(console, "task", "auto", None, False)

        assert "Workflow Complete" in console.export_text()

    def test_run_command_invokes_asyncio(self):
        runner = CliRunner()

        calls = {"count": 0}

        def _consume(coro):
            calls["count"] += 1
            coro.close()

        with patch("src.cli.commands.run.asyncio.run", side_effect=_consume):
            result = runner.invoke(
                run_cmd,
                ["--task", "demo task"],
                obj={"console": Console(record=True)},
            )

        assert result.exit_code == 0
        assert calls["count"] == 1


class TestGuidedDraftCommand:
    @pytest.mark.asyncio
    async def test_guided_draft_importerror(self):
        original_import = __import__

        def fake_import(name, *args, **kwargs):
            if name == "src.workflow.workflow_engine":
                raise ImportError("missing")
            return original_import(name, *args, **kwargs)

        console = Console(record=True)
        with patch("builtins.__import__", side_effect=fake_import):
            await _run_guided_draft(console, "idea", max_steps=5, json_output=False)

        assert "WorkflowEngine not available" in console.export_text()

    @pytest.mark.asyncio
    async def test_guided_draft_prints_draft_text(self):
        class FakeWorkflowEngine:
            def __init__(self):
                self.execute_calls = 0

            async def route(self, task):
                return {"level": "L2-Lite", "level_slug": "l2-lite", "reason": "r"}

            async def plan(self, task, level=None):
                return {
                    "plan_id": "p-guided",
                    "level": level or "L3-Standard",
                    "steps": [
                        {"id": "p-guided-0", "name": "analyze", "description": "d", "status": "planned"},
                        {"id": "p-guided-1", "name": "generate_draft", "description": "d", "status": "planned"},
                    ],
                }

            async def execute(self, plan_id):
                self.execute_calls += 1
                if self.execute_calls == 1:
                    return {"status": "completed", "step_name": "analyze", "plan_status": "running", "result": {}}
                return {
                    "status": "completed",
                    "step_name": "generate_draft",
                    "plan_status": "running",
                    "result": {"draft": "1. 开场", "section_count": 1},
                }

            def get_plan_status(self, plan_id):
                return {
                    "steps": [
                        {"name": "generate_draft", "output": {"draft": "1. 开场", "section_count": 1}},
                    ]
                }

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_guided_draft(console, "idea", max_steps=5, json_output=False)

        output = console.export_text()
        assert "Guided Session Complete" in output
        assert "First Draft" in output
        assert "1. 开场" in output

    @pytest.mark.asyncio
    async def test_guided_draft_json_output(self):
        class FakeWorkflowEngine:
            async def route(self, task):
                return {"level": "L3-Standard", "level_slug": "l3-standard", "reason": "r"}

            async def plan(self, task, level=None):
                return {
                    "plan_id": "p-guided-json",
                    "level": level or "L3-Standard",
                    "steps": [{"id": "p-guided-json-0", "name": "generate_draft", "description": "d", "status": "planned"}],
                }

            async def execute(self, plan_id):
                return {
                    "status": "completed",
                    "step_name": "generate_draft",
                    "plan_status": "running",
                    "result": {"draft": "1. 结构", "section_count": 1},
                }

            def get_plan_status(self, plan_id):
                return {"steps": []}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_guided_draft(console, "idea", max_steps=3, json_output=True)

        output = console.export_text()
        assert '"plan_id": "p-guided-json"' in output
        assert '"controls": {' in output
        assert '"style": "neutral"' in output
        assert '"length": "medium"' in output
        assert '"draft": "1. 结构"' in output

    @pytest.mark.asyncio
    async def test_guided_draft_passes_namespace_to_engine(self):
        class FakeWorkflowEngine:
            captured_namespace = None

            def __init__(self, session_namespace=""):
                self.__class__.captured_namespace = session_namespace

            async def route(self, task):
                return {"level": "L3-Standard", "level_slug": "l3-standard", "reason": "r"}

            async def plan(self, task, level=None, recommendations=None):
                return {
                    "plan_id": "p-guided-ns",
                    "level": level or "L3-Standard",
                    "steps": [{"id": "p-guided-ns-0", "name": "generate_draft", "description": "d", "status": "planned"}],
                }

            async def execute(self, plan_id):
                return {
                    "status": "completed",
                    "step_name": "generate_draft",
                    "plan_status": "running",
                    "result": {"draft": "1. 命名空间", "section_count": 1},
                }

            def get_plan_status(self, plan_id):
                return {"steps": []}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_guided_draft(console, "idea", namespace="novel-b", max_steps=3, json_output=True)

        assert FakeWorkflowEngine.captured_namespace == "novel-b"

    @pytest.mark.asyncio
    async def test_guided_draft_rejects_session_namespace_mismatch(self):
        class FakeWorkflowEngine:
            def __init__(self, session_namespace=""):
                self.plan_sessions = {}

            async def route(self, task):
                return {"level": "L3-Standard", "level_slug": "l3-standard", "reason": "r"}

            async def plan(self, task, level=None, recommendations=None):
                return {
                    "plan_id": "p-guided-mismatch",
                    "level": level or "L3-Standard",
                    "steps": [{"id": "p-guided-mismatch-0", "name": "generate_draft", "description": "d", "status": "planned"}],
                }

            async def execute(self, plan_id):
                return {
                    "status": "completed",
                    "step_name": "generate_draft",
                    "plan_status": "running",
                    "result": {"draft": "1. mismatch", "section_count": 1},
                }

            def get_plan_status(self, plan_id):
                return {"steps": []}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_guided_draft(
                console,
                "idea",
                session="novel-b--workflow-existing",
                namespace="novel-a",
                max_steps=3,
                json_output=True,
            )

        assert "session does not match namespace isolation boundary" in console.export_text()

    @pytest.mark.asyncio
    async def test_guided_draft_binds_explicit_session_to_plan(self):
        class FakeWorkflowEngine:
            instance = None

            def __init__(self, session_namespace=""):
                self.plan_sessions = {}
                self.__class__.instance = self

            async def route(self, task):
                return {"level": "L3-Standard", "level_slug": "l3-standard", "reason": "r"}

            async def plan(self, task, level=None, recommendations=None):
                return {
                    "plan_id": "p-guided-bind",
                    "level": level or "L3-Standard",
                    "steps": [{"id": "p-guided-bind-0", "name": "generate_draft", "description": "d", "status": "planned"}],
                }

            async def execute(self, plan_id):
                return {
                    "status": "completed",
                    "step_name": "generate_draft",
                    "plan_status": "running",
                    "result": {"draft": "1. bind", "section_count": 1},
                }

            def get_plan_status(self, plan_id):
                return {"steps": []}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_guided_draft(
                console,
                "idea",
                session="novel-a--workflow-existing",
                namespace="novel-a",
                max_steps=3,
                json_output=True,
            )

        assert FakeWorkflowEngine.instance.plan_sessions["p-guided-bind"] == "novel-a--workflow-existing"

    @pytest.mark.asyncio
    async def test_guided_draft_passes_controls_to_plan_recommendations(self):
        class FakeWorkflowEngine:
            captured_recommendations = None

            async def route(self, task):
                return {"level": "L3-Standard", "level_slug": "l3-standard", "reason": "r"}

            async def plan(self, task, level=None, recommendations=None):
                self.__class__.captured_recommendations = recommendations
                return {
                    "plan_id": "p-guided-controls",
                    "level": level or "L3-Standard",
                    "steps": [{"id": "p-guided-controls-0", "name": "generate_draft", "description": "d", "status": "planned"}],
                }

            async def execute(self, plan_id):
                return {
                    "status": "completed",
                    "step_name": "generate_draft",
                    "plan_status": "running",
                    "result": {"draft": "1. 控制", "section_count": 1},
                }

            def get_plan_status(self, plan_id):
                return {"steps": []}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        console = Console(record=True)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            await _run_guided_draft(
                console,
                "idea",
                controls={"style": "cinematic", "length": "long", "constraints": ["avoid passive voice"]},
                max_steps=3,
                json_output=True,
            )

        recommendations = FakeWorkflowEngine.captured_recommendations
        assert isinstance(recommendations, list)
        assert recommendations[0]["action"] == "set_generation_controls"
        assert recommendations[0]["params"]["style"] == "cinematic"
        assert recommendations[0]["params"]["length"] == "long"
        assert recommendations[0]["params"]["constraints"] == ["avoid passive voice"]

    def test_guided_draft_genre_profile_merges_into_controls(self):
        class FakeWorkflowEngine:
            captured_recommendations = None

            async def route(self, task):
                return {"level": "L3-Standard", "level_slug": "l3-standard", "reason": "r"}

            async def plan(self, task, level=None, recommendations=None):
                self.__class__.captured_recommendations = recommendations
                return {
                    "plan_id": "p-guided-genre",
                    "level": level or "L3-Standard",
                    "steps": [{"id": "p-guided-genre-0", "name": "generate_draft", "description": "d", "status": "planned"}],
                }

            async def execute(self, plan_id):
                return {
                    "status": "completed",
                    "step_name": "generate_draft",
                    "plan_status": "running",
                    "result": {"draft": "1. 题材", "section_count": 1},
                }

            def get_plan_status(self, plan_id):
                return {"steps": []}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        runner = CliRunner()

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            result = runner.invoke(
                guided_draft,
                ["--idea", "demo", "--genre", "xuanhuan"],
                obj={"console": Console(record=True)},
            )

        assert result.exit_code == 0
        recommendations = FakeWorkflowEngine.captured_recommendations
        assert isinstance(recommendations, list)
        assert recommendations[0]["action"] == "set_generation_controls"
        assert recommendations[0]["params"]["style"] == "lyrical"
        assert recommendations[0]["params"]["length"] == "long"
        assert "Keep realm progression and power boundaries consistent" in recommendations[0]["params"]["constraints"]

    @pytest.mark.parametrize(
        "genre,expected_style,expected_length",
        [
            ("xuanhuan", "lyrical", "long"),
            ("东方玄幻", "lyrical", "long"),
            ("悬疑", "cinematic", "medium"),
        ],
    )
    def test_guided_draft_genre_alias_matrix(self, genre, expected_style, expected_length):
        class FakeWorkflowEngine:
            captured_recommendations = None

            async def route(self, task):
                return {"level": "L3-Standard", "level_slug": "l3-standard", "reason": "r"}

            async def plan(self, task, level=None, recommendations=None):
                self.__class__.captured_recommendations = recommendations
                return {
                    "plan_id": "p-guided-genre-matrix",
                    "level": level or "L3-Standard",
                    "steps": [{"id": "p-guided-genre-matrix-0", "name": "generate_draft", "description": "d", "status": "planned"}],
                }

            async def execute(self, plan_id):
                return {
                    "status": "completed",
                    "step_name": "generate_draft",
                    "plan_status": "running",
                    "result": {"draft": "1. matrix", "section_count": 1},
                }

            def get_plan_status(self, plan_id):
                return {"steps": []}

        fake_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)
        runner = CliRunner()

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_module}):
            result = runner.invoke(
                guided_draft,
                ["--idea", "demo", "--genre", genre],
                obj={"console": Console(record=True)},
            )

        assert result.exit_code == 0
        recommendations = FakeWorkflowEngine.captured_recommendations
        assert recommendations[0]["action"] == "set_generation_controls"
        assert recommendations[0]["params"]["style"] == expected_style
        assert recommendations[0]["params"]["length"] == expected_length


    def test_guided_draft_command_validates_input(self):
        runner = CliRunner()
        result = runner.invoke(guided_draft, ["--idea", "   "], obj={"console": Console(record=True)})
        assert result.exit_code != 0
        assert "cannot be empty" in result.output

    def test_guided_draft_command_rejects_empty_constraint(self):
        runner = CliRunner()
        result = runner.invoke(
            guided_draft,
            ["--idea", "demo", "--constraint", "   "],
            obj={"console": Console(record=True)},
        )
        assert result.exit_code != 0
        assert "constraint cannot be empty" in result.output

    def test_guided_draft_command_invokes_asyncio(self):
        runner = CliRunner()
        calls = {"count": 0}

        def _consume(coro):
            calls["count"] += 1
            coro.close()

        with patch("src.cli.commands.guided_draft.asyncio.run", side_effect=_consume):
            result = runner.invoke(guided_draft, ["--idea", "demo"], obj={"console": Console(record=True)})

        assert result.exit_code == 0
        assert calls["count"] == 1


class TestChatCommand:
    @pytest.mark.asyncio
    async def test_handle_command_level_status_and_unknown(self):
        console = Console(record=True)
        history = [{"role": "user", "content": "hi"}]

        level_result = await _handle_command(console, "/level 4", "sid", 3, history, None)
        assert level_result == "level:4"

        invalid_level = await _handle_command(console, "/level 9", "sid", 3, history, None)
        assert invalid_level == ""

        unknown = await _handle_command(console, "/nope", "sid", 3, history, None)
        assert unknown == ""

    @pytest.mark.asyncio
    async def test_handle_command_save_and_export(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        console = Console(record=True)
        history = [
            {"role": "user", "content": "u"},
            {"role": "assistant", "content": "a"},
        ]

        await _handle_command(console, "/save", "s1", 3, history, None)
        await _handle_command(console, "/export", "s1", 3, history, None)

        assert (tmp_path / ".niko" / "sessions" / "s1.json").exists()
        exported = tmp_path / ".niko" / "exports" / "s1.md"
        assert exported.exists()
        assert "**Niko:**" in exported.read_text(encoding="utf-8")

    @pytest.mark.asyncio
    async def test_chat_loop_quit_and_memory_cleanup(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        (tmp_path / ".niko").mkdir(parents=True, exist_ok=True)

        class FakeMemoryEngine:
            last_instance = None

            def __init__(self, db_path):
                self.db_path = db_path
                self.closed = False
                self.__class__.last_instance = self

            async def add(self, **kwargs):
                return None

            def close(self):
                self.closed = True

        fake_memory_module = types.SimpleNamespace(UnifiedMemoryEngine=FakeMemoryEngine)

        with patch.dict(sys.modules, {"src.memory.unified_memory": fake_memory_module}):
            with patch("src.cli.commands.chat.Prompt.ask", return_value="/quit"):
                console = Console(record=True)
                await _chat_loop(console, "sess", 3, "model-x")

        assert FakeMemoryEngine.last_instance is not None
        assert FakeMemoryEngine.last_instance.closed is True

    @pytest.mark.asyncio
    async def test_handle_command_help_clear_and_status(self):
        console = Console(record=True)
        history = [{"role": "user", "content": "hi"}]

        await _handle_command(console, "/help", "sid", 3, history, None)

        with patch.object(console, "clear") as clear_mock:
            await _handle_command(console, "/clear", "sid", 3, history, None)
            clear_mock.assert_called_once()

        class MemoryFlag:
            pass

        await _handle_command(console, "/status", "sid", 3, history, MemoryFlag())
        output = console.export_text()
        assert "Available Commands" in output
        assert "Memory: Connected" in output

    @pytest.mark.asyncio
    async def test_chat_loop_with_workflow_execution_path(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)

        class FakeWorkflowEngine:
            async def route(self, _user_input):
                return {"level": "L3-Standard"}

            async def plan(self, _user_input, level=None):
                return {"plan_id": "pid", "total_steps": 1}

            async def execute(self, _plan_id):
                return {"plan_status": "completed", "result": "done"}

        fake_workflow_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_workflow_module}):
            with patch("src.cli.commands.chat.Prompt.ask", side_effect=["", "/level 4", "hello", "/quit"]):
                console = Console(record=True)
                await _chat_loop(console, "sess2", 3, "model-y")

        output = console.export_text()
        assert "Routing: L3-Standard" in output
        assert "Workflow completed: pid" in output

    @pytest.mark.asyncio
    async def test_chat_loop_importerror_fallback_paths(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)

        original_import = __import__

        def fake_import(name, *args, **kwargs):
            if name in {"src.memory.unified_memory", "src.workflow.workflow_engine"}:
                raise ImportError("mock missing")
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=fake_import):
            with patch("src.cli.commands.chat.Prompt.ask", side_effect=["hello", "/quit"]):
                console = Console(record=True)
                await _chat_loop(console, "sess3", 3, "model-z")

        assert "[Simulation] Processing" in console.export_text()

    @pytest.mark.asyncio
    async def test_chat_loop_l1_quick_response_and_memory_adds(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        (tmp_path / ".niko").mkdir(parents=True, exist_ok=True)

        class FakeMemoryEngine:
            instances = []

            def __init__(self, db_path):
                self.db_path = db_path
                self.calls = []
                self.__class__.instances.append(self)

            async def add(self, **kwargs):
                self.calls.append(kwargs)

            def close(self):
                return None

        class FakeWorkflowEngine:
            async def route(self, _user_input):
                return {"level": "L1-Rapid"}

        fake_memory_module = types.SimpleNamespace(UnifiedMemoryEngine=FakeMemoryEngine)
        fake_workflow_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)

        with patch.dict(
            sys.modules,
            {
                "src.memory.unified_memory": fake_memory_module,
                "src.workflow.workflow_engine": fake_workflow_module,
            },
        ):
            with patch("src.cli.commands.chat.Prompt.ask", side_effect=["hello", "/quit"]):
                console = Console(record=True)
                await _chat_loop(console, "sess-l1", 3, "model-m")

        output = console.export_text()
        assert "Quick response to: hello" in output
        assert len(FakeMemoryEngine.instances[0].calls) == 2
        assert FakeMemoryEngine.instances[0].calls[0]["source"] == "user"
        assert FakeMemoryEngine.instances[0].calls[1]["source"] == "agent"

    @pytest.mark.asyncio
    async def test_chat_loop_workflow_exception_branch(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)

        class FakeWorkflowEngine:
            async def route(self, _user_input):
                raise RuntimeError("boom")

        fake_workflow_module = types.SimpleNamespace(WorkflowEngine=FakeWorkflowEngine)

        with patch.dict(sys.modules, {"src.workflow.workflow_engine": fake_workflow_module}):
            with patch("src.cli.commands.chat.Prompt.ask", side_effect=["hello", "/quit"]):
                console = Console(record=True)
                await _chat_loop(console, "sess-err", 3, "model-e")

        assert "Workflow error: boom" in console.export_text()

    @pytest.mark.asyncio
    async def test_chat_loop_keyboard_interrupt_branch(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)

        with patch("src.cli.commands.chat.Prompt.ask", side_effect=[KeyboardInterrupt(), "/quit"]):
            console = Console(record=True)
            await _chat_loop(console, "sess-kb", 3, "model-k")

        assert "Use /quit to exit" in console.export_text()

    @pytest.mark.asyncio
    async def test_chat_loop_eof_branch(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)

        with patch("src.cli.commands.chat.Prompt.ask", side_effect=EOFError()):
            console = Console(record=True)
            await _chat_loop(console, "sess-eof", 3, "model-eof")

        assert "Session ended. Goodbye!" in console.export_text()

    def test_chat_command_invokes_asyncio(self):
        runner = CliRunner()

        calls = {"count": 0}

        def _consume(coro):
            calls["count"] += 1
            coro.close()

        with patch("src.cli.commands.chat.asyncio.run", side_effect=_consume):
            result = runner.invoke(
                chat_cmd,
                ["--level", "2"],
                obj={"console": Console(record=True)},
            )

        assert result.exit_code == 0
        assert calls["count"] == 1
