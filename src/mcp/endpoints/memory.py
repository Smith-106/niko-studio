"""
Memory REST Endpoints

Memory-related HTTP endpoints for Desktop frontend.
"""

import base64
import io
import logging
from typing import List

from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("niko-gateway")


async def memory_search_endpoint(request: Request):
    """Memory search REST endpoint."""
    from src.mcp.gateway import memory_search

    body = await request.json()
    result = await memory_search(
        query=body.get("query", ""),
        layer=body.get("layer"),
        dimensions=body.get("dimensions"),
        entity_id=body.get("entity_id"),
        at_time=body.get("at_time"),
        limit=body.get("limit", 10),
    )
    return JSONResponse(result)


async def memory_add_endpoint(request: Request):
    """Memory add REST endpoint."""
    from src.mcp.gateway import memory_add

    body = await request.json()
    result = await memory_add(
        content=body.get("content", ""),
        layer=body.get("layer", "session"),
        dimension=body.get("dimension"),
        entity_id=body.get("entity_id"),
        valid_from=body.get("valid_from"),
        valid_until=body.get("valid_until"),
        importance=body.get("importance", 0.5),
        tags=body.get("tags") or [],
    )
    return JSONResponse(result)


async def memory_upload_endpoint(request: Request):
    """Memory upload REST endpoint - uploads and chunks file content."""
    from src.mcp.gateway import memory_add, DocumentLoader

    body = await request.json()

    file_name = body.get("file_name")
    file_content_base64 = body.get("file_content_base64")
    session_id = body.get("session_id")
    chunk_size = body.get("chunk_size", 1000)
    chunk_overlap = body.get("chunk_overlap", 200)

    if not isinstance(file_name, str) or not file_name.strip():
        return JSONResponse({"error": "file_name is required"}, status_code=400)
    if not isinstance(file_content_base64, str) or not file_content_base64.strip():
        return JSONResponse({"error": "file_content_base64 is required"}, status_code=400)
    if not isinstance(session_id, str) or not session_id.strip():
        return JSONResponse({"error": "session_id is required"}, status_code=400)

    try:
        if isinstance(file_content_base64, str) and "," in file_content_base64:
            file_content_base64 = file_content_base64.split(",", 1)[1]
        file_bytes = base64.b64decode(file_content_base64, validate=True)
    except Exception:
        return JSONResponse({"error": "invalid file_content_base64"}, status_code=400)

    try:
        text = DocumentLoader.load_file(io.BytesIO(file_bytes), file_name)
    except Exception as exc:
        return JSONResponse({"error": f"failed to parse file: {exc}"}, status_code=400)

    if not text.strip():
        return JSONResponse({"error": "file contains no readable text"}, status_code=400)

    chunk_size = int(chunk_size)
    chunk_overlap = int(chunk_overlap)
    if chunk_size <= 0:
        chunk_size = 1000
    if chunk_overlap < 0:
        chunk_overlap = 0
    if chunk_overlap >= chunk_size:
        chunk_overlap = max(chunk_size // 5, 0)

    try:
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
        except ImportError:
            from langchain.text_splitter import RecursiveCharacterTextSplitter

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )
        chunks = splitter.split_text(text)
    except Exception as exc:
        return JSONResponse({"error": f"failed to split file text: {exc}"}, status_code=500)

    if not chunks:
        return JSONResponse({"error": "file contains no indexable chunks"}, status_code=400)

    safe_filename = "".join([c for c in file_name if c.isalnum() or c in (" ", ".", "_")]).replace(" ", "_")
    if not safe_filename:
        safe_filename = "uploaded_file"

    tags = ["uploaded_material", f"filename:{safe_filename}", f"session:{session_id}"]
    memory_ids: List[str] = []

    for index, chunk in enumerate(chunks):
        chunk_content = chunk.strip()
        if not chunk_content:
            continue
        chunk_id = f"{session_id}_{safe_filename}_part_{index}"
        result = await memory_add(
            content=chunk_content,
            layer="session",
            dimension="context",
            entity_id=session_id,
            importance=0.6,
            tags=[*tags, f"chunk:{index}", f"chunk_id:{chunk_id}"],
        )
        memory_id = result.get("id") if isinstance(result, dict) else None
        if isinstance(memory_id, str):
            memory_ids.append(memory_id)

    if not memory_ids:
        return JSONResponse({"error": "failed to inject any file chunks"}, status_code=500)

    return JSONResponse({
        "status": "created",
        "file_name": file_name,
        "session_id": session_id,
        "chunks": len(memory_ids),
        "memory_ids": memory_ids,
    })


async def memory_temporal_endpoint(request: Request):
    """Memory temporal query REST endpoint."""
    from src.mcp.gateway import memory_get_temporal

    body = await request.json()
    result = await memory_get_temporal(
        entity_id=body.get("entity_id", ""),
        at_time=body.get("at_time"),
    )
    return JSONResponse(result)


__all__ = [
    "memory_search_endpoint",
    "memory_add_endpoint",
    "memory_upload_endpoint",
    "memory_temporal_endpoint",
]
