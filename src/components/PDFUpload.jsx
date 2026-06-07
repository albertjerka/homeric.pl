import { useState, useRef } from 'react';

export default function PDFUpload({ onLoad, language }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  function handleFile(f) {
    if (f && f.type === 'application/pdf') {
      setFile(f);
      const name = f.name.replace(/\.pdf$/i, '');
      setTitle(name);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function handleStart() {
    const start = Math.max(1, parseInt(startPage) || 1);
    const end = endPage ? Math.max(start, parseInt(endPage) || start) : null;
    onLoad(file, start, end, title);
  }

  return (
    <div className="upload-screen">
      <div className="upload-intro">
        <h2>Zacznij czytać w oryginale</h2>
        <p>
          Wgraj plik PDF z książką lub tekstem literackim.
          UANNA przetłumaczy każdą stronę, wyodrębni słowniczek i dostarczy kontekst kulturowy.
        </p>
      </div>

      <div
        className={`upload-zone${dragOver ? ' drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files?.[0])}
        />
        <span className="upload-icon">📜</span>
        <h3>{file ? 'Zmień plik' : 'Przeciągnij PDF lub kliknij'}</h3>
        <p>Obsługujemy pliki do 1000 stron</p>
        {file && <div className="upload-file-name">✓ {file.name}</div>}
      </div>

      {file && (
        <div className="upload-config">
          <div className="config-row">
            <span className="config-label">Tytuł dzieła</span>
            <input
              type="text"
              className="config-input"
              style={{ width: '220px', textAlign: 'left' }}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="np. Mistrz i Małgorzata"
            />
          </div>

          <div className="config-row">
            <span className="config-label">Język źródłowy</span>
            <span style={{ color: 'var(--accent)', fontFamily: 'Cinzel, serif', fontSize: '0.9rem' }}>
              {language === 'ru' ? 'Rosyjski' : 'Angielski'}
            </span>
          </div>

          <div className="config-row">
            <span className="config-label">Od strony</span>
            <input
              type="number"
              className="config-input"
              min={1}
              value={startPage}
              onChange={e => setStartPage(e.target.value)}
            />
          </div>

          <div className="config-row">
            <span className="config-label">Do strony <span style={{color:'var(--text-muted)',fontSize:'0.75rem'}}>(puste = koniec)</span></span>
            <input
              type="number"
              className="config-input"
              min={1}
              value={endPage}
              placeholder="koniec"
              onChange={e => setEndPage(e.target.value)}
            />
          </div>

          <button className="btn-start" onClick={handleStart}>
            Zacznij czytanie ›
          </button>
        </div>
      )}
    </div>
  );
}
