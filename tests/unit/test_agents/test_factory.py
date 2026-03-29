"""
Unit tests for AgentFactory dependency injection.
"""

import pytest
from unittest.mock import Mock, MagicMock

from src.agents.factory import AgentFactory
from src.agents.base import AgentType


class TestAgentFactory:
    """Test suite for AgentFactory class."""

    @pytest.fixture
    def factory(self):
        """Create fresh factory instance for each test."""
        return AgentFactory()

    def test_get_agent_commander(self, factory):
        """Test creating Commander agent."""
        agent = factory.get_agent(AgentType.COMMANDER)
        assert agent is not None
        # CommanderAgent has an llm attribute
        assert hasattr(agent, 'llm')
        # Verify caching - same instance on second call
        agent2 = factory.get_agent(AgentType.COMMANDER)
        assert agent is agent2

    def test_get_agent_architect(self, factory):
        """Test creating Architect agent."""
        agent = factory.get_agent(AgentType.ARCHITECT)
        assert agent is not None
        # ArchitectAgent has an llm attribute
        assert hasattr(agent, 'llm')
        # Verify caching
        agent2 = factory.get_agent(AgentType.ARCHITECT)
        assert agent is agent2

    def test_get_agent_writer(self, factory):
        """Test creating Writer agent with LLM initialization."""
        agent = factory.get_agent(AgentType.WRITER)
        assert agent is not None
        # WriterAgent has an llm attribute
        assert hasattr(agent, 'llm')
        # Verify caching
        agent2 = factory.get_agent(AgentType.WRITER)
        assert agent is agent2

    def test_get_agent_critic(self, factory):
        """Test creating Critic agent."""
        agent = factory.get_agent(AgentType.CRITIC)
        assert agent is not None
        # CriticAgent has an llm attribute
        assert hasattr(agent, 'llm')
        # Verify caching
        agent2 = factory.get_agent(AgentType.CRITIC)
        assert agent is agent2

    def test_get_agent_plot(self, factory):
        """Test creating Plot agent."""
        agent = factory.get_agent(AgentType.PLOT)
        assert agent is not None
        assert hasattr(agent, 'run')
        # Verify caching
        agent2 = factory.get_agent(AgentType.PLOT)
        assert agent is agent2

    def test_lazy_initialization(self, factory):
        """Test that agents are created lazily."""
        # Factory starts empty
        assert len(factory.get_cached_types()) == 0
        
        # Request an agent
        agent = factory.get_agent(AgentType.COMMANDER)
        
        # Factory now has one cached type
        assert len(factory.get_cached_types()) == 1
        assert AgentType.COMMANDER in factory.get_cached_types()

    def test_agent_caching(self, factory):
        """Test that agent instances are cached and reused."""
        # Request same agent type multiple times
        agent1 = factory.get_agent(AgentType.COMMANDER)
        agent2 = factory.get_agent(AgentType.COMMANDER)
        agent3 = factory.get_agent(AgentType.COMMANDER)
        
        # All should be the same instance
        assert agent1 is agent2
        assert agent2 is agent3
        
        # Factory should only have one cached instance
        assert len(factory.get_cached_types()) == 1

    def test_mock_injection(self, factory):
        """Test mock injection for testing scenarios."""
        # Create mock agent
        mock_agent = Mock()
        mock_agent.run = Mock(return_value="mocked result")
        
        # Register mock
        factory.register_mock(AgentType.COMMANDER, mock_agent)
        
        # Get agent should return mock
        agent = factory.get_agent(AgentType.COMMANDER)
        assert agent is mock_agent
        assert agent.run() == "mocked result"

    def test_multiple_agent_types(self, factory):
        """Test creating multiple agent types."""
        commander = factory.get_agent(AgentType.COMMANDER)
        architect = factory.get_agent(AgentType.ARCHITECT)
        writer = factory.get_agent(AgentType.WRITER)
        
        # All should be different instances
        assert commander is not architect
        assert architect is not writer
        assert writer is not commander
        
        # Factory should have 3 cached types
        assert len(factory.get_cached_types()) == 3

    def test_reset_clears_cache(self, factory):
        """Test that reset() clears all cached instances."""
        # Create some agents
        factory.get_agent(AgentType.COMMANDER)
        factory.get_agent(AgentType.ARCHITECT)
        assert len(factory.get_cached_types()) == 2
        
        # Reset
        factory.reset()
        
        # Cache should be empty
        assert len(factory.get_cached_types()) == 0

    def test_custom_agent_name(self, factory):
        """Test creating agent with custom name."""
        agent = factory.get_agent(AgentType.PLOT, name="custom_plot")
        assert agent is not None
        assert agent.name == "custom_plot"

    def test_custom_agent_config(self, factory):
        """Test creating agent with custom configuration."""
        config = {"model": "gpt-4", "temperature": 0.5}
        agent = factory.get_agent(AgentType.PLOT, config=config)
        assert agent is not None
        # PlotAgent should have config attribute
        assert agent.config == config

    def test_unsupported_agent_type(self, factory):
        """Test that unsupported agent type raises ValueError."""
        # This should raise ValueError
        with pytest.raises(ValueError, match="Unsupported agent type"):
            # Create a fake agent type
            fake_type = Mock()
            fake_type.value = "fake_agent"
            factory._create_agent(fake_type, None, None, None)
