export default function Library({ books, onOpen, onDelete }) {
  if (!books.length) return (
    <div className="library-empty">
      <span style={{ fontSize: '2rem' }}>𒀭</span>
      <p>Biblioteka jest pusta. Wgraj pierwszą książkę poniżej.</p>
    </div>
  );

  return (
    <section className="library">
      <h2 className="library-title">Moja Biblioteka</h2>
      <div className="library-grid">
        {books.map(book => {
          const last = book.currentPage || book.startPage || 1;
          const total = book.totalPages || 1;
          const end = book.endPage || total;
          const progress = Math.round(((last - (book.startPage || 1)) / Math.max(end - (book.startPage || 1), 1)) * 100);

          return (
            <div key={book.id} className="book-card">
              <div className="book-card-lang">
                {book.language === 'ru' ? 'RU' : 'EN'}
              </div>
              <div className="book-card-title">{book.title || 'Bez tytułu'}</div>
              <div className="book-card-status">
                s. {last} / {end} (PDF {total} stron)
              </div>
              <div className="book-progress-bar">
                <div className="book-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <div className="book-card-pct">{Math.min(progress, 100)}%</div>
              <div className="book-card-actions">
                <button className="btn-read" onClick={() => onOpen(book.id)}>
                  Czytaj →
                </button>
                <button className="btn-delete" onClick={() => {
                  if (confirm(`Usunąć "${book.title}" z biblioteki?`)) onDelete(book.id);
                }}>
                  Usuń
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
