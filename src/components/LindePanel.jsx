import { useState, useRef } from 'react';
import { searchLinde, importLinde, askLinde } from '../services/lindeApi.js';

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function LindePanel({ onInsertQuote }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showImport, setShowImport] = useState(false);
  const [importForm, setImportForm] = useState({ file_path: '', title: 'Słownik Lindego', volume: '' });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // AI prompt
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiImage, setAiImage] = useState(null); // { base64, type, previewUrl }
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null); // { answer, headwords }
  const [aiError, setAiError] = useState('');
  const imageRef = useRef();

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await searchLinde(query.trim());
      setResults(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function openOnline() {
    const url = `https://www.google.com/search?q=S%C5%82ownik+Lindego+${encodeURIComponent(query)}+site%3Akpbc.umk.pl`;
    window.open(url, '_blank', 'noopener');
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!importForm.file_path.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const r = await importLinde(importForm);
      setImportResult({ ok: true, msg: `Zaimportowano ${r.imported} haseł (źródło #${r.source_id})` });
    } catch (e) {
      setImportResult({ ok: false, msg: e.message });
    } finally {
      setImporting(false);
    }
  }

  async function handleAiImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await toBase64(file);
    const previewUrl = URL.createObjectURL(file);
    setAiImage({ base64, type: file.type, previewUrl });
  }

  function removeAiImage() {
    if (aiImage?.previewUrl) URL.revokeObjectURL(aiImage.previewUrl);
    setAiImage(null);
    if (imageRef.current) imageRef.current.value = '';
  }

  async function handleAiAsk(e) {
    e.preventDefault();
    if (!aiPrompt.trim() && !aiImage) return;
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const payload = { prompt: aiPrompt };
      if (aiImage) {
        payload.image_base64 = aiImage.base64;
        payload.image_media_type = aiImage.type;
      }
      const r = await askLinde(payload);
      setAiResult(r);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="linde-panel">
      <div className="linde-panel-header">
        <div className="panel-title">Słownik Lindego</div>
        <button
          className="btn-ghost-sm"
          onClick={() => setShowImport(s => !s)}
          title="Importuj plik OCR/TXT Słownika Lindego"
        >
          {showImport ? '✕ Zamknij' : '⊕ Import'}
        </button>
      </div>

      {showImport && (
        <form className="linde-import-form" onSubmit={handleImport}>
          <div className="import-hint">
            Podaj ścieżkę do pliku TXT/OCR Słownika Lindego na serwerze.
          </div>
          <label>Ścieżka do pliku na serwerze
            <input
              value={importForm.file_path}
              onChange={e => setImportForm(f => ({ ...f, file_path: e.target.value }))}
              placeholder="/home/ubuntu/linde_tom1.txt"
            />
          </label>
          <label>Tytuł źródła
            <input
              value={importForm.title}
              onChange={e => setImportForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Słownik Lindego"
            />
          </label>
          <label>Tom
            <input
              value={importForm.volume}
              onChange={e => setImportForm(f => ({ ...f, volume: e.target.value }))}
              placeholder="np. I"
            />
          </label>
          <button type="submit" className="btn-primary-sm" disabled={importing}>
            {importing ? 'Importuję…' : 'Importuj'}
          </button>
          {importResult && (
            <div className={importResult.ok ? 'import-ok' : 'import-err'}>{importResult.msg}</div>
          )}
        </form>
      )}

      {/* Wyszukiwanie hasła */}
      <form className="linde-search-form" onSubmit={handleSearch}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Wpisz hasło…"
          className="linde-input"
        />
        <button type="submit" className="btn-primary-sm" disabled={loading}>
          {loading ? '…' : 'Szukaj'}
        </button>
      </form>

      {error && <div className="linde-error">{error}</div>}

      {results !== null && results.length === 0 && (
        <div className="linde-empty">
          <p>Nie znaleziono hasła dla „{query}".</p>
          <p className="linde-empty-hint">Linde używa staropolskiej pisowni (np. BESTYA zamiast bestia). Spróbuj wariantu pisowni lub szukaj online.</p>
          <button className="btn-ghost-sm" onClick={openOnline}>Szukaj online →</button>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="linde-results">
          {/* Czy jest dokładne trafienie? */}
          {!results.some(r => r.match_type === 'exact') && (
            <div className="linde-no-exact">
              Nie znaleziono dokładnego hasła. Poniżej podobne trafienia:
            </div>
          )}
          {results.map(entry => (
            <div key={entry.id} className={`linde-entry linde-entry-${entry.match_type || 'body'}`}>
              <div className="linde-entry-head">
                <span className="linde-headword">{entry.headword}</span>
                <span className={`linde-match-badge linde-match-${entry.match_type || 'body'}`}>
                  {entry.match_type === 'exact' ? 'dokładne' :
                   entry.match_type === 'prefix' ? 'prefiks' :
                   entry.match_type === 'headword' ? 'hasło' : 'treść'}
                </span>
              </div>
              {(entry.volume || entry.page) && (
                <div className="linde-meta">
                  {entry.volume && <span>Tom {entry.volume}</span>}
                  {entry.page && <span>, s. {entry.page}</span>}
                </div>
              )}
              {entry.body && (
                <div className="linde-body">{entry.body.slice(0, 500)}{entry.body.length > 500 ? '…' : ''}</div>
              )}
              <div className="linde-actions">
                {onInsertQuote && (
                  <button
                    className="btn-ghost-sm"
                    onClick={() => onInsertQuote(`[Linde: ${entry.headword}] ${entry.body?.slice(0, 200) || ''}`)}
                  >
                    Wstaw cytat
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI prompt */}
      <div className="linde-ai-divider">
        <span>Zapytaj o słownik</span>
      </div>

      <form className="linde-ai-form" onSubmit={handleAiAsk}>
        <textarea
          className="linde-ai-textarea"
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          placeholder="Zapytaj np.: Jakie słowa w języku staropolskim oznaczały miłość? Znajdź archaizmy pasujące do sceny uczty. Co Linde mówi o słowie 'brat'?"
          rows={4}
        />

        <div className="linde-ai-actions">
          <label className="linde-ai-img-btn" title="Wgraj obraz — AI znajdzie pasujące hasła">
            {aiImage ? '📷 Zmień' : '🖼 Wgraj obraz'}
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAiImageChange}
            />
          </label>
          <button
            type="submit"
            className="btn-primary-sm"
            disabled={aiLoading || (!aiPrompt.trim() && !aiImage)}
          >
            {aiLoading ? 'Szukam…' : 'Zapytaj Lindego'}
          </button>
        </div>

        {aiImage && (
          <div className="linde-ai-img-preview">
            <img src={aiImage.previewUrl} alt="Podgląd" />
            <button type="button" className="linde-ai-img-remove" onClick={removeAiImage}>✕</button>
          </div>
        )}
      </form>

      {aiLoading && (
        <div className="linde-ai-loading">
          <span className="homer-loading-dot" /> Przeszukuję słownik i pytam AI…
        </div>
      )}

      {aiError && <div className="linde-error">{aiError}</div>}

      {aiResult && (
        <div className="linde-ai-result">
          {/* Informacja o wyszukiwaniu */}
          <div className="linde-ai-search-info">
            {aiResult.searchTerms?.length > 0 && (
              <span className="linde-ai-search-terms">
                Wyszukano: {aiResult.searchTerms.join(', ')}
              </span>
            )}
            {aiResult.resultsCount != null && (
              <span className="linde-ai-results-count">
                {aiResult.resultsCount > 0
                  ? `${aiResult.resultsCount} haseł z bazy`
                  : 'Brak haseł w bazie'}
              </span>
            )}
          </div>

          {/* Hasła z bazy — tylko realne trafienia */}
          {aiResult.headwords?.length > 0 && (
            <div className="linde-ai-headwords">
              <span className="linde-ai-hw-label">Hasła z bazy:</span>
              {aiResult.headwords.map(hw => (
                <button
                  key={hw}
                  className="linde-ai-hw-tag"
                  onClick={() => { setQuery(hw); searchLinde(hw).then(setResults).catch(() => {}); }}
                  title="Kliknij aby zobaczyć pełne hasło"
                >
                  {hw}
                </button>
              ))}
            </div>
          )}

          <div className="linde-ai-answer">{aiResult.answer}</div>
          <div className="linde-ai-footer">
            <button
              className="btn-ghost-sm"
              onClick={() => navigator.clipboard?.writeText(aiResult.answer).catch(() => {})}
            >
              Kopiuj
            </button>
            {onInsertQuote && (
              <button
                className="btn-ghost-sm"
                onClick={() => onInsertQuote(aiResult.answer)}
              >
                Wstaw do rozdziału
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
