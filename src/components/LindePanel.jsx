import { useState } from 'react';
import { searchLinde } from '../services/lindeApi.js';

export default function LindePanel({ onInsertQuote }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="linde-panel">
      <div className="panel-title">Słownik Lindego</div>
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
          <p>Brak wyników dla „{query}"</p>
          {query && (
            <div className="linde-empty-actions">
              <p className="linde-hint">
                Baza Słownika Lindego nie została jeszcze zaimportowana lub nie zawiera tego hasła.<br />
                Dodaj plik OCR/TXT słownika, aby uruchomić lokalne wyszukiwanie.
              </p>
              <button className="btn-ghost-sm" onClick={openOnline}>
                Szukaj online →
              </button>
            </div>
          )}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="linde-results">
          {results.map(entry => (
            <div key={entry.id} className="linde-entry">
              <div className="linde-headword">{entry.headword}</div>
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
                {entry.source_url && (
                  <a href={entry.source_url} target="_blank" rel="noopener" className="btn-ghost-sm">
                    Źródło
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
