"""
Six-Dimensional Memory System

Implements IDimensionProcessor Protocol with 6 dimension processors:
- TimelineProcessor: Event timeline and temporal sequences
- ContextProcessor: Story context and narrative flow
- CharacterProcessor: Character identity and development
- WorldviewProcessor: World settings and rules
- PreferenceProcessor: Creative preferences and style
- ExperienceProcessor: Writing experience and learned patterns

Each dimension classifies and processes content specific to its domain.
"""

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, Set, Tuple, runtime_checkable

logger = logging.getLogger("niko-six-dimensional-memory")


class DimensionType(Enum):
    """Six memory dimensions for content classification."""
    TIMELINE = "timeline"       # Event timeline
    CONTEXT = "context"         # Story context
    CHARACTER = "character"     # Character identity
    WORLDVIEW = "worldview"     # World settings
    PREFERENCE = "preference"   # Creative preferences
    EXPERIENCE = "experience"   # Writing experience


@dataclass
class DimensionScore:
    """Score for a dimension classification."""
    dimension: DimensionType
    score: float  # 0.0 to 1.0
    confidence: float  # 0.0 to 1.0
    keywords_matched: List[str] = field(default_factory=list)


@dataclass
class ClassificationResult:
    """Result of content classification across dimensions."""
    content: str
    primary_dimension: DimensionType
    scores: List[DimensionScore]
    multi_dimensional: bool = False
    extracted_entities: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)

    def get_score(self, dimension: DimensionType) -> float:
        """Get score for a specific dimension."""
        for score in self.scores:
            if score.dimension == dimension:
                return score.score
        return 0.0


@dataclass
class ProcessedContent:
    """Content processed by a dimension processor."""
    original: str
    processed: str
    dimension: DimensionType
    extracted_data: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    importance: float = 0.5
    metadata: Dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class IDimensionProcessor(Protocol):
    """
    Protocol for dimension processors.

    Each processor handles content classification and extraction
    for its specific dimension.
    """

    @property
    def dimension(self) -> DimensionType:
        """Get the dimension type."""
        ...

    def classify(self, content: str) -> DimensionScore:
        """
        Classify content for this dimension.

        Args:
            content: Content to classify.

        Returns:
            DimensionScore with classification result.
        """
        ...

    def process(self, content: str) -> ProcessedContent:
        """
        Process content for this dimension.

        Args:
            content: Content to process.

        Returns:
            ProcessedContent with extracted data.
        """
        ...

    def extract_entities(self, content: str) -> List[str]:
        """
        Extract dimension-specific entities from content.

        Args:
            content: Content to extract from.

        Returns:
            List of extracted entity strings.
        """
        ...


class BaseDimensionProcessor:
    """Base implementation for dimension processors."""

    def __init__(self, dimension: DimensionType, keywords: List[str]):
        self._dimension = dimension
        self._keywords = set(kw.lower() for kw in keywords)

    @property
    def dimension(self) -> DimensionType:
        return self._dimension

    def classify(self, content: str) -> DimensionScore:
        content_lower = content.lower()
        matched = [kw for kw in self._keywords if kw in content_lower]

        # Calculate score based on keyword density
        word_count = len(content.split())
        if word_count == 0:
            return DimensionScore(
                dimension=self._dimension,
                score=0.0,
                confidence=0.0,
                keywords_matched=[]
            )

        score = min(1.0, len(matched) / max(5, word_count * 0.1))
        confidence = min(1.0, len(matched) / 3) if matched else 0.0

        return DimensionScore(
            dimension=self._dimension,
            score=score,
            confidence=confidence,
            keywords_matched=matched
        )

    def process(self, content: str) -> ProcessedContent:
        entities = self.extract_entities(content)
        tags = self._generate_tags(content)

        return ProcessedContent(
            original=content,
            processed=content,
            dimension=self._dimension,
            extracted_data={"entities": entities},
            tags=tags,
            importance=self._calculate_importance(content)
        )

    def extract_entities(self, content: str) -> List[str]:
        return []

    def _generate_tags(self, content: str) -> List[str]:
        content_lower = content.lower()
        return [kw for kw in self._keywords if kw in content_lower][:5]

    def _calculate_importance(self, content: str) -> float:
        # Base importance on content length and keyword density
        word_count = len(content.split())
        content_lower = content.lower()
        matched = sum(1 for kw in self._keywords if kw in content_lower)

        length_factor = min(1.0, word_count / 100)
        keyword_factor = min(1.0, matched / 5)

        return 0.3 + (length_factor * 0.3) + (keyword_factor * 0.4)


