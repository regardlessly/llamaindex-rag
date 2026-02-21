import { useState } from 'react';
import type { SourceChunk } from '../types';

interface Props {
  chunk: SourceChunk;
  index: number;
}

const PREVIEW_LENGTH = 200;

export function SourceChunkCard({ chunk, index }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isLong = chunk.text.length > PREVIEW_LENGTH;
  const displayed = expanded || !isLong ? chunk.text : chunk.text.slice(0, PREVIEW_LENGTH) + '…';

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.index}>{index + 1}</span>
        <span style={styles.filename}>{chunk.filename}</span>
        {chunk.page_label && (
          <span style={styles.badge}>p. {chunk.page_label}</span>
        )}
        {chunk.score != null && (
          <span style={styles.score}>{(chunk.score * 100).toFixed(0)}%</span>
        )}
      </div>
      <p style={styles.text}>{displayed}</p>
      {isLong && (
        <button style={styles.toggle} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#181825',
    border: '1px solid #313244',
    borderRadius: 8,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  index: {
    background: '#45475a',
    color: '#cdd6f4',
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: 11,
    fontWeight: 700,
  },
  filename: {
    color: '#89b4fa',
    fontSize: 13,
    fontWeight: 500,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badge: {
    background: '#313244',
    color: '#bac2de',
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: 11,
  },
  score: {
    background: '#a6e3a1',
    color: '#1e1e2e',
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: 11,
    fontWeight: 700,
  },
  text: {
    color: '#a6adc8',
    fontSize: 13,
    lineHeight: 1.55,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  toggle: {
    background: 'none',
    border: 'none',
    color: '#cba6f7',
    cursor: 'pointer',
    fontSize: 12,
    padding: 0,
    alignSelf: 'flex-start',
  },
};
