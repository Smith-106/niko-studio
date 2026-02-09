from typing import Optional, Callable, Any
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter

from src.services.document_loader import DocumentLoader
from src.services.indexing_service import IndexingService

def process_uploaded_file(uploaded_file: Any, session_id: str, indexing_service: IndexingService, progress_callback: Optional[Callable[[float], None]] = None) -> int:
    """
    Process an uploaded file: load content, split into chunks, and index.

    Args:
        uploaded_file: The file object from streamlit (BytesIO with .name)
        session_id: The current session ID
        indexing_service: The indexing service instance
        progress_callback: Optional callback for progress updates (accepts float 0.0-1.0)

    Returns:
        int: The number of chunks processed.
    """
    # Load text
    text = DocumentLoader.load_file(uploaded_file, uploaded_file.name)

    # Chunking
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )
    chunks = text_splitter.split_text(text)

    # Indexing
    # Sanitize filename
    safe_filename = "".join([c for c in uploaded_file.name if c.isalnum() or c in (' ', '.', '_')]).replace(' ', '_')

    for i, chunk in enumerate(chunks):
        chunk_id = f"{session_id}_{safe_filename}_part_{i}"
        indexing_service.add_document(doc_id=chunk_id, content=chunk, source_type="uploaded_material")
        if progress_callback:
            progress_callback((i + 1) / len(chunks))

    return len(chunks)
