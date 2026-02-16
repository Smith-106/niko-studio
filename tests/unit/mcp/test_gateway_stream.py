"""
Gateway SSE Stream Endpoint Tests

Tests for POST /chat/stream SSE endpoint.
"""

import json
import pytest
from unittest.mock import MagicMock, AsyncMock

from src.workflow.levels.types import ANALYSIS_SCHEMA_VERSION, LEGACY_CONTRACT_FIELD_MAP


class _SceneTypeDialogue:
    value = "dialogue"


def _build_assignment():
    assignment = MagicMock()
    assignment.agent_type = "writer"
    assignment.instruction = "Write dialogue scene"
    assignment.model_dump = MagicMock(return_value={
        "agent_type": "writer",
        "instruction": "Write dialogue scene",
    })
    return assignment


def parse_sse_events(content: str) -> list:
    """Parse SSE events from response content"""
    events = []
    current_event = {}

    for line in content.split("\n"):
        line = line.strip()
        if not line:
            if current_event:
                events.append(current_event)
                current_event = {}
            continue

        if line.startswith("event:"):
            current_event["event"] = line[6:].strip()
        elif line.startswith("data:"):
            data_str = line[5:].strip()
            try:
                current_event["data"] = json.loads(data_str)
            except json.JSONDecodeError:
                current_event["data"] = data_str

    if current_event:
        events.append(current_event)

    return events


class TestStreamEndpoint:
    """Tests for POST /chat/stream endpoint"""

    def test_stream_returns_200(self, client_no_lifespan):
        """Test stream returns 200 status"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ]
        })
        assert response.status_code == 200

    def test_stream_content_type_is_sse(self, client_no_lifespan):
        """Test stream Content-Type is text/event-stream"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ]
        })
        assert "text/event-stream" in response.headers.get("content-type", "")

    def test_stream_cache_control_headers(self, client_no_lifespan):
        """Test stream has appropriate cache headers"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ]
        })
        assert response.headers.get("cache-control") == "no-cache"

    def test_stream_returns_start_event(self, client_no_lifespan):
        """Test stream returns start event"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ]
        })
        events = parse_sse_events(response.text)
        start_events = [e for e in events if e.get("event") == "start"]
        assert len(start_events) >= 1
        start_data = start_events[0]["data"]
        assert start_data["status"] == "started"
        assert start_data["analysis_schema_version"] == ANALYSIS_SCHEMA_VERSION
        assert start_data["contract_version"] == ANALYSIS_SCHEMA_VERSION
        assert start_data["compatibility"]["legacy_field_map"] == LEGACY_CONTRACT_FIELD_MAP
        assert "diagnostics" in start_data

    def test_stream_returns_routing_event(self, client_no_lifespan):
        """Test stream returns routing event"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ]
        })
        events = parse_sse_events(response.text)
        routing_events = [e for e in events if e.get("event") == "routing"]
        assert len(routing_events) >= 1

        routing_data = routing_events[0]["data"]
        assert "level" in routing_data
        assert "scene_type" in routing_data
        assert "skills" in routing_data

    def test_stream_returns_progress_events(self, client_no_lifespan):
        """Test stream returns progress events"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ]
        })
        events = parse_sse_events(response.text)
        progress_events = [e for e in events if e.get("event") == "progress"]
        assert len(progress_events) >= 1

        for progress in progress_events:
            assert "step" in progress["data"]
            assert "total" in progress["data"]
            assert "message" in progress["data"]

    def test_stream_returns_content_events(self, client_no_lifespan):
        """Test stream returns content events"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ]
        })
        events = parse_sse_events(response.text)
        content_events = [e for e in events if e.get("event") == "content"]
        assert len(content_events) >= 1

        for content in content_events:
            assert "chunk" in content["data"]
            assert "index" in content["data"]

    def test_stream_returns_done_event(self, client_no_lifespan):
        """Test stream returns done event"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ]
        })
        events = parse_sse_events(response.text)
        done_events = [e for e in events if e.get("event") == "done"]
        assert len(done_events) >= 1
        assert done_events[0]["data"]["status"] == "completed"
        assert done_events[0]["data"]["terminal"] == "done"
        assert done_events[0]["data"]["decision"] in {"go", "soft_go"}
        assert "diagnostics" in done_events[0]["data"]


