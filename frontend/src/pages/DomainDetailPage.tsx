import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChatInterface } from '../components/ChatInterface';
import { DocumentList } from '../components/DocumentList';
import { PdfDropzone } from '../components/PdfDropzone';
import { useDeleteDocument, useDocuments, useUploadPdfs } from '../hooks/useDocuments';

export function DomainDetailPage() {
  const { name } = useParams<{ name: string }>();
  const domain = name!;
  const { data: documents, isLoading } = useDocuments(domain);
  const uploadMutation = useUploadPdfs(domain);
  const deleteMutation = useDeleteDocument(domain);
  const [chatOpen, setChatOpen] = useState(true);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete "${filename}" from this domain?`)) return;
    setDeletingFilename(filename);
    try {
      await deleteMutation.mutateAsync(filename);
    } finally {
      setDeletingFilename(null);
    }
  };

  return (
    <div style={styles.page}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <Link to="/" style={styles.crumbLink}>Domains</Link>
        <span style={styles.crumbSep}>/</span>
        <span style={styles.crumbCurrent}>{domain}</span>
      </div>

      <div style={styles.headerRow}>
        <h1 style={styles.title}>{domain}</h1>
        <Link to={`/domains/${domain}/query`} style={styles.queryBtn}>
          Full Chat View
        </Link>
      </div>

      <div style={styles.layout}>
        {/* Left: Upload + Documents */}
        <div style={styles.left}>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Upload PDFs</h2>
            <PdfDropzone
              domain={domain}
              onUpload={(files) => uploadMutation.mutateAsync(files)}
            />
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              Documents{' '}
              <span style={styles.count}>
                {documents ? `(${documents.length})` : ''}
              </span>
            </h2>
            <DocumentList
              documents={documents ?? []}
              isLoading={isLoading}
              onDelete={handleDelete}
              deletingFilename={deletingFilename}
            />
          </section>
        </div>

        {/* Right: Inline Chat */}
        <div style={styles.right}>
          <div style={styles.chatHeader}>
            <h2 style={styles.sectionTitle}>Test RAG</h2>
            <button style={styles.toggleBtn} onClick={() => setChatOpen((v) => !v)}>
              {chatOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {chatOpen && (
            <div style={styles.chatBox}>
              <ChatInterface initialDomains={[domain]} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '24px 24px 40px',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  crumbLink: {
    color: '#89b4fa',
    textDecoration: 'none',
    fontSize: 14,
  },
  crumbSep: {
    color: '#45475a',
    fontSize: 14,
  },
  crumbCurrent: {
    color: '#a6adc8',
    fontSize: 14,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    color: '#cdd6f4',
    fontSize: 26,
    margin: 0,
    fontWeight: 700,
  },
  queryBtn: {
    background: '#cba6f7',
    borderRadius: 10,
    color: '#1e1e2e',
    fontSize: 14,
    fontWeight: 600,
    padding: '9px 18px',
    textDecoration: 'none',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 28,
    alignItems: 'start',
  },
  left: {
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },
  right: {
    background: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    height: 600,
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  section: {
    background: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sectionTitle: {
    color: '#cdd6f4',
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
  },
  count: {
    color: '#6c7086',
    fontWeight: 400,
  },
  toggleBtn: {
    background: 'none',
    border: '1px solid #45475a',
    borderRadius: 6,
    color: '#6c7086',
    cursor: 'pointer',
    fontSize: 13,
    padding: '4px 10px',
  },
};
