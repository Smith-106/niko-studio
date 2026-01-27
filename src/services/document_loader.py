import io
import logging
from typing import List, Dict, Any, Union
from pathlib import Path
import pypdf
import docx
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter

logger = logging.getLogger("DocumentLoader")

class DocumentLoader:
    """
    Service for loading and chunking documents from various file formats.
    Supports: PDF, DOCX, TXT, MD
    """

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 100):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )

    def load_and_split(self, file_obj: Union[io.BytesIO, bytes], filename: str) -> List[Dict[str, Any]]:
        """
        Load a file and split it into chunks.

        Args:
            file_obj: The file object (bytes or BytesIO) from Streamlit uploader or file read.
            filename: The name of the file (used to determine type and metadata).

        Returns:
            List of dictionaries, each containing:
                - content: str
                - source: str (filename)
                - chunk_index: int
                - total_chunks: int
        """
        file_ext = Path(filename).suffix.lower()
        text = ""

        try:
            # Ensure we have a BytesIO object
            if isinstance(file_obj, bytes):
                file_stream = io.BytesIO(file_obj)
            else:
                file_stream = file_obj
                file_stream.seek(0)

            if file_ext == ".pdf":
                text = self._read_pdf(file_stream)
            elif file_ext == ".docx":
                text = self._read_docx(file_stream)
            elif file_ext in [".txt", ".md"]:
                text = self._read_text(file_stream)
            else:
                logger.warning(f"Unsupported file extension: {file_ext}")
                return []

            if not text:
                logger.warning(f"No text extracted from {filename}")
                return []

            # Split text
            chunks = self.text_splitter.split_text(text)

            result = []
            for i, chunk in enumerate(chunks):
                result.append({
                    "content": chunk,
                    "metadata": {
                        "source": filename,
                        "chunk_index": i,
                        "total_chunks": len(chunks),
                        "source_type": file_ext.lstrip(".")
                    }
                })

            logger.info(f"Processed {filename}: {len(chunks)} chunks created.")
            return result

        except Exception as e:
            logger.error(f"Error processing file {filename}: {e}")
            return []

    def _read_pdf(self, stream: io.BytesIO) -> str:
        try:
            reader = pypdf.PdfReader(stream)
            text = []
            for page in reader.pages:
                text.append(page.extract_text() or "")
            return "\n".join(text)
        except Exception as e:
            logger.error(f"Failed to read PDF: {e}")
            return ""

    def _read_docx(self, stream: io.BytesIO) -> str:
        try:
            doc = docx.Document(stream)
            text = []
            for para in doc.paragraphs:
                text.append(para.text)
            return "\n".join(text)
        except Exception as e:
            logger.error(f"Failed to read DOCX: {e}")
            return ""

    def _read_text(self, stream: io.BytesIO) -> str:
        try:
            return stream.read().decode("utf-8")
        except UnicodeDecodeError:
            # Try fallback encoding
            stream.seek(0)
            return stream.read().decode("latin-1")
        except Exception as e:
            logger.error(f"Failed to read text file: {e}")
            return ""
