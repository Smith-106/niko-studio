import io
import logging
import typing

logger = logging.getLogger(__name__)

class DocumentLoader:
    """
    Service to load and parse content from uploaded files.
    Supports: txt, md, pdf, docx
    """

    @staticmethod
    def load_file(file_stream: io.BytesIO, file_name: str) -> str:
        """
        Extract text from a file stream based on its extension.

        Args:
            file_stream: The file-like object containing the document
            file_name: The name of the file (used for extension detection)

        Returns:
            str: Extracted text content
        """
        file_ext = file_name.split('.')[-1].lower()

        try:
            if file_ext in ['txt', 'md']:
                return DocumentLoader._load_text(file_stream)
            elif file_ext == 'pdf':
                return DocumentLoader._load_pdf(file_stream)
            elif file_ext in ['docx', 'doc']: # Handle .doc as .docx logic for now or fail
                # Note: python-docx only supports .docx. .doc is binary OLE format.
                if file_ext == 'doc':
                     raise ValueError("Legacy .doc format is not supported. Please convert to .docx")
                return DocumentLoader._load_docx(file_stream)
            else:
                raise ValueError(f"Unsupported file format: {file_ext}")
        except Exception as e:
            logger.error(f"Error loading file {file_name}: {e}")
            raise e

    @staticmethod
    def _load_text(file_stream: io.BytesIO) -> str:
        return file_stream.read().decode('utf-8')

    @staticmethod
    def _load_pdf(file_stream: io.BytesIO) -> str:
        try:
            import pypdf
        except ImportError:
            raise ImportError("pypdf is required for PDF support")

        reader = pypdf.PdfReader(file_stream)
        text = []
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text.append(extracted)
        return "\n".join(text)

    @staticmethod
    def _load_docx(file_stream: io.BytesIO) -> str:
        try:
            import docx
        except ImportError:
            raise ImportError("python-docx is required for DOCX support")

        doc = docx.Document(file_stream)
        return "\n".join([para.text for para in doc.paragraphs])
