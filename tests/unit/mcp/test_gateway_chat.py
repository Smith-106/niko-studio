"""
Gateway Chat Endpoint Tests

Tests for POST /chat endpoint.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock


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


class TestChatEndpoint:
    """Tests for POST /chat endpoint"""

    def test_chat_returns_200_with_valid_request(self, client_no_lifespan):
        """Test chat returns 200 with valid request"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write a dialogue scene"}
            ]
        })
        assert response.status_code == 200

    def test_chat_returns_content(self, client_no_lifespan):
        """Test chat response includes content"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write a dialogue scene"}
            ]
        })
        data = response.json()
        assert "content" in data
        assert len(data["content"]) > 0

    def test_chat_returns_skills_used(self, client_no_lifespan):
        """Test chat response includes skills_used"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write a dialogue scene"}
            ]
        })
        data = response.json()
        assert "skills_used" in data
        assert isinstance(data["skills_used"], list)

    def test_chat_returns_workflow_info(self, client_no_lifespan):
        """Test chat response includes workflow_info"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write a dialogue scene"}
            ]
        })
        data = response.json()
        assert "workflow_info" in data
        workflow_info = data["workflow_info"]
        assert "level" in workflow_info
        assert "level_slug" in workflow_info
        assert "scene_type" in workflow_info
        assert "steps_completed" in workflow_info
        assert "total_steps" in workflow_info

    def test_chat_returns_evaluation(self, client_no_lifespan):
        """Test chat response includes evaluation"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write a dialogue scene"}
            ]
        })
        data = response.json()
        assert "evaluation" in data
        assert "score" in data["evaluation"]
        assert "feedback" in data["evaluation"]


class TestChatEndpointErrors:
    """Tests for chat endpoint error cases"""

    def test_chat_empty_messages_returns_400(self, client_no_lifespan):
        """Test chat with empty messages returns 400"""
        response = client_no_lifespan.post("/chat", json={
            "messages": []
        })
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert "No messages provided" in data["error"]

    def test_chat_no_user_message_returns_400(self, client_no_lifespan):
        """Test chat with no user message returns 400"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "assistant", "content": "Hello"}
            ]
        })
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert "No user message found" in data["error"]

    def test_chat_missing_messages_returns_400(self, client_no_lifespan):
        """Test chat without messages field returns 400"""
        response = client_no_lifespan.post("/chat", json={})
        assert response.status_code == 400

    def test_chat_invalid_workflow_level_returns_400(self, client_no_lifespan):
        """Test chat with invalid workflowLevel returns 400"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ],
            "workflowLevel": "L7"
        })
        assert response.status_code == 400
        data = response.json()
        assert data["error"] == "Invalid workflowLevel. Expected one of: L1, L2, L3, L4, L5"

    def test_chat_invalid_type_workflow_level_returns_400(self, client_no_lifespan):
        """Test chat with invalid type workflowLevel returns 400"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ],
            "workflowLevel": [3]
        })
        assert response.status_code == 400
        data = response.json()
        assert data["error"] == "Invalid workflowLevel. Expected one of: L1, L2, L3, L4, L5"

    def test_chat_int_workflow_level_accepted(self, client_no_lifespan):
        """Test chat with int workflowLevel (1-5) is accepted"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ],
            "workflowLevel": 3
        })
        assert response.status_code == 200


class TestChatWorkflowLevels:
    """Tests for different workflow levels"""

    def test_chat_l1_rapid_mode(self, client_no_lifespan):
        """Test chat with L1 rapid mode"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Fix this paragraph"}
            ],
            "workflowLevel": "L1"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["workflow_info"]["level"] == "L1"

    def test_chat_l4_brainstorm_mode(self, client_no_lifespan):
        """Test chat with L4 brainstorm mode"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ],
            "workflowLevel": "l4"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["workflow_info"]["level"] == "L4"

    def test_chat_l5_deep_mode(self, client_no_lifespan):
        """Test chat with L5 deep mode"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Plan entire book structure"}
            ],
            "workflowLevel": "L5"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["workflow_info"]["level"] == "L5"


class TestChatWithSkills:
    """Tests for chat with skills injection"""

    def test_chat_with_custom_skills(self, client_no_lifespan):
        """Test chat with custom skills list"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write dialogue"}
            ],
            "skills": ["dialogue-system", "tension-building"]
        })
        assert response.status_code == 200
        data = response.json()
        # Skills should be merged with dispatched skills
        assert "skills_used" in data

    def test_chat_skills_limited_to_five(self, client_no_lifespan):
        """Test that skills are limited to 5"""
        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ],
            "skills": ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]
        })
        assert response.status_code == 200
        data = response.json()
        assert len(data["skills_used"]) <= 5




class TestChatLlmFallback:
    """Tests for LLM fallback behavior"""

    def test_chat_llm_unavailable_returns_503_when_fallback_disabled(self, client_no_lifespan, monkeypatch):
        """Test LLM unavailable returns 503 if fallback disabled"""
        from src.mcp import gateway as gateway_module

        monkeypatch.setattr(gateway_module, "_is_llm_available", lambda: False)

        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write a scene"}
            ],
            "allowLlmFallback": False
        })

        assert response.status_code == 503
        data = response.json()
        assert data["error"] == "LLM unavailable and fallback disabled"


