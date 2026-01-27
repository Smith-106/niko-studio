from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
import logging

class BaseAgent(ABC):
    """
    Abstract base class for all agents in the system.
    Implements the Claude Code Workflow (CCW) 6-Field Prompt Protocol.
    """
    
    def __init__(self, name: str, config: Optional[Dict[str, Any]] = None):
        self.name = name
        self.config = config or {}
        self.logger = logging.getLogger(f"agent.{name}")

    def construct_prompt(
        self,
        purpose: str,
        task: str,
        mode: str,
        context: str,
        expected: str,
        rules: str
    ) -> str:
        """
        Constructs a structured prompt following the CCW 6-Field Protocol.
        
        Args:
            purpose (str): High-level goal of the request.
            task (str): Specific action or implementation task.
            mode (str): The operational mode (e.g., 'analysis', 'execution', 'planning').
            context (str): Summary of relevant evidence, memory, or file contents.
            expected (str): Definition of the expected output format and deliverables.
            rules (str): Constraints, patterns, and style guidelines to follow.

        Returns:
            str: The fully formatted prompt string.
        """
        return f"""
PURPOSE: {purpose}
TASK: {task}
MODE: {mode}
CONTEXT: {context}
EXPECTED: {expected}
RULES: {rules}
"""

    @abstractmethod
    def run(self, input_data: Any) -> Any:
        """
        Main execution method for the agent.
        Must be implemented by subclasses.
        """
        pass

    def log_activity(self, message: str, level: str = "INFO"):
        """Logs agent activity."""
        if level == "INFO":
            self.logger.info(message)
        elif level == "WARNING":
            self.logger.warning(message)
        elif level == "ERROR":
            self.logger.error(message)
        elif level == "DEBUG":
            self.logger.debug(message)
