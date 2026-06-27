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

  // vocabMap: 8-12 kluczowych słów → tłumaczenie (żółte)
  const vocabMap = {};
  analysis?.vocabulary?.forEach(v => {
    if (v.word) vocabMap[v.word.toLowerCase()] = v.translation || '';
  });

  // allWordsMap: wszystkie słowa z word_translations → tłumaczenie (białe)
  const allWordsMap = {};
  if (analysis?.word_translations) {
    Object.entries(analysis.word_translations).forEach(([w, t]) => {
      allWordsMap[w.toLowerCase()] = t;
    });
  }
  // vocab nadpisuje allWords (lepszy kontekst)
  const fullMap = { ...allWordsMap, ...vocabMap };

  // Fallback dla białych: sentenceMap (stare cache bez word_translations)
  const sentenceMap = {};
  analysis?.sentences?.forEach(s => {
    const words = s.original.match(/[\wа-яёіїєґА-ЯЁІЇЄҐ'-]+/gi) || [];
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
                {pageText
                  ? (renderFlowingText(pageText, vocabMap, fullMap, sentenceMap) || pageText)
                  : <span style={{ color: 'var(--text-muted)' }}>Ładowanie tekstu…</span>
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
                            {renderSentenceWords(s.original, s.key_words, vocabMap, fullMap, sentenceMap, s.polish)}
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

// ── Oryginał: każde słowo jako span ──
function renderFlowingText(text, vocabMap, fullMap, sentenceMap) {
  if (!text) return null;
  const tokens = text.split(/([\s\n]+|[.,!?;:«»„"()[\]{}/\\—–-]+)/);

  return tokens.map((token, i) => {
    const clean = token.replace(/[^а-яёіїєґa-zA-ZА-ЯЁІЇЄҐ'-]/gi, '').toLowerCase();
    if (!clean) return token;

    // Żółte = kluczowe słówka ze słowniczka
    const vocabTr = vocabMap[clean] || findByPrefix(clean, vocabMap);
    if (vocabTr) {
      return <span key={i} className="vocab-highlight" data-translation={vocabTr}>{token}</span>;
    }

    // Białe = pozostałe słowa z word_translations (bez fallbacku na zdanie)
    const whiteTr = fullMap[clean] || findByPrefix(clean, fullMap);
    if (whiteTr) {
      return <span key={i} className="word-hint" data-translation={whiteTr}>{token}</span>;
    }

    return token;
  });
}

// ── Zdanie po zdaniu: każde słowo ma swój własny tooltip ──
function renderSentenceWords(text, keyWords, vocabMap, fullMap, sentenceMap, sentencePolish) {
  if (!text) return null;

  const keySet = new Set((keyWords || []).map(w => w.toLowerCase()));
  const tokens = text.split(/([\s\n]+|[.,!?;:«»„"()[\]{}/\\—–-]+)/);

  return tokens.map((token, i) => {
    const clean = token.replace(/[^а-яёіїєґa-zA-ZА-ЯЁІЇЄҐ'-]/gi, '').toLowerCase();
    if (!clean) return token;

    if (keySet.has(clean)) {
      // Żółte – tłumaczenie ze słowniczka (własne słowo, nie zdanie)
      const tr = vocabMap[clean] || findByPrefix(clean, vocabMap)
              || fullMap[clean]  || findByPrefix(clean, fullMap);
      return (
        <span key={i} className="vocab-highlight" data-translation={tr || '—'}>
          {token}
        </span>
      );
    }

    // Białe – tłumaczenie indywidualne słowa (tylko z word_translations, nie całe zdanie)
    const tr = fullMap[clean] || findByPrefix(clean, fullMap);
    if (tr) {
      return <span key={i} className="word-hint" data-translation={tr}>{token}</span>;
    }

    return token;
  });
}

function findByPrefix(word, map) {
  if (!word || word.length < 4) return '';
  const stem = word.slice(0, Math.max(4, word.length - 2));
  for (const [k, v] of Object.entries(map)) {
    if (k !== word && (k.startsWith(stem) || word.startsWith(k.slice(0, -1)))) return v;
  }
  return '';
}
