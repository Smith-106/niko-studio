"""
DistillationManager - Knowledge Distillation Module

Implements IDistillationService interface from memory_contracts.py.
Provides 6 distillation templates for extracting structured knowledge from content.
Integrates with CitationManager for DerivedFrom relationship tracking.

Templates:
- SUMMARY: Content summarization
- KEY_POINTS: Key points extraction
- CHARACTER_TRAITS: Character trait distillation
- PLOT_STRUCTURE: Plot structure analysis
- WORLD_BUILDING: World-building extraction
- STYLE_ELEMENTS: Style element extraction
"""

import json
import logging
import uuid
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any, Union, TYPE_CHECKING

if TYPE_CHECKING:
    from .citation_manager import CitationManager, PersistedCitation
    from .memory_manager import MemoryManager

logger = logging.getLogger("niko-distillation-manager")


class DistillationTemplate(Enum):
    """
    Distillation template types.

    Each template provides a specialized prompt for extracting
    specific types of knowledge from source content.
    """
    SUMMARY = "summary"
    KEY_POINTS = "key_points"
    CHARACTER_TRAITS = "character_traits"
    PLOT_STRUCTURE = "plot_structure"
    WORLD_BUILDING = "world_building"
    STYLE_ELEMENTS = "style_elements"


# Ensure enum identity consistency across `src.memory.*` and `memory.*` imports.
_alias_name = "memory.distillation_manager"
if _alias_name in sys.modules:
    _alias_module = sys.modules[_alias_name]
    setattr(_alias_module, "DistillationTemplate", DistillationTemplate)
else:
    sys.modules[_alias_name] = sys.modules[__name__]


@dataclass
class DistillationResult:
    """
    Result of a distillation operation.

    Attributes:
        result_id: Unique identifier for this result.
        source_ids: List of source content IDs used for distillation.
        template: The template type used.
        content: The distilled content.
        derived_from: List of citation IDs linking to sources.
        created_at: Creation timestamp (ISO 8601).
        metadata: Additional metadata.
    """
    result_id: str
    source_ids: List[str]
    template: DistillationTemplate
    content: str
    derived_from: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "result_id": self.result_id,
            "source_ids": self.source_ids,
            "template": self.template.value,
            "content": self.content,
            "derived_from": self.derived_from,
            "created_at": self.created_at,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DistillationResult':
        """Create from dictionary."""
        template_value = data.get("template", "summary")
        template = DistillationTemplate(template_value) if isinstance(template_value, str) else template_value

        return cls(
            result_id=data["result_id"],
            source_ids=data.get("source_ids", []),
            template=template,
            content=data.get("content", ""),
            derived_from=data.get("derived_from", []),
            created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
            metadata=data.get("metadata", {})
        )


# ============================================================
# Distillation Prompt Templates
# ============================================================

