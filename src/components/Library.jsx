import { useRef, useState, useEffect } from 'react';
import { getToken } from '../services/auth.js';
import { getProjects } from '../services/writerApi.js';

function BookCard({ book, onOpen, onUploadAndOpen, onDelete }) {
  const fileRef = useRef();
  const [downloading, setDownloading] = useState(false);
  const langLabel = book.language === 'ru' ? 'RU' : book.language === 'uk' ? 'UA' : 'EN';
  const last = book.current_page || book.start_page || 1;
  const total = book.total_pages || 1;
  const end = book.end_page || total;
  const progress = Math.round(((last - (book.start_page || 1)) / Math.max(end - (book.start_page || 1), 1)) * 100);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) onUploadAndOpen(book.id, file);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/books/${book.id}/pdf`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) { alert('Brak pliku PDF'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${book.title || 'ksiazka'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Błąd pobierania: ${e.message}`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="book-card">
      <div className="book-card-lang">{langLabel}</div>
      <div className="book-card-title">{book.title || 'Bez tytułu'}</div>
      <div className="book-card-status">s. {last} / {end} · {total} stron</div>
      <div className="book-progress-bar">
        <div className="book-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      <div className="book-card-pct">{Math.min(progress, 100)}%</div>
      <div className="book-card-actions">
        <button className="btn-read" onClick={() => onOpen(book.id)}>Czytaj →</button>
        <label className="btn-read btn-upload-label" title="Wgraj plik PDF">
          ↑ PDF
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handleFileChange} />
        </label>
        <button className="btn-read btn-download" onClick={handleDownload} disabled={downloading} title="Pobierz PDF">
          {downloading ? '…' : '↓'}
        </button>
        <button className="btn-delete" onClick={() => { if (confirm(`Usunąć "${book.title}"?`)) onDelete(book.id); }}>Usuń</button>
      </div>
    </div>
  );
}

function WriterProjectsSection({ onOpenWriterProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!projects.length) return (
    <div className="writer-books-empty">
      <span>Nie masz jeszcze żadnych pisanych książek.</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> Przejdź do modułu Pisarz, aby zacząć.</span>
    </div>
  );

  return (
    <div className="writer-books-grid">
      {projects.map(proj => (
        <div key={proj.id} className="writer-book-card" onClick={() => onOpenWriterProject(proj)}>
          <div className="writer-book-icon">✒</div>
          <div className="writer-book-title">{proj.title}</div>
          {proj.genre && <div className="writer-book-genre">{proj.genre}</div>}
          <div className="writer-book-words">{(proj.word_count || 0).toLocaleString('pl-PL')} słów</div>
          <button className="btn-read" style={{ marginTop: '8px' }}>Otwórz →</button>
        </div>
      ))}
    </div>
  );
}

export default function Library({ books, onOpen, onUploadAndOpen, onDelete, onOpenWriterProject }) {
  return (
    <section className="library">
      <div className="library-section">
        <h2 className="library-title">📚 PDF do czytania</h2>
        {books.length === 0 ? (
          <div className="library-empty">
            <span style={{ fontSize: '2rem' }}>Η</span>
            <p>Brak książek PDF. Wgraj pierwszą książkę poniżej.</p>
          </div>
        ) : (
          <div className="library-grid">
            {books.map(book => (
              <BookCard key={book.id} book={book} onOpen={onOpen} onUploadAndOpen={onUploadAndOpen} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>

      {onOpenWriterProject && (
        <div className="library-section">
          <h2 className="library-title">✒ Pisane przeze mnie</h2>
          <WriterProjectsSection onOpenWriterProject={onOpenWriterProject} />
        </div>
      )}
    </section>
  );
}
