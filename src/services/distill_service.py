"""
DEPRECATED: This module is deprecated and will be removed in a future version.

Use `src.memory.distillation_manager.DistillationManager` instead, which provides:
- 6 distillation templates (SUMMARY, KEY_POINTS, CHARACTER_TRAITS, etc.)
- CitationManager integration for DerivedFrom tracking
- MemoryManager integration for storing distilled content
- Full persistence and result management

Migration example:
    # Old:
    from src.services.distill_service import DistillService
    service = DistillService()
    result = service.distill_chapter(content)

    # New:
    from src.memory.distillation_manager import DistillationManager
    manager = DistillationManager()
    result = manager.distill_chapter(content)  # Legacy compatibility
    # Or use new API:
    result = manager.distill([content], DistillationTemplate.SUMMARY)
"""

import warnings
from typing import List, Dict, Any, Optional
import json
import logging

# Note: BaseAgent import removed to prevent circular dependency
# If needed, import from protocols.agent.AgentProtocol instead

logger = logging.getLogger("DistillService")

# Emit deprecation warning on import
warnings.warn(
    "DistillService is deprecated. Use src.memory.distillation_manager.DistillationManager instead.",
    DeprecationWarning,
    stacklevel=2
)


class DistillService:
    """
    Service responsible for 'Memory Distillation' (OpenKL).
    Extracts structured knowledge (Entities, Relations, Insights) from raw text.
    """

    def __init__(self, llm_client: Any = None):
        self.llm_client = llm_client # Placeholder for LLM Client

    def get_distillation_prompt(self, task_type: str, content: str) -> str:
        """
        Generates standard OpenKL distillation prompts.
        
        Args:
            task_type: 'extract-facts', 'identify-patterns', 'extract-relationships'
            content: The text to analyze
        """
        if task_type == "extract-facts":
            return f"""
PURPOSE: Extract factual information and key details from the text.
TASK: Identify entities (Characters, Locations, Items) and specific events.
MODE: Analysis
CONTEXT: {content[:2000]}... (truncated)
EXPECTED: JSON list of objects {{ "entity": "Name", "type": "Type", "fact": "Description" }}
RULES: Be precise. Only extract explicitly stated facts.
"""
        elif task_type == "extract-relationships":
            return f"""
PURPOSE: Identify connections between concepts or characters.
TASK: Extract relationships in specific format.
MODE: Analysis
CONTEXT: {content[:2000]}... (truncated)
EXPECTED: JSON list of objects {{ "source": "Name", "target": "Name", "relation": "TYPE", "desc": "Description" }}
RULES: Use standard relation types (KNOWS, LOCATED_IN, OWNS, DISLIKES).
"""
        else:
            return f"Analyze the following content: {content}"

    def distill_chapter(self, content: str) -> Dict[str, Any]:
        """
        Main entry point to distill a chapter.
        Runs multiple passes (Facts -> Relations) and aggregates results.
        
        Returns:
            Dict containing 'entities' and 'relations' ready for KnowledgeLayer.
        """
        logger.info("Starting distillation for chapter content...")
        
        # 1. Generate Prompts
        fact_prompt = self.get_distillation_prompt("extract-facts", content)
        rel_prompt = self.get_distillation_prompt("extract-relationships", content)
        
        # 2. Call LLM (Mocked for now)
        # facts = self.llm_client.generate(fact_prompt)
        # relations = self.llm_client.generate(rel_prompt)
        
        logger.info("Distillation complete (Mocked).")
        
        # Return Mocked Data for Integration Testing
        return {
            "entities": [
                {"id": "alice", "name": "Alice", "type": "Character", "description": "Protagonist"},
                {"id": "wonderland", "name": "Wonderland", "type": "Location", "description": "Magical Realm"}
            ],
            "relations": [
                {"source": "alice", "target": "wonderland", "type": "LOCATED_IN", "props": {}}
            ]
        }
    
    def apply_to_graph(self, knowledge_layer: Any, distilled_data: Dict[str, Any]):
        """
        Writes distilled data into the AgentKnowledgeLayer.
        """
        for ent in distilled_data.get("entities", []):
            knowledge_layer.add_entity(ent["id"], ent["name"], ent["type"], ent.get("description", ""))
            
        for rel in distilled_data.get("relations", []):
            knowledge_layer.add_relation(rel["source"], rel["target"], rel["type"], rel.get("props"))
            
        logger.info(f"Applied {len(distilled_data.get('entities', []))} entities and {len(distilled_data.get('relations', []))} relations to Graph.")
