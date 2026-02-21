import { useState } from 'react';

interface Props {
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
  isLoading: boolean;
}

export function CreateDomainModal({ onClose, onCreate, isLoading }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name)) {
      setError('Name must be lowercase letters, numbers, or hyphens (no leading/trailing hyphens)');
      return;
    }
    try {
      await onCreate(name.trim(), description.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create domain');
    }
  };

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <h2 style={styles.title}>New Domain</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Name
            <input
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase())}
              placeholder="e.g. legal, finance, research"
              required
              autoFocus
            />
          </label>
          <label style={styles.label}>
            Description (optional)
            <input
              style={styles.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of this domain"
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <div style={styles.buttons}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" disabled={isLoading} style={styles.createBtn}>
              {isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 16,
    padding: 32,
    width: 440,
    maxWidth: '90vw',
  },
  title: {
    color: '#cdd6f4',
    margin: '0 0 24px',
    fontSize: 22,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  label: {
    color: '#a6adc8',
    fontSize: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  input: {
    background: '#313244',
    border: '1px solid #45475a',
    borderRadius: 8,
    color: '#cdd6f4',
    fontSize: 15,
    padding: '10px 12px',
    outline: 'none',
  },
  error: {
    color: '#f38ba8',
    fontSize: 13,
    margin: 0,
  },
  buttons: {
    display: 'flex',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 8,
    border: '1px solid #45475a',
    background: 'none',
    color: '#cdd6f4',
    cursor: 'pointer',
    fontSize: 15,
  },
  createBtn: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 8,
    border: 'none',
    background: '#cba6f7',
    color: '#1e1e2e',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
  },
};
