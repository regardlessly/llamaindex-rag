import { Link } from 'react-router-dom';
import type { Domain } from '../types';

interface Props {
  domain: Domain;
  onDelete: (name: string) => void;
  isDeleting: boolean;
}

export function DomainCard({ domain, onDelete, isDeleting }: Props) {
  const created = new Date(domain.created_at).toLocaleDateString();

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <Link to={`/domains/${domain.name}`} style={styles.name}>
          {domain.name}
        </Link>
        <button
          onClick={() => {
            if (confirm(`Delete domain "${domain.name}"? This cannot be undone.`)) {
              onDelete(domain.name);
            }
          }}
          disabled={isDeleting}
          style={styles.deleteBtn}
          title="Delete domain"
        >
          ✕
        </button>
      </div>
      {domain.description && (
        <p style={styles.description}>{domain.description}</p>
      )}
      <div style={styles.meta}>
        <span>{domain.doc_count} document{domain.doc_count !== 1 ? 's' : ''}</span>
        <span>{created}</span>
      </div>
      <div style={styles.actions}>
        <Link to={`/domains/${domain.name}`} style={styles.actionBtn}>
          Manage
        </Link>
        <Link to={`/domains/${domain.name}/query`} style={{ ...styles.actionBtn, ...styles.queryBtn }}>
          Query
        </Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    color: '#cba6f7',
    fontSize: 18,
    fontWeight: 600,
    textDecoration: 'none',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#6c7086',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 6px',
    borderRadius: 4,
  },
  description: {
    color: '#bac2de',
    fontSize: 14,
    margin: 0,
  },
  meta: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#6c7086',
    fontSize: 13,
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    textAlign: 'center',
    padding: '8px 0',
    borderRadius: 8,
    background: '#313244',
    color: '#cdd6f4',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
  },
  queryBtn: {
    background: '#cba6f7',
    color: '#1e1e2e',
  },
};