class TimelineProcessor(BaseDimensionProcessor):
    """
    Timeline dimension processor.

    Handles event sequences, temporal markers, and chronological data.
    """

    TIMELINE_KEYWORDS = [
        "before", "after", "when", "then", "first", "last", "next",
        "previous", "later", "earlier", "during", "while", "since",
        "until", "year", "month", "day", "hour", "minute", "time",
        "past", "present", "future", "history", "event", "happened",
        "occurred", "began", "ended", "started", "finished", "sequence"
    ]

    def __init__(self):
        super().__init__(DimensionType.TIMELINE, self.TIMELINE_KEYWORDS)

    def extract_entities(self, content: str) -> List[str]:
        entities = []

        # Extract date patterns
        date_patterns = [
            r'\d{4}[-/]\d{1,2}[-/]\d{1,2}',  # YYYY-MM-DD
            r'\d{1,2}[-/]\d{1,2}[-/]\d{4}',  # DD-MM-YYYY
            r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}',
        ]

        for pattern in date_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            entities.extend(matches if isinstance(matches[0], str) else [m[0] for m in matches] if matches else [])

        # Extract time references
        time_refs = re.findall(r'\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\b', content, re.IGNORECASE)
        entities.extend(time_refs)

        return list(set(entities))

    def process(self, content: str) -> ProcessedContent:
        result = super().process(content)

        # Extract temporal sequence
        temporal_markers = []
        for word in ["first", "then", "next", "finally", "later", "before", "after"]:
            if word in content.lower():
                temporal_markers.append(word)

        result.extracted_data["temporal_markers"] = temporal_markers
        result.extracted_data["has_sequence"] = len(temporal_markers) > 1

        return result


class ContextProcessor(BaseDimensionProcessor):
    """
    Context dimension processor.

    Handles story context, narrative flow, and scene information.
    """

    CONTEXT_KEYWORDS = [
        "scene", "chapter", "story", "narrative", "plot", "setting",
        "situation", "background", "circumstance", "environment",
        "atmosphere", "mood", "tone", "perspective", "viewpoint",
        "pov", "narrator", "conflict", "tension", "resolution",
        "climax", "beginning", "middle", "end", "transition"
    ]

    def __init__(self):
        super().__init__(DimensionType.CONTEXT, self.CONTEXT_KEYWORDS)

    def extract_entities(self, content: str) -> List[str]:
        entities = []

        # Extract chapter/scene references
        chapter_refs = re.findall(r'(Chapter|Scene|Part|Section)\s*\d+', content, re.IGNORECASE)
        entities.extend(chapter_refs)

        # Extract POV markers
        pov_markers = re.findall(r'(first-person|third-person|omniscient|limited)', content, re.IGNORECASE)
        entities.extend(pov_markers)

        return list(set(entities))