class TestStreamEventSequence:
    """Tests for SSE event sequence"""

    def test_event_sequence_order(self, client_no_lifespan):
        """Test events arrive in correct order: start -> routing -> progress -> content -> done"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ]
        })
        events = parse_sse_events(response.text)
        event_types = [e.get("event") for e in events if e.get("event")]

        # Start should be first
        assert event_types[0] == "start"

        # Done should be last
        assert event_types[-1] == "done"

        # Routing should come before content
        if "routing" in event_types and "content" in event_types:
            routing_idx = event_types.index("routing")
            first_content_idx = event_types.index("content")
            assert routing_idx < first_content_idx

    def test_done_event_includes_skills_used(self, client_no_lifespan):
        """Test done event includes skills_used"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ]
        })
        events = parse_sse_events(response.text)
        done_events = [e for e in events if e.get("event") == "done"]
        assert len(done_events) >= 1
        assert "skills_used" in done_events[0]["data"]


class TestStreamErrorCases:
    """Tests for stream endpoint error cases"""

    def test_stream_empty_messages_returns_400(self, client_no_lifespan):
        """Test stream with empty messages returns 400"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": []
        })
        assert response.status_code == 400
        data = response.json()
        assert "error" in data

    def test_stream_no_user_message_returns_400(self, client_no_lifespan):
        """Test stream with no user message returns 400"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "assistant", "content": "Hello"}
            ]
        })
        assert response.status_code == 400

    def test_stream_invalid_workflow_level_returns_400(self, client_no_lifespan):
        """Test stream with invalid workflowLevel returns 400"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ],
            "workflowLevel": "L0"
        })
        assert response.status_code == 400
        data = response.json()
        assert data["error"] == "Invalid workflowLevel. Expected one of: L1, L2, L3, L4, L5"

    def test_stream_non_string_workflow_level_returns_400(self, client_no_lifespan):
        """Test stream with non-string workflowLevel returns 400"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ],
            "workflowLevel": True
        })
        assert response.status_code == 400
        data = response.json()
        assert data["error"] == "Invalid workflowLevel. Expected one of: L1, L2, L3, L4, L5"


