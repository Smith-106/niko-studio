"""
L1 快速模式 (Rapid)

無狀態、無工件、直接輸出。
適用於: 錯字修正、格式調整、快速潤色、簡單問答。
"""

from typing import Dict, List, Optional
from .base_level import BaseLevel, LevelRegistry
from ..base_state import BaseState


@LevelRegistry.register(1)
class Level1Rapid(BaseLevel):
    """
    L1 快速模式
    
    特點:
    - 無會話持久化
    - 無工件生成
    - 直接輸出結果
    - 最快響應
    """
    
    level = 1
    name = "rapid"
    description = "快速模式 - 無狀態、無工件、直接輸出"
    
    def execute(self, state: BaseState, **kwargs) -> BaseState:
        """
        直接執行，返回結果
        
        流程:
        1. 構建簡單 Prompt
        2. 調用 LLM
        3. 返回結果
        """
        from ...agents.writer import WriterAgent
        
        # 獲取用戶請求
        user_request = state.get("user_request", "")
        context = state.get("context", "")
        
        # 構建 Prompt
        prompt = self._build_prompt(user_request, context)
        
        # 調用 Writer Agent (簡化模式)
        try:
            writer = WriterAgent(name="rapid_writer")
            result = writer.run({
                "prompt": prompt,
                "mode": "rapid",
            })
            
            state["final_output"] = result.get("content", "")
            state["decision"] = "APPROVED"
            
        except Exception as e:
            state["errors"] = state.get("errors", []) + [str(e)]
            state["decision"] = "FAILED"
        
        return state
    
    def get_required_agents(self) -> List[str]:
        return ["writer"]
    
    def _build_prompt(self, request: str, context: str = "") -> str:
        """構建快速模式 Prompt"""
        prompt = f"任務: {request}\n"
        if context:
            prompt += f"\n上下文:\n{context}\n"
        prompt += "\n請直接給出結果，無需詳細解釋。"
        return prompt
