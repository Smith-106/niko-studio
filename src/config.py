"""
统一配置管理模块

支持：
- 多配置源（YAML、环境变量、默认值）
- 热加载（文件变更自动重载）
- 全局单例访问
- 配置验证
- 配置变更通知
"""

import os
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TypeVar, Generic
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent
from dotenv import load_dotenv
import yaml
import logging

from src import __version__

logger = logging.getLogger(__name__)

T = TypeVar('T')


class ConfigSource(Enum):
    """配置来源"""
    DEFAULT = "default"
    ENV = "environment"
    FILE = "file"
    OVERRIDE = "override"


@dataclass
class ConfigValue(Generic[T]):
    """配置值包装器，记录来源"""
    value: T
    source: ConfigSource
    key: str
    timestamp: float = field(default_factory=time.time)

    def __repr__(self) -> str:
        return f"ConfigValue({self.key}={self.value}, source={self.source.value})"


class ConfigChangeEvent:
    """配置变更事件"""
    def __init__(self, key: str, old_value: Any, new_value: Any, source: ConfigSource):
        self.key = key
        self.old_value = old_value
        self.new_value = new_value
        self.source = source
        self.timestamp = time.time()


class ConfigFileHandler(FileSystemEventHandler):
    """配置文件变更处理器"""
    def __init__(self, config_manager: 'ConfigManager', config_path: Path):
        self.config_manager = config_manager
        self.config_path = config_path
        self._last_modified = 0
        self._debounce_seconds = 1.0  # 防抖延迟

    def on_modified(self, event):
        if not isinstance(event, FileModifiedEvent):
            return
        if Path(event.src_path).resolve() != self.config_path.resolve():
            return

        # 防抖处理
        current_time = time.time()
        if current_time - self._last_modified < self._debounce_seconds:
            return
        self._last_modified = current_time

        logger.info(f"Config file changed: {self.config_path}")
        self.config_manager._reload_from_file()


@dataclass
class AgentConfig:
    """Agent 相关配置"""
    # Token 成本控制
    max_cost_per_request: float = 1.0
    max_cost_per_session: float = 10.0
    max_tokens_per_request: int = 100000
    budget_warn_threshold: float = 0.8

    # 默认模型
    default_model: str = "gpt-4o"
    google_api_key: str = ""
    openai_api_key: str = ""

    # 日志级别
    log_level: str = "INFO"


@dataclass
class MemoryConfig:
    """Memory 相关配置"""
    # 向量存储
    vector_db_path: str = ".writing/vector_store"
    embedding_model: str = "text-embedding-3-small"
    embedding_dimension: int = 1536

    # 缓存
    cache_enabled: bool = True
    cache_ttl: int = 86400  # 24 hours
    cache_max_size: int = 10000

    # 分块
    chunk_size: int = 1000
    chunk_overlap: int = 200


@dataclass
class WorkflowConfig:
    """Workflow 相关配置"""
    # 会话
    session_timeout: int = 3600  # 1 hour
    max_concurrent_sessions: int = 10

    # 检查点
    checkpoint_enabled: bool = True
    checkpoint_interval: int = 300  # 5 minutes

    # 断点续传
    resume_strategy: str = "from_last_checkpoint"

    # 质量控制
    quality_mode: str = "auto"  # auto | manual
    quality_level: str = "high"  # ultra | high | medium | fluent
    degrade_on_timeout: bool = True
    degrade_on_error: bool = True
    critical_gate_always_on: bool = True
    quality_phase_timeout_seconds: int = 30


@dataclass
class GraphConfig:
    """Graph 相关配置"""
    # Kuzu 图数据库
    db_path: str = ".writing/graph_db"
    max_connections: int = 10

    # 实体
    max_entities_per_query: int = 100
    relation_depth: int = 3


