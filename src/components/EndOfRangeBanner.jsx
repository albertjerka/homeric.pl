import { useState } from 'react';

export default function EndOfRangeBanner({ currentPage, onExtend }) {
  const [count, setCount] = useState(20);

  return (
    <div className="end-of-range-banner">
      <span className="end-of-range-icon">📖</span>
      <div className="end-of-range-text">
        <strong>Dotarłeś do końca wybranego zakresu</strong> (strona {currentPage}).
        Ile kolejnych stron przetłumaczyć?
      </div>
      <input
        type="number"
        min={1}
        max={500}
        value={count}
        onChange={e => setCount(Math.max(1, parseInt(e.target.value) || 1))}
        className="config-input"
        style={{ width: '80px' }}
      />
      <button className="btn-start" style={{ width: 'auto', padding: '10px 24px' }} onClick={() => onExtend(count)}>
        Dodaj strony
      </button>
    </div>
  );
}
