"""
All domain-related API routes:
  GET    /domains
  POST   /domains
  DELETE /domains/{name}
  POST   /domains/{name}/upload
  GET    /domains/{name}/documents
  POST   /domains/{name}/query
"""

import json
from pathlib import Path

import aiofiles
from app.dependencies import get_index_manager
from app.models.schemas import (
    CreateDomainRequest,
    DocumentInfo,
    DomainInfo,
    MultiQueryRequest,
    MultiQueryResponse,
    QueryRequest,
    QueryResponse,
    SourceChunk,
    UploadResponse,
)
from app.services.index_manager import DomainAlreadyExistsError, DomainNotFoundError, IndexManager
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

router = APIRouter()


def _domain_not_found(name: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Domain '{name}' not found")


def _serialize_source_node(node) -> dict:
    metadata = node.metadata or {}
    filename = metadata.get("file_name", "")
    if not filename:
        # Fall back to doc_id stem
        doc_id = getattr(node, "node_id", "")
        filename = doc_id.split("::")[-1] if "::" in doc_id else doc_id

    return {
        "doc_id": node.node_id,
        "filename": filename,
        "page_label": metadata.get("page_label"),
        "score": round(node.score, 4) if node.score is not None else None,
        "text": node.get_content(),
    }


# ── List domains ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[DomainInfo])
async def list_domains(mgr: IndexManager = Depends(get_index_manager)):
    return await mgr.list_domains()


# ── Create domain ─────────────────────────────────────────────────────────────

@router.post("", response_model=DomainInfo, status_code=201)
async def create_domain(
    body: CreateDomainRequest,
    mgr: IndexManager = Depends(get_index_manager),
):
    try:
        await mgr.create_domain(body.name, body.description)
    except DomainAlreadyExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return await mgr.get_domain(body.name)


# ── Delete domain ─────────────────────────────────────────────────────────────

@router.delete("/{name}", status_code=204)
async def delete_domain(name: str, mgr: IndexManager = Depends(get_index_manager)):
    try:
        await mgr.delete_domain(name)
    except DomainNotFoundError:
        raise _domain_not_found(name)


# ── Upload PDFs ───────────────────────────────────────────────────────────────

@router.post("/{name}/upload", response_model=UploadResponse)
async def upload_pdfs(
    name: str,
    files: list[UploadFile] = File(...),
    mgr: IndexManager = Depends(get_index_manager),
):
    if not mgr.domain_exists(name):
        raise _domain_not_found(name)

    pdf_dir: Path = mgr._pdf_dir(name)
    pdf_dir.mkdir(parents=True, exist_ok=True)

    saved_paths: list[Path] = []
    filenames: list[str] = []

    for upload in files:
        if not (
            upload.filename.lower().endswith(".pdf")
            or upload.content_type == "application/pdf"
        ):
            raise HTTPException(
                status_code=400,
                detail=f"File '{upload.filename}' is not a PDF",
            )

        dest = pdf_dir / upload.filename
        async with aiofiles.open(dest, "wb") as f:
            content = await upload.read()
            await f.write(content)

        saved_paths.append(dest)
        filenames.append(upload.filename)

    try:
        ingested = await mgr.ingest_pdfs(name, saved_paths)
    except DomainNotFoundError:
        raise _domain_not_found(name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")

    return UploadResponse(
        uploaded=len(saved_paths),
        ingested=ingested,
        filenames=filenames,
    )


# ── List documents ────────────────────────────────────────────────────────────

@router.get("/{name}/documents", response_model=list[DocumentInfo])
async def list_documents(name: str, mgr: IndexManager = Depends(get_index_manager)):
    try:
        return await mgr.list_documents(name)
    except DomainNotFoundError:
        raise _domain_not_found(name)


# ── Delete document ───────────────────────────────────────────────────────────

@router.delete("/{name}/documents/{filename:path}", status_code=204)
async def delete_document(
    name: str,
    filename: str,
    mgr: IndexManager = Depends(get_index_manager),
):
    if not mgr.domain_exists(name):
        raise _domain_not_found(name)
    try:
        await mgr.delete_document(name, filename)
    except DomainNotFoundError:
        raise _domain_not_found(name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Document '{filename}' not found")


# ── Multi-domain query (must be before /{name}/query to avoid path conflict) ──

@router.post("/query")
async def query_multi_domain(
    body: MultiQueryRequest,
    mgr: IndexManager = Depends(get_index_manager),
):
    """Query one or more domains and merge the results."""
    if not body.domains:
        raise HTTPException(status_code=400, detail="At least one domain is required")

    # Validate all domains exist upfront
    for name in body.domains:
        if not mgr.domain_exists(name):
            raise _domain_not_found(name)

    try:
        if body.streaming:
            return await _multi_streaming_query(body.domains, body.question, mgr)
        else:
            return await _multi_standard_query(body.domains, body.question, mgr)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


async def _gather_nodes(domains: list[str], question: str, mgr: IndexManager) -> tuple[list, list]:
    """Retrieve nodes from all domains concurrently, return (merged_nodes, sources_list)."""
    import asyncio

    results = await asyncio.gather(
        *[mgr.retrieve_nodes(name, question) for name in domains],
        return_exceptions=True,
    )

    merged_nodes = []
    all_sources = []

    for name, nodes in zip(domains, results):
        if isinstance(nodes, Exception):
            continue
        for node in nodes:
            merged_nodes.append(node)
            s = _serialize_source_node(node)
            s["filename"] = f"{name}/{s['filename']}"
            all_sources.append(s)

    return merged_nodes, all_sources


async def _multi_standard_query(
    domains: list[str], question: str, mgr: IndexManager
) -> MultiQueryResponse:
    merged_nodes, all_sources = await _gather_nodes(domains, question, mgr)

    if not merged_nodes:
        return MultiQueryResponse(
            answer="No results found across the selected domains.",
            sources=[],
            domains=domains,
            question=question,
        )

    response = await mgr.synthesize(question, merged_nodes, streaming=False)

    return MultiQueryResponse(
        answer=str(response),
        sources=[SourceChunk(**s) for s in all_sources],
        domains=domains,
        question=question,
    )


async def _multi_streaming_query(
    domains: list[str], question: str, mgr: IndexManager
) -> StreamingResponse:
    # Retrieve from all domains concurrently, then synthesize with streaming
    merged_nodes, all_sources = await _gather_nodes(domains, question, mgr)

    if not merged_nodes:
        async def empty_sse():
            yield f"data: {json.dumps({'type': 'token', 'text': 'No results found across the selected domains.'})}\n\n"
            yield f"data: {json.dumps({'type': 'sources', 'sources': []})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(empty_sse(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    # synthesize returns a streaming response object; run it in thread
    response = await mgr.synthesize(question, merged_nodes, streaming=True)

    async def sse_generator():
        try:
            for token in response.response_gen:
                yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
            yield f"data: {json.dumps({'type': 'sources', 'sources': all_sources})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── Single-domain query ───────────────────────────────────────────────────────

@router.post("/{name}/query")
async def query_domain(
    name: str,
    body: QueryRequest,
    mgr: IndexManager = Depends(get_index_manager),
):
    try:
        if body.streaming:
            return await _streaming_query(name, body.question, mgr)
        else:
            return await _standard_query(name, body.question, mgr)
    except DomainNotFoundError:
        raise _domain_not_found(name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


async def _standard_query(name: str, question: str, mgr: IndexManager) -> QueryResponse:
    response = await mgr.query(name, question, streaming=False)
    sources = [_serialize_source_node(n) for n in response.source_nodes]
    return QueryResponse(
        answer=str(response),
        sources=[SourceChunk(**s) for s in sources],
        domain=name,
        question=question,
    )


async def _streaming_query(
    name: str, question: str, mgr: IndexManager
) -> StreamingResponse:
    response = await mgr.query(name, question, streaming=True)

    async def sse_generator():
        try:
            for token in response.response_gen:
                yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
            sources = [_serialize_source_node(n) for n in response.source_nodes]
            yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
