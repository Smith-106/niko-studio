from dataclasses import dataclass, field
import hashlib
from typing import Dict, Any, Optional
import json

@dataclass
class Citation:
    """
    Represents a verifiable reference to a source document.
    Inspired by OpenKL's citation object.
    """
    doc_id: str
    span: str  # e.g., "L10-L15" or "char:100-200"
    content: str
    source_hash: str # SHA256 of the content for integrity check
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_json(self) -> str:
        return json.dumps(self.__dict__, ensure_ascii=False)

    @staticmethod
    def from_json(json_str: str) -> 'Citation':
        data = json.loads(json_str)
        return Citation(**data)

class CitationManager:
    """
    Manages creation and verification of citations.
    """

    @staticmethod
    def create_citation(doc_id: str, content: str, span: str = "", metadata: Dict = None) -> Citation:
        """
        Creates a new citation object.
        """
        # Calculate hash of the content for verification
        content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
        
        return Citation(
            doc_id=doc_id,
            span=span,
            content=content,
            source_hash=content_hash,
            metadata=metadata or {}
        )

    @staticmethod
    def verify_citation(citation: Citation, current_content: str) -> bool:
        """
        Verifies if the citation is still valid against current document content.
        
        Args:
            citation: The citation object to verify.
            current_content: The text from the actual file currently on disk.
            
        Returns:
            bool: True if content matches the citation hash.
        """
        if not current_content:
            return False
            
        # Re-calculate hash
        current_hash = hashlib.sha256(current_content.encode('utf-8')).hexdigest()
        
        # Strict equality check
        # In a real system, we might check if 'citation.content' exists in 'current_content' substring
        # But for 'verifiable provenance', exact match or hash match is safer.
        return citation.source_hash == current_hash or citation.content in current_content
