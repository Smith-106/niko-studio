"""
工作流圖工廠 (Workflow Graph Factory)

統一創建和管理不同領域的工作流圖。
支持動態加載適配器和配置。
"""

from typing import Optional, Dict, Any
from enum import Enum

from src.workflow.adapters import BaseDomainAdapter, AdapterRegistry


class WorkflowLevel(Enum):
    """工作流層級 (CCW 風格)"""
    L1_RAPID = 1          # 快速模式 - 無狀態
    L2_LIGHTWEIGHT = 2    # 輕量模式 - 內存計劃
    L3_STANDARD = 3       # 標準模式 - 完整會話
    L4_BRAINSTORM = 4     # 頭腦風暴 - 多角色並行
    L5_COORDINATOR = 5    # 智能編排 - 自動規劃


class WorkflowFactory:
    """
    工作流圖工廠
    
    用法:
        # 創建小說工作流
        graph = WorkflowFactory.create("novel", config={"pass_score": 85})
        
        # 創建代碼工作流
        graph = WorkflowFactory.create("code", level=WorkflowLevel.L3_STANDARD)
        
        # 列出可用領域
        domains = WorkflowFactory.list_domains()
    """
    
    @staticmethod
    def create(
        domain: str,
        level: WorkflowLevel = WorkflowLevel.L3_STANDARD,
        config: Optional[Dict[str, Any]] = None
    ):
        """
        創建工作流圖
        
        Args:
            domain: 領域類型 ("novel" | "code" | "knowledge" | ...)
            level: 工作流層級 (L1-L5)
            config: 自定義配置
            
        Returns:
            編譯後的 LangGraph 應用
            
        Raises:
            ValueError: 如果領域未註冊
        """
        adapter = AdapterRegistry.create_adapter(domain, config)
        
        if adapter is None:
            available = AdapterRegistry.list_domains()
            raise ValueError(
                f"Unknown domain: '{domain}'. "
                f"Available domains: {available}"
            )
        
        # 合併配置
        merged_config = adapter.merge_config(config)
        merged_config["workflow_level"] = level.value
        
        # 創建圖
        graph = adapter.create_graph()
        
        return graph
    
    @staticmethod
    def create_adapter(
        domain: str,
        config: Optional[Dict[str, Any]] = None
    ) -> Optional[BaseDomainAdapter]:
        """
        創建適配器實例 (不編譯圖)
        
        用於需要訪問適配器方法但不需要完整工作流的場景
        """
        return AdapterRegistry.create_adapter(domain, config)
    
    @staticmethod
    def list_domains() -> list[str]:
        """列出所有已註冊的領域"""
        return AdapterRegistry.list_domains()
    
    @staticmethod
    def register_adapter(domain: str, adapter_class: type):
        """
        手動註冊適配器
        
        用於動態加載自定義領域
        """
        AdapterRegistry._adapters[domain] = adapter_class
    
    @staticmethod
    def get_level_description(level: WorkflowLevel) -> Dict[str, str]:
        """獲取層級描述"""
        descriptions = {
            WorkflowLevel.L1_RAPID: {
                "name": "Rapid",
                "description": "快速模式 - 無狀態、無工件、直接輸出",
                "novel_use": "錯字修正、格式調整、快速潤色",
                "code_use": "typo 修復、格式化、簡單重命名",
            },
            WorkflowLevel.L2_LIGHTWEIGHT: {
                "name": "Lightweight",
                "description": "輕量模式 - 內存計劃、輕量持久化",
                "novel_use": "單章節寫作、情節調整",
                "code_use": "單文件修改、簡單功能添加",
            },
            WorkflowLevel.L3_STANDARD: {
                "name": "Standard",
                "description": "標準模式 - 完整會話、驗證步驟",
                "novel_use": "多章節開發、角色塑造",
                "code_use": "功能開發 + 測試、代碼審查",
            },
            WorkflowLevel.L4_BRAINSTORM: {
                "name": "Brainstorm",
                "description": "頭腦風暴 - 多角色並行分析",
                "novel_use": "世界觀設計、劇情構思",
                "code_use": "架構設計、技術選型",
            },
            WorkflowLevel.L5_COORDINATOR: {
                "name": "Coordinator",
                "description": "智能編排 - 自動規劃命令鏈",
                "novel_use": "完整小說創作、長期項目",
                "code_use": "完整項目開發、多模塊協調",
            },
        }
        return descriptions.get(level, {})


# ============================================================
# 便捷函數
# ============================================================

def create_workflow(
    domain: str,
    user_request: str,
    level: int = 3,
    config: Optional[Dict] = None
):
    """
    便捷函數: 創建並初始化工作流
    
    Args:
        domain: 領域類型
        user_request: 用戶請求
        level: 工作流層級 (1-5)
        config: 自定義配置
        
    Returns:
        (graph, initial_state) 元組
    """
    workflow_level = WorkflowLevel(level)
    
    adapter = WorkflowFactory.create_adapter(domain, config)
    if adapter is None:
        raise ValueError(f"Unknown domain: {domain}")
    
    graph = adapter.create_graph()
    initial_state = adapter.create_initial_state(user_request)
    
    return graph, initial_state
