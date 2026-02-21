import { Link, useParams } from 'react-router-dom';
import { ChatInterface } from '../components/ChatInterface';

export function QueryPage() {
  const { name } = useParams<{ name: string }>();
  const domain = name!;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.breadcrumb}>
          <Link to="/" style={styles.crumbLink}>Domains</Link>
          <span style={styles.crumbSep}>/</span>
          <Link to={`/domains/${domain}`} style={styles.crumbLink}>{domain}</Link>
          <span style={styles.crumbSep}>/</span>
          <span style={styles.crumbCurrent}>Query</span>
        </div>
        <Link to={`/domains/${domain}`} style={styles.backBtn}>
          Manage Domain
        </Link>
      </div>
      <div style={styles.chatContainer}>
        <ChatInterface initialDomains={[domain]} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 860,
    margin: '0 auto',
    padding: '24px 24px',
    height: 'calc(100vh - 56px)',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexShrink: 0,
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
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
  backBtn: {
    background: 'none',
    border: '1px solid #45475a',
    borderRadius: 8,
    color: '#bac2de',
    fontSize: 13,
    padding: '7px 14px',
    textDecoration: 'none',
  },
  chatContainer: {
    flex: 1,
    background: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 14,
    padding: '16px 20px 20px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
};