DISTILLATION_PROMPTS: Dict[DistillationTemplate, str] = {
    DistillationTemplate.SUMMARY: """
PURPOSE: Create a concise summary of the provided content.

TASK:
- Extract the main theme and central ideas
- Preserve key information while reducing length
- Maintain logical flow and coherence
- Keep the summary to 20-30% of original length

CONTEXT:
{content}

OUTPUT FORMAT:
Provide a clear, well-structured summary that captures the essence of the content.
Focus on: Main themes, key events, important decisions, and outcomes.
""".strip(),

    DistillationTemplate.KEY_POINTS: """
PURPOSE: Extract key points and important details from the content.

TASK:
- Identify the most important facts and insights
- List actionable items or decisions
- Highlight notable quotes or statements
- Prioritize by importance

CONTEXT:
{content}

OUTPUT FORMAT:
Return a structured list of key points:
1. [Category]: Point description
2. [Category]: Point description
...

Categories: Facts, Insights, Decisions, Actions, Quotes
""".strip(),

    DistillationTemplate.CHARACTER_TRAITS: """
PURPOSE: Distill character traits, personalities, and development arcs.

TASK:
- Identify character names and roles
- Extract personality traits and motivations
- Note character relationships
- Track character development and changes
- Identify key dialogue patterns

CONTEXT:
{content}

OUTPUT FORMAT:
For each character:
**[Character Name]**
- Role: [protagonist/antagonist/supporting]
- Traits: [list of personality traits]
- Motivation: [primary driving force]
- Relationships: [connections to other characters]
- Development: [character arc or changes]
- Speech Pattern: [distinctive dialogue characteristics]
""".strip(),

    DistillationTemplate.PLOT_STRUCTURE: """
PURPOSE: Analyze and extract plot structure elements.

TASK:
- Identify the narrative structure (three-act, hero's journey, etc.)
- Extract major plot points and turning points
- Note conflicts (internal/external)
- Identify subplots and their connections
- Track pacing and tension progression

CONTEXT:
{content}

OUTPUT FORMAT:
**Plot Structure Analysis**

1. **Opening/Setup**
   - Initial situation
   - Key characters introduced

2. **Inciting Incident**
   - Event that starts the main conflict

3. **Rising Action**
   - Key events building tension
   - Complications and obstacles

4. **Climax**
   - Highest point of tension
   - Critical decision or confrontation

5. **Resolution**
   - Outcome of the conflict
   - Character states at end

**Subplots**: [list of secondary storylines]
**Themes**: [underlying themes explored]
""".strip(),

    DistillationTemplate.WORLD_BUILDING: """
PURPOSE: Extract world-building elements and settings.

TASK:
- Identify locations and their characteristics
- Extract rules of the world (magic systems, technology, society)
- Note cultural elements and customs
- Identify historical background
- Extract environmental and atmospheric details

CONTEXT:
{content}

OUTPUT FORMAT:
**World-Building Elements**

1. **Geography & Locations**
   - [Location]: Description and significance

2. **Systems & Rules**
   - [System Type]: How it works

3. **Society & Culture**
   - Social structure
   - Customs and traditions
   - Political systems

4. **History & Lore**
   - Key historical events
   - Legends or myths

5. **Atmosphere**
   - Tone and mood
   - Environmental details
""".strip(),

    DistillationTemplate.STYLE_ELEMENTS: """
PURPOSE: Extract writing style elements and literary techniques.

TASK:
- Identify narrative voice and point of view
- Note prose style (sparse, ornate, conversational, etc.)
- Extract recurring motifs and symbols
- Identify literary devices used
- Analyze sentence structure and rhythm
- Note dialogue style and format

CONTEXT:
{content}

OUTPUT FORMAT:
**Style Analysis**

1. **Narrative Voice**
   - POV: [first/second/third person]
   - Tense: [past/present]
   - Tone: [description]

2. **Prose Style**
   - Sentence length: [short/medium/long/varied]
   - Vocabulary: [simple/complex/technical]
   - Descriptive density: [sparse/moderate/rich]

3. **Literary Devices**
   - [Device]: Example from text

4. **Motifs & Symbols**
   - [Motif]: Significance

5. **Dialogue Style**
   - Format and punctuation
   - Character voice differentiation
""".strip()
}


