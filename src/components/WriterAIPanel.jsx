import { useState, useRef, useEffect } from 'react';
import { aiAction, getAiMessages } from '../services/writerApi.js';

const MODES = [
  { key: 'improve_style',    label: 'Popraw styl',       icon: '✦' },
  { key: 'archaic_tone',     label: 'Archaiczne',         icon: '⸸' },
  { key: 'ornate',           label: 'Ozdobne',            icon: '❧' },
  { key: 'epic_tone',        label: 'Ton epicki',         icon: '⚔' },
  { key: 'expand_scene',     label: 'Rozwiń scenę',       icon: '⟳' },
  { key: 'propose_dialogue', label: 'Dialog',             icon: '❝' },
  { key: 'propose_variants', label: 'Warianty zdania',    icon: '≡' },
  { key: 'linde_words',      label: 'Słowa Lindego',      icon: 'Λ' },
];

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function MessageCard({ msg, onInsert, onReplace, onNote }) {
  const structured = msg.structured;
  const [copiedIdx, setCopiedIdx] = useState(null);

  function copy(text, idx) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  const variants = structured?.variants || [{ label: 'Odpowiedź', text: msg.raw }];
  const lindeWords = structured?.linde_inspirations || msg.linde_words || [];
  const editorNote = structured?.editor_note || '';
  const modeName = MODES.find(m => m.key === msg.mode)?.label || msg.mode || '';

  return (
    <div className="ai-msg-card">
      <div className="ai-msg-header">
        <span className="ai-msg-mode">{modeName}</span>
        {msg.created_at && (
          <span className="ai-msg-time">
            {new Date(msg.created_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {msg.prompt && (
        <div className="ai-msg-prompt">„{msg.prompt.slice(0, 120)}{msg.prompt.length > 120 ? '…' : ''}"</div>
      )}

      {lindeWords.length > 0 && (
        <div className="ai-msg-linde-words">
          <span className="ai-msg-linde-label">Linde:</span>
          {lindeWords.slice(0, 8).map(w => (
            <span key={w} className="ai-msg-linde-tag">{w}</span>
          ))}
        </div>
      )}

      {variants.map((v, idx) => (
        <div key={idx} className="ai-variant">
          <div className="ai-variant-label">{v.label}</div>
          <div className="ai-variant-text">{v.text}</div>
          <div className="ai-variant-actions">
            <button className="btn-ghost-sm" onClick={() => onInsert?.(v.text)}>Wstaw</button>
            <button className="btn-ghost-sm" onClick={() => onReplace?.(v.text)}>Zastąp</button>
            <button className="btn-ghost-sm" onClick={() => onNote?.(v.text)}>Notatka</button>
            <button className="btn-ghost-sm" onClick={() => copy(v.text, idx)}>
              {copiedIdx === idx ? '✓' : 'Kopiuj'}
            </button>
          </div>
        </div>
      ))}

      {editorNote && (
        <div className="ai-editor-note">📝 {editorNote}</div>
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
  const [messages, setMessages] = useState([]); // historia
  const imageRef = useRef();
  const historyRef = useRef();

  // Załaduj historię przy otwarciu rozdziału
  useEffect(() => {
    if (!chapterId) return;
    getAiMessages(chapterId).then(rows => {
      const parsed = rows.map(row => {
        let structured = null;
        try { structured = JSON.parse(row.output_text); } catch {}
        return {
          id: row.id,
          mode: row.mode,
          prompt: row.prompt,
          linde_words: JSON.parse(row.linde_terms_json || '[]'),
          structured,
          raw: row.output_text,
          created_at: row.created_at,
        };
      });
      setMessages(parsed.reverse()); // najstarsze pierwsze
    }).catch(() => {});
  }, [chapterId]);

  // Scroll do końca po nowej odpowiedzi
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = selectedText || chapterText;
    if (!text?.trim() && !image && !prompt.trim()) {
      setError('Zaznacz fragment, wpisz prompt lub wgraj obraz.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        mode,
        prompt: prompt || undefined,
        selected_text: selectedText || undefined,
        chapter_context: selectedText ? undefined : (chapterText || undefined),
        scene_words: sceneWords,
        use_linde: true,
        project_id: projectId,
        chapter_id: chapterId,
      };
      if (image) {
        payload.image_base64 = image.base64;
        payload.image_media_type = image.type;
      }
      const r = await aiAction(payload);

      let structured = r.structured;
      if (!structured) {
        try { structured = JSON.parse(r.result); } catch { structured = null; }
      }
      if (!structured) {
        structured = { variants: [{ label: 'Odpowiedź', text: r.result }], linde_inspirations: [], editor_note: '' };
      }

      const newMsg = {
        id: Date.now(),
        mode,
        prompt,
        linde_words: (r.lindeTerms || []).map(t => t.headword),
        structured,
        raw: r.result,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newMsg]);
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

  function removeSceneWord(w) {
    setSceneWords(prev => prev.filter(x => x !== w));
  }

  return (
    <div className="homer-ai-full">
      {/* Nagłówek */}
      <div className="homer-ai-full-header">
        <div className="homer-ai-logo">
          <span className="homer-ai-symbol">Η</span>
          <div>
            <div className="homer-ai-name">Homer AI</div>
            <div className="homer-ai-sub">Laboratorium stylu</div>
          </div>
        </div>
      </div>

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
      {selectedText ? (
        <div className="ai-selection-preview">
          <span className="ai-selection-label">Zaznaczono:</span>
          <span className="ai-selection-text">{selectedText.slice(0, 140)}{selectedText.length > 140 ? '…' : ''}</span>
        </div>
      ) : (
        <div className="ai-no-selection">Brak zaznaczenia — AI użyje całego rozdziału.</div>
      )}

      {/* Słowa do sceny */}
      <div className="ai-scene-words-section">
        <div className="ai-scene-words-label">Słowa do sceny</div>
        <div className="ai-scene-words-tags">
          {sceneWords.map(w => (
            <span key={w} className="ai-scene-tag">
              {w}
              <button onClick={() => removeSceneWord(w)}>✕</button>
            </span>
          ))}
          <input
            className="ai-scene-input"
            value={wordInput}
            onChange={e => setWordInput(e.target.value)}
            onKeyDown={addSceneWord}
            placeholder="wpisz słowo + Enter…"
          />
        </div>
      </div>

      {/* Prompt i submit */}
      <form className="ai-prompt-form" onSubmit={handleSubmit}>
        <textarea
          className="ai-prompt-textarea"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Opcjonalny prompt — dodatkowa instrukcja dla Homer AI…"
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
          <button type="submit" className="btn-primary" disabled={loading} style={{ marginLeft: 'auto' }}>
            {loading ? 'Pisze…' : 'Wyślij →'}
          </button>
        </div>
      </form>

      {error && <div className="ai-error" style={{ margin: '0 12px 8px' }}>{error}</div>}

      {loading && (
        <div className="homer-loading" style={{ margin: '0 12px 8px' }}>
          <span className="homer-loading-dot" /> Homer AI pracuje…
        </div>
      )}

      {/* Historia odpowiedzi */}
      <div className="ai-history" ref={historyRef}>
        {messages.length === 0 && !loading && (
          <div className="ai-history-empty">Wyniki pojawią się tutaj. Historia nie znika po zmianie promptu.</div>
        )}
        {messages.map(msg => (
          <MessageCard
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
