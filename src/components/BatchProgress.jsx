import ExportButton from './ExportButton.jsx';

export default function BatchProgress({ running, done, current, total, errors, onCancel, language, bookTitle, pageImages }) {
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
              {errors > 0 && <span className="batch-errors"> ({errors} błędów)</span>}
            </span>
            <button className="batch-cancel" onClick={onCancel}>Zatrzymaj</button>
          </div>
          <div className="batch-bar">
            <div className="batch-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="batch-pct">{pct}%</span>
        </>
      )}

      {done && (
        <div className="batch-done">
          <span className="batch-done-icon">✓</span>
          <div className="batch-done-text">
            <strong>Wszystkie {total} stron przetłumaczone!</strong>
            {errors > 0 && <span className="batch-errors"> ({errors} stron z błędem)</span>}
          </div>
          <ExportButton language={language} bookTitle={bookTitle} pageImages={pageImages} prominent />
        </div>
      )}
    </div>
  );
}