class CharacterProcessor(BaseDimensionProcessor):
    """
    Character dimension processor.

    Handles character identity, traits, relationships, and development.
    """

    CHARACTER_KEYWORDS = [
        "character", "protagonist", "antagonist", "hero", "villain",
        "trait", "personality", "motivation", "goal", "desire",
        "fear", "flaw", "strength", "weakness", "relationship",
        "friend", "enemy", "ally", "rival", "family", "love",
        "hate", "trust", "betray", "arc", "development", "growth",
        "backstory", "origin", "appearance", "voice", "dialogue"
    ]

    def __init__(self):
        super().__init__(DimensionType.CHARACTER, self.CHARACTER_KEYWORDS)

    def extract_entities(self, content: str) -> List[str]:
        entities = []

        # Extract capitalized names (potential character names)
        # Pattern: Capitalized word not at sentence start
        name_pattern = r'(?<=[.!?]\s)([A-Z][a-z]+)|(?<=\s)([A-Z][a-z]+)(?=\s(?:said|asked|replied|thought|felt|looked))'
        matches = re.findall(name_pattern, content)
        for match in matches:
            name = match[0] or match[1]
            if name and len(name) > 1:
                entities.append(name)

        # Extract quoted dialogue speakers
        dialogue_pattern = r'"[^"]+"\s+(?:said|asked|replied|whispered|shouted)\s+([A-Z][a-z]+)'
        speakers = re.findall(dialogue_pattern, content)
        entities.extend(speakers)

        return list(set(entities))

    def process(self, content: str) -> ProcessedContent:
        result = super().process(content)

        # Extract trait mentions
        trait_keywords = ["brave", "coward", "kind", "cruel", "smart", "wise", "naive", "cunning"]
        found_traits = [t for t in trait_keywords if t in content.lower()]
        result.extracted_data["traits"] = found_traits

        # Check for relationship indicators
        relationship_words = ["love", "hate", "friend", "enemy", "trust", "betray"]
        has_relationships = any(w in content.lower() for w in relationship_words)
        result.extracted_data["has_relationships"] = has_relationships

        return result


class WorldviewProcessor(BaseDimensionProcessor):
    """
    Worldview dimension processor.

    Handles world settings, rules, magic systems, and lore.
    """

    WORLDVIEW_KEYWORDS = [
        "world", "universe", "realm", "kingdom", "empire", "nation",
        "magic", "technology", "power", "system", "rule", "law",
        "culture", "tradition", "custom", "religion", "belief",
        "history", "legend", "myth", "lore", "geography", "map",
        "species", "race", "faction", "organization", "government",
        "economy", "society", "class", "hierarchy", "politics"
    ]

    def __init__(self):
        super().__init__(DimensionType.WORLDVIEW, self.WORLDVIEW_KEYWORDS)

    def extract_entities(self, content: str) -> List[str]:
        entities = []

        # Extract place names (capitalized multi-word phrases)
        place_pattern = r'(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Kingdom|Empire|Realm|Land|City|Town|Village|Forest|Mountain|River|Sea|Ocean)'
        places = re.findall(place_pattern, content)
        entities.extend(places)

        # Extract system names
        system_pattern = r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:System|Magic|Power|Force)'
        systems = re.findall(system_pattern, content)
        entities.extend(systems)

        return list(set(entities))


class PreferenceProcessor(BaseDimensionProcessor):
    """
    Preference dimension processor.

    Handles creative preferences, style choices, and authorial intent.
    """

    PREFERENCE_KEYWORDS = [
        "prefer", "like", "dislike", "favorite", "style", "tone",
        "genre", "theme", "mood", "approach", "technique", "method",
        "always", "never", "usually", "often", "avoid", "include",
        "emphasis", "focus", "priority", "important", "essential",
        "optional", "required", "mandatory", "forbidden", "allowed"
    ]

    def __init__(self):
        super().__init__(DimensionType.PREFERENCE, self.PREFERENCE_KEYWORDS)

    def extract_entities(self, content: str) -> List[str]:
        entities = []

        # Extract preference statements
        pref_pattern = r'(?:I\s+)?(?:prefer|like|want|need)\s+([^,.]+)'
        preferences = re.findall(pref_pattern, content, re.IGNORECASE)
        entities.extend([p.strip() for p in preferences if len(p.strip()) > 3])

        # Extract avoidance statements
        avoid_pattern = r'(?:avoid|don\'t|never)\s+([^,.]+)'
        avoidances = re.findall(avoid_pattern, content, re.IGNORECASE)
        entities.extend([f"avoid: {a.strip()}" for a in avoidances if len(a.strip()) > 3])

        return list(set(entities))


