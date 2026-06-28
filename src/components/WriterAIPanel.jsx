import { useState, useRef, useEffect } from 'react';
import { aiAction } from '../services/writerApi.js';

const MODES = [
  { key: 'improve_style',    label: 'Popraw styl',    icon: '✦' },
  { key: 'archaic_tone',     label: 'Archaiczne',      icon: '⸸' },
  { key: 'ornate',           label: 'Ozdobne',         icon: '❧' },
  { key: 'epic_tone',        label: 'Epicki',          icon: '⚔' },
  { key: 'expand_scene',     label: 'Rozwiń',          icon: '⟳' },
  { key: 'propose_dialogue', label: 'Dialog',          icon: '❝' },
  { key: 'propose_variants', label: 'Warianty',        icon: '≡' },
  { key: 'linde_words',      label: 'Linde',           icon: 'Λ' },
];

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function VariantCard({ variant, idx, onInsert, onReplace, onNote }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(variant.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="ai-variant-card">
      <div className="ai-variant-card-label">{variant.label}</div>
      <div className="ai-variant-card-text">{variant.text}</div>
      <div className="ai-variant-card-actions">
        <button className="btn-ai-action" onClick={() => onInsert?.(variant.text)}>Wstaw</button>
        <button className="btn-ai-action" onClick={() => onReplace?.(variant.text)}>Zastąp</button>
        <button className="btn-ai-action" onClick={() => onNote?.(variant.text)}>Notatka</button>
        <button className="btn-ai-action copy" onClick={copy}>{copied ? '✓' : 'Kopiuj'}</button>
      </div>
    </div>
  );
}

