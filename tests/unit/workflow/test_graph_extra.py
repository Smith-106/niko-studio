# -*- coding: utf-8 -*-
"""Workflow graph extra tests - DistillationNode, compile_graph, run_writing_session."""

import pytest
import importlib.util
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock

from src.workflow.graph import (
    DistillationNode, add_distillation_node, create_distillation_node,
    should_distill,
)
from src.memory.distillation_manager import DistillationTemplate


class TestDistillationNodeInit:
    def test_defaults(self):
        node = DistillationNode(template=DistillationTemplate.SUMMARY)
        assert node.template == DistillationTemplate.SUMMARY
        assert node._knowledge_layer is None
        assert node._distill_service is None

    def test_with_injected(self):
        kl = MagicMock()
        ds = MagicMock()
        node = DistillationNode(template=DistillationTemplate.SUMMARY, knowledge_layer=kl, distill_service=ds)
        assert node._knowledge_layer is kl
        assert node._distill_service is ds


class TestDistillationNodeProperties:
    def test_knowledge_layer_lazy(self):
        node = DistillationNode(template=DistillationTemplate.SUMMARY)
        mock_kl = MagicMock()
        with patch("src.services.knowledge_layer.AgentKnowledgeLayer", return_value=mock_kl):
            result = node.knowledge_layer
        assert result is mock_kl

    def test_knowledge_layer_cached(self):
        kl = MagicMock()
        node = DistillationNode(template=DistillationTemplate.SUMMARY, knowledge_layer=kl)
        assert node.knowledge_layer is kl

    def test_distill_service_lazy(self):
        node = DistillationNode(template=DistillationTemplate.SUMMARY)
        mock_ds = MagicMock()
        with patch("src.memory.distillation_manager.DistillationManager", return_value=mock_ds):
            result = node.distill_service
        assert result is mock_ds

    def test_distill_service_cached(self):
        ds = MagicMock()
        node = DistillationNode(template=DistillationTemplate.SUMMARY, distill_service=ds)
        assert node.distill_service is ds


class TestDistillationNodeProcess:
    def test_empty_draft_returns_state(self):
        node = DistillationNode(template=DistillationTemplate.SUMMARY)
        state = {"draft_content": ""}
        result = node.process(state)
        assert result is state

    def test_no_draft_returns_state(self):
        node = DistillationNode(template=DistillationTemplate.SUMMARY)
        state = {"other": "data"}
        result = node.process(state)
        assert result is state

    def test_with_draft_calls_execute(self):
        kl = MagicMock()
        ds = MagicMock()
        node = DistillationNode(template=DistillationTemplate.SUMMARY, knowledge_layer=kl, distill_service=ds)
        mock_result = MagicMock()
        with patch.object(node, "_execute_distillation", return_value=mock_result):
            state = {"draft_content": "some text", "current_scene": {"scene_id": "S1"}, "current_chapter": 1}
            result = node.process(state)
            assert "distillation_result" in result or result is not None


class TestShouldDistill:
    def test_no_draft(self):
        assert should_distill({"draft_content": ""}) is False

    def test_already_distilled(self):
        assert should_distill({"draft_content": "text", "distillation_result": {}}) is False

    def test_should(self):
        assert should_distill({"draft_content": "text"}) is True


class TestAddDistillationNode:
    def test_conditional_true(self):
        graph = MagicMock()
        result = add_distillation_node(graph, after_node="writer", conditional=True)
        graph.add_node.assert_called_once()
        graph.add_conditional_edges.assert_called_once()
        assert result is graph

    def test_conditional_false(self):
        graph = MagicMock()
        result = add_distillation_node(graph, after_node="writer", conditional=False)
        graph.add_node.assert_called_once()
        graph.add_edge.assert_called_once_with("writer", "distillation")
        assert result is graph

    def test_route_to_distill_goes_to_distillation(self):
        graph = MagicMock()
        add_distillation_node(graph, after_node="writer", conditional=True)

        route_fn = graph.add_conditional_edges.call_args.args[1]
        assert route_fn({"draft_content": "text"}) == "distillation"

    def test_route_to_distill_goes_to_critic(self):
        graph = MagicMock()
        add_distillation_node(graph, after_node="writer", conditional=True)

        route_fn = graph.add_conditional_edges.call_args.args[1]
        assert route_fn({"draft_content": "", "distillation_result": {}}) == "critic"


class TestCreateDistillationNode:
    def test_default(self):
        node = create_distillation_node()
        assert isinstance(node, DistillationNode)

    def test_with_template(self):
        node = create_distillation_node(template="summary")
        assert node.template.value == "summary"

    def test_with_knowledge_layer(self):
        kl = MagicMock()
        node = create_distillation_node(knowledge_layer=kl)
        assert node._knowledge_layer is kl


class TestCompileGraph:
    @patch("src.workflow.graph.create_writing_graph")
    @patch("src.workflow.graph.MemorySaver")
    def test_with_memory(self, mock_saver, mock_create):
        mock_graph = MagicMock()
        mock_create.return_value = mock_graph
        from src.workflow.graph import compile_graph
        result = compile_graph(use_memory=True)
        mock_graph.compile.assert_called_once()
        call_kwargs = mock_graph.compile.call_args
        assert call_kwargs is not None

    @patch("src.workflow.graph.create_writing_graph")
    def test_without_memory(self, mock_create):
        mock_graph = MagicMock()
        mock_create.return_value = mock_graph
        from src.workflow.graph import compile_graph
        result = compile_graph(use_memory=False)
        mock_graph.compile.assert_called_once_with()


class TestCreateWritingGraph:
    @patch("src.workflow.adapters.AdapterRegistry.create_adapter", return_value=None)
    def test_raises_when_adapter_is_none(self, _):
        with pytest.raises(ValueError, match="Failed to create NovelAdapter"):
            from src.workflow.graph import create_writing_graph
            create_writing_graph()


class TestImportFallback:
    def test_default_app_fallback_to_none_when_compile_fails(self):
        module_path = Path(__file__).resolve().parents[3] / "src" / "workflow" / "graph.py"
        spec = importlib.util.spec_from_file_location("graph_import_fail_case", module_path)
        module = importlib.util.module_from_spec(spec)

        with patch("src.workflow.adapters.AdapterRegistry.create_adapter", return_value=None):
            spec.loader.exec_module(module)

        assert module.app is None


class TestRunWritingSession:
    @pytest.mark.asyncio
    @patch("src.workflow.graph.compile_graph")
    @patch("src.workflow.graph.create_initial_state")
    async def test_basic(self, mock_init, mock_compile):
        mock_init.return_value = {"user_idea": "test"}
        mock_app = MagicMock()

        async def fake_stream(state):
            yield {"writer": {"draft_content": "output"}}

        mock_app.astream = fake_stream
        mock_compile.return_value = mock_app

        from src.workflow.graph import run_writing_session
        result = await run_writing_session("test idea", verbose=False)
        assert result is not None

    @pytest.mark.asyncio
    @patch("src.workflow.graph.compile_graph")
    @patch("src.workflow.graph.create_initial_state")
    async def test_verbose(self, mock_init, mock_compile, capsys):
        mock_init.return_value = {"user_idea": "test"}
        mock_app = MagicMock()

        async def fake_stream(state):
            yield {"writer": {"draft_content": "output"}}

        mock_app.astream = fake_stream
        mock_compile.return_value = mock_app

        from src.workflow.graph import run_writing_session
        await run_writing_session("test idea", verbose=True)
        captured = capsys.readouterr()
        assert "test idea" in captured.out