class ExperienceProcessor(BaseDimensionProcessor):
    """
    Experience dimension processor.

    Handles writing experience, learned patterns, and accumulated knowledge.
    """

    EXPERIENCE_KEYWORDS = [
        "learned", "discovered", "realized", "understood", "figured",
        "pattern", "technique", "trick", "tip", "advice", "lesson",
        "mistake", "error", "success", "failure", "improvement",
        "practice", "exercise", "example", "template", "model",
        "feedback", "review", "critique", "revision", "edit"
    ]

    def __init__(self):
        super().__init__(DimensionType.EXPERIENCE, self.EXPERIENCE_KEYWORDS)

    def extract_entities(self, content: str) -> List[str]:
        entities = []

        # Extract learning statements
        learn_pattern = r'(?:learned|discovered|realized|found)\s+(?:that\s+)?([^,.]+)'
        learnings = re.findall(learn_pattern, content, re.IGNORECASE)
        entities.extend([l.strip() for l in learnings if len(l.strip()) > 5])

        return list(set(entities))


class DimensionRouter:
    """
    Routes content to appropriate dimension processors.

    Provides automatic classification and multi-dimensional processing.
    """

    def __init__(self):
        self._processors: Dict[DimensionType, BaseDimensionProcessor] = {
            DimensionType.TIMELINE: TimelineProcessor(),
            DimensionType.CONTEXT: ContextProcessor(),
            DimensionType.CHARACTER: CharacterProcessor(),
            DimensionType.WORLDVIEW: WorldviewProcessor(),
            DimensionType.PREFERENCE: PreferenceProcessor(),
            DimensionType.EXPERIENCE: ExperienceProcessor(),
        }
        logger.info("DimensionRouter initialized with all processors")

    def get_processor(self, dimension: DimensionType) -> BaseDimensionProcessor:
        """Get a specific dimension processor."""
        return self._processors[dimension]

    def classify(self, content: str) -> ClassificationResult:
        """
        Classify content across all dimensions.

        Args:
            content: Content to classify.

        Returns:
            ClassificationResult with scores for all dimensions.
        """
        scores = []
        all_entities = []

        for dimension, processor in self._processors.items():
            score = processor.classify(content)
            scores.append(score)

            if score.score > 0.3:
                entities = processor.extract_entities(content)
                all_entities.extend(entities)

        # Sort by score descending
        scores.sort(key=lambda s: s.score, reverse=True)

        # Determine primary dimension
        primary = scores[0].dimension if scores and scores[0].score > 0 else DimensionType.CONTEXT

        # Check if multi-dimensional
        high_scores = [s for s in scores if s.score > 0.3]
        multi_dimensional = len(high_scores) > 1

        return ClassificationResult(
            content=content,
            primary_dimension=primary,
            scores=scores,
            multi_dimensional=multi_dimensional,
            extracted_entities=list(set(all_entities))
        )

    def process(
        self,
        content: str,
        dimension: Optional[DimensionType] = None
    ) -> ProcessedContent:
        """
        Process content for a dimension.

        If dimension is None, auto-classifies and uses primary dimension.
        """
        if dimension is None:
            result = self.classify(content)
            dimension = result.primary_dimension

        processor = self._processors[dimension]
        return processor.process(content)

    def process_all(self, content: str) -> Dict[DimensionType, ProcessedContent]:
        """
        Process content for all dimensions.

        Returns dict mapping dimension to processed content.
        """
        results = {}
        for dimension, processor in self._processors.items():
            results[dimension] = processor.process(content)
        return results

    def get_relevant_dimensions(
        self,
        content: str,
        threshold: float = 0.3
    ) -> List[DimensionType]:
        """
        Get dimensions relevant to content.

        Args:
            content: Content to analyze.
            threshold: Minimum score threshold.

        Returns:
            List of relevant dimensions.
        """
        result = self.classify(content)
        return [s.dimension for s in result.scores if s.score >= threshold]


# Singleton instance
_dimension_router: Optional[DimensionRouter] = None


def get_dimension_router() -> DimensionRouter:
    """Get or create DimensionRouter singleton."""
    global _dimension_router
    if _dimension_router is None:
        _dimension_router = DimensionRouter()
    return _dimension_router


def reset_dimension_router() -> None:
    """Reset DimensionRouter singleton (for testing)."""
    global _dimension_router
    _dimension_router = None
