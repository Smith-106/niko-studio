"""
Code Domain Adapter (Placeholder)
"""
from typing import Type, Any, Dict
from langgraph.graph import StateGraph, END

from .base_adapter import (
    BaseDomainAdapter,
    AdapterRegistry,
    DomainType,
    BaseEvaluationResult
)
from src.workflow.base_state import BaseState, create_base_state

@AdapterRegistry.register(DomainType.CODE.value)
class CodeAdapter(BaseDomainAdapter):
    
    def get_domain_type(self) -> str:
        return DomainType.CODE.value
    
    def get_state_class(self) -> Type[BaseState]:
        return BaseState
    
    def create_initial_state(self, user_request: str, **kwargs) -> BaseState:
        metadata = kwargs.get("metadata") or {}
        resume_decision = kwargs.get("resume_decision")
        if resume_decision:
            metadata = {**metadata, "resume_decision": resume_decision}

        return create_base_state(
            user_request=user_request,
            domain=DomainType.CODE.value,
            metadata=metadata,
            **{key: value for key, value in kwargs.items() if key not in ("metadata", "resume_decision")}
        )
    
    def evaluate(self, state: BaseState) -> BaseEvaluationResult:
        return BaseEvaluationResult(
            decision="APPROVED",
            decision_reason="Auto-approved (Placeholder)",
            total_score=100.0,
            dimension_scores={},
            feedback="",
            revision_instructions=[]
        )
        
    def create_graph(self):
        workflow = StateGraph(BaseState)
        workflow.add_node("planner", self.planner_node)
        workflow.add_node("coder", self.coder_node)
        workflow.set_entry_point("planner")
        workflow.add_edge("planner", "coder")
        workflow.add_edge("coder", END)
        return workflow

    async def planner_node(self, state: BaseState) -> Dict[str, Any]:
        print("Code Planner: Planning...")
        return {"context": "Planned"}

    async def coder_node(self, state: BaseState) -> Dict[str, Any]:
        print("Code Coder: Coding...")
        return {"final_output": "print('Hello World')"}
