import type { DocumentInfo } from '../types';

interface Props {
  documents: DocumentInfo[];
  isLoading: boolean;
}

export function DocumentList({ documents, isLoading }: Props) {
  if (isLoading) {
    return <p style={styles.hint}>Loading documents...</p>;
  }
  if (!documents.length) {
    return <p style={styles.hint}>No documents ingested yet. Upload PDFs above.</p>;
  }

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Filename</th>
          <th style={{ ...styles.th, textAlign: 'right' }}>Chunks</th>
        </tr>
      </thead>
      <tbody>
        {documents.map((doc) => (
          <tr key={doc.doc_id} style={styles.row}>
            <td style={styles.td}>{doc.filename}</td>
            <td style={{ ...styles.td, textAlign: 'right', color: '#6c7086' }}>
              {doc.num_chunks}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const styles: Record<string, React.CSSProperties> = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    color: '#6c7086',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'left',
    paddingBottom: 8,
    borderBottom: '1px solid #313244',
  },
  row: {
    borderBottom: '1px solid #1e1e2e',
  },
  td: {
    color: '#cdd6f4',
    fontSize: 14,
    padding: '10px 0',
  },
  hint: {
    color: '#6c7086',
    fontSize: 14,
    margin: 0,
  },
};
