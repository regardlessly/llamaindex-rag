import { Link } from 'react-router-dom';

export function Navbar() {
  return (
    <nav style={styles.nav}>
      <Link to="/" style={styles.brand}>
        RAG Domains
      </Link>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    background: '#1e1e2e',
    padding: '0 24px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #313244',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    color: '#cba6f7',
    fontSize: 20,
    fontWeight: 700,
    textDecoration: 'none',
    letterSpacing: '-0.3px',
  },
};