class DistillationManager:
    """
    Knowledge Distillation Manager.

    Implements IDistillationService interface:
    - distill(sources, template) -> DistillationResult
    - get_derived_from(result_id) -> List[Citation]
    - list_by_template(template) -> List[DistillationResult]
    - get_prompt(template) -> str

    Integrates with CitationManager for DerivedFrom relationship tracking.
    """

    def __init__(
        self,
        base_path: Union[str, Path] = ".writing",
        citation_manager: Optional['CitationManager'] = None,
        memory_manager: Optional['MemoryManager'] = None,
        llm_client: Optional[Any] = None
    ):
        """
        Initialize DistillationManager.

        Args:
            base_path: Base directory for writing system.
            citation_manager: CitationManager for tracking DerivedFrom relations.
            memory_manager: MemoryManager for storing distilled content.
            llm_client: Optional LLM client for actual distillation.
        """
        self.base_path = Path(base_path)
        self.distillation_dir = self.base_path / "distillations"
        self.distillation_dir.mkdir(parents=True, exist_ok=True)

        self._citation_manager = citation_manager
        self._memory_manager = memory_manager
        self._llm_client = llm_client

        # In-memory index for quick lookup
        self._results_index: Dict[str, DistillationResult] = {}
        self._template_index: Dict[DistillationTemplate, List[str]] = {
            t: [] for t in DistillationTemplate
        }

        # Load existing results
        self._load_index()

        logger.info(f"DistillationManager initialized at {self.distillation_dir}")

    def set_citation_manager(self, citation_manager: 'CitationManager') -> None:
        """Set CitationManager for DerivedFrom tracking."""
        self._citation_manager = citation_manager

    def set_memory_manager(self, memory_manager: 'MemoryManager') -> None:
        """Set MemoryManager for storing distilled content."""
        self._memory_manager = memory_manager

    def set_llm_client(self, llm_client: Any) -> None:
        """Set LLM client for distillation."""
        self._llm_client = llm_client

    # ============================================================
    # IDistillationService Implementation
    # ============================================================

    def get_prompt(self, template: Union[DistillationTemplate, str]) -> str:
        """
        Get the prompt template for a distillation type.

        Args:
            template: Template type or string value.

        Returns:
            Prompt template string.
        """
        if isinstance(template, str):
            template = DistillationTemplate(template)
        else:
            template = DistillationTemplate(getattr(template, "value", template))

        return DISTILLATION_PROMPTS.get(template, DISTILLATION_PROMPTS[DistillationTemplate.SUMMARY])

    def get_distillation_prompt(self, prompt_type: str) -> str:
        """
        Get distillation prompt by type string (IDistillationService compatibility).

        Args:
            prompt_type: Template type as string.

        Returns:
            Prompt template string.
        """
        try:
            template = DistillationTemplate(prompt_type)
        except ValueError:
            template = DistillationTemplate.SUMMARY
        return self.get_prompt(template)

    def distill(
        self,
        sources: List[str],
        template: Union[DistillationTemplate, str],
        source_ids: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> DistillationResult:
        """
        Perform distillation on source content.

        Args:
            sources: List of source content strings to distill.
            template: Distillation template to use.
            source_ids: Optional list of source identifiers.
            metadata: Additional metadata.

        Returns:
            DistillationResult with distilled content.
        """
        if isinstance(template, str):
            template = DistillationTemplate(template)
        else:
            template = DistillationTemplate(getattr(template, "value", template))

        # Combine sources
        combined_content = "\n\n---\n\n".join(sources)

        # Get prompt template
        prompt = self.get_prompt(template)
        full_prompt = prompt.format(content=combined_content)

        # Perform distillation (via LLM or fallback)
        if self._llm_client:
            distilled_content = self._call_llm(full_prompt)
        else:
            # Fallback: simple extraction based on template
            distilled_content = self._simple_distill(combined_content, template)

        # Generate result ID
        result_id = self._generate_result_id()

        # Create citations for DerivedFrom tracking
        derived_from = []
        if self._citation_manager and source_ids:
            derived_from = self._create_derived_from_citations(sources, source_ids)

        # Create result
        result = DistillationResult(
            result_id=result_id,
            source_ids=source_ids or [],
            template=template,
            content=distilled_content,
            derived_from=derived_from,
            metadata=metadata or {}
        )

        # Save result
        self._save_result(result)

        # Index result
        self._results_index[result_id] = result
        # Use setdefault to handle potential enum instance mismatch
        if template not in self._template_index:
            self._template_index[template] = []
        self._template_index[template].append(result_id)

        logger.info(f"Created distillation result: {result_id} (template={template.value})")
        return result

    def get_derived_from(self, result_id: str) -> List['PersistedCitation']:
        """
        Get DerivedFrom citations for a distillation result.

        Args:
            result_id: Distillation result ID.

        Returns:
            List of PersistedCitation objects.
        """
        result = self.get_result(result_id)
        if not result:
            return []

        if not self._citation_manager:
            logger.warning("CitationManager not configured")
            return []

        citations = []
        for citation_id in result.derived_from:
            citation = self._citation_manager.get_citation(citation_id)
            if citation:
                citations.append(citation)

        return citations

    def list_by_template(
        self,
        template: Union[DistillationTemplate, str],
        limit: int = 100
    ) -> List[DistillationResult]:
        """
        List distillation results by template type.

        Args:
            template: Template type to filter by.
            limit: Maximum results to return.

        Returns:
            List of DistillationResult objects.
        """
        if isinstance(template, str):
            template = DistillationTemplate(template)
        else:
            template = DistillationTemplate(getattr(template, "value", template))

        result_ids = self._template_index.get(template, [])
        results = []

        for result_id in result_ids[:limit]:
            result = self.get_result(result_id)
            if result:
                results.append(result)

        # Sort by created_at (newest first)
        results.sort(key=lambda r: r.created_at, reverse=True)
        return results

    def get_result(self, result_id: str) -> Optional[DistillationResult]:
        """
        Get a distillation result by ID.

        Args:
            result_id: Result identifier.

        Returns:
            DistillationResult or None if not found.
        """
        # Check in-memory cache
        if result_id in self._results_index:
            return self._results_index[result_id]

        # Try loading from disk
        file_path = self._get_result_path(result_id)
        if file_path.exists():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                result = DistillationResult.from_dict(data)
                self._results_index[result_id] = result
                return result
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Failed to load result {result_id}: {e}")

        return None

    def delete_result(self, result_id: str) -> bool:
        """
        Delete a distillation result.

        Args:
            result_id: Result identifier.

        Returns:
            True if deleted, False otherwise.
        """
        result = self.get_result(result_id)
        if not result:
            return False

        # Remove from indexes
        if result_id in self._results_index:
            del self._results_index[result_id]

        if result_id in self._template_index.get(result.template, []):
            self._template_index[result.template].remove(result_id)

        # Delete file
        file_path = self._get_result_path(result_id)
        if file_path.exists():
            file_path.unlink()

        logger.info(f"Deleted distillation result: {result_id}")
        return True

    # ============================================================
    # IDistillationService Extended Methods
    # ============================================================

    def create_memory_from_distillation(
        self,
        content: str,
        prompt_type: str,
        source_citations: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        topics: Optional[List[str]] = None
    ) -> Optional[str]:
        """
        Create a memory entry from distillation content.

        Args:
            content: Distilled content.
            prompt_type: Distillation type used.
            source_citations: Citation IDs for DerivedFrom.
            tags: Tags for the memory.
            topics: Topics for indexing.

        Returns:
            Memory ID if created, None otherwise.
        """
        if not self._memory_manager:
            logger.warning("MemoryManager not configured")
            return None

        # Create memory entry
        entry = self._memory_manager.add(
            content=content,
            topics=topics or tags or [prompt_type],
            source="distill",
            importance=0.7,  # Distilled content is typically important
            metadata={
                "distillation_type": prompt_type,
                "derived_from": source_citations or []
            }
        )

        logger.info(f"Created memory from distillation: {entry.id}")
        return entry.id

    def batch_distill(
        self,
        sources: List[str],
        source_ids: Optional[List[str]] = None
    ) -> Dict[DistillationTemplate, DistillationResult]:
        """
        Perform distillation with all templates.

        Args:
            sources: Source content strings.
            source_ids: Optional source identifiers.

        Returns:
            Dictionary mapping template to result.
        """
        results = {}
        for template in DistillationTemplate:
            try:
                result = self.distill(sources, template, source_ids)
                results[template] = result
            except Exception as e:
                logger.warning(f"Batch distill failed for {template.value}: {e}")

        return results

    # ============================================================
    # Private Methods
    # ============================================================

    def _generate_result_id(self) -> str:
        """Generate unique result ID."""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_suffix = uuid.uuid4().hex[:8]
        return f"dist-{timestamp}-{unique_suffix}"

    def _get_result_path(self, result_id: str) -> Path:
        """Get file path for a result ID."""
        return self.distillation_dir / f"{result_id}.json"

    def _save_result(self, result: DistillationResult) -> None:
        """Save result to disk."""
        file_path = self._get_result_path(result.result_id)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(result.to_dict(), f, ensure_ascii=False, indent=2)

    def _load_index(self) -> None:
        """Load existing results into index."""
        for file_path in self.distillation_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                result = DistillationResult.from_dict(data)
                self._results_index[result.result_id] = result
                # Use setdefault to handle potential enum instance mismatch
                if result.template not in self._template_index:
                    self._template_index[result.template] = []
                self._template_index[result.template].append(result.result_id)
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                logger.warning(f"Failed to load {file_path}: {e}")

    def _create_derived_from_citations(
        self,
        sources: List[str],
        source_ids: List[str]
    ) -> List[str]:
        """
        Create DerivedFrom citations linking distillation to sources.

        Args:
            sources: Source content strings.
            source_ids: Source identifiers.

        Returns:
            List of created citation IDs.
        """
        citation_ids = []

        for i, (source, source_id) in enumerate(zip(sources, source_ids)):
            # Create transient citation
            transient = self._citation_manager.create_transient_citation(
                source_text=source[:500] if len(source) > 500 else source,
                location={
                    "surface": "distillation_source",
                    "path": source_id,
                    "loc": {"kind": "full", "index": i}
                },
                metadata={"relation": "DerivedFrom"}
            )

            # Persist citation
            persisted = self._citation_manager.make_citation(
                transient,
                retention_class="durable",
                tags=["derived_from", "distillation"]
            )

            citation_ids.append(persisted.citation_id)

        return citation_ids

    def _call_llm(self, prompt: str) -> str:
        """
        Call LLM for distillation.

        Args:
            prompt: Full prompt with content.

        Returns:
            LLM response.
        """
        try:
            # Assuming LLM client has a generate method
            if hasattr(self._llm_client, 'generate'):
                return self._llm_client.generate(prompt)
            elif hasattr(self._llm_client, 'complete'):
                return self._llm_client.complete(prompt)
            elif callable(self._llm_client):
                return self._llm_client(prompt)
            else:
                logger.warning("LLM client interface not recognized")
                return self._simple_distill(prompt, DistillationTemplate.SUMMARY)
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return self._simple_distill(prompt, DistillationTemplate.SUMMARY)

    def _simple_distill(
        self,
        content: str,
        template: DistillationTemplate
    ) -> str:
        """
        Simple fallback distillation without LLM.

        Args:
            content: Content to distill.
            template: Template type.

        Returns:
            Simple extracted content.
        """
        # Split content into sentences
        sentences = [s.strip() for s in content.replace('\n', ' ').split('.') if s.strip()]

        if template == DistillationTemplate.SUMMARY:
            # Take first 30% of sentences
            count = max(1, len(sentences) // 3)
            return '. '.join(sentences[:count]) + '.'

        elif template == DistillationTemplate.KEY_POINTS:
            # Extract first sentence of each paragraph
            paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
            points = []
            for i, para in enumerate(paragraphs[:10], 1):
                first_sentence = para.split('.')[0].strip()
                if first_sentence:
                    points.append(f"{i}. {first_sentence}")
            return '\n'.join(points) if points else content[:500]

        elif template == DistillationTemplate.CHARACTER_TRAITS:
            # Simple pattern matching for character indicators
            result = "**Character Analysis (Simple Extraction)**\n\n"
            result += "Note: Full character analysis requires LLM integration.\n\n"
            result += "Content preview:\n" + content[:500] + "..."
            return result

        elif template == DistillationTemplate.PLOT_STRUCTURE:
            result = "**Plot Structure (Simple Extraction)**\n\n"
            result += "Note: Full plot analysis requires LLM integration.\n\n"
            # Divide content into thirds
            third = len(content) // 3
            result += f"**Beginning**: {content[:200]}...\n\n"
            result += f"**Middle**: {content[third:third+200]}...\n\n"
            result += f"**End**: {content[-200:]}..."
            return result

        elif template == DistillationTemplate.WORLD_BUILDING:
            result = "**World-Building (Simple Extraction)**\n\n"
            result += "Note: Full world-building analysis requires LLM integration.\n\n"
            result += "Content preview:\n" + content[:500] + "..."
            return result

        elif template == DistillationTemplate.STYLE_ELEMENTS:
            # Basic style metrics
            word_count = len(content.split())
            sentence_count = len(sentences)
            avg_sentence_length = word_count / max(1, sentence_count)

            result = "**Style Analysis (Simple Metrics)**\n\n"
            result += f"- Word count: {word_count}\n"
            result += f"- Sentence count: {sentence_count}\n"
            result += f"- Average sentence length: {avg_sentence_length:.1f} words\n\n"
            result += "Note: Full style analysis requires LLM integration."
            return result

        return content[:500] + "..."

    # ============================================================
    # Statistics
    # ============================================================

    def stats(self) -> Dict[str, Any]:
        """Get distillation statistics."""
        return {
            "total_results": len(self._results_index),
            "by_template": {
                t.value: len(ids) for t, ids in self._template_index.items()
            },
            "distillation_dir": str(self.distillation_dir)
        }

    def list_templates(self) -> List[Dict[str, str]]:
        """List all available templates with descriptions."""
        return [
            {
                "name": t.value,
                "description": DISTILLATION_PROMPTS[t].split('\n')[0].replace("PURPOSE:", "").strip()
            }
            for t in DistillationTemplate
        ]

    # ============================================================
    # Legacy Compatibility (DistillService interface)
    # ============================================================

    def distill_chapter(self, content: str) -> Dict[str, Any]:
        """
        Legacy compatibility method for DistillService.distill_chapter().

        Args:
            content: Chapter content to distill.

        Returns:
            Dict with entities and relations (DistillService format).
        """
        result = self.distill([content], DistillationTemplate.SUMMARY)
        return {
            "entities": [],
            "relations": [],
            "summary": result.content,
            "events": [],
            "character_arcs": [],
            "plot_points": [],
        }

    def apply_to_graph(self, knowledge_layer: Any, distilled_data: Dict[str, Any]) -> None:
        """
        Legacy compatibility method for DistillService.apply_to_graph().

        Args:
            knowledge_layer: AgentKnowledgeLayer instance.
            distilled_data: Distilled data dict.
        """
        for ent in distilled_data.get("entities", []):
            if hasattr(knowledge_layer, "add_entity"):
                knowledge_layer.add_entity(
                    ent.get("id", ""),
                    ent.get("name", ""),
                    ent.get("type", ""),
                    ent.get("description", "")
                )

        for rel in distilled_data.get("relations", []):
            if hasattr(knowledge_layer, "add_relation"):
                knowledge_layer.add_relation(
                    rel.get("source", ""),
                    rel.get("target", ""),
                    rel.get("type", ""),
                    rel.get("props")
                )

    def get_distillation_prompt(self, task_type: str, content: str = "") -> str:
        """
        Legacy compatibility method for DistillService.get_distillation_prompt().

        Args:
            task_type: Prompt type string.
            content: Content to include in prompt.

        Returns:
            Prompt string.
        """
        template_map = {
            "extract-facts": DistillationTemplate.KEY_POINTS,
            "extract-relationships": DistillationTemplate.CHARACTER_TRAITS,
            "insight": DistillationTemplate.SUMMARY,
        }
        template = template_map.get(task_type, DistillationTemplate.SUMMARY)
        prompt = self.get_prompt(template)
        if content:
            return prompt.format(content=content[:2000])
        return prompt


# ============================================================
# Factory Functions
# ============================================================

_distillation_manager: Optional[DistillationManager] = None


def get_distillation_manager(
    base_path: Union[str, Path] = ".writing",
    citation_manager: Optional['CitationManager'] = None,
    memory_manager: Optional['MemoryManager'] = None
) -> DistillationManager:
    """
    Get or create DistillationManager singleton.

    Args:
        base_path: Base directory for writing system.
        citation_manager: Optional CitationManager for integration.
        memory_manager: Optional MemoryManager for integration.

    Returns:
        DistillationManager instance.
    """
    global _distillation_manager
    if _distillation_manager is None:
        _distillation_manager = DistillationManager(
            base_path,
            citation_manager,
            memory_manager
        )
    else:
        if citation_manager and not _distillation_manager._citation_manager:
            _distillation_manager.set_citation_manager(citation_manager)
        if memory_manager and not _distillation_manager._memory_manager:
            _distillation_manager.set_memory_manager(memory_manager)

    return _distillation_manager


def reset_distillation_manager() -> None:
    """Reset DistillationManager singleton (for testing)."""
    global _distillation_manager
    _distillation_manager = None