class TestChatWriterFailure:
    """Tests for chat error fallback on writer failure"""

    def test_chat_writer_failure_returns_analysis_content(self, client_no_lifespan, monkeypatch):
        """Test writer failure triggers analysis fallback content"""
        from src.mcp import gateway as gateway_module

        mock_writer = MagicMock()
        mock_writer.inject_skills = MagicMock()
        mock_writer.write = AsyncMock(side_effect=RuntimeError("writer down"))
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)

        response = client_no_lifespan.post("/chat", json={
            "messages": [
                {"role": "user", "content": "Write a chapter"}
            ],
            "workflowLevel": "L3"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["content"].startswith("## 任务分析")
        assert data["workflow_info"]["steps_completed"] == 1

class TestChatRoutingSemantics:
    """Tests for workflowLevel explicit vs auto-route semantics"""

    def test_chat_without_workflow_level_uses_commander_route(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_commander = MagicMock()
        mock_commander.route = MagicMock(return_value="L4")
        mock_commander.detect_scene_type = MagicMock(return_value=_SceneTypeDialogue())
        mock_commander.dispatch_skills = MagicMock(return_value=["dialogue-system"])
        mock_commander.dispatch_tasks = MagicMock(return_value=[_build_assignment()])
        monkeypatch.setattr(gateway_module, "get_commander_agent", lambda: mock_commander)

        response = client_no_lifespan.post("/chat", json={
            "messages": [{"role": "user", "content": "Write scene"}]
        })

        assert response.status_code == 200
        assert mock_commander.route.call_count == 1
        assert response.json()["workflow_info"]["level"] == "L4"

    def test_chat_with_explicit_workflow_level_skips_route(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_commander = MagicMock()
        mock_commander.route = MagicMock(return_value="L5")
        mock_commander.detect_scene_type = MagicMock(return_value=_SceneTypeDialogue())
        mock_commander.dispatch_skills = MagicMock(return_value=["dialogue-system"])
        mock_commander.dispatch_tasks = MagicMock(return_value=[_build_assignment()])
        monkeypatch.setattr(gateway_module, "get_commander_agent", lambda: mock_commander)

        response = client_no_lifespan.post("/chat", json={
            "messages": [{"role": "user", "content": "Write scene"}],
            "workflowLevel": "L3"
        })

        assert response.status_code == 200
        assert mock_commander.route.call_count == 0
        assert response.json()["workflow_info"]["level"] == "L3"




class TestChatHardFailAndCoordinatorState:
    """Tests for hard-fail branches and coordinator state propagation."""

    def test_chat_critic_failure_with_fallback_disabled_returns_500(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_writer = MagicMock()
        mock_writer.inject_skills = MagicMock()
        writer_result = MagicMock()
        writer_result.content = "writer content"
        writer_result.sensory_types_used = ["visual"]
        mock_writer.write = AsyncMock(return_value=writer_result)
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)

        mock_critic = MagicMock()
        mock_critic.evaluate = AsyncMock(side_effect=RuntimeError("critic down"))
        monkeypatch.setattr(gateway_module, "get_critic_engine", lambda: mock_critic)

        response = client_no_lifespan.post("/chat", json={
            "messages": [{"role": "user", "content": "Write a chapter"}],
            "workflowLevel": "L3",
            "allowLlmFallback": False,
        })

        assert response.status_code == 500
        assert "Writer execution failed with fallback disabled" in response.json()["error"]

    def test_chat_l5_coordinator_state_includes_session_id(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        captured_state = {}

        def _execute(state):
            captured_state.update(state)
            return {
                "final_output": "L5 Final Content",
                "score": 90,
                "feedback_context": "ok",
            }

        mock_coordinator_instance = MagicMock()
        mock_coordinator_instance.execute = MagicMock(side_effect=_execute)
        monkeypatch.setattr(gateway_module, "Level5Coordinator", MagicMock(return_value=mock_coordinator_instance))

        response = client_no_lifespan.post("/chat", json={
            "messages": [{"role": "user", "content": "Plan entire book structure"}],
            "workflowLevel": "L5",
            "context": {
                "session_id": "sess-chat-001",
                "context": "story context",
            },
        })

        assert response.status_code == 200
        assert captured_state["session_id"] == "sess-chat-001"


class TestChatAdditionalBranchCoverage:
    def test_chat_skips_skill_injection_when_no_skills(self, client_no_lifespan, monkeypatch):
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
        writer_result.sensory_types_used = []
        mock_writer.write = AsyncMock(return_value=writer_result)
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)

        response = client_no_lifespan.post("/chat", json={
            "messages": [{"role": "user", "content": "Write a chapter"}],
            "workflowLevel": "L3",
        })

        assert response.status_code == 200
        mock_writer.inject_skills.assert_not_called()

    def test_chat_critic_failure_with_fallback_enabled_uses_self_check_feedback(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_writer = MagicMock()
        mock_writer.inject_skills = MagicMock()
        writer_result = MagicMock()
        writer_result.content = "writer content"
        writer_result.sensory_types_used = ["visual", "auditory"]
        mock_writer.write = AsyncMock(return_value=writer_result)
        monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: mock_writer)

        mock_critic = MagicMock()
        mock_critic.evaluate = AsyncMock(side_effect=RuntimeError("critic down"))
        monkeypatch.setattr(gateway_module, "get_critic_engine", lambda: mock_critic)

        response = client_no_lifespan.post("/chat", json={
            "messages": [{"role": "user", "content": "Write a chapter"}],
            "workflowLevel": "L3",
            "allowLlmFallback": True,
        })

        assert response.status_code == 200
        data = response.json()
        assert data["evaluation"]["score"] == 75
        assert data["evaluation"]["feedback"] == "自检: 使用了 2 种感官描写"
