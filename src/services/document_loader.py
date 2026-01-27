import logging
from io import BytesIO
from typing import List, Optional
import pypdf
import docx
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger("DocumentLoader")

class DocumentLoader:
    """
    Service to load and chunk documents from various file formats.
    """

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )

    def load_file(self, file_obj: BytesIO, filename: str) -> str:
        """
        Extract text from a file object based on its extension.
        """
        filename_lower = filename.lower()

        try:
            if filename_lower.endswith('.pdf'):
                return self._parse_pdf(file_obj)
            elif filename_lower.endswith('.docx'):
                return self._parse_docx(file_obj)
            elif filename_lower.endswith('.txt') or filename_lower.endswith('.md'):
                return self._parse_text(file_obj)
            else:
                raise ValueError(f"Unsupported file format: {filename}")
        except Exception as e:
            logger.error(f"Error loading file {filename}: {e}")
            raise e

    def _parse_pdf(self, file_obj: BytesIO) -> str:
        reader = pypdf.PdfReader(file_obj)
        text = []
        for page in reader.pages:
            content = page.extract_text()
            if content:
                text.append(content)
        return "\n".join(text)

    def _parse_docx(self, file_obj: BytesIO) -> str:
        doc = docx.Document(file_obj)
        text = []
        for para in doc.paragraphs:
            text.append(para.text)
        return "\n".join(text)

    def _parse_text(self, file_obj: BytesIO) -> str:
        # Reset pointer just in case, though usually fresh stream
        file_obj.seek(0)
        content_bytes = file_obj.read()
        try:
            return content_bytes.decode('utf-8')
        except UnicodeDecodeError:
            logger.warning("UTF-8 decode failed, falling back to latin-1")
            try:
                return content_bytes.decode('latin-1')
            except Exception:
                # Last resort: ignore errors or replace
                return content_bytes.decode('utf-8', errors='replace')

    def chunk_text(self, text: str) -> List[str]:
        """
        Split text into chunks.
        """
        return self.text_splitter.split_text(text)