@dataclass
class WritingConfig:
    """写作质量相关配置"""
    # 角色建模
    character_depth_dimensions: int = 5
    max_character_traits: int = 20

    # 场景检测
    scene_coherence_threshold: float = 0.8
    contradiction_sensitivity: str = "medium"

    # 伏笔追踪
    foreshadowing_max_distance: int = 50  # 章节数
    foreshadowing_reminder_threshold: int = 10

    # 风格学习
    style_vector_dimensions: int = 30
    style_sample_min_words: int = 5000


@dataclass
class GatewayConfig:
    """Gateway 相关配置"""
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    cors_dev_origins: List[str] = field(default_factory=lambda: ["*"])
    cors_prod_origins: List[str] = field(default_factory=lambda: ["https://app.example.com", "https://gray.example.com"])
    metrics_enabled: bool = True
    ui_bridge_enabled: bool = False


@dataclass
class BackupConfig:
    """备份相关配置"""
    backup_dir: str = ".writing/backups"
    compress: bool = True
    max_backups: int = 50

    # WebDAV
    webdav_enabled: bool = False
    webdav_url: str = ""
    webdav_username: str = ""
    webdav_password: str = ""
    webdav_remote_path: str = "/backups"

    # S3
    s3_enabled: bool = False
    s3_bucket: str = ""
    s3_prefix: str = "backups"
    s3_region: str = "us-east-1"


@dataclass
class TokenConfig:
    """Token 估算相关配置"""
    db_path: str = ".writing/token_usage.db"
    default_model: str = "gpt-4o"
    default_budget: float = 10.0
    budget_warn_threshold: float = 0.8


@dataclass
class ObsidianConfig:
    """Obsidian 集成配置"""
    enabled: bool = True
    auto_discover: bool = True
    sync_on_startup: bool = False
    default_vault: str = ""
    file_patterns: List[str] = field(default_factory=lambda: ["*.md"])


@dataclass
class AppConfig:
    """应用主配置"""
    # 基础
    app_name: str = "niko-studio"
    version: str = __version__
    debug: bool = False
    env: str = "development"

    # 路径
    data_dir: str = ".writing"
    log_dir: str = "logs"

    # 子配置
    agent: AgentConfig = field(default_factory=AgentConfig)
    memory: MemoryConfig = field(default_factory=MemoryConfig)
    workflow: WorkflowConfig = field(default_factory=WorkflowConfig)
    graph: GraphConfig = field(default_factory=GraphConfig)
    writing: WritingConfig = field(default_factory=WritingConfig)
    backup: BackupConfig = field(default_factory=BackupConfig)
    token: TokenConfig = field(default_factory=TokenConfig)
    obsidian: ObsidianConfig = field(default_factory=ObsidianConfig)
    gateway: GatewayConfig = field(default_factory=GatewayConfig)


