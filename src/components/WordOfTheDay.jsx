import { useState, useEffect } from 'react';
import { getToken } from '../services/auth.js';

export default function WordOfTheDay({ onUseInWriter }) {
  const [word, setWord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/linde/word-of-the-day?seed=${seed}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(data => { setWord(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [seed]);

  if (loading) {
    return (
      <div className="wotd-card wotd-loading">
        <div className="wotd-icon">Λ</div>
        <div className="wotd-skeleton" />
      </div>
    );
  }

  if (!word || word.empty) {
    return (
      <div className="wotd-card wotd-empty">
        <div className="wotd-icon">Λ</div>
        <p>Słowniki nie zostały jeszcze zaimportowane.</p>
      </div>
    );
  }

  return (
    <div className="wotd-card">
      <div className="wotd-header">
        <span className="wotd-icon">Λ</span>
        <span className="wotd-label">Słowo z dawnej polszczyzny</span>
        <button
          className="wotd-roll-btn"
          onClick={() => setSeed(s => s + 1)}
          title="Losuj inne słowo"
        >
          ↻
        </button>
      </div>

      <div className="wotd-headword">{word.headword}</div>
      <div className="wotd-source">{word.source}</div>
      <div className="wotd-meaning">{word.meaning}</div>

      {onUseInWriter && (
        <button
          className="wotd-use-btn"
          onClick={() => onUseInWriter(word.headword)}
        >
          Użyj w Pisarzu
        </button>
      )}
    </div>
  );
}
