# RAG Domains

A full-stack web app that wraps the LlamaIndex SDK to provide a UI for:
- Creating named **domains** (isolated RAG namespaces)
- **Uploading PDFs** into domains for ingestion
- **Querying** domains with natural language (streaming chat with source attribution)

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python · FastAPI · LlamaIndex · OpenAI |
| Frontend | React · Vite · TypeScript · TanStack Query |
| Storage | Local disk (per-domain vector index) |

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and set OPENAI_API_KEY=sk-...

uvicorn main:app --reload --port 8000
```

Backend runs at http://localhost:8000. Swagger docs at http://localhost:8000/docs.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173.

## Usage

1. **Create a domain** — click "New Domain", give it a name (e.g. `legal`, `finance`)
2. **Upload PDFs** — navigate into the domain and drag-drop PDF files
3. **Test RAG** — use the inline "Test RAG" chat panel on the domain page, or click "Full Chat View" for a dedicated query interface
4. **Source attribution** — each answer shows the source chunks (filename, page, similarity score, excerpt) that the model used

## API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/domains` | List all domains |
| POST | `/domains` | Create domain |
| DELETE | `/domains/{name}` | Delete domain |
| POST | `/domains/{name}/upload` | Upload PDFs |
| GET | `/domains/{name}/documents` | List ingested documents |
| POST | `/domains/{name}/query` | RAG query (streaming or standard) |

## Configuration

All settings are in `backend/.env`:

```env
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small
SIMILARITY_TOP_K=4
CHUNK_SIZE=512
CHUNK_OVERLAP=64
DATA_DIR=./data
```
