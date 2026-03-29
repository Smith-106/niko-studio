"""
AgentFactory - Dependency Injection Factory for Agent Instantiation

Provides centralized agent creation with lazy initialization and caching.
Enables decoupling of agent instantiation from workflow levels (ARCH-001 resolution).
"""

import logging
from typing import Any, Dict, Optional

from src.agents.base import AgentType

logger = logging.getLogger("niko-agent-factory")


class AgentFactory:
    """
    Factory for creating and caching agent instances.
    
    Implements lazy initialization pattern with instance caching to ensure
    single instance per agent type. Resolves ARCH-001 tight coupling issue
    by centralizing agent instantiation.
    """
    
    def __init__(self):
        """Initialize factory with empty instance cache."""
        self._instances: Dict[AgentType, Any] = {}
        self._mocks: Dict[AgentType, Any] = {}
        
    def register_mock(self, agent_type: AgentType, mock: Any) -> None:
        """
        Register a mock instance for testing.
        
        Args:
            agent_type: Type of agent to mock
            mock: Mock agent instance
        """
        self._mocks[agent_type] = mock
        logger.debug(f"Registered mock for {agent_type.value}")
    
    def get_agent(
        self, 
        agent_type: AgentType, 
        name: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
        llm: Optional[Any] = None
    ) -> Any:
        """
        Get or create agent instance with lazy initialization.
        
        Args:
            agent_type: Type of agent to retrieve
            name: Optional agent name (defaults to type value)
            config: Optional agent configuration
            llm: Optional LLM instance (for writer agent)
            
        Returns:
            Agent instance of requested type
            
        Raises:
            ValueError: If agent type is not supported
        """
        # Check for mock first (testing support)
        if agent_type in self._mocks:
            return self._mocks[agent_type]
        
        # Return cached instance if available
        if agent_type in self._instances:
            return self._instances[agent_type]
        
        # Create new instance
        agent = self._create_agent(agent_type, name, config, llm)
        self._instances[agent_type] = agent
        logger.info(f"Created and cached {agent_type.value} agent")
        return agent
    
    def _create_agent(
        self,
        agent_type: AgentType,
        name: Optional[str],
        config: Optional[Dict[str, Any]],
        llm: Optional[Any]
    ) -> Any:
        """
        Create agent instance based on type.

        Args:
            agent_type: Type of agent to create
            name: Agent name
            config: Agent configuration
            llm: LLM instance

        Returns:
            New agent instance

        Raises:
            ValueError: If agent type is not supported
        """
        if agent_type == AgentType.COMMANDER:
            from src.agents.commander import CommanderAgent
            return CommanderAgent(llm=llm)

        elif agent_type == AgentType.ARCHITECT:
            from src.agents.architect import ArchitectAgent
            # ArchitectAgent requires LLM
            if llm is None:
                llm = self._initialize_default_llm()
            return ArchitectAgent(llm=llm)

        elif agent_type == AgentType.WRITER:
            from src.agents.writer import WriterAgent
            # WriterAgent requires LLM
            if llm is None:
                llm = self._initialize_default_llm()
            return WriterAgent(llm=llm)

        elif agent_type == AgentType.CRITIC:
            from src.agents.critic import CriticAgent
            # CriticAgent requires LLM
            if llm is None:
                llm = self._initialize_default_llm()
            return CriticAgent(llm=llm)

        elif agent_type == AgentType.PLOT:
            from src.agents.plot import PlotAgent
            # PlotAgent has llm=None by default
            return PlotAgent(llm=llm, name=name or agent_type.value, config=config)

        else:
            raise ValueError(f"Unsupported agent type: {agent_type}")
    
    def _initialize_default_llm(self) -> Optional[Any]:
        """
        Initialize default LLM for agents that require it.
        
        Attempts to initialize LLM in order:
        1. Google Gemini (if API key available)
        2. OpenAI (if API key available)
        3. None (if no API keys available)
        
        Returns:
            LLM instance or None
        """
        import os
        from src.config import get_config
        
        config = get_config()
        google_key = (
            config.agent.google_api_key
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("GEMINI_API_KEY")
        )
        openai_key = config.agent.openai_api_key or os.getenv("OPENAI_API_KEY")
        
        llm = None
        
        # Try Google Gemini first
        if google_key:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                llm = ChatGoogleGenerativeAI(
                    model="gemini-pro",
                    temperature=0.7,
                    google_api_key=google_key,
                )
                logger.info("Initialized Google Gemini LLM for agent")
            except Exception as exc:
                logger.warning(f"Failed to initialize Google LLM: {exc}")
        
        # Fallback to OpenAI
        if llm is None and openai_key:
            try:
                from langchain_openai import ChatOpenAI
                
                openai_base = os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAI_API_BASE")
                if openai_base:
                    normalized = openai_base.rstrip("/")
                    if not normalized.endswith("/v1"):
                        normalized = f"{normalized}/v1"
                    openai_base = normalized
                
                openai_model = (
                    os.getenv("OPENAI_MODEL")
                    or os.getenv("OPENAI_CHAT_MODEL")
                    or config.agent.default_model
                    or "gpt-4o"
                )
                
                chat_openai_kwargs = {
                    "model": openai_model,
                    "temperature": 0.7,
                    "openai_api_key": openai_key,
                }
                if openai_base:
                    chat_openai_kwargs["openai_api_base"] = openai_base
                
                llm = ChatOpenAI(**chat_openai_kwargs)
                logger.info("Initialized OpenAI LLM for agent")
            except Exception as exc:
                logger.warning(f"Failed to initialize OpenAI LLM: {exc}")
        
        if llm is None:
            logger.warning("No LLM initialized - agent may have limited functionality")
        
        return llm
    
    def reset(self) -> None:
        """Clear all cached instances (for testing)."""
        self._instances.clear()
        self._mocks.clear()
        logger.debug("AgentFactory cache cleared")
    
    def get_cached_types(self) -> list[AgentType]:
        """Get list of currently cached agent types."""
        return list(self._instances.keys())
