from contextlib import asynccontextmanager

from app.dependencies import get_index_manager
from app.routers.domains import router as domains_router
from config import get_settings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure data directory exists on startup
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    # Pre-configure LlamaIndex settings
    mgr = get_index_manager()
    mgr._configure_llama_settings()
    yield


app = FastAPI(
    title="RAG Domains API",
    description="LlamaIndex-powered RAG with named domains",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(domains_router, prefix="/domains", tags=["domains"])


@app.get("/health")
def health():
    return {"status": "ok"}
