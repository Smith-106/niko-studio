from typing import Any, Dict, List, Optional
from enum import Enum
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from .base import BaseAgent

class WorkflowLevel(Enum):
    L1_RAPID = "rapid"       # Quick fixes, polishing
    L3_STANDARD = "standard" # Full chapter writing
    L5_BRAINSTORM = "storm"  # World building, brainstorming

class TaskAnalysis(BaseModel):
    reasoning: str = Field(description="Reasoning for the workflow level selection")
    workflow_level: WorkflowLevel = Field(description="The determined workflow level")

class CommanderAgent(BaseAgent):
    """
    Commander Agent responsible for routing task to appropriate workflows (L1-L5).
    """

    def __init__(self, llm, name: str = "Commander", config: Optional[Dict[str, Any]] = None):
        super().__init__(name, config)
        self.llm = llm

    def route(self, task_description: str) -> WorkflowLevel:
        """
        Analyzes the task complexity and returns the appropriate workflow level.
        
        Args:
            task_description: The user's request.
            
        Returns:
            WorkflowLevel: The determined workflow level.
        """
        parser = PydanticOutputParser(pydantic_object=TaskAnalysis)

        # Define the 6-Field Prompt components
        purpose = "Analyze the user's request to determine the appropriate workflow level."
        task = "Classify the request into one of the defined workflow levels."
        mode = "analysis"
        context = f"User Request: '{task_description}'"
        expected = "A structured analysis including reasoning and the selected workflow level."
        rules = """
        Use the following definitions for classification:
        - L1_RAPID: Quick fixes, typo corrections, grammar polish, small edits.
        - L3_STANDARD: Writing full chapters, scenes, or substantial content generation.
        - L5_BRAINSTORM: World building, character design, plot outlines, brainstorming ideas.
        """
        
        prompt_str = self.construct_prompt(
            purpose=purpose,
            task=task,
            mode=mode,
            context=context,
            expected=expected,
            rules=rules
        )
        
        prompt = ChatPromptTemplate.from_template(
            prompt_str + "\n\n{format_instructions}"
        )

        chain = prompt | self.llm | parser

        try:
            result = chain.invoke({
                "format_instructions": parser.get_format_instructions()
            })

            self.log_activity(f"Routing '{task_description}' to {result.workflow_level} (Reason: {result.reasoning})")
            return result.workflow_level
            
        except Exception as e:
            self.log_activity(f"LLM routing failed: {e}. Falling back to heuristics.", level="WARNING")
            # Fallback to heuristics
            task_lower = task_description.lower()
            
            if any(kw in task_lower for kw in ["typo", "fix", "polish", "correct", "grammar"]):
                return WorkflowLevel.L1_RAPID

            if any(kw in task_lower for kw in ["plan", "world", "character", "setting", "brainstorm"]):
                return WorkflowLevel.L5_BRAINSTORM

            return WorkflowLevel.L3_STANDARD

    def run(self, input_data: Any) -> Any:
        # Placeholder for main execution logic
        pass
