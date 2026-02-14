"""
ServiceContainer - Lightweight Dependency Injection Container

Replaces global singletons with a centralized container for:
- Better testability (reset/mock injection)
- Lifecycle management
- Lazy initialization
"""

import asyncio
import logging
import os
from typing import Any, Dict, Optional, List

logger = logging.getLogger("niko-container")

# Singleton container instance
_container: Optional["ServiceContainer"] = None


def get_container() -> "ServiceContainer":
    """Get the global container instance."""
    global _container
    if _container is None:
        _container = ServiceContainer()
    return _container


def reset_container() -> None:
    """Reset the global container (for testing)."""
    global _container
    if _container is not None:
        _container.reset()
    _container = None


class ServiceContainer:
    """Lightweight DI container for engine management."""

    def __init__(self):
        self._engines: Dict[str, Any] = {}
        self._mocks: Dict[str, Any] = {}
        self._initialized = False
        self._engine_plugins_cache: Dict[str, List[Any]] = {}
        self._init_tasks: Dict[str, asyncio.Task] = {}

    def reset(self) -> None:
        """Clear all cached engines (for testing)."""
        # Cancel pending init tasks
        for task in self._init_tasks.values():
            if not task.done():
                task.cancel()
        self._init_tasks.clear()
        self._engines.clear()
        self._mocks.clear()
        self._engine_plugins_cache.clear()
        self._initialized = False

    def register_mock(self, name: str, mock: Any) -> None:
        """Register a mock for testing."""
        self._mocks[name] = mock

    def _get_or_create(self, name: str, factory) -> Any:
        """Get cached engine or create new one."""
        if name in self._mocks:
            return self._mocks[name]
        if name not in self._engines:
            engine = factory()
            self._engines[name] = engine
            init_fn = getattr(engine, "initialize", None)
            if init_fn is not None:
                self._schedule_init_task(name, init_fn)
        return self._engines[name]

    def _schedule_init_task(self, name: str, init_fn) -> None:
        """Schedule initialization task if missing and loop is running."""
        if name in self._init_tasks:
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        self._init_tasks[name] = loop.create_task(init_fn())

    # ============ Plugin Loading ============

    def _load_gateway_engine_config(self):
        """Load engine configuration from config."""
        from dataclasses import dataclass, field
        from src.config import get_config_value

        @dataclass
        class EnginePluginConfig:
            enabled: bool = False
            modules: List[str] = field(default_factory=list)

        @dataclass
        class GatewayEngineConfig:
            memory_plugins: EnginePluginConfig = field(default_factory=EnginePluginConfig)
            graph_plugins: EnginePluginConfig = field(default_factory=EnginePluginConfig)
            critic_plugins: EnginePluginConfig = field(default_factory=EnginePluginConfig)

        return GatewayEngineConfig(
            memory_plugins=EnginePluginConfig(
                enabled=get_config_value("engines.memory.plugins_enabled", False),
                modules=get_config_value("engines.memory.plugin_modules", []) or [],
            ),
            graph_plugins=EnginePluginConfig(
                enabled=get_config_value("engines.graph.plugins_enabled", False),
                modules=get_config_value("engines.graph.plugin_modules", []) or [],
            ),
            critic_plugins=EnginePluginConfig(
                enabled=get_config_value("engines.critic.plugins_enabled", False),
                modules=get_config_value("engines.critic.plugin_modules", []) or [],
            ),
        )

    def _load_engine_plugins(self, config) -> List[Any]:
        """Load plugins for an engine."""
        if not config.enabled:
            return []
        cache_key = ",".join(config.modules)
        if cache_key in self._engine_plugins_cache:
            return self._engine_plugins_cache[cache_key]

        plugins: List[Any] = []
        for module_path in config.modules:
            try:
                module_name, symbol_name = module_path.rsplit(".", 1)
                module = __import__(module_name, fromlist=[symbol_name])
                plugin_cls = getattr(module, symbol_name)
                plugins.append(plugin_cls())
            except Exception as exc:
                logger.error(f"Failed to load engine plugin {module_path}: {exc}")
        self._engine_plugins_cache[cache_key] = plugins
        return plugins

    # ============ Engine Properties ============

    @property
    def memory(self) -> Any:
        """Get memory engine (lazy loaded)."""
        def factory():
            from src.memory.unified_memory import UnifiedMemoryEngine
            engine_config = self._load_gateway_engine_config()
            plugins = self._load_engine_plugins(engine_config.memory_plugins)
            return UnifiedMemoryEngine.from_config(plugins=plugins)
        return self._get_or_create("memory", factory)

    @property
    def graph(self) -> Any:
        """Get graph engine (lazy loaded)."""
        def factory():
            from src.graph.graph_engine import GraphEngine
            engine_config = self._load_gateway_engine_config()
            plugins = self._load_engine_plugins(engine_config.graph_plugins)
            return GraphEngine.from_config(plugins=plugins)
        return self._get_or_create("graph", factory)

    @property
    def search(self) -> Any:
        """Get search engine (lazy loaded)."""
        def factory():
            from src.search.iterative_retriever import IterativeRetriever
            return IterativeRetriever()
        return self._get_or_create("search", factory)

    @property
    def workflow(self) -> Any:
        """Get workflow engine (lazy loaded)."""
        def factory():
            from src.workflow.workflow_engine import WorkflowEngine
            return WorkflowEngine()
        return self._get_or_create("workflow", factory)

    @property
    def critic(self) -> Any:
        """Get critic engine (lazy loaded)."""
        def factory():
            from src.narrative.critic_engine import CriticEngine
            engine_config = self._load_gateway_engine_config()
            plugins = self._load_engine_plugins(engine_config.critic_plugins)
            return CriticEngine.from_config(plugins=plugins)
        return self._get_or_create("critic", factory)

    @property
    def commander(self) -> Any:
        """Get commander agent (lazy loaded)."""
        def factory():
            from src.agents.commander import CommanderAgent
            return CommanderAgent(llm=None)
        return self._get_or_create("commander", factory)

    @property
    def writer(self) -> Any:
        """Get writer agent (lazy loaded)."""
        def factory():
            from src.agents.writer import WriterAgent
            from src.config import get_config

            config = get_config()
            google_key = (
                config.agent.google_api_key
                or os.getenv("GOOGLE_API_KEY")
                or os.getenv("GEMINI_API_KEY")
            )
            openai_key = config.agent.openai_api_key or os.getenv("OPENAI_API_KEY")

            llm = None

            if google_key:
                try:
                    from langchain_google_genai import ChatGoogleGenerativeAI
                    llm = ChatGoogleGenerativeAI(
                        model="gemini-pro",
                        temperature=0.7,
                        google_api_key=google_key,
                    )
                except Exception as exc:
                    logger.warning(f"Failed to initialize Google LLM for WriterAgent: {exc}")

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
                except Exception as exc:
                    logger.warning(f"Failed to initialize OpenAI LLM for WriterAgent: {exc}")

            return WriterAgent(llm=llm)
        return self._get_or_create("writer", factory)

    @property
    def backup(self) -> Any:
        """Get backup manager (lazy loaded)."""
        def factory():
            from src.services.backup_manager import BackupManager
            return BackupManager()
        return self._get_or_create("backup", factory)

    @property
    def token(self) -> Any:
        """Get token service (lazy loaded)."""
        def factory():
            from src.services.token_service import TokenService
            return TokenService()
        return self._get_or_create("token", factory)

    @property
    def obsidian(self) -> Any:
        """Get obsidian service (lazy loaded)."""
        def factory():
            from src.services.obsidian_service import ObsidianService
            return ObsidianService()
        return self._get_or_create("obsidian", factory)

    # ============ Lifecycle ============

    @property
    def engines_initialized(self) -> bool:
        """Check if engines have been pre-warmed."""
        return self._initialized

    async def ensure_initialized(self, *names: str, timeout: float = 30.0) -> None:
        """Wait for specified engines to complete initialization.

        Args:
            *names: Engine names to wait for (e.g., "memory", "graph")
            timeout: Maximum wait time in seconds
        """
        tasks = [self._init_tasks[n] for n in names if n in self._init_tasks]
        if tasks:
            try:
                await asyncio.wait_for(
                    asyncio.gather(*tasks, return_exceptions=True),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                logger.warning(f"Engine initialization timed out after {timeout}s")
            finally:
                for name in names:
                    task = self._init_tasks.get(name)
                    if task is not None and task.done():
                        self._init_tasks.pop(name, None)

    async def initialize_all(self) -> None:
        """Pre-warm critical engines (parallel initialization)."""
        if self._initialized:
            return

        logger.info("Pre-warming engines...")
        start_time = asyncio.get_event_loop().time()

        # Trigger lazy loading (this creates the init tasks)
        _ = self.memory
        _ = self.graph
        _ = self.critic
        _ = self.search
        _ = self.workflow

        # Wait for all initialization tasks to complete
        if self._init_tasks:
            await self.ensure_initialized(*self._init_tasks.keys(), timeout=60.0)

        self._initialized = True
        elapsed = asyncio.get_event_loop().time() - start_time
        logger.info(f"Engines pre-warmed in {elapsed:.2f}s")
