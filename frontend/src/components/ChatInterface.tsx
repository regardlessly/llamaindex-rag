import { useCallback, useEffect, useRef, useState } from 'react';
import { queryStream } from '../api/client';
import { useDomains } from '../hooks/useDomains';
import type { ChatMessage, SourceChunk } from '../types';
import { SourceChunkCard } from './SourceChunkCard';

interface Props {
  /** Initial domain(s) pre-selected. If omitted, all domains shown unselected. */
  initialDomains?: string[];
}

let msgId = 0;
const nextId = () => String(++msgId);

export function ChatInterface({ initialDomains = [] }: Props) {
  const { data: allDomains = [] } = useDomains();
  const [selectedDomains, setSelectedDomains] = useState<string[]>(initialDomains);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync if initialDomains changes (e.g. navigating between domain pages)
  useEffect(() => {
    if (initialDomains.length > 0) {
      setSelectedDomains(initialDomains);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDomains.join(',')]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentAnswer]);

  const toggleDomain = (name: string) => {
    setSelectedDomains((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name],
    );
  };

  const submit = useCallback(async () => {
    const q = question.trim();
    if (!q || streaming || selectedDomains.length === 0) return;

    setQuestion('');
    setError('');
    setStreaming(true);
    setCurrentAnswer('');

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);

    let accumulated = '';
    let finalSources: SourceChunk[] = [];

    try {
      await queryStream(
        selectedDomains,
        q,
        (token) => {
          accumulated += token;
          setCurrentAnswer(accumulated);
        },
        (sources) => {
          finalSources = sources;
        },
        () => {
          const assistantMsg: ChatMessage = {
            id: nextId(),
            role: 'assistant',
            content: accumulated,
            sources: finalSources,
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setCurrentAnswer('');
          setStreaming(false);
        },
        (msg) => {
          setError(msg);
          setStreaming(false);
        },
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Query failed');
      setStreaming(false);
    }
  }, [selectedDomains, question, streaming]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const noDomainsSelected = selectedDomains.length === 0;

  return (
    <div style={styles.container}>
      {/* Domain selector */}
      <div style={styles.domainBar}>
        <span style={styles.domainLabel}>Domains:</span>
        <div style={styles.domainChips}>
          {allDomains.length === 0 && (
            <span style={styles.noDomains}>No domains yet</span>
          )}
          {allDomains.map((d) => {
            const active = selectedDomains.includes(d.name);
            return (
              <button
                key={d.name}
                style={{ ...styles.chip, ...(active ? styles.chipActive : {}) }}
                onClick={() => toggleDomain(d.name)}
                disabled={streaming}
                title={d.description || d.name}
              >
                {d.name}
                {active && <span style={styles.chipCheck}> ✓</span>}
              </button>
            );
          })}
        </div>
        {selectedDomains.length > 1 && (
          <span style={styles.multiHint}>{selectedDomains.length} domains</span>
        )}
      </div>

      {/* Message history */}
      <div style={styles.messages}>
        {messages.length === 0 && !streaming && (
          <p style={styles.empty}>
            {noDomainsSelected
              ? 'Select one or more domains above to start querying.'
              : selectedDomains.length === 1
              ? <span>Ask a question about documents in <strong>{selectedDomains[0]}</strong>.</span>
              : <span>Ask a question across <strong>{selectedDomains.join(', ')}</strong>.</span>}
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={msg.role === 'user' ? styles.userBubbleWrap : styles.aiBubbleWrap}>
            <div style={msg.role === 'user' ? styles.userBubble : styles.aiBubble}>
              {msg.content}
            </div>
            {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
              <div style={styles.sources}>
                <p style={styles.sourcesLabel}>Sources</p>
                {msg.sources.map((chunk, i) => (
                  <SourceChunkCard key={chunk.doc_id + i} chunk={chunk} index={i} />
                ))}
              </div>
            )}
          </div>
        ))}

        {streaming && currentAnswer && (
          <div style={styles.aiBubbleWrap}>
            <div style={{ ...styles.aiBubble, ...styles.streaming }}>
              {currentAnswer}
              <span style={styles.cursor}>▌</span>
            </div>
          </div>
        )}
        {streaming && !currentAnswer && (
          <div style={styles.aiBubbleWrap}>
            <div style={{ ...styles.aiBubble, color: '#6c7086' }}>Thinking…</div>
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}
        <div ref={scrollRef} />
      </div>

      {/* Input bar */}
      <div style={styles.inputBar}>
        <textarea
          style={styles.textarea}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKey}
          placeholder={
            noDomainsSelected
              ? 'Select a domain above first…'
              : 'Ask a question… (Enter to send, Shift+Enter for newline)'
          }
          rows={2}
          disabled={streaming || noDomainsSelected}
        />
        <div style={styles.controls}>
          <button
            style={styles.clearBtn}
            onClick={() => setMessages([])}
            disabled={streaming}
          >
            Clear
          </button>
          <button
            style={styles.sendBtn}
            onClick={submit}
            disabled={streaming || !question.trim() || noDomainsSelected}
          >
            {streaming ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  domainBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottom: '1px solid #313244',
    marginBottom: 4,
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  domainLabel: {
    color: '#6c7086',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap' as const,
  },
  domainChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
    flex: 1,
  },
  chip: {
    background: '#313244',
    border: '1px solid #45475a',
    borderRadius: 20,
    color: '#bac2de',
    cursor: 'pointer',
    fontSize: 13,
    padding: '4px 12px',
  },
  chipActive: {
    background: '#cba6f7',
    borderColor: '#cba6f7',
    color: '#1e1e2e',
    fontWeight: 600,
  },
  chipCheck: {
    fontSize: 11,
  },
  multiHint: {
    color: '#6c7086',
    fontSize: 12,
    whiteSpace: 'nowrap' as const,
  },
  noDomains: {
    color: '#6c7086',
    fontSize: 13,
    fontStyle: 'italic' as const,
  },
  messages: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px 0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  empty: {
    color: '#6c7086',
    fontSize: 14,
    textAlign: 'center' as const,
    margin: '40px 0',
  },
  userBubbleWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end' as const,
  },
  aiBubbleWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
  },
  userBubble: {
    background: '#cba6f7',
    color: '#1e1e2e',
    borderRadius: '14px 14px 4px 14px',
    padding: '10px 16px',
    maxWidth: '75%',
    fontSize: 15,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  aiBubble: {
    background: '#313244',
    color: '#cdd6f4',
    borderRadius: '14px 14px 14px 4px',
    padding: '10px 16px',
    maxWidth: '85%',
    fontSize: 15,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    lineHeight: 1.6,
  },
  streaming: {
    position: 'relative' as const,
  },
  cursor: {
    animation: 'blink 1s step-end infinite',
    color: '#cba6f7',
  },
  sources: {
    width: '100%',
    maxWidth: '85%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  sourcesLabel: {
    color: '#6c7086',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: 0,
  },
  error: {
    color: '#f38ba8',
    fontSize: 14,
    margin: 0,
    padding: '8px 12px',
    background: '#45475a',
    borderRadius: 8,
  },
  inputBar: {
    borderTop: '1px solid #313244',
    paddingTop: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  textarea: {
    background: '#313244',
    border: '1px solid #45475a',
    borderRadius: 10,
    color: '#cdd6f4',
    fontSize: 15,
    padding: '10px 14px',
    resize: 'none' as const,
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  controls: {
    display: 'flex',
    justifyContent: 'flex-end' as const,
    gap: 8,
  },
  clearBtn: {
    background: 'none',
    border: '1px solid #45475a',
    borderRadius: 8,
    color: '#6c7086',
    cursor: 'pointer',
    fontSize: 14,
    padding: '8px 16px',
  },
  sendBtn: {
    background: '#cba6f7',
    border: 'none',
    borderRadius: 8,
    color: '#1e1e2e',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    padding: '8px 20px',
  },
};
