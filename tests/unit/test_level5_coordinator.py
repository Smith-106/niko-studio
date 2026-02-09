"""
Level5 Coordinator unit tests.
"""

from unittest.mock import MagicMock

from src.workflow.base_state import create_base_state
from src.workflow.levels.level5_coordinator import Level5Coordinator, Command, CommandType


def test_execute_unit_maps_result_fields():
    coordinator = Level5Coordinator()
    coordinator._coordinator_state = MagicMock()

    state = create_base_state(user_request="test")
    cmd = Command(
        command_id="cmd1",
        command_type=CommandType.EXECUTE,
        name="write",
        description="write content",
        agent="writer",
    )

    coordinator._execute_write = MagicMock(return_value={"content": "hello", "status": "completed"})

    unit = MagicMock()
    unit.command = cmd
    unit.unit_id = "unit1"
    unit.start = MagicMock()
    unit.complete = MagicMock()

    updated = coordinator._execute_unit(unit, state)

    assert updated["draft_content"] == "hello"
    assert updated["final_output"] == "hello"


def test_execute_unit_maps_plan_feedback_decision_analysis():
    coordinator = Level5Coordinator()
    coordinator._coordinator_state = MagicMock()

    state = create_base_state(user_request="test")
    cmd = Command(
        command_id="cmd2",
        command_type=CommandType.VERIFY,
        name="verify",
        description="verify content",
        agent="critic",
    )

    coordinator._execute_verify = MagicMock(return_value={
        "score": 92,
        "feedback": "ok",
        "decision": "APPROVED",
        "plan": {"steps": ["a"]},
        "analysis": [{"x": 1}],
        "status": "completed",
    })

    unit = MagicMock()
    unit.command = cmd
    unit.unit_id = "unit2"
    unit.start = MagicMock()
    unit.complete = MagicMock()

    updated = coordinator._execute_unit(unit, state)

    assert updated["score"] == 92
    assert updated["feedback_context"] == "ok"
    assert updated["decision"] == "APPROVED"
    assert updated["implementation_plan"] == {"steps": ["a"]}
    assert updated["metadata"]["analysis"] == [{"x": 1}]


def test_execute_sets_session_id_and_init_session_manager(monkeypatch):
    coordinator = Level5Coordinator()

    mock_sm = MagicMock()
    monkeypatch.setattr("src.workflow.levels.level5_coordinator.SessionManager", MagicMock(return_value=mock_sm))

    monkeypatch.setattr(coordinator, "_try_resume", MagicMock(return_value=None))
    monkeypatch.setattr(coordinator, "_analyze_requirements_phase", MagicMock(side_effect=lambda s: s))
    monkeypatch.setattr(coordinator, "_recommend_chain_phase", MagicMock(side_effect=lambda s: s))
    monkeypatch.setattr(coordinator, "_execute_chain_phase", MagicMock(side_effect=lambda s: s))
    monkeypatch.setattr(coordinator, "_all_units_completed", MagicMock(return_value=True))
    monkeypatch.setattr(coordinator, "persist_state", MagicMock(return_value="sid"))

    state = create_base_state(user_request="hello")
    state.pop("session_id", None)

    updated = coordinator.execute(state)

    assert updated.get("session_id")
    assert mock_sm.init.call_count >= 1


def test_load_state_prefers_session_manager(monkeypatch):
    coordinator = Level5Coordinator()

    fake = {
        "session_id": "s1",
        "phase": "planning",
        "created_at": "2026-01-01T00:00:00",
        "updated_at": "2026-01-01T00:00:00",
        "execution_units": [],
        "errors": [],
    }

    mock_sm = MagicMock()
    mock_sm.read = MagicMock(return_value=__import__("json").dumps(fake, ensure_ascii=False))
    monkeypatch.setattr("src.workflow.levels.level5_coordinator.SessionManager", MagicMock(return_value=mock_sm))

    loaded = coordinator.load_state("s1")
    assert loaded is not None
    assert loaded.session_id == "s1"


def test_persist_state_writes_session_manager(monkeypatch):
    coordinator = Level5Coordinator()

    mock_sm = MagicMock()
    monkeypatch.setattr("src.workflow.levels.level5_coordinator.SessionManager", MagicMock(return_value=mock_sm))

    coordinator._coordinator_state = MagicMock()
    coordinator_state = MagicMock()
    coordinator_state.session_id = "s1"
    coordinator_state.to_dict = MagicMock(return_value={"session_id": "s1", "phase": "planning"})

    out = coordinator.persist_state(coordinator_state)

    assert out == "s1"
    assert mock_sm.write.call_count >= 1
