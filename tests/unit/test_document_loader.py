import pytest
from unittest.mock import MagicMock, patch
import io
import sys
import os

# Ensure src is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../src")))

from services.document_loader import DocumentLoader

def test_load_text():
    content = "Hello world"
    f = io.BytesIO(content.encode('utf-8'))
    result = DocumentLoader.load_file(f, "test.txt")
    assert result == content

def test_load_md():
    content = "# Heading\nContent"
    f = io.BytesIO(content.encode('utf-8'))
    result = DocumentLoader.load_file(f, "test.md")
    assert result == content

@patch('pypdf.PdfReader')
def test_load_pdf(mock_pdf_reader):
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "PDF Content"

    mock_reader_instance = MagicMock()
    mock_reader_instance.pages = [mock_page]

    mock_pdf_reader.return_value = mock_reader_instance

    f = io.BytesIO(b"fake pdf content")
    result = DocumentLoader.load_file(f, "test.pdf")

    assert result == "PDF Content"
    mock_pdf_reader.assert_called_once()

@patch('docx.Document')
def test_load_docx(mock_docx_document):
    mock_para = MagicMock()
    mock_para.text = "Docx Content"

    mock_doc_instance = MagicMock()
    mock_doc_instance.paragraphs = [mock_para]

    mock_docx_document.return_value = mock_doc_instance

    f = io.BytesIO(b"fake docx content")
    result = DocumentLoader.load_file(f, "test.docx")

    assert result == "Docx Content"
    mock_docx_document.assert_called_once()

def test_unsupported_format():
    f = io.BytesIO(b"content")
    with pytest.raises(ValueError, match="Unsupported file format: jpg"):
        DocumentLoader.load_file(f, "image.jpg")
