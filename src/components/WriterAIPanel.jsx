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

// ── Sekcja A: materiał słownikowy ─────────────────────────────────────────────
function DictionaryMaterial({ items, onAddToScene }) {
  const [open, setOpen] = useState(null);
  if (!items?.length) return null;
  return (
    <div className="ai-dict-section">
      <div className="ai-dict-section-title">
        <span className="ai-dict-icon">Λ</span>
        Materiał ze słowników ({items.length} haseł)
      </div>
      <div className="ai-dict-tags">
        {items.map((item, i) => (
          <button
            key={item.headword + i}
            className={`ai-dict-hw-btn${open === i ? ' open' : ''}`}
            onClick={() => setOpen(open === i ? null : i)}
          >
            {item.headword}
          </button>
        ))}
      </div>
      {open !== null && items[open] && (
        <div className="ai-dict-detail">
          <div className="ai-dict-detail-head">
            <span className="ai-dict-detail-hw">{items[open].headword}</span>
            <span className="ai-dict-detail-src">{items[open].source}</span>
            {onAddToScene && (
              <button className="btn-ai-sm" onClick={() => onAddToScene(items[open].headword)}>
                + Do sceny
              </button>
            )}
          </div>
          {items[open].meaning && (
            <div className="ai-dict-detail-meaning">{items[open].meaning}</div>
          )}
          {items[open].suggested_use && (
            <div className="ai-dict-detail-use">
              <span className="ai-dict-use-label">Zastosowanie:</span> {items[open].suggested_use}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sekcja B: słowa pokrewne ──────────────────────────────────────────────────
function RelatedWords({ items }) {
  if (!items?.length) return null;
  return (
    <div className="ai-related-section">
      <div className="ai-related-title">Słowa pokrewne i bliskoznaczne</div>
      {items.map((group, i) => (
        <div key={i} className="ai-related-group">
          <span className="ai-related-base">{group.base}:</span>
          {(group.words || []).map(w => (
            <span key={w} className="ai-related-word">{w}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Karta wariantu ────────────────────────────────────────────────────────────
function VariantCard({ variant, onInsert, onReplace, onNote }) {
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
        <button className="btn-ai-action copy" onClick={copy}>{copied ? '✓ Skopiowano' : 'Kopiuj'}</button>
      </div>
    </div>
  );
}

// ── Bańka wiadomości ──────────────────────────────────────────────────────────
function MessageBubble({ msg, onInsert, onReplace, onNote, onAddToScene }) {
  const modeName = MODES.find(m => m.key === msg.mode)?.label || msg.mode || '';
  const { structured, lindeTerms } = msg;

  return (
    <div className="ai-msg-bubble">
      {/* Nagłówek */}
      <div className="ai-msg-bubble-meta">
        <span className="ai-msg-bubble-mode">{modeName}</span>
        {msg.prompt && (
          <span className="ai-msg-bubble-prompt">
            „{msg.prompt.slice(0, 80)}{msg.prompt.length > 80 ? '…' : ''}"
          </span>
        )}
        <span className="ai-msg-bubble-time">
          {new Date(msg.ts).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* A. Materiał słownikowy — z Lindego przez backend */}
      {lindeTerms?.length > 0 && (
        <DictionaryMaterial
          items={lindeTerms}
          onAddToScene={onAddToScene}
        />
      )}

      {/* A2. Materiał słownikowy — wybrany przez AI */}
      {structured?.dictionary_material?.length > 0 && (
        <DictionaryMaterial
          items={structured.dictionary_material}
          onAddToScene={onAddToScene}
        />
      )}

      {/* B. Słowa pokrewne */}
      <RelatedWords items={structured?.related_words} />

      {/* C. Warianty */}
      <div className="ai-variants-section">
        {(structured?.variants || []).map((v, i) => (
          <VariantCard
            key={i}
            variant={v}
            onInsert={onInsert}
            onReplace={onReplace}
            onNote={onNote}
          />
        ))}
      </div>

      {/* D. Uwaga redaktorska */}
      {structured?.editor_note && (
        <div className="ai-editor-note">
          <span className="ai-editor-note-icon">✒</span>
          {structured.editor_note}
        </div>
      )}
    </div>
  );
}

// ── Główny panel ──────────────────────────────────────────────────────────────
export default function WriterAIPanel({
  selectedText, chapterText, projectId, chapterId, onInsert, onReplace, onNote,
}) {
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

  useEffect(() => {
    if (chapterId !== prevChapterId.current) {
      setMessages([]);
      prevChapterId.current = chapterId;
    }
  }, [chapterId]);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages]);

  function handleAddToScene(word) {
    const w = word.toLowerCase();
    if (!sceneWords.includes(w)) setSceneWords(prev => [...prev, w]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const text = selectedText?.trim() || chapterText?.trim();
    if (!text && !image && !prompt.trim()) {
      setError('Zaznacz fragment tekstu, wpisz prompt lub wgraj obraz.');
      return;
    }
    setLoading(true);
    setError('');

    const history = messages.slice(-3).flatMap(msg => [
      { role: 'user', content: msg.prompt || '' },
      { role: 'assistant', content: (msg.structured?.variants || []).map(v => `${v.label}: ${v.text}`).join('\n\n') },
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

      setMessages(prev => [...prev, {
        id: Date.now(),
        mode,
        prompt: prompt.trim(),
        structured: r.structured || {},
        lindeTerms: r.lindeTerms || [],
        ts: Date.now(),
      }]);
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
      handleAddToScene(wordInput.trim());
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
            <span className="ai-context-text">„{selectedText.slice(0, 110)}{selectedText.length > 110 ? '…' : ''}"</span>
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

      {/* Formularz promptu */}
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
          <span className="ai-loading-dot" />
          Homer AI analizuje słownik i pisze warianty…
        </div>
      )}

      {/* Historia */}
      <div className="ai-history" ref={historyRef}>
        {messages.length === 0 && !loading && (
          <div className="ai-history-empty">
            <div className="ai-history-empty-icon">Η</div>
            <div>Wybierz tryb, zaznacz tekst i wyślij.</div>
            <div className="ai-history-empty-sub">
              AI najpierw przeszuka słownik Lindego, a potem zaproponuje warianty literackie.
            </div>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onInsert={onInsert}
            onReplace={onReplace}
            onNote={onNote}
            onAddToScene={handleAddToScene}
          />
        ))}
      </div>
    </div>
  );
}
