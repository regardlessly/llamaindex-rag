export interface Domain {
  name: string;
  description: string;
  created_at: string;
  doc_count: number;
}

export interface DocumentInfo {
  doc_id: string;
  filename: string;
  num_chunks: number;
}

export interface SourceChunk {
  doc_id: string;
  filename: string;
  page_label: string | null;
  score: number | null;
  text: string;
}

export interface QueryResponse {
  answer: string;
  sources: SourceChunk[];
  domain: string;
  question: string;
}

export interface UploadResponse {
  uploaded: number;
  ingested: number;
  filenames: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceChunk[];
}
