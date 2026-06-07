import { useState } from 'react';

export default function Navigation({ currentPage, totalPages, startPage, endPage, onNavigate, position }) {
  const [jumpValue, setJumpValue] = useState('');

  const lastPage = endPage || totalPages;
  const relPage = currentPage - startPage + 1;
  const relTotal = lastPage - startPage + 1;
  const progress = relTotal > 1 ? ((currentPage - startPage) / (relTotal - 1)) * 100 : 100;

  function handleJump() {
    const n = parseInt(jumpValue);
    if (n >= startPage && n <= lastPage) {
      onNavigate(n);
      setJumpValue('');
    }
  }

  return (
    <nav className={`navigation${position === 'top' ? ' top' : ''}`}>
      <button
        className="btn-nav"
        disabled={currentPage <= startPage}
        onClick={() => onNavigate(currentPage - 1)}
      >
        ← Wstecz
      </button>

      <div className="nav-center">
        <span className="nav-progress-text">
          Strona {relPage} z {relTotal}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
            &ensp;(PDF s.&nbsp;{currentPage}/{lastPage})
          </span>
        </span>
        <div className="nav-progress-bar">
          <div className="nav-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="nav-jump">
          <span>Skocz do PDF s.</span>
          <input
            type="number"
            min={startPage}
            max={lastPage}
            value={jumpValue}
            onChange={e => setJumpValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJump()}
            placeholder="nr"
          />
          <button onClick={handleJump}>Idź</button>
        </div>
      </div>

      <button
        className="btn-nav"
        disabled={currentPage >= lastPage}
        onClick={() => onNavigate(currentPage + 1)}
      >
        Dalej →
      </button>
    </nav>
  );
}
