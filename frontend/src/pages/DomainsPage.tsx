import { useState } from 'react';
import { CreateDomainModal } from '../components/CreateDomainModal';
import { DomainCard } from '../components/DomainCard';
import { useCreateDomain, useDeleteDomain, useDomains } from '../hooks/useDomains';

export function DomainsPage() {
  const { data: domains, isLoading, error } = useDomains();
  const createMutation = useCreateDomain();
  const deleteMutation = useDeleteDomain();
  const [showModal, setShowModal] = useState(false);

  if (isLoading) return <div style={styles.center}>Loading domains...</div>;
  if (error) return <div style={styles.center}>Error: {(error as Error).message}</div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Domains</h1>
        <button style={styles.newBtn} onClick={() => setShowModal(true)}>
          + New Domain
        </button>
      </div>

      {domains && domains.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyTitle}>No domains yet</p>
          <p style={styles.emptyHint}>
            Create a domain to get started. Each domain holds a separate RAG index.
          </p>
          <button style={styles.newBtn} onClick={() => setShowModal(true)}>
            + New Domain
          </button>
        </div>
      ) : (
        <div style={styles.grid}>
          {domains?.map((domain) => (
            <DomainCard
              key={domain.name}
              domain={domain}
              onDelete={(name) => deleteMutation.mutate(name)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {showModal && (
        <CreateDomainModal
          onClose={() => setShowModal(false)}
          onCreate={async (name, description) => {
            await createMutation.mutateAsync({ name, description });
          }}
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '32px 24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    color: '#cdd6f4',
    fontSize: 28,
    margin: 0,
    fontWeight: 700,
  },
  newBtn: {
    background: '#cba6f7',
    border: 'none',
    borderRadius: 10,
    color: '#1e1e2e',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
    padding: '10px 20px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  empty: {
    textAlign: 'center',
    padding: '80px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: '#cdd6f4',
    fontSize: 22,
    margin: 0,
    fontWeight: 600,
  },
  emptyHint: {
    color: '#6c7086',
    fontSize: 14,
    margin: 0,
    maxWidth: 360,
  },
  center: {
    textAlign: 'center',
    padding: 64,
    color: '#6c7086',
  },
};