class ConfigManager:
    """
    统一配置管理器

    支持：
    - 多配置源加载（默认值 < 环境变量 < 配置文件 < 运行时覆盖）
    - 热加载（文件变更自动重载）
    - 配置变更通知
    - 线程安全
    """

    _instance: Optional['ConfigManager'] = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(
        self,
        config_path: Optional[str | Path] = None,
        hot_reload: bool = True,
        auto_create: bool = True
    ):
        if self._initialized:
            return

        self._config_path: Optional[Path] = Path(config_path) if config_path else None
        self._hot_reload = hot_reload
        self._auto_create = auto_create

        self._config: AppConfig = AppConfig()
        self._raw_config: Dict[str, Any] = {}
        self._overrides: Dict[str, Any] = {}
        self._listeners: List[Callable[[ConfigChangeEvent], None]] = []

        self._observer: Optional[Observer] = None
        self._config_lock = threading.RLock()

        self._load_config()

        if hot_reload and self._config_path and self._config_path.exists():
            self._start_file_watcher()

        self._initialized = True

    def _load_config(self) -> None:
        """加载配置（按优先级：默认值 < 环境变量 < 配置文件）"""
        with self._config_lock:
            # 1. 从默认值开始
            self._config = AppConfig()

            # 2. 加载 .env 并从环境变量加载
            load_dotenv(override=False)
            self._load_from_env()

            # 3. 从配置文件加载
            if self._config_path:
                if self._config_path.exists():
                    self._load_from_file()
                elif self._auto_create:
                    self._create_default_config_file()

            # 4. 应用运行时覆盖
            self._apply_overrides()

            logger.info(f"Config loaded: env={self._config.env}, debug={self._config.debug}")

    def _load_from_env(self) -> None:
        """从环境变量加载配置"""

        def _parse_bool(raw: str) -> bool:
            return str(raw).strip().lower() in ('true', '1', 'yes', 'on')

        def _parse_csv(raw: str) -> List[str]:
            return [item.strip() for item in str(raw).split(',') if item.strip()]

        # 基础配置
        if os.getenv('NIKO_DEBUG'):
            self._config.debug = _parse_bool(os.getenv('NIKO_DEBUG', ''))
        if os.getenv('NIKO_ENV'):
            self._config.env = os.getenv('NIKO_ENV', 'development')

        # Agent 配置
        if os.getenv('NIKO_DEFAULT_MODEL'):
            self._config.agent.default_model = os.getenv('NIKO_DEFAULT_MODEL')
        if os.getenv('GOOGLE_API_KEY'):
            self._config.agent.google_api_key = os.getenv('GOOGLE_API_KEY', '')
        if os.getenv('OPENAI_API_KEY'):
            self._config.agent.openai_api_key = os.getenv('OPENAI_API_KEY', '')
        if os.getenv('NIKO_MAX_COST_PER_REQUEST'):
            self._config.agent.max_cost_per_request = float(os.getenv('NIKO_MAX_COST_PER_REQUEST'))
        if os.getenv('NIKO_MAX_COST_PER_SESSION'):
            self._config.agent.max_cost_per_session = float(os.getenv('NIKO_MAX_COST_PER_SESSION'))

        # Memory 配置
        if os.getenv('NIKO_VECTOR_DB_PATH'):
            self._config.memory.vector_db_path = os.getenv('NIKO_VECTOR_DB_PATH')
        if os.getenv('NIKO_EMBEDDING_MODEL'):
            self._config.memory.embedding_model = os.getenv('NIKO_EMBEDDING_MODEL')

        # Graph 配置
        if os.getenv('NIKO_GRAPH_DB_PATH'):
            self._config.graph.db_path = os.getenv('NIKO_GRAPH_DB_PATH')

        # Workflow 配置
        if os.getenv('NIKO_WORKFLOW_QUALITY_MODE'):
            self._config.workflow.quality_mode = os.getenv('NIKO_WORKFLOW_QUALITY_MODE', self._config.workflow.quality_mode)
        if os.getenv('NIKO_WORKFLOW_QUALITY_LEVEL'):
            self._config.workflow.quality_level = os.getenv('NIKO_WORKFLOW_QUALITY_LEVEL', self._config.workflow.quality_level)
        if os.getenv('NIKO_WORKFLOW_DEGRADE_ON_TIMEOUT'):
            self._config.workflow.degrade_on_timeout = _parse_bool(os.getenv('NIKO_WORKFLOW_DEGRADE_ON_TIMEOUT', ''))
        if os.getenv('NIKO_WORKFLOW_DEGRADE_ON_ERROR'):
            self._config.workflow.degrade_on_error = _parse_bool(os.getenv('NIKO_WORKFLOW_DEGRADE_ON_ERROR', ''))
        if os.getenv('NIKO_WORKFLOW_CRITICAL_GATE_ALWAYS_ON'):
            self._config.workflow.critical_gate_always_on = _parse_bool(os.getenv('NIKO_WORKFLOW_CRITICAL_GATE_ALWAYS_ON', ''))
        if os.getenv('NIKO_WORKFLOW_QUALITY_PHASE_TIMEOUT_SECONDS'):
            self._config.workflow.quality_phase_timeout_seconds = int(
                os.getenv('NIKO_WORKFLOW_QUALITY_PHASE_TIMEOUT_SECONDS', self._config.workflow.quality_phase_timeout_seconds)
            )

        # Gateway 配置
        if os.getenv('NIKO_GATEWAY_HOST'):
            self._config.gateway.host = os.getenv('NIKO_GATEWAY_HOST', self._config.gateway.host)
        if os.getenv('NIKO_GATEWAY_PORT'):
            self._config.gateway.port = int(os.getenv('NIKO_GATEWAY_PORT', self._config.gateway.port))
        if os.getenv('NIKO_GATEWAY_RELOAD'):
            self._config.gateway.reload = _parse_bool(os.getenv('NIKO_GATEWAY_RELOAD', ''))
        if os.getenv('NIKO_CORS_DEV_ORIGINS'):
            self._config.gateway.cors_dev_origins = _parse_csv(os.getenv('NIKO_CORS_DEV_ORIGINS', ''))
        if os.getenv('NIKO_CORS_PROD_ORIGINS'):
            self._config.gateway.cors_prod_origins = _parse_csv(os.getenv('NIKO_CORS_PROD_ORIGINS', ''))
        if os.getenv('NIKO_GATEWAY_METRICS_ENABLED'):
            self._config.gateway.metrics_enabled = _parse_bool(os.getenv('NIKO_GATEWAY_METRICS_ENABLED', ''))
        if os.getenv('NIKO_UI_BRIDGE_ENABLED'):
            self._config.gateway.ui_bridge_enabled = _parse_bool(os.getenv('NIKO_UI_BRIDGE_ENABLED', ''))

    def _load_from_file(self) -> None:
        """从 YAML 文件加载配置"""
        if not self._config_path or not self._config_path.exists():
            return

        try:
            with open(self._config_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}
            self._raw_config = data
            self._apply_dict_to_config(data)
            logger.info(f"Config loaded from {self._config_path}")
        except Exception as e:
            logger.error(f"Failed to load config from {self._config_path}: {e}")

    def _apply_dict_to_config(self, data: Dict[str, Any]) -> None:
        """将字典数据应用到配置对象"""
        # 基础配置
        if 'app_name' in data:
            self._config.app_name = data['app_name']
        if 'version' in data:
            self._config.version = data['version']
        if 'debug' in data:
            self._config.debug = data['debug']
        if 'env' in data:
            self._config.env = data['env']
        if 'data_dir' in data:
            self._config.data_dir = data['data_dir']

        # Agent 配置
        if 'agent' in data:
            agent_data = data['agent']
            for key, value in agent_data.items():
                if hasattr(self._config.agent, key):
                    setattr(self._config.agent, key, value)

        # Memory 配置
        if 'memory' in data:
            memory_data = data['memory']
            for key, value in memory_data.items():
                if hasattr(self._config.memory, key):
                    setattr(self._config.memory, key, value)

        # Workflow 配置
        if 'workflow' in data:
            workflow_data = data['workflow']
            for key, value in workflow_data.items():
                if hasattr(self._config.workflow, key):
                    setattr(self._config.workflow, key, value)

        # Graph 配置
        if 'graph' in data:
            graph_data = data['graph']
            for key, value in graph_data.items():
                if hasattr(self._config.graph, key):
                    setattr(self._config.graph, key, value)

        # Writing 配置
        if 'writing' in data:
            writing_data = data['writing']
            for key, value in writing_data.items():
                if hasattr(self._config.writing, key):
                    setattr(self._config.writing, key, value)

        # Gateway 配置
        if 'gateway' in data:
            gateway_data = data['gateway']
            for key, value in gateway_data.items():
                if hasattr(self._config.gateway, key):
                    setattr(self._config.gateway, key, value)

    def _apply_overrides(self) -> None:
        """应用运行时覆盖"""
        for key, value in self._overrides.items():
            self.set(key, value)

    def _create_default_config_file(self) -> None:
        """创建默认配置文件"""
        if not self._config_path:
            return

        self._config_path.parent.mkdir(parents=True, exist_ok=True)

        default_config = f"""# Niko-Studio 配置文件
# 此文件支持热加载，修改后自动生效

app_name: niko-studio
version: "{__version__}"
debug: false
env: development
data_dir: .writing

agent:
  default_model: gpt-4o
  google_api_key: ""
  openai_api_key: ""
  max_cost_per_request: 1.0
  max_cost_per_session: 10.0
  max_tokens_per_request: 100000
  budget_warn_threshold: 0.8
  log_level: INFO

memory:
  vector_db_path: .writing/vector_store
  embedding_model: text-embedding-3-small
  embedding_dimension: 1536
  cache_enabled: true
  cache_ttl: 86400
  cache_max_size: 10000
  chunk_size: 1000
  chunk_overlap: 200

workflow:
  session_timeout: 3600
  max_concurrent_sessions: 10
  checkpoint_enabled: true
  checkpoint_interval: 300
  resume_strategy: from_last_checkpoint
  quality_mode: auto
  quality_level: high
  degrade_on_timeout: true
  degrade_on_error: true
  critical_gate_always_on: true
  quality_phase_timeout_seconds: 30

graph:
  db_path: .writing/graph_db
  max_connections: 10
  max_entities_per_query: 100
  relation_depth: 3

writing:
  character_depth_dimensions: 5
  max_character_traits: 20
  scene_coherence_threshold: 0.8
  contradiction_sensitivity: medium
  foreshadowing_max_distance: 50
  foreshadowing_reminder_threshold: 10
  style_vector_dimensions: 30
  style_sample_min_words: 5000

gateway:
  host: 0.0.0.0
  port: 8000
  reload: true
  cors_dev_origins:
    - "*"
  cors_prod_origins:
    - https://app.example.com
    - https://gray.example.com
  metrics_enabled: true
  ui_bridge_enabled: false
"""
        with open(self._config_path, 'w', encoding='utf-8') as f:
            f.write(default_config)
        logger.info(f"Created default config file: {self._config_path}")

    def _start_file_watcher(self) -> None:
        """启动文件监控"""
        if not self._config_path:
            return

        self._observer = Observer()
        handler = ConfigFileHandler(self, self._config_path)
        self._observer.schedule(
            handler,
            str(self._config_path.parent),
            recursive=False
        )
        self._observer.start()
        logger.info(f"Started config file watcher: {self._config_path}")

    def _reload_from_file(self) -> None:
        """重新加载配置文件"""
        old_config = self._config
        self._load_config()

        # 通知监听器
        # 这里简化处理，只通知 "config_reloaded" 事件
        event = ConfigChangeEvent(
            key="*",
            old_value=old_config,
            new_value=self._config,
            source=ConfigSource.FILE
        )
        self._notify_listeners(event)

    def _notify_listeners(self, event: ConfigChangeEvent) -> None:
        """通知配置变更监听器"""
        for listener in self._listeners:
            try:
                listener(event)
            except Exception as e:
                logger.error(f"Config listener error: {e}")

    # ========== 公共 API ==========

    @property
    def config(self) -> AppConfig:
        """获取完整配置对象"""
        return self._config

    def get(self, key: str, default: Any = None) -> Any:
        """
        获取配置值（支持点号分隔的路径）

        Args:
            key: 配置键，如 "agent.default_model"
            default: 默认值

        Returns:
            配置值
        """
        with self._config_lock:
            parts = key.split('.')
            obj = self._config

            for part in parts:
                if hasattr(obj, part):
                    obj = getattr(obj, part)
                else:
                    return default

            return obj

    def set(self, key: str, value: Any) -> None:
        """
        设置配置值（运行时覆盖）

        Args:
            key: 配置键，如 "agent.default_model"
            value: 配置值
        """
        with self._config_lock:
            parts = key.split('.')
            obj = self._config

            # 导航到父对象
            for part in parts[:-1]:
                if hasattr(obj, part):
                    obj = getattr(obj, part)
                else:
                    return

            # 设置值
            final_key = parts[-1]
            if hasattr(obj, final_key):
                old_value = getattr(obj, final_key)
                setattr(obj, final_key, value)
                self._overrides[key] = value

                # 通知变更
                event = ConfigChangeEvent(key, old_value, value, ConfigSource.OVERRIDE)
                self._notify_listeners(event)

    def add_listener(self, listener: Callable[[ConfigChangeEvent], None]) -> None:
        """添加配置变更监听器"""
        self._listeners.append(listener)

    def remove_listener(self, listener: Callable[[ConfigChangeEvent], None]) -> None:
        """移除配置变更监听器"""
        if listener in self._listeners:
            self._listeners.remove(listener)

    def reload(self) -> None:
        """手动重新加载配置"""
        self._load_config()

    def shutdown(self) -> None:
        """关闭配置管理器（停止文件监控）"""
        if self._observer:
            self._observer.stop()
            self._observer.join()
            self._observer = None
            logger.info("Config file watcher stopped")

    def to_dict(self) -> Dict[str, Any]:
        """导出配置为字典"""
        import dataclasses
        return dataclasses.asdict(self._config)

    @classmethod
    def reset_instance(cls) -> None:
        """重置单例（仅用于测试）"""
        with cls._lock:
            if cls._instance:
                cls._instance.shutdown()
            cls._instance = None


