import { useState, useRef, useEffect, useCallback } from 'react';
import { aiAction, getAiMessages } from '../services/writerApi.js';

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

// ── Karta wariantu ────────────────────────────────────────────────────────────
function VariantCard({ variant, onInsert, onReplace, onNote }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(variant.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
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

// ── Słownik zwijany — max 8 na starcie ───────────────────────────────────────
function DictionaryMaterial({ items, onAddToScene }) {
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);
  if (!items?.length) return null;
  const visible = showAll ? items : items.slice(0, 8);
  return (
    <div className="ai-dict-section">
      <div className="ai-dict-section-title">
        <span className="ai-dict-icon">Λ</span>
        Materiał słownikowy ({items.length} haseł)
      </div>
      <div className="ai-dict-tags">
        {visible.map((item, i) => (
          <button
            key={item.headword + i}
            className={`ai-dict-hw-btn${open === i ? ' open' : ''}`}
            onClick={() => setOpen(open === i ? null : i)}
          >
            {item.headword}
          </button>
        ))}
        {!showAll && items.length > 8 && (
          <button className="ai-dict-hw-btn ai-dict-more-btn" onClick={() => setShowAll(true)}>
            +{items.length - 8} więcej
          </button>
        )}
      </div>
      {open !== null && visible[open] && (
        <div className="ai-dict-detail">
          <div className="ai-dict-detail-head">
            <span className="ai-dict-detail-hw">{visible[open].headword}</span>
            <span className="ai-dict-detail-src">{visible[open].source}</span>
            {onAddToScene && (
              <button className="btn-ai-sm" onClick={() => onAddToScene(visible[open].headword)}>
                + Do sceny
              </button>
            )}
          </div>
          {visible[open].meaning && (
            <div className="ai-dict-detail-meaning">{visible[open].meaning}</div>
          )}
          {visible[open].suggested_use && (
            <div className="ai-dict-detail-use">
              <span className="ai-dict-use-label">Zastosowanie:</span> {visible[open].suggested_use}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Słowa pokrewne ────────────────────────────────────────────────────────────
function RelatedWords({ items }) {
  if (!items?.length) return null;
  return (
    <div className="ai-related-section">
      <div className="ai-related-title">Słowa pokrewne</div>
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

// ── Bańka wiadomości ──────────────────────────────────────────────────────────
function MessageBubble({ msg, onInsert, onReplace, onNote, onAddToScene }) {
  const modeName = MODES.find(m => m.key === msg.mode)?.label || msg.mode || '';
  const { structured, lindeTerms } = msg;

  // Zbierz wszystkie hasła słownikowe (z Linde backend + z AI)
  const allDictItems = [
    ...(lindeTerms || []),
    ...((structured?.dictionary_material || []).filter(
      ai => !(lindeTerms || []).some(l => l.headword === ai.headword)
    )),
  ];

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

      {/* Fragment wejściowy */}
      {(msg.inputText || msg.selectedText) && (
        <div className="ai-input-fragment">
          <span className="ai-input-fragment-label">Redagowany fragment:</span>
          <span className="ai-input-fragment-text">
            „{(msg.selectedText || msg.inputText).slice(0, 120)}
            {(msg.selectedText || msg.inputText).length > 120 ? '…' : ''}"
          </span>
        </div>
      )}

      {/* A. WARIANTY — GŁÓWNY WYNIK */}
      {structured?.variants?.length > 0 && (
        <div className="ai-variants-section">
          <div className="ai-variants-section-title">Warianty tekstu</div>
          {structured.variants.map((v, i) => (
            <VariantCard
              key={i}
              variant={v}
              onInsert={onInsert}
              onReplace={onReplace}
              onNote={onNote}
            />
          ))}
        </div>
      )}

      {/* B. Uwaga redaktorska */}
      {structured?.editor_note && (
        <div className="ai-editor-note">
          <span className="ai-editor-note-icon">✒</span>
          {structured.editor_note}
        </div>
      )}

      {/* C. Słowa pokrewne */}
      <RelatedWords items={structured?.related_words} />

      {/* D. Słownik — zwijany, materiał pomocniczy */}
      {allDictItems.length > 0 && (
        <DictionaryMaterial items={allDictItems} onAddToScene={onAddToScene} />
      )}
    </div>
  );
}

// ── Brak zaznaczenia — prompt wyboru ─────────────────────────────────────────
function NoSelectionPrompt({ chapterText, onUseChapter, onUseParagraph }) {
  return (
    <div className="ai-no-selection-prompt">
      <div className="ai-no-selection-icon">⌖</div>
      <div className="ai-no-selection-msg">
        Zaznacz fragment tekstu w edytorze, albo wybierz zakres:
      </div>
      <div className="ai-no-selection-btns">
        <button className="btn-ai-choice" onClick={onUseParagraph} disabled={!chapterText}>
          Użyj aktualnego akapitu
        </button>
        <button className="btn-ai-choice" onClick={onUseChapter} disabled={!chapterText}>
          Użyj całego rozdziału
        </button>
      </div>
    </div>
  );
}

// ── Główny panel ──────────────────────────────────────────────────────────────
export default function WriterAIPanel({
  selectedText,    // zamrożone zaznaczenie z edytora
  liveSelection,   // bieżące (może być puste gdy kursor w AI panelu)
  chapterText,
  projectId,
  chapterId,
  onInsert,
  onReplace,
  onNote,
}) {
  const [mode, setMode] = useState('improve_style');
  const [prompt, setPrompt] = useState('');
  const [sceneWords, setSceneWords] = useState([]);
  const [wordInput, setWordInput] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [textOverride, setTextOverride] = useState(null); // gdy brak zaznaczenia, user wybrał akapit/rozdział
  const imageRef = useRef();
  const historyRef = useRef();
  const prevChapterId = useRef(chapterId);

  // ── Ładuj historię z DB przy zmianie rozdziału ─────────────────────────────
  useEffect(() => {
    if (!chapterId) return;
    if (chapterId !== prevChapterId.current) {
      setMessages([]);
      setTextOverride(null);
      prevChapterId.current = chapterId;
      setHistoryLoaded(false);
    }

    getAiMessages(chapterId)
      .then(rows => {
        if (!rows.length) { setHistoryLoaded(true); return; }
        const restored = rows.map(m => {
          // output_json to JSONB z backendu — może być obiektem lub stringiem
          let structured = {};
          if (m.output_json && typeof m.output_json === 'object') {
            structured = m.output_json;
          } else if (m.output_json && typeof m.output_json === 'string') {
            try { structured = JSON.parse(m.output_json); } catch {}
          }

          // Linde terms zapisane jako [{headword, source, meaning}] lub ["headword"]
          let lindeTerms = [];
          try {
            const raw = JSON.parse(m.linde_terms_json || '[]');
            lindeTerms = raw.map(t => typeof t === 'string' ? { headword: t } : t);
          } catch {}

          return {
            id: m.id,
            mode: m.mode,
            prompt: m.prompt || '',
            inputText: m.input_text || '',
            selectedText: m.selected_text || '',
            structured,
            lindeTerms,
            ts: new Date(m.created_at).getTime(),
            fromHistory: true,
          };
        });
        setMessages(restored);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, [chapterId]);

  // Scroll do dołu gdy pojawi się nowa wiadomość
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages]);

  function handleAddToScene(word) {
    const w = word.toLowerCase();
    if (!sceneWords.includes(w)) setSceneWords(prev => [...prev, w]);
  }

  // Aktualny tekst do redakcji
  const effectiveText = textOverride ?? selectedText ?? '';

  async function submitWithText(text) {
    if (!text?.trim() && !image && !prompt.trim()) return;
    setLoading(true);
    setError('');

    // Historia — ostatnie 3 wiadomości jako pary user/assistant
    const history = messages.slice(-3).flatMap(msg => {
      const variantsSummary = (msg.structured?.variants || [])
        .slice(0, 2)
        .map(v => `${v.label}: ${v.text.slice(0, 200)}`)
        .join('\n');
      return [
        { role: 'user', content: msg.prompt || `[tryb: ${msg.mode}]` },
        { role: 'assistant', content: variantsSummary || msg.inputText || '' },
      ];
    });

    try {
      const payload = {
        mode,
        prompt: prompt.trim() || undefined,
        selected_text: text?.trim() || undefined,
        chapter_context: !text?.trim() ? chapterText?.slice(0, 3000) : undefined,
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
        inputText: text?.trim() || '',
        selectedText: selectedText || '',
        structured: r.structured || {},
        lindeTerms: r.lindeTerms || [],
        ts: Date.now(),
      }]);
      setPrompt('');
      setTextOverride(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await submitWithText(effectiveText);
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

  // Pierwszy akapit z chapterText
  function getFirstParagraph() {
    return (chapterText || '').split(/\n\s*\n/)[0]?.trim().slice(0, 800) || chapterText?.slice(0, 800) || '';
  }

  const hasText = effectiveText.trim() || image;
  const showNoSelection = !hasText && !image && messages.length === 0 && historyLoaded;

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

      {/* Zaznaczony fragment */}
      <div className="ai-context-bar">
        {selectedText ? (
          <>
            <span className="ai-context-label">Zaznaczono:</span>
            <span className="ai-context-text">
              „{selectedText.slice(0, 100)}{selectedText.length > 100 ? '…' : ''}"
            </span>
          </>
        ) : textOverride ? (
          <>
            <span className="ai-context-label">Fragment:</span>
            <span className="ai-context-text">
              „{textOverride.slice(0, 100)}{textOverride.length > 100 ? '…' : ''}"
            </span>
            <button className="ai-context-clear" onClick={() => setTextOverride(null)}>✕</button>
          </>
        ) : (
          <span className="ai-context-none">Brak zaznaczenia.</span>
        )}
      </div>

      {/* Gdy brak tekstu i brak historii — prompt wyboru */}
      {showNoSelection && (
        <NoSelectionPrompt
          chapterText={chapterText}
          onUseParagraph={() => setTextOverride(getFirstParagraph())}
          onUseChapter={() => setTextOverride(chapterText?.slice(0, 3000) || '')}
        />
      )}

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
          placeholder={messages.length > 0 ? 'Kontynuuj — np. "zrób mniej patetycznie" albo "jak Sienkiewicz"…' : 'Opcjonalna instrukcja dla Homer AI…'}
          rows={3}
        />
        <div className="ai-prompt-row">
          <label className="ai-img-btn" title="Wgraj obraz">
            {image ? '📷' : '🖼'}
            <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
          </label>
          {image && (
            <div className="ai-img-preview-small">
              <img src={image.previewUrl} alt="" />
              <button type="button" onClick={removeImage}>✕</button>
            </div>
          )}
          <button
            type="submit"
            className="btn-homer-send"
            disabled={loading || (!hasText && !prompt.trim() && !image)}
          >
            {loading ? 'Pisze…' : (messages.length > 0 ? 'Kontynuuj →' : 'Wyślij →')}
          </button>
        </div>
      </form>

      {error && <div className="ai-error-bar">{error}</div>}
      {loading && (
        <div className="ai-loading-bar">
          <span className="ai-loading-dot" />
          Homer AI przeszukuje słownik i redaguje warianty…
        </div>
      )}

      {/* Historia odpowiedzi */}
      <div className="ai-history" ref={historyRef}>
        {historyLoaded && messages.length === 0 && !loading && !showNoSelection && (
          <div className="ai-history-empty">
            <div className="ai-history-empty-icon">Η</div>
            <div>Wybierz tryb i wyślij fragment do redakcji.</div>
            <div className="ai-history-empty-sub">
              Zaznacz tekst w edytorze, aby AI wiedziało co poprawić.
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
