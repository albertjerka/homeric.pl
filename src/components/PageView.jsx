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

  // Mapa słowo → tłumaczenie dla tooltipów
  const vocabMap = {};
  analysis?.vocabulary?.forEach(v => {
    if (v.word) vocabMap[v.word.toLowerCase()] = v.translation;
  });

  return (
    <div className="page-view">
      <div className="tabs">
        {TABS.map((label, i) => (
          <button
            key={i}
            className={`tab-btn${activeTab === i ? ' active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
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
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Ładowanie tłumaczenia…
                  </span>
                )}
              </div>
            )}

            {/* ── Oryginał – lity tekst z żółtymi słowami ── */}
            {activeTab === 1 && (
              <div className="text-block original">
                {analysis?.vocabulary?.length > 0
                  ? renderFlowingText(pageText, analysis.vocabulary)
                  : pageText || <span style={{ color: 'var(--text-muted)' }}>Brak tekstu.</span>
                }
              </div>
            )}

            {/* ── Zdanie po zdaniu ── */}
            {activeTab === 2 && (
              <div className="sentence-list">
                {analysis?.sentences?.length > 0
                  ? analysis.sentences.map((s, i) => {
                    const isPlaying = speaking && currentText === s.original;
                    return (
                      <div key={i} className={`sentence-pair${isPlaying ? ' playing' : ''}`}>
                        <div className="sentence-original-row">
                          <div className="sentence-original">
                            {highlightBold(s.original, s.key_words)}
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
                    <div
                      key={i}
                      className="vocab-card"
                      onClick={() => speak(v.word, 0.75)}
                      title="Kliknij aby usłyszeć"
                      style={{ cursor: 'pointer' }}
                    >
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

      {analysis?.image_prompt && !loading && (
        <ImagePromptSection prompt={analysis.image_prompt} />
      )}

      {analysis?.context && !loading && (
        <div className="context-block">
          <h4>Kontekst i objaśnienia</h4>
          {analysis.context.summary && (
            <p className="context-summary">{analysis.context.summary}</p>
          )}
          {analysis.context.notes?.length > 0 && (
            <div className="context-notes">
              {analysis.context.notes.map((note, i) => (
                <div key={i} className="context-note">{note}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="image-section">
        <div className="image-section-header">
          <h4>Obrazki do tej strony</h4>
          <label className="btn-add-image">
            + Dodaj obrazek
            <input type="file" accept="image/*" multiple onChange={handleImageAdd} style={{ display: 'none' }} />
          </label>
        </div>
        {pageImages?.length > 0 && (
          <div className="image-grid">
            {pageImages.map((dataUrl, i) => (
              <div key={i} className="image-thumb">
                <img src={dataUrl} alt={`Obrazek ${i + 1}`} />
                <button className="image-thumb-remove" onClick={() => onRemoveImage(i)} title="Usuń">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
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
        <button
          className={`btn-copy${copied ? ' copied' : ''}`}
          onClick={handleCopy}
        >
          {copied ? '✓ Skopiowano!' : '📋 Kopiuj prompt'}
        </button>
      </div>
      <p className="image-prompt-text">{prompt}</p>
    </div>
  );
}

// Oryginał: lity tekst, żółte słowa słowniczkowe z tooltipem (bez play)
function renderFlowingText(text, vocabulary) {
  if (!vocabulary?.length || !text) return text;

  const vocabMap = {};
  vocabulary.forEach(v => { if (v.word) vocabMap[v.word.toLowerCase()] = v.translation || ''; });

  const escaped = Object.keys(vocabMap).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return text;

  const splitRegex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const testRegex  = new RegExp(`^(${escaped.join('|')})$`, 'i');
  const parts = text.split(splitRegex);

  return parts.map((part, i) =>
    testRegex.test(part)
      ? <span key={i} className="vocab-highlight" data-translation={vocabMap[part.toLowerCase()] || part}>{part}</span>
      : part
  );
}

// Zdanie po zdaniu: tylko pogrubienie (bez tooltip)
function highlightBold(text, keyWords) {
  if (!keyWords?.length) return text;
  const escaped = keyWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const splitRegex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const testRegex = new RegExp(`(${escaped.join('|')})`, 'i');
  return text.split(splitRegex).map((part, i) =>
    testRegex.test(part) ? <strong key={i}>{part}</strong> : part
  );
}