# ========== 便捷函数 ==========

_config_manager: Optional[ConfigManager] = None


def validate_environment(strict: bool = False) -> List[str]:
    """校验关键环境变量，返回错误列表。"""
    config = get_config()
    errors: List[str] = []

    if not (config.agent.google_api_key or config.agent.openai_api_key):
        errors.append("缺少 LLM 凭证：请设置 GOOGLE_API_KEY 或 OPENAI_API_KEY")

    if strict and config.env != "development":
        if not config.graph.db_path:
            errors.append("缺少 NIKO_GRAPH_DB_PATH 或 graph.db_path 配置")

    return errors


def ensure_environment(strict: bool = False) -> None:
    """执行启动前环境校验。

    开发环境仅 warning，非开发环境（或 strict=True）抛出异常。
    """
    config = get_config()
    errors = validate_environment(strict=strict)
    if not errors:
        return
    msg = "环境预检问题：\n- " + "\n- ".join(errors)
    if config.env == "development" and not strict:
        logger.warning(msg)
    else:
        raise RuntimeError(msg)


def init_config(
    config_path: Optional[str | Path] = None,
    hot_reload: bool = True
) -> ConfigManager:
    """
    初始化全局配置

    Args:
        config_path: 配置文件路径
        hot_reload: 是否启用热加载

    Returns:
        ConfigManager 实例
    """
    global _config_manager
    if config_path is None:
        # 默认配置文件位置
        candidates = [
            Path('config/niko-studio.yaml'),
            Path('niko-studio.yaml'),
            Path.home() / '.config' / 'niko-studio' / 'config.yaml',
        ]
        for candidate in candidates:
            if candidate.exists():
                config_path = candidate
                break
        if config_path is None:
            config_path = Path('config/niko-studio.yaml')

    _config_manager = ConfigManager(config_path, hot_reload)
    return _config_manager


def get_config() -> AppConfig:
    """获取全局配置对象"""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager.config


def get_config_value(key: str, default: Any = None) -> Any:
    """获取配置值"""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager.get(key, default)


def set_config_value(key: str, value: Any) -> None:
    """设置配置值"""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    _config_manager.set(key, value)
