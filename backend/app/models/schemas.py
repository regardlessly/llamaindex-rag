import re
from typing import Optional

from pydantic import BaseModel, field_validator


class CreateDomainRequest(BaseModel):
    name: str
    description: str = ""

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$", v):
            raise ValueError(
                "Domain name must be lowercase alphanumeric with optional hyphens, 1-64 chars"
            )
        return v


class QueryRequest(BaseModel):
    question: str
    streaming: bool = False


class MultiQueryRequest(BaseModel):
    question: str
    domains: list[str]
    streaming: bool = False


class DomainInfo(BaseModel):
    name: str
    description: str
    created_at: str
    doc_count: int


class DocumentInfo(BaseModel):
    doc_id: str
    filename: str
    num_chunks: int


class SourceChunk(BaseModel):
    doc_id: str
    filename: str
    page_label: Optional[str]
    score: Optional[float]
    text: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    domain: str
    question: str


class MultiQueryResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    domains: list[str]
    question: str


class UploadResponse(BaseModel):
    uploaded: int
    ingested: int
    filenames: list[str]
