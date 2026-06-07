import { useState } from 'react';
import ExportButton from './ExportButton.jsx';

export default function BatchProgress({ running, done, current, total, errors, errorList, onCancel, language, bookTitle, pageImages }) {
  const [showErrors, setShowErrors] = useState(false);
  if (!running && !done) return null;

  const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;

  return (
    <div className={`batch-progress${done ? ' done' : ''}`}>
      {running && (
        <>
          <div className="batch-header">
            <div className="batch-spinner" />
            <span className="batch-label">
              Tłumaczę stronę <strong>{current}</strong> z <strong>{total}</strong>
              {errors > 0 && (
                <span className="batch-errors" style={{ cursor: 'pointer' }} onClick={() => setShowErrors(v => !v)}>
                  &ensp;⚠ {errors} błędów ▾
                </span>
              )}
            </span>
            <button className="batch-cancel" onClick={onCancel}>Zatrzymaj</button>
          </div>
          <div className="batch-bar"><div className="batch-bar-fill" style={{ width: `${pct}%` }} /></div>
          <span className="batch-pct">{pct}%</span>
        </>
      )}

      {done && (
        <div className="batch-done">
          <span className="batch-done-icon">{errors > 0 ? '⚠' : '✓'}</span>
          <div className="batch-done-text">
            <strong>{errors > 0 ? `Gotowe – ${total - errors} z ${total} stron` : `Wszystkie ${total} stron przetłumaczone!`}</strong>
            {errors > 0 && (
              <span className="batch-errors" style={{ cursor: 'pointer', marginLeft: 8 }} onClick={() => setShowErrors(v => !v)}>
                {errors} błędów ▾
              </span>
            )}
          </div>
          <ExportButton language={language} bookTitle={bookTitle} pageImages={pageImages} prominent />
        </div>
      )}

      {showErrors && errorList?.length > 0 && (
        <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#e07080', lineHeight: 1.6 }}>
          {errorList.map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}
    </div>
  );
}