function LindeSection({ terms }) {
  const [expanded, setExpanded] = useState(null);
  if (!terms?.length) return null;
  return (
    <div className="ai-linde-section">
      <div className="ai-linde-section-title">Materiał ze Słownika Lindego ({terms.length} haseł)</div>
      <div className="ai-linde-tags">
        {terms.map((t, i) => (
          <button
            key={t.headword}
            className={`ai-linde-hw-btn${expanded === i ? ' open' : ''}`}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            {t.headword}
          </button>
        ))}
      </div>
      {expanded !== null && terms[expanded] && (
        <div className="ai-linde-body">
          <div className="ai-linde-body-hw">{terms[expanded].headword} <span className="ai-linde-body-src">({terms[expanded].source})</span></div>
          <div className="ai-linde-body-text">{terms[expanded].body}</div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, onInsert, onReplace, onNote }) {
  const modeName = MODES.find(m => m.key === msg.mode)?.label || msg.mode || '';
  return (
    <div className="ai-msg-bubble">
      <div className="ai-msg-bubble-meta">
        <span className="ai-msg-bubble-mode">{modeName}</span>
        {msg.prompt && <span className="ai-msg-bubble-prompt">„{msg.prompt.slice(0, 80)}{msg.prompt.length > 80 ? '…' : ''}"</span>}
        <span className="ai-msg-bubble-time">
          {new Date(msg.ts).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Linde materiał */}
      <LindeSection terms={msg.lindeTerms} />

      {/* Warianty w kartach */}
      {(msg.variants || []).map((v, i) => (
        <VariantCard key={i} variant={v} idx={i} onInsert={onInsert} onReplace={onReplace} onNote={onNote} />
      ))}

      {/* Notatka redaktora */}
      {msg.editorNote && (
        <div className="ai-editor-note">📝 {msg.editorNote}</div>
      )}

      {/* Słowa zainspirowane Linde */}
      {msg.lindeInspirations?.length > 0 && (
        <div className="ai-linde-inspirations">
          <span className="ai-linde-insp-label">Sugestie słownikowe:</span>
          {msg.lindeInspirations.map(w => <span key={w} className="ai-linde-insp-tag">{w}</span>)}
        </div>
      )}
    </div>
  );
}

export default function WriterAIPanel({ selectedText, chapterText, projectId, chapterId, onInsert, onReplace, onNote }) {
  const [mode, setMode] = useState('improve_style');
  const [prompt, setPrompt] = useState('');
  const [sceneWords, setSceneWords] = useState([]);
  const [wordInput, setWordInput] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const imageRef = useRef();
  const historyRef = useRef();
  const prevChapterId = useRef(chapterId);

  // Gdy zmienia się rozdział, wyczyść historię widoku (nie DB)
  useEffect(() => {
    if (chapterId !== prevChapterId.current) {
      setMessages([]);
      prevChapterId.current = chapterId;
    }
  }, [chapterId]);

  // Auto-scroll do ostatniej odpowiedzi
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = selectedText?.trim() || chapterText?.trim();
    if (!text && !image && !prompt.trim()) {
      setError('Zaznacz fragment tekstu, wpisz prompt lub wgraj obraz.');
      return;
    }
    setLoading(true);
    setError('');

    // Historia dla kontynuacji — ostatnie 3 wymiany
    const history = messages.slice(-3).flatMap(msg => [
      { role: 'user', content: msg.prompt || msg.inputText || '' },
      { role: 'assistant', content: (msg.variants || []).map(v => `${v.label}:\n${v.text}`).join('\n\n') },
    ]);

    try {
      const payload = {
        mode,
        prompt: prompt.trim() || undefined,
        selected_text: selectedText?.trim() || undefined,
        chapter_context: !selectedText?.trim() ? (chapterText?.slice(0, 3000) || undefined) : undefined,
        scene_words: sceneWords,
        use_linde: true,
        project_id: projectId,
        chapter_id: chapterId,
        history,
      };
      if (image) {
        payload.image_base64 = image.base64;
        payload.image_media_type = image.type;
      }

      const r = await aiAction(payload);

      const newMsg = {
        id: Date.now(),
        mode,
        prompt: prompt.trim(),
        inputText: selectedText?.trim() || '',
        variants: r.structured?.variants || [],
        lindeTerms: r.lindeTerms || [],
        lindeInspirations: r.structured?.linde_inspirations || [],
        editorNote: r.structured?.editor_note || '',
        ts: Date.now(),
      };
      setMessages(prev => [...prev, newMsg]);
      setPrompt('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await toBase64(file);
    setImage({ base64, type: file.type, previewUrl: URL.createObjectURL(file) });
  }

  function removeImage() {
    if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    if (imageRef.current) imageRef.current.value = '';
  }

  function addSceneWord(e) {
    if (e.key === 'Enter' && wordInput.trim()) {
      e.preventDefault();
      const w = wordInput.trim().toLowerCase();
      if (!sceneWords.includes(w)) setSceneWords(prev => [...prev, w]);
      setWordInput('');
    }
  }

  return (
    <div className="homer-ai-full">

      {/* Tryby */}
      <div className="ai-mode-grid">
        {MODES.map(m => (
          <button
            key={m.key}
            className={`ai-mode-btn${mode === m.key ? ' active' : ''}`}
            onClick={() => setMode(m.key)}
          >
            <span className="ai-mode-icon">{m.icon}</span>
            <span className="ai-mode-label">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Zaznaczony tekst */}
      <div className="ai-context-bar">
        {selectedText ? (
          <>
            <span className="ai-context-label">Zaznaczono:</span>
            <span className="ai-context-text">„{selectedText.slice(0, 120)}{selectedText.length > 120 ? '…' : ''}„</span>
          </>
        ) : (
          <span className="ai-context-none">Brak zaznaczenia — AI użyje treści rozdziału.</span>
        )}
      </div>

      {/* Słowa do sceny */}
      <div className="ai-scene-words-section">
        <span className="ai-scene-words-label">Słowa do sceny:</span>
        <div className="ai-scene-words-tags">
          {sceneWords.map(w => (
            <span key={w} className="ai-scene-tag">
              {w}
              <button onClick={() => setSceneWords(prev => prev.filter(x => x !== w))}>✕</button>
            </span>
          ))}
          <input
            className="ai-scene-input"
            value={wordInput}
            onChange={e => setWordInput(e.target.value)}
            onKeyDown={addSceneWord}
            placeholder="słowo + Enter"
          />
        </div>
      </div>

      {/* Prompt */}
      <form className="ai-prompt-form" onSubmit={handleSubmit}>
        <textarea
          className="ai-prompt-textarea"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={messages.length > 0 ? 'Kontynuuj rozmowę lub wpisz nowy prompt…' : 'Opcjonalna instrukcja dla Homer AI…'}
          rows={3}
        />
        <div className="ai-prompt-row">
          <label className="ai-img-btn">
            {image ? '📷 Zmień' : '🖼 Obraz'}
            <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
          </label>
          {image && (
            <div className="ai-img-preview-small">
              <img src={image.previewUrl} alt="" />
              <button type="button" onClick={removeImage}>✕</button>
            </div>
          )}
          <button type="submit" className="btn-homer-send" disabled={loading}>
            {loading ? 'Pisze…' : (messages.length > 0 ? 'Kontynuuj →' : 'Wyślij →')}
          </button>
        </div>
      </form>

      {error && <div className="ai-error-bar">{error}</div>}

      {loading && (
        <div className="ai-loading-bar">
          <span className="ai-loading-dot" /> Homer AI pracuje…
        </div>
      )}

      {/* Historia odpowiedzi */}
      <div className="ai-history" ref={historyRef}>
        {messages.length === 0 && !loading && (
          <div className="ai-history-empty">
            <div className="ai-history-empty-icon">Η</div>
            <div>Wybierz tryb, zaznacz tekst i wyślij — odpowiedzi będą tu widoczne.</div>
            <div className="ai-history-empty-sub">Historia nie znika po zmianie zakładki.</div>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onInsert={onInsert}
            onReplace={onReplace}
            onNote={onNote}
          />
        ))}
      </div>
    </div>
  );
}
