import { useRef } from 'react';

function BookCard({ book, onOpen, onUploadAndOpen, onDelete }) {
  const fileRef = useRef();
  const langLabel = book.language === 'ru' ? 'RU' : book.language === 'uk' ? 'UA' : 'EN';
  const last = book.current_page || book.start_page || 1;
  const total = book.total_pages || 1;
  const end = book.end_page || total;
  const progress = Math.round(((last - (book.start_page || 1)) / Math.max(end - (book.start_page || 1), 1)) * 100);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) onUploadAndOpen(book.id, file);
  }

  return (
    <div className="book-card">
      <div className="book-card-lang">{langLabel}</div>
      <div className="book-card-title">{book.title || 'Bez tytułu'}</div>
      <div className="book-card-status">s. {last} / {end} · PDF {total} stron</div>
      <div className="book-progress-bar">
        <div className="book-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      <div className="book-card-pct">{Math.min(progress, 100)}%</div>
      <div className="book-card-actions">
        <button className="btn-read" onClick={() => onOpen(book.id)}>
          Czytaj →
        </button>
        <label className="btn-read" style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'center' }}
          title="Wgraj plik PDF">
          ↑ PDF
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </label>
        <button className="btn-delete" onClick={() => {
          if (confirm(`Usunąć "${book.title}" z biblioteki?`)) onDelete(book.id);
        }}>Usuń</button>
      </div>
    </div>
  );
}

export default function Library({ books, onOpen, onUploadAndOpen, onDelete }) {
  if (!books.length) return (
    <div className="library-empty">
      <span style={{ fontSize: '2rem' }}>Η</span>
      <p>Biblioteka jest pusta. Wgraj pierwszą książkę poniżej.</p>
    </div>
  );

  return (
    <section className="library">
      <h2 className="library-title">Moja Biblioteka</h2>
      <div className="library-grid">
        {books.map(book => (
          <BookCard
            key={book.id}
            book={book}
            onOpen={onOpen}
            onUploadAndOpen={onUploadAndOpen}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}