class TestStreamL1Mode:
    """Tests for L1 rapid mode streaming"""

    def test_stream_l1_mode(self, client_no_lifespan):
        """Test stream with L1 rapid mode"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Fix this text"}
            ],
            "workflowLevel": "L1"
        })
        assert response.status_code == 200
        events = parse_sse_events(response.text)

        routing_events = [e for e in events if e.get("event") == "routing"]
        assert len(routing_events) >= 1
        assert routing_events[0]["data"]["level"] == "L1"


class TestStreamL3Mode:
    """Tests for L3 standard mode streaming with evaluation"""

    def test_stream_l3_includes_evaluation(self, client_no_lifespan):
        """Test L3 stream includes evaluation event"""
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a chapter"}
            ],
            "workflowLevel": "L3"
        })
        assert response.status_code == 200
        events = parse_sse_events(response.text)

        evaluation_events = [e for e in events if e.get("event") == "evaluation"]
        assert len(evaluation_events) >= 1

        eval_data = evaluation_events[0]["data"]
        assert "score" in eval_data
        assert "feedback" in eval_data


class TestStreamErrorEvents:
    """Tests for SSE error events"""

    def test_stream_writer_failure_emits_error_event(self, client_no_lifespan, monkeypatch):
        """Test stream emits error event when writer fails with fallback disabled"""
        from src.mcp import gateway as gateway_module

        mock_writer = MagicMock()
        mock_writer.inject_skills = MagicMock()
        mock_writer.write = AsyncMock(side_effect=RuntimeError("writer down"))
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a chapter"}
            ],
            "workflowLevel": "L3",
            "allowLlmFallback": False
        })

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert "Writer execution failed" in error_events[0]["data"]["error"]
        assert error_events[0]["data"]["terminal"] == "error"
        assert error_events[0]["data"]["decision"] == "no_go"
        assert error_events[0]["data"]["diagnostics"]["error_type"] in {"RuntimeError", "Exception"}


class TestStreamRoutingSemantics:
    """Tests for workflowLevel explicit vs auto-route in stream"""

    def test_stream_without_workflow_level_uses_commander_route(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_commander = MagicMock()
        mock_commander.route = MagicMock(return_value="L4")
        mock_commander.detect_scene_type = MagicMock(return_value=_SceneTypeDialogue())
        mock_commander.dispatch_skills = MagicMock(return_value=["dialogue-system"])
        mock_commander.dispatch_tasks = MagicMock(return_value=[_build_assignment()])
        monkeypatch.setattr(gateway_module, "get_commander_agent", lambda: mock_commander)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Write a scene"}]
        })

        assert response.status_code == 200
        assert mock_commander.route.call_count == 1

    def test_stream_with_explicit_workflow_level_skips_route(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_commander = MagicMock()
        mock_commander.route = MagicMock(return_value="L5")
        mock_commander.detect_scene_type = MagicMock(return_value=_SceneTypeDialogue())
        mock_commander.dispatch_skills = MagicMock(return_value=["dialogue-system"])
        mock_commander.dispatch_tasks = MagicMock(return_value=[_build_assignment()])
        monkeypatch.setattr(gateway_module, "get_commander_agent", lambda: mock_commander)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Write a scene"}],
            "workflowLevel": "L3"
        })

        assert response.status_code == 200
        assert mock_commander.route.call_count == 0


class TestStreamContractCompatibility:
    """Contract baseline tests for schema and legacy replay."""

    def test_stream_done_event_contract_legacy_replay(self, client_no_lifespan):
        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ]
        })
        assert response.status_code == 200
        events = parse_sse_events(response.text)
        done_events = [e for e in events if e.get("event") == "done"]
        assert len(done_events) >= 1

        payload = done_events[0]["data"]
        assert payload["analysis_schema_version"] == ANALYSIS_SCHEMA_VERSION
        assert payload["contract_version"] == ANALYSIS_SCHEMA_VERSION
        assert payload["compatibility"]["legacy_field_map"] == LEGACY_CONTRACT_FIELD_MAP
        assert payload["legacy_contract_fields"]["level"] == payload["workflow_level"]
        assert payload["legacy_contract_fields"]["level_slug"] == payload["workflow_level_slug"]

    def test_stream_error_event_contract_legacy_replay(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_writer = MagicMock()
        mock_writer.inject_skills = MagicMock()
        mock_writer.write = AsyncMock(side_effect=RuntimeError("writer down"))
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a chapter"}
            ],
            "workflowLevel": "L3",
            "allowLlmFallback": False
        })

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1

        payload = error_events[0]["data"]
        assert payload["analysis_schema_version"] == ANALYSIS_SCHEMA_VERSION
        assert payload["contract_version"] == ANALYSIS_SCHEMA_VERSION
        assert payload["compatibility"]["legacy_field_map"] == LEGACY_CONTRACT_FIELD_MAP
        assert payload["terminal"] == "error"
        assert payload["decision"] == "no_go"


class TestStreamSoftGateRecovery:
    """Tests for soft gate terminal semantics."""

    def test_soft_gate_done_event_uses_recovered_terminal(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_critic = MagicMock()
        mock_critic.evaluate = AsyncMock(side_effect=RuntimeError("critic down"))
        monkeypatch.setattr(gateway_module, "get_critic_engine", lambda: mock_critic)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [
                {"role": "user", "content": "Write a chapter"}
            ],
            "workflowLevel": "L3",
            "allowLlmFallback": True,
        })

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        done_events = [e for e in events if e.get("event") == "done"]
        assert len(done_events) >= 1

        payload = done_events[0]["data"]
        assert payload["decision"] == "soft_go"
        assert payload["terminal"] == "recovered"
        assert payload["legacy_contract_fields"]["terminal"] == "done"
        assert payload["diagnostics"]["fallback_reason"] in {"critic_unavailable", "writer_unavailable_l234", "writer_unavailable_l1"}




class TestStreamHardFailAndSleepBranches:
    """Tests for stream hard-fail and chunk sleep branches."""

    def test_stream_critic_failure_with_fallback_disabled_emits_error(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_writer = MagicMock()
        mock_writer.inject_skills = MagicMock()
        writer_result = MagicMock()
        writer_result.content = "writer content"
        mock_writer.write = AsyncMock(return_value=writer_result)
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)

        mock_critic = MagicMock()
        mock_critic.evaluate = AsyncMock(side_effect=RuntimeError("critic down"))
        monkeypatch.setattr(gateway_module, "get_critic_engine", lambda: mock_critic)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Write a chapter"}],
            "workflowLevel": "L3",
            "allowLlmFallback": False,
        })

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        payload = error_events[0]["data"]
        assert payload["terminal"] == "error"
        assert payload["decision"] == "no_go"
        assert "Writer execution failed with fallback disabled" in payload["error"]

    def test_stream_l1_multi_chunks_calls_sleep_between_chunks(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_writer = MagicMock()
        mock_writer.inject_skills = MagicMock()
        mock_writer.continue_writing = AsyncMock(return_value="line1. line2. line3.")
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)
        monkeypatch.setattr(gateway_module, "adaptive_chunk_content", lambda *_args, **_kwargs: ["c1", "c2", "c3"])

        sleep_mock = AsyncMock()
        monkeypatch.setattr(gateway_module.asyncio, "sleep", sleep_mock)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Fix this text"}],
            "workflowLevel": "L1",
        })

        assert response.status_code == 200
        assert sleep_mock.await_count == 2

    def test_stream_timeout_error_maps_to_interrupted_terminal(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_commander = MagicMock()
        mock_commander.route = MagicMock(side_effect=TimeoutError("stream timeout"))
        monkeypatch.setattr(gateway_module, "get_commander_agent", lambda: mock_commander)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Write a scene"}],
        })

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["terminal"] == "interrupted"

    def test_stream_outer_exception_returns_500(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        async def _broken_json(self):
            raise RuntimeError("bad body")

        monkeypatch.setattr(gateway_module.Request, "json", _broken_json)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Write a scene"}],
        })

        assert response.status_code == 500
        assert "bad body" in response.json()["error"]


class TestStreamAdditionalBranchCoverage:
    def test_stream_llm_unavailable_with_fallback_disabled_returns_503(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        monkeypatch.setattr(gateway_module, "_is_llm_available", lambda: False)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Write a scene"}],
            "allowLlmFallback": False,
        })

        assert response.status_code == 503
        assert response.json()["error"] == "LLM unavailable and fallback disabled"

    def test_stream_skips_skill_injection_when_no_skills(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_commander = MagicMock()
        mock_commander.route = MagicMock(return_value="L3")
        mock_commander.detect_scene_type = MagicMock(return_value=_SceneTypeDialogue())
        mock_commander.dispatch_skills = MagicMock(return_value=[])
        mock_commander.dispatch_tasks = MagicMock(return_value=[_build_assignment()])
        monkeypatch.setattr(gateway_module, "get_commander_agent", lambda: mock_commander)

        mock_writer = MagicMock()
        mock_writer.inject_skills = MagicMock()
        writer_result = MagicMock()
        writer_result.content = "writer content"
        mock_writer.write = AsyncMock(return_value=writer_result)
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Write a scene"}],
            "workflowLevel": "L3",
        })

        assert response.status_code == 200
        mock_writer.inject_skills.assert_not_called()

    def test_stream_l1_writer_failure_with_fallback_enabled_emits_soft_recovery(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_writer = MagicMock()
        mock_writer.inject_skills = MagicMock()
        mock_writer.continue_writing = AsyncMock(side_effect=RuntimeError("writer down"))
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Fix this text"}],
            "workflowLevel": "L1",
            "allowLlmFallback": True,
        })

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        done_events = [e for e in events if e.get("event") == "done"]
        assert len(done_events) >= 1
        payload = done_events[0]["data"]
        assert payload["terminal"] == "recovered"
        assert payload["decision"] == "soft_go"
        assert payload["diagnostics"]["fallback_reason"] == "writer_unavailable_l1"

    def test_stream_l3_writer_failure_with_fallback_enabled_emits_soft_recovery(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_writer = MagicMock()
        mock_writer.inject_skills = MagicMock()
        mock_writer.write = AsyncMock(side_effect=RuntimeError("writer down"))
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Write a chapter"}],
            "workflowLevel": "L3",
            "allowLlmFallback": True,
        })

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        content_events = [e for e in events if e.get("event") == "content"]
        assert len(content_events) >= 1
        assert "写作服务暂时不可用" in content_events[0]["data"]["chunk"]
        done_events = [e for e in events if e.get("event") == "done"]
        assert len(done_events) >= 1
        payload = done_events[0]["data"]
        assert payload["terminal"] == "recovered"
        assert payload["decision"] == "soft_go"
        assert payload["diagnostics"]["fallback_reason"] == "writer_unavailable_l234"

    def test_stream_l5_without_session_id_skips_state_injection(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        captured_state = {}

        def _execute(state):
            captured_state.update(state)
            return {
                "final_output": "L5 stream content",
                "score": 88,
                "feedback_context": "good",
            }

        mock_coordinator_instance = MagicMock()
        mock_coordinator_instance.execute = MagicMock(side_effect=_execute)
        monkeypatch.setattr(gateway_module, "Level5Coordinator", MagicMock(return_value=mock_coordinator_instance))

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Deep plan"}],
            "workflowLevel": "L5",
            "context": {
                "context": "story context",
            },
        })

        assert response.status_code == 200
        assert captured_state["session_id"] != "sess-stream-001"

    def test_stream_l5_multi_chunks_calls_sleep_between_chunks(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_coordinator_instance = MagicMock()
        mock_coordinator_instance.execute = MagicMock(return_value={
            "final_output": "L5 stream content",
            "score": 90,
            "feedback_context": "ok",
        })
        monkeypatch.setattr(gateway_module, "Level5Coordinator", MagicMock(return_value=mock_coordinator_instance))
        monkeypatch.setattr(gateway_module, "adaptive_chunk_content", lambda *_args, **_kwargs: ["c1", "c2", "c3"])

        sleep_mock = AsyncMock()
        monkeypatch.setattr(gateway_module.asyncio, "sleep", sleep_mock)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Deep plan"}],
            "workflowLevel": "L5",
        })

        assert response.status_code == 200
        assert sleep_mock.await_count == 2

    def test_stream_l3_multi_chunks_calls_sleep_between_chunks(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_writer = MagicMock()
        mock_writer.inject_skills = MagicMock()
        writer_result = MagicMock()
        writer_result.content = "writer content"
        mock_writer.write = AsyncMock(return_value=writer_result)
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)
        monkeypatch.setattr(gateway_module, "adaptive_chunk_content", lambda *_args, **_kwargs: ["c1", "c2", "c3"])

        sleep_mock = AsyncMock()
        monkeypatch.setattr(gateway_module.asyncio, "sleep", sleep_mock)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Write a chapter"}],
            "workflowLevel": "L3",
        })

        assert response.status_code == 200
        assert sleep_mock.await_count == 2

    def test_stream_l1_writer_failure_with_fallback_disabled_emits_error(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_writer = MagicMock()
        mock_writer.inject_skills = MagicMock()
        mock_writer.continue_writing = AsyncMock(side_effect=RuntimeError("writer down"))
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Fix this text"}],
            "workflowLevel": "L1",
            "allowLlmFallback": False,
        })

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        payload = error_events[0]["data"]
        assert payload["terminal"] == "error"
        assert payload["decision"] == "no_go"
        assert "Writer execution failed with fallback disabled" in payload["error"]

    def test_stream_l5_with_session_id_injects_state(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        captured_state = {}

        def _execute(state):
            captured_state.update(state)
            return {
                "final_output": "L5 stream content",
                "score": 88,
                "feedback_context": "good",
            }

        mock_coordinator_instance = MagicMock()
        mock_coordinator_instance.execute = MagicMock(side_effect=_execute)
        monkeypatch.setattr(gateway_module, "Level5Coordinator", MagicMock(return_value=mock_coordinator_instance))

        response = client_no_lifespan.post("/chat/stream", json={
            "messages": [{"role": "user", "content": "Deep plan"}],
            "workflowLevel": "L5",
            "context": {
                "session_id": "sess-stream-001",
                "context": "story context",
            },
        })

        assert response.status_code == 200
        assert captured_state["session_id"] == "sess-stream-001"
