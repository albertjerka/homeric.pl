import { useState } from 'react';
import { useSpeech } from '../hooks/useSpeech.js';

const TABS = ['Tłumaczenie PL', 'Oryginał', 'Zdanie po zdaniu', 'Słowniczek'];

export default function PageView({ pageText, analysis, loading, error, pageImages, onAddImage, onRemoveImage, language }) {
  const [activeTab, setActiveTab] = useState(0);
  const { speak, speaking, currentText } = useSpeech(language);

  async function handleImageAdd(e) {
    const files = Array.from(e.target.files || []);
    onAddImage(files);
    e.target.value = '';
  }

  // Mapa: słowo → tłumaczenie (z vocabulary)
  const vocabMap = {};
  analysis?.vocabulary?.forEach(v => {
    if (v.word) vocabMap[v.word.toLowerCase()] = v.translation || '';
  });

  // Mapa: słowo → tłumaczenie zdania (dla białych słów)
  const sentenceMap = {};
  analysis?.sentences?.forEach(s => {
    const words = s.original.match(/[\wа-яёА-ЯЁ'-]+/gi) || [];
    words.forEach(w => {
      const k = w.toLowerCase();
      if (!sentenceMap[k]) sentenceMap[k] = s.polish;
    });
  });

  return (
    <div className="page-view">
      <div className="tabs">
        {TABS.map((label, i) => (
          <button key={i} className={`tab-btn${activeTab === i ? ' active' : ''}`} onClick={() => setActiveTab(i)}>
            {label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {error && <div className="error-msg">⚠ {error}</div>}

        {loading && (
          <div className="loading-pane">
            <div className="spinner" />
            <p>Claude analizuje stronę…</p>
          </div>
        )}

        {!loading && (
          <>
            {/* ── Tłumaczenie PL ── */}
            {activeTab === 0 && (
              <div className="text-block">
                {analysis?.polish_translation || (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Ładowanie tłumaczenia…</span>
                )}
              </div>
            )}

            {/* ── Oryginał – wszystkie słowa z tooltipami ── */}
            {activeTab === 1 && (
              <div className="text-block original">
                {(analysis?.vocabulary?.length > 0 || analysis?.sentences?.length > 0)
                  ? renderFlowingText(pageText, vocabMap, sentenceMap)
                  : pageText || <span style={{ color: 'var(--text-muted)' }}>Brak tekstu.</span>
                }
              </div>
            )}

            {/* ── Zdanie po zdaniu – żółte i białe z tooltipami ── */}
            {activeTab === 2 && (
              <div className="sentence-list">
                {analysis?.sentences?.length > 0
                  ? analysis.sentences.map((s, i) => {
                    const isPlaying = speaking && currentText === s.original;
                    return (
                      <div key={i} className={`sentence-pair${isPlaying ? ' playing' : ''}`}>
                        <div className="sentence-original-row">
                          <div className="sentence-original">
                            {renderSentenceWords(s.original, s.key_words, vocabMap, s.polish)}
                          </div>
                          <button
                            className={`btn-speak${isPlaying ? ' active' : ''}`}
                            onClick={() => speak(s.original)}
                            title={isPlaying ? 'Zatrzymaj' : 'Odtwórz'}
                          >
                            {isPlaying ? '■' : '▶'}
                          </button>
                        </div>
                        <div className="sentence-polish">{s.polish}</div>
                      </div>
                    );
                  })
                  : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Brak analizy zdań.</span>
                }
              </div>
            )}

            {/* ── Słowniczek ── */}
            {activeTab === 3 && (
              <div className="vocab-grid">
                {analysis?.vocabulary?.length > 0
                  ? analysis.vocabulary.map((v, i) => (
                    <div key={i} className="vocab-card" onClick={() => speak(v.word, 0.75)} title="Kliknij aby usłyszeć" style={{ cursor: 'pointer' }}>
                      <div className="vocab-word">{v.word}</div>
                      <div className="vocab-translation">{v.translation}</div>
                      {v.note && <div className="vocab-note">{v.note}</div>}
                    </div>
                  ))
                  : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Brak słowniczka.</span>
                }
              </div>
            )}
          </>
        )}
      </div>

      {/* Kontekst */}
      {analysis?.context && !loading && (
        <div className="context-block">
          <h4>Kontekst i objaśnienia</h4>
          {analysis.context.summary && <p className="context-summary">{analysis.context.summary}</p>}
          {analysis.context.notes?.length > 0 && (
            <div className="context-notes">
              {analysis.context.notes.map((note, i) => (
                <div key={i} className="context-note">{note}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prompt do obrazka – na dole */}
      {analysis?.image_prompt && !loading && (
        <ImagePromptSection prompt={analysis.image_prompt} />
      )}

      {/* Obrazki */}
      <ImageSection
        images={pageImages}
        onAdd={handleImageAdd}
        onRemove={onRemoveImage}
      />
    </div>
  );
}

function ImageSection({ images, onAdd, onRemove }) {
  const [lightbox, setLightbox] = useState(null);

  return (
    <div className="image-section">
      <div className="image-section-header">
        <h4>Obrazki do tej strony</h4>
        <label className="btn-add-image">
          + Dodaj obrazek
          <input type="file" accept="image/*" multiple onChange={onAdd} style={{ display: 'none' }} />
        </label>
      </div>

      {images?.length > 0 && (
        <div className="image-grid">
          {images.map((dataUrl, i) => (
            <div key={i} className="image-thumb" onClick={() => setLightbox(dataUrl)} title="Kliknij aby powiększyć">
              <img src={dataUrl} alt={`Obrazek ${i + 1}`} />
              <button
                className="image-thumb-remove"
                onClick={e => { e.stopPropagation(); onRemove(i); }}
                title="Usuń"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
            <img src={lightbox} alt="Powiększony obrazek" />
            <button className="lightbox-close" onClick={() => setLightbox(null)}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ImagePromptSection({ prompt }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="image-prompt-section">
      <div className="image-prompt-header">
        <h4>🎬 Prompt do obrazka</h4>
        <button className={`btn-copy${copied ? ' copied' : ''}`} onClick={handleCopy}>
          {copied ? '✓ Skopiowano!' : '📋 Kopiuj prompt'}
        </button>
      </div>
      <p className="image-prompt-text">{prompt}</p>
    </div>
  );
}

// ── Oryginał: każde słowo jako span, żółte = vocab, białe = kontekst zdania ──
function renderFlowingText(text, vocabMap, sentenceMap) {
  if (!text) return null;

  // Tokenizuj: słowa + białe znaki + interpunkcja
  const tokens = text.split(/([\s\n]+|[.,!?;:«»„"()[\]{}/\\—–-]+)/);

  return tokens.map((token, i) => {
    const clean = token.replace(/[^а-яёa-zA-ZА-ЯЁ'-]/gi, '').toLowerCase();
    if (!clean) return token; // spacja, interpunkcja → bez zmian

    const vocabTranslation = vocabMap[clean];
    if (vocabTranslation) {
      // Żółte – słowo ze słowniczka
      return (
        <span key={i} className="vocab-highlight" data-translation={vocabTranslation}>
          {token}
        </span>
      );
    }

    const sentenceTranslation = sentenceMap[clean];
    if (sentenceTranslation) {
      // Białe – słowo z przetłumaczonego zdania
      return (
        <span key={i} className="word-hint" data-translation={sentenceTranslation}>
          {token}
        </span>
      );
    }

    return token;
  });
}

// ── Zdanie po zdaniu: żółte = vocab z tooltipem, białe = tłumaczenie zdania ──
function renderSentenceWords(text, keyWords, vocabMap, sentencePolish) {
  if (!text) return null;

  const keySet = new Set((keyWords || []).map(w => w.toLowerCase()));
  const tokens = text.split(/([\s\n]+|[.,!?;:«»„"()[\]{}/\\—–-]+)/);

  return tokens.map((token, i) => {
    const clean = token.replace(/[^а-яёa-zA-ZА-ЯЁ'-]/gi, '').toLowerCase();
    if (!clean) return token;

    if (keySet.has(clean)) {
      const translation = vocabMap[clean] || '';
      return (
        <span key={i} className="vocab-highlight" data-translation={translation || token}>
          {token}
        </span>
      );
    }

    // Białe słowo – tooltip = tłumaczenie całego zdania
    return (
      <span key={i} className="word-hint" data-translation={sentencePolish}>
        {token}
      </span>
    );
  });
}
