import type { Domain, DocumentInfo, QueryResponse, SourceChunk, UploadResponse } from '../types';

// In production, set VITE_API_URL to the backend Railway service URL.
// In dev, leave it unset and the Vite proxy handles routing.
const BASE = (import.meta.env.VITE_API_URL as string) ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Request failed');
  }
  return res.json();
}

// ── Domains ───────────────────────────────────────────────────────────────────

export function getDomains(): Promise<Domain[]> {
  return request('/domains');
}

export function createDomain(name: string, description: string): Promise<Domain> {
  return request('/domains', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export function deleteDomain(name: string): Promise<void> {
  return fetch(`${BASE}/domains/${name}`, { method: 'DELETE' }).then(() => undefined);
}

// ── Documents ─────────────────────────────────────────────────────────────────

export function getDocuments(domain: string): Promise<DocumentInfo[]> {
  return request(`/domains/${domain}/documents`);
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadPdfs(domain: string, files: File[]): Promise<UploadResponse> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file);
  }
  const res = await fetch(`${BASE}/domains/${domain}/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Upload failed');
  }
  return res.json();
}

// ── Query ─────────────────────────────────────────────────────────────────────

export async function query(domain: string, question: string): Promise<QueryResponse> {
  return request(`/domains/${domain}/query`, {
    method: 'POST',
    body: JSON.stringify({ question, streaming: false }),
  });
}

// Multi-domain streaming query — routes to /domains/query when >1 domain,
// or /domains/{name}/query for a single domain.
export async function queryStream(
  domains: string[],
  question: string,
  onToken: (text: string) => void,
  onSources: (sources: SourceChunk[]) => void,
  onDone: () => void,
  onError: (msg: string) => void,
): Promise<void> {
  const url =
    domains.length === 1
      ? `${BASE}/domains/${domains[0]}/query`
      : `${BASE}/domains/query`;

  const body =
    domains.length === 1
      ? JSON.stringify({ question, streaming: true })
      : JSON.stringify({ question, domains, streaming: true });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Query failed');
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (raw === '[DONE]') {
        onDone();
        return;
      }
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'token') onToken(msg.text);
        else if (msg.type === 'sources') onSources(msg.sources);
        else if (msg.type === 'error') onError(msg.message);
      } catch {
        // ignore malformed frames
      }
    }
  }
  onDone();
}
