import sys
import os
import json
import pytest
from unittest.mock import MagicMock
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda

# Ensure src is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../src")))

from agents.commander import CommanderAgent, WorkflowLevel

def test_llm_routing():
    # Define expected responses for the tests
    responses = [
        {"analysis": "User wants to fix a typo.", "workflow_level": "rapid", "reasoning": "Keywords indicate rapid fix."},
        {"analysis": "User wants to brainstorm world.", "workflow_level": "storm", "reasoning": "Keywords indicate brainstorming."},
        {"analysis": "User wants to write a chapter.", "workflow_level": "standard", "reasoning": "Standard writing task."},
        {"analysis": "User wants to fix brace issue.", "workflow_level": "rapid", "reasoning": "Fixing code."}
    ]

    # Shared state for closure
    state = {"count": 0}

    def mock_llm_func(input):
        idx = state["count"]
        if idx < len(responses):
            response_data = responses[idx]
            state["count"] += 1
            return AIMessage(content=json.dumps(response_data))
        return AIMessage(content="{}")

    mock_llm = RunnableLambda(mock_llm_func)
    agent = CommanderAgent(llm=mock_llm)

    # Test L1_RAPID
    level = agent.route("Fix this typo")
    assert level == WorkflowLevel.L1_RAPID

    # Test L5_BRAINSTORM
    level = agent.route("Brainstorm a new world")
    assert level == WorkflowLevel.L5_BRAINSTORM

    # Test L3_STANDARD
    level = agent.route("Write a chapter about a detective")
    assert level == WorkflowLevel.L3_STANDARD

    # Test input with braces
    level = agent.route("Fix function { foo() }")
    assert level == WorkflowLevel.L1_RAPID

def test_llm_fallback():
    def mock_fail_llm(input):
        raise Exception("LLM overloaded")

    mock_llm = RunnableLambda(mock_fail_llm)
    agent = CommanderAgent(llm=mock_llm)

    # Test fallback to L1
    level = agent.route("Fix this typo")
    assert level == WorkflowLevel.L1_RAPID

    # Test fallback to L5
    level = agent.route("Brainstorm ideas")
    assert level == WorkflowLevel.L5_BRAINSTORM
