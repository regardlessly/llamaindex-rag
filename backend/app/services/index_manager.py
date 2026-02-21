"""
LlamaIndex integration layer.

Manages per-domain VectorStoreIndex instances with an in-memory cache.
All blocking LlamaIndex operations are run in a thread pool via asyncio.to_thread
to avoid blocking the FastAPI event loop.
"""

import asyncio
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from config import Settings


class DomainNotFoundError(Exception):
    pass


class DomainAlreadyExistsError(Exception):
    pass


class IndexManager:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._instances: dict = {}  # domain_name -> VectorStoreIndex
        self._configured = False

    def _configure_llama_settings(self) -> None:
        if self._configured:
            return
        from llama_index.core import Settings
        from llama_index.embeddings.openai import OpenAIEmbedding
        from llama_index.llms.openai import OpenAI

        Settings.llm = OpenAI(
            model=self._settings.llm_model,
            api_key=self._settings.openai_api_key,
        )
        Settings.embed_model = OpenAIEmbedding(
            model=self._settings.embedding_model,
            api_key=self._settings.openai_api_key,
        )
        Settings.chunk_size = self._settings.chunk_size
        Settings.chunk_overlap = self._settings.chunk_overlap
        self._configured = True

    # ── Path helpers ──────────────────────────────────────────────────────────

    def _domain_dir(self, name: str) -> Path:
        return self._settings.data_dir / name

    def _index_dir(self, name: str) -> Path:
        return self._domain_dir(name) / "index"

    def _pdf_dir(self, name: str) -> Path:
        return self._domain_dir(name) / "pdfs"

    def _meta_path(self, name: str) -> Path:
        return self._domain_dir(name) / "meta.json"

    # ── Meta helpers ──────────────────────────────────────────────────────────

    def _read_meta(self, name: str) -> dict:
        return json.loads(self._meta_path(name).read_text())

    def _write_meta(self, name: str, meta: dict) -> None:
        self._meta_path(name).write_text(json.dumps(meta, indent=2))

    # ── Domain existence ──────────────────────────────────────────────────────

    def domain_exists(self, name: str) -> bool:
        return self._meta_path(name).exists()

    def index_exists(self, name: str) -> bool:
        return (self._index_dir(name) / "index_store.json").exists()

    # ── Sync internals (run inside threads) ───────────────────────────────────

    def _create_empty_index_sync(self, name: str, description: str) -> None:
        from llama_index.core import StorageContext, VectorStoreIndex

        self._configure_llama_settings()

        pdf_dir = self._pdf_dir(name)
        index_dir = self._index_dir(name)
        pdf_dir.mkdir(parents=True, exist_ok=True)
        index_dir.mkdir(parents=True, exist_ok=True)

        storage_context = StorageContext.from_defaults()
        index = VectorStoreIndex(nodes=[], storage_context=storage_context)
        index.storage_context.persist(persist_dir=str(index_dir))

        self._instances[name] = index
        self._write_meta(
            name,
            {
                "name": name,
                "description": description,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "doc_count": 0,
            },
        )

    def _load_index_sync(self, name: str):
        from llama_index.core import StorageContext, load_index_from_storage

        self._configure_llama_settings()
        storage_context = StorageContext.from_defaults(
            persist_dir=str(self._index_dir(name))
        )
        return load_index_from_storage(storage_context)

    def _get_or_load_index_sync(self, name: str):
        if name in self._instances:
            return self._instances[name]
        if not self.domain_exists(name):
            raise DomainNotFoundError(f"Domain '{name}' not found")
        index = self._load_index_sync(name)
        self._instances[name] = index
        return index

    def _extract_text_from_pdf(self, pdf_path: Path) -> list:
        """
        Extract text from a PDF, falling back to OCR for image-based pages.
        Returns a list of (page_num, text) tuples for non-empty pages.
        """
        import pypdf

        pages = []
        reader = pypdf.PdfReader(str(pdf_path))
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            text = text.strip()
            if text:
                pages.append((i, text))

        # If fewer than 10% of pages have text, try OCR via pymupdf + pytesseract
        if len(pages) < max(1, len(reader.pages) * 0.1):
            try:
                import fitz  # pymupdf
                import pytesseract
                from PIL import Image
                import io

                pages = []
                doc = fitz.open(str(pdf_path))
                for i, page in enumerate(doc):
                    mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better OCR
                    pix = page.get_pixmap(matrix=mat)
                    img = Image.open(io.BytesIO(pix.tobytes("png")))
                    text = pytesseract.image_to_string(img).strip()
                    if text:
                        pages.append((i, text))
                doc.close()
            except ImportError:
                pass  # OCR deps not available, use what we have

        return pages

    def _ingest_pdfs_sync(self, name: str, pdf_paths: list[Path]) -> int:
        from llama_index.core.schema import Document

        index = self._get_or_load_index_sync(name)

        new_count = 0
        for pdf_path in pdf_paths:
            pages = self._extract_text_from_pdf(pdf_path)

            if not pages:
                # Nothing extractable — skip silently
                continue

            # Each page gets a unique doc_id so refresh_ref_docs tracks them
            # individually and doesn't collapse the whole PDF into one node.
            documents = []
            for page_num, text in pages:
                doc = Document(
                    text=text,
                    doc_id=f"{name}::{pdf_path.name}::p{page_num}",
                    metadata={
                        "file_name": pdf_path.name,
                        "domain": name,
                        "page_label": str(page_num + 1),
                    },
                )
                documents.append(doc)

            index.refresh_ref_docs(documents)
            new_count += len(documents)

        index.storage_context.persist(persist_dir=str(self._index_dir(name)))

        # Update doc_count from actual ref_doc_info
        meta = self._read_meta(name)
        meta["doc_count"] = len(index.ref_doc_info)
        self._write_meta(name, meta)

        return new_count

    def _list_documents_sync(self, name: str) -> list[dict]:
        index = self._get_or_load_index_sync(name)

        # Group per-page doc_ids back into a single entry per filename.
        # doc_id format: "{domain}::{filename}::p{n}"  (new)
        #            or: "{domain}::{filename}"         (legacy)
        file_chunks: dict[str, int] = {}
        for doc_id, ref_info in index.ref_doc_info.items():
            # Strip domain prefix
            without_domain = doc_id.split("::", 1)[-1] if "::" in doc_id else doc_id
            # Strip ::pN page suffix if present
            if "::" in without_domain:
                filename = without_domain.rsplit("::", 1)[0]
            else:
                filename = without_domain
            file_chunks[filename] = file_chunks.get(filename, 0) + len(ref_info.node_ids)

        return [
            {"doc_id": filename, "filename": filename, "num_chunks": chunks}
            for filename, chunks in sorted(file_chunks.items())
        ]

    def _query_sync(self, name: str, question: str, streaming: bool):
        from llama_index.core import PromptTemplate
        from llama_index.core.prompts import PromptType

        index = self._get_or_load_index_sync(name)

        qa_prompt = PromptTemplate(
            """\
You are an expert research assistant. Use the provided context to answer the question thoroughly and accurately.
- Be specific and detailed — include numbers, names, and facts from the context.
- If the context contains partial information, synthesize it fully rather than summarizing vaguely.
- If the answer is not in the context, say so clearly.
- Do not hedge unnecessarily — answer directly.

Context:
---------------------
{context_str}
---------------------

Question: {query_str}

Answer:""",
            prompt_type=PromptType.QUESTION_ANSWER,
        )

        query_engine = index.as_query_engine(
            similarity_top_k=self._settings.similarity_top_k,
            streaming=streaming,
            response_mode="compact",
            text_qa_template=qa_prompt,
        )
        return query_engine.query(question)

    def _retrieve_nodes_sync(self, name: str, question: str) -> list:
        """Return the top-k NodeWithScore objects for a domain without synthesizing."""
        index = self._get_or_load_index_sync(name)
        retriever = index.as_retriever(
            similarity_top_k=self._settings.similarity_top_k
        )
        nodes = retriever.retrieve(question)
        # Tag each node with its source domain for attribution
        # n is NodeWithScore; metadata lives on n.node
        for n in nodes:
            n.node.metadata = dict(n.node.metadata or {})
            n.node.metadata["_domain"] = name
        return nodes

    def _synthesize_sync(self, question: str, nodes: list, streaming: bool):
        """Run a single LLM synthesis pass over the merged node pool."""
        from llama_index.core import PromptTemplate, get_response_synthesizer
        from llama_index.core.prompts import PromptType
        from llama_index.core.schema import QueryBundle

        self._configure_llama_settings()

        qa_prompt = PromptTemplate(
            """\
You are an expert research assistant with access to information from multiple knowledge domains.
Use ALL of the provided context to answer the question thoroughly and accurately.
- Be specific and detailed — include numbers, names, dates, and facts from the context.
- Synthesize information across sources into a single coherent answer.
- If sources contain complementary information, combine them naturally.
- If the answer is not in the context, say so clearly.
- Do not hedge unnecessarily — answer directly and confidently.

Context:
---------------------
{context_str}
---------------------

Question: {query_str}

Answer:""",
            prompt_type=PromptType.QUESTION_ANSWER,
        )

        refine_prompt = PromptTemplate(
            """\
You are an expert research assistant. You have an existing answer and new context to refine it with.
Incorporate any new relevant information from the additional context to make the answer more complete and accurate.
Do not remove correct information — only add or improve.

Existing answer:
{existing_answer}

Additional context:
---------------------
{context_msg}
---------------------

Question: {query_str}

Refined answer:""",
            prompt_type=PromptType.REFINE,
        )

        synthesizer = get_response_synthesizer(
            response_mode="refine",
            streaming=streaming,
            text_qa_template=qa_prompt,
            refine_template=refine_prompt,
        )
        return synthesizer.synthesize(
            query=QueryBundle(query_str=question),
            nodes=nodes,
        )

    def _delete_document_sync(self, name: str, filename: str) -> None:
        """Remove all per-page doc entries for a filename from the index and delete the PDF."""
        index = self._get_or_load_index_sync(name)

        # Collect all doc_ids that belong to this filename
        to_delete = [
            doc_id for doc_id in index.ref_doc_info
            if doc_id == f"{name}::{filename}"             # legacy format
            or doc_id.startswith(f"{name}::{filename}::")  # per-page format
        ]

        if not to_delete:
            raise FileNotFoundError(filename)

        for doc_id in to_delete:
            index.delete_ref_doc(doc_id, delete_from_docstore=True)

        index.storage_context.persist(persist_dir=str(self._index_dir(name)))

        # Delete the PDF file from disk
        pdf_path = self._pdf_dir(name) / filename
        if pdf_path.exists():
            pdf_path.unlink()

        # Update doc_count
        meta = self._read_meta(name)
        meta["doc_count"] = len(index.ref_doc_info)
        self._write_meta(name, meta)

    def _delete_domain_sync(self, name: str) -> None:
        self._instances.pop(name, None)
        domain_dir = self._domain_dir(name)
        if domain_dir.exists():
            shutil.rmtree(domain_dir)

    # ── Public async API ──────────────────────────────────────────────────────

    async def create_domain(self, name: str, description: str) -> None:
        if self.domain_exists(name):
            raise DomainAlreadyExistsError(f"Domain '{name}' already exists")
        await asyncio.to_thread(self._create_empty_index_sync, name, description)

    async def list_domains(self) -> list[dict]:
        data_dir = self._settings.data_dir
        data_dir.mkdir(parents=True, exist_ok=True)
        domains = []
        for meta_path in sorted(data_dir.glob("*/meta.json")):
            try:
                domains.append(json.loads(meta_path.read_text()))
            except Exception:
                pass
        return domains

    async def get_domain(self, name: str) -> dict:
        if not self.domain_exists(name):
            raise DomainNotFoundError(f"Domain '{name}' not found")
        return self._read_meta(name)

    async def delete_domain(self, name: str) -> None:
        if not self.domain_exists(name):
            raise DomainNotFoundError(f"Domain '{name}' not found")
        await asyncio.to_thread(self._delete_domain_sync, name)

    async def delete_document(self, name: str, filename: str) -> None:
        if not self.domain_exists(name):
            raise DomainNotFoundError(f"Domain '{name}' not found")
        await asyncio.to_thread(self._delete_document_sync, name, filename)

    async def ingest_pdfs(self, name: str, pdf_paths: list[Path]) -> int:
        if not self.domain_exists(name):
            raise DomainNotFoundError(f"Domain '{name}' not found")
        return await asyncio.to_thread(self._ingest_pdfs_sync, name, pdf_paths)

    async def list_documents(self, name: str) -> list[dict]:
        if not self.domain_exists(name):
            raise DomainNotFoundError(f"Domain '{name}' not found")
        return await asyncio.to_thread(self._list_documents_sync, name)

    async def query(self, name: str, question: str, streaming: bool = False):
        if not self.domain_exists(name):
            raise DomainNotFoundError(f"Domain '{name}' not found")
        return await asyncio.to_thread(self._query_sync, name, question, streaming)

    async def retrieve_nodes(self, name: str, question: str) -> list:
        """Retrieve top-k nodes from a single domain (no LLM call)."""
        if not self.domain_exists(name):
            raise DomainNotFoundError(f"Domain '{name}' not found")
        return await asyncio.to_thread(self._retrieve_nodes_sync, name, question)

    async def synthesize(self, question: str, nodes: list, streaming: bool = False):
        """Synthesize a single answer from pre-merged nodes."""
        return await asyncio.to_thread(self._synthesize_sync, question, nodes, streaming)
