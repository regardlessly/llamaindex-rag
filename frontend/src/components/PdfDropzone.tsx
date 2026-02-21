import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { UploadResponse } from '../types';

interface Props {
  domain: string;
  onUpload: (files: File[]) => Promise<UploadResponse>;
}

export function PdfDropzone({ domain, onUpload }: Props) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState('');

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      setUploading(true);
      setResult(null);
      setError('');
      try {
        const res = await onUpload(accepted);
        setResult(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [onUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    disabled: uploading,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        style={{
          ...styles.zone,
          ...(isDragActive ? styles.zoneActive : {}),
          ...(uploading ? styles.zoneDisabled : {}),
        }}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <p style={styles.hint}>Uploading and ingesting PDFs...</p>
        ) : isDragActive ? (
          <p style={styles.hint}>Drop PDFs here</p>
        ) : (
          <>
            <p style={styles.icon}>📄</p>
            <p style={styles.hint}>Drag &amp; drop PDFs here, or click to select</p>
            <p style={styles.sub}>Only .pdf files are accepted</p>
          </>
        )}
      </div>
      {result && (
        <div style={styles.success}>
          Uploaded {result.uploaded} file{result.uploaded !== 1 ? 's' : ''} →{' '}
          {result.ingested} chunk{result.ingested !== 1 ? 's' : ''} ingested into{' '}
          <strong>{domain}</strong>
        </div>
      )}
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  zone: {
    border: '2px dashed #45475a',
    borderRadius: 12,
    padding: '40px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
    background: '#181825',
  },
  zoneActive: {
    borderColor: '#cba6f7',
    background: '#1e1e2e',
  },
  zoneDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  icon: {
    fontSize: 40,
    margin: '0 0 8px',
  },
  hint: {
    color: '#bac2de',
    margin: 0,
    fontSize: 15,
  },
  sub: {
    color: '#6c7086',
    margin: '4px 0 0',
    fontSize: 13,
  },
  success: {
    marginTop: 12,
    padding: '10px 16px',
    background: '#a6e3a1',
    color: '#1e1e2e',
    borderRadius: 8,
    fontSize: 14,
  },
  error: {
    marginTop: 12,
    padding: '10px 16px',
    background: '#f38ba8',
    color: '#1e1e2e',
    borderRadius: 8,
    fontSize: 14,
  },
};
