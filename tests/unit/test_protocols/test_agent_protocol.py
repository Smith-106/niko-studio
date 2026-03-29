"""
Tests for Agent Protocol

Verifies AgentProtocol compliance.
"""

import pytest
from protocols import AgentProtocol


class MockAgent:
    """Mock implementation of AgentProtocol for testing."""
    
    @property
    def name(self) -> str:
        return "test_agent"
    
    async def execute(self, input_data, **kwargs):
        return {"result": "success"}
    
    def validate(self, input_data) -> tuple[bool, list[str]]:
        return (True, [])
    
    def format_output(self, result, **kwargs) -> dict:
        return {"formatted": result}
    
    async def health_check(self) -> bool:
        return True


class TestAgentProtocol:
    """Tests for AgentProtocol compliance."""
    
    def test_agent_protocol_compliance(self):
        """Verify MockAgent implements AgentProtocol protocol."""
        agent = MockAgent()
        assert isinstance(agent, AgentProtocol)
    
    def test_agent_has_required_methods(self):
        """Verify AgentProtocol has all required methods."""
        agent = MockAgent()
        assert hasattr(agent, 'name')
        assert hasattr(agent, 'execute')
        assert hasattr(agent, 'validate')
        assert hasattr(agent, 'format_output')
        assert hasattr(agent, 'health_check')
    
    @pytest.mark.asyncio
    async def test_agent_execute(self):
        """Test AgentProtocol.execute method."""
        agent = MockAgent()
        result = await agent.execute("test input")
        assert result == {"result": "success"}
    
    def test_agent_validate(self):
        """Test AgentProtocol.validate method."""
        agent = MockAgent()
        is_valid, errors = agent.validate("test input")
        assert is_valid is True
        assert errors == []
    
    @pytest.mark.asyncio
    async def test_agent_health_check(self):
        """Test AgentProtocol.health_check method."""
        agent = MockAgent()
        result = await agent.health_check()
        assert result is True
