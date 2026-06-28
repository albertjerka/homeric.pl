import { useState, useCallback, useEffect, useRef } from 'react';
import LoginPage from './components/LoginPage.jsx';
import Dashboard from './components/Dashboard.jsx';
import WriterHome from './components/WriterHome.jsx';
import WriterProjectEditor from './components/WriterProjectEditor.jsx';
import { isLoggedIn } from './services/auth.js';
import Header from './components/Header.jsx';
import Library from './components/Library.jsx';
import PDFUpload from './components/PDFUpload.jsx';
import WordStats from './components/WordStats.jsx';
import PageReader from './components/PageReader.jsx';
import ExportButton from './components/ExportButton.jsx';
import BatchProgress from './components/BatchProgress.jsx';
import { usePDF } from './hooks/usePDF.js';
import { useBatchTranslation } from './hooks/useBatchTranslation.js';
import { countWords } from './services/api.js';
import {
  getAllBooks, saveBook, uploadPDF, getBookPDF,
  updateBook, deleteBook, getImages, saveImages,
} from './services/dbApi.js';
import { migrateFromLocalStorage } from './services/migration.js';

function MainApp({ onBackToDashboard }) {
  const [phase, setPhase] = useState('home');
  const [language, setLanguage] = useState('ru');
  const [headerImage, setHeaderImage] = useState(null);
  const [bookTitle, setBookTitle] = useState('');
  const [currentBookId, setCurrentBookId] = useState(null);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [wordCount, setWordCount] = useState(null);
  const [wordCountLoading, setWordCountLoading] = useState(false);
  const [pageImages, setPageImages] = useState({});
  const [books, setBooks] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const pdfPickerRef = useRef(null);

  const pdfDocRef = useRef(null);
  const getPageTextRef = useRef(null);

  const { pdfDoc, totalPages, loadPDF, loadPDFFromBuffer, getPageText, sampleTexts } = usePDF();
  const batch = useBatchTranslation();

  useEffect(() => { pdfDocRef.current = pdfDoc; }, [pdfDoc]);
  useEffect(() => { getPageTextRef.current = getPageText; }, [getPageText]);

  useEffect(() => {
    async function init() {
      try {
        const imported = await migrateFromLocalStorage(msg => setMigrationStatus(msg));
        if (imported?.length) {
          const total = imported.reduce((s, b) => s + b.count, 0);
          setMigrationStatus(`Zaimportowano ${total} stron z poprzedniej sesji`);
          setTimeout(() => setMigrationStatus(null), 4000);
        }
      } catch (e) {
        console.warn('Migracja nie powiodła się:', e.message);
      }
      getAllBooks().then(b => { setBooks(b); setLoadingLibrary(false); }).catch(() => setLoadingLibrary(false));
    }
    init();
  }, []);

  useEffect(() => {
    if (currentBookId && currentPage) {
      updateBook(currentBookId, { current_page: currentPage }).catch(() => {});
      setBooks(prev => prev.map(b => b.id === currentBookId ? { ...b, current_page: currentPage } : b));
    }
  }, [currentPage, currentBookId]);

  useEffect(() => {
    if (!currentBookId || !Object.keys(pageImages).length) return;
    Object.entries(pageImages).forEach(([page, imgs]) => {
      saveImages(currentBookId, page, imgs).catch(() => {});
    });
  }, [pageImages, currentBookId]);

  async function startReading(doc, title, lang, start, end, bookId) {
    setBookTitle(title);
    setLanguage(lang);
    setStartPage(start);
    setEndPage(end);
    setCurrentPage(start);
    setCurrentBookId(bookId);
    setPhase('reading');
    setWordCountLoading(true);
    try {
      const texts = await sampleTexts(doc, lang);
      const result = await countWords(texts, lang);
      setWordCount(result.count);
    } catch { setWordCount(null); }
    finally { setWordCountLoading(false); }
  }

  const handleLoad = useCallback(async (file, start, end, title, lang) => {
    const usedLang = lang || language;
    batch.reset();
    const result = await loadPDF(file);
    if (!result) return;
    const { doc, arrayBuffer } = result;

    const total = doc.numPages;
    const clampedStart = Math.min(start, total);
    const clampedEnd = end ? Math.min(end, total) : null;
    const resolvedTitle = title || file.name.replace(/\.pdf$/i, '');

    let id = null;
    try {
      id = await saveBook({
        title: resolvedTitle, language: usedLang,
        startPage: clampedStart, endPage: clampedEnd,
        currentPage: clampedStart, totalPages: total,
      });
      await uploadPDF(id, arrayBuffer);
      setBooks(prev => [{
        id, title: resolvedTitle, language: usedLang,
        start_page: clampedStart, end_page: clampedEnd,
        current_page: clampedStart, total_pages: total,
      }, ...prev]);
    } catch (e) {
      console.warn('Nie udało się zapisać do bazy:', e.message);
    }

    await startReading(doc, resolvedTitle, usedLang, clampedStart, clampedEnd, id);

    if (clampedEnd && id) {
      batch.start(doc, clampedStart, clampedEnd, usedLang, getPageText, id);
    }
  }, [loadPDF, language, sampleTexts, getPageText, batch]);

  function pickPDFFile() {
    return new Promise((resolve) => {
      const input = pdfPickerRef.current;
      input.value = '';
      input.onchange = e => resolve(e.target.files?.[0] ?? null);
      input.click();
    });
  }

  const handleOpenBook = useCallback(async (bookId) => {
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    batch.reset();
    const arrayBuffer = await getBookPDF(bookId);
    if (!arrayBuffer) {
      alert('Brak pliku PDF w bazie. Użyj przycisku "↑ PDF" na karcie książki, aby wgrać plik.');
      return;
    }

    const doc = await loadPDFFromBuffer(arrayBuffer);
    if (!doc) return;

    try {
      const imgs = await getImages(bookId);
      if (Object.keys(imgs).length) setPageImages(imgs);
    } catch {}

    const bookStart = book.start_page || 1;
    const bookEnd = book.end_page || doc.numPages;
    await startReading(doc, book.title, book.language, bookStart, book.end_page, bookId);
    setCurrentPage(book.current_page || bookStart);
    batch.start(doc, bookStart, bookEnd, book.language, getPageText, bookId);
  }, [books, loadPDFFromBuffer, sampleTexts, batch, getPageText]);

  const handleUploadAndOpen = useCallback(async (bookId, file) => {
    const book = books.find(b => b.id === bookId);
    if (!book || !file) return;

    batch.reset();
    const arrayBuffer = await file.arrayBuffer();
    await uploadPDF(bookId, arrayBuffer);

    const doc = await loadPDFFromBuffer(arrayBuffer);
    if (!doc) return;

    try {
      const imgs = await getImages(bookId);
      if (Object.keys(imgs).length) setPageImages(imgs);
    } catch {}

    const bookStart = book.start_page || 1;
    const bookEnd = book.end_page || doc.numPages;
    await startReading(doc, book.title, book.language, bookStart, book.end_page, bookId);
    setCurrentPage(book.current_page || bookStart);
    batch.start(doc, bookStart, bookEnd, book.language, getPageText, bookId);
  }, [books, loadPDFFromBuffer, batch, getPageText]);

  const handleDeleteBook = useCallback(async (bookId) => {
    await deleteBook(bookId);
    setBooks(prev => prev.filter(b => b.id !== bookId));
    if (currentBookId === bookId) { batch.cancel(); setPhase('home'); }
  }, [currentBookId, batch]);

  const handleExtendRange = useCallback(async (additionalPages) => {
    const newEnd = Math.min((endPage || totalPages) + additionalPages, totalPages);
    setEndPage(newEnd);
    if (currentBookId) {
      await updateBook(currentBookId, { end_page: newEnd });
      setBooks(prev => prev.map(b => b.id === currentBookId ? { ...b, end_page: newEnd } : b));
    }
    if (pdfDocRef.current && getPageTextRef.current) {
      batch.start(pdfDocRef.current, (endPage || totalPages) + 1, newEnd, language, getPageTextRef.current, currentBookId);
    }
  }, [endPage, totalPages, currentBookId, language, batch]);

  const handleAddImage = useCallback(async (pageNum, files) => {
    const dataUrls = await Promise.all(files.map(f => new Promise(res => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.readAsDataURL(f);
    })));
    setPageImages(prev => ({ ...prev, [pageNum]: [...(prev[pageNum] || []), ...dataUrls] }));
  }, []);

  const handleRemoveImage = useCallback((pageNum, idx) => {
    setPageImages(prev => ({ ...prev, [pageNum]: (prev[pageNum] || []).filter((_, i) => i !== idx) }));
  }, []);

  return (
    <div className="app-layout">
      <input ref={pdfPickerRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} />
      <Header
        language={language}
        onLanguageChange={setLanguage}
        headerImage={headerImage}
        onHeaderImageChange={setHeaderImage}
        onBackToDashboard={onBackToDashboard}
        exportButton={phase === 'reading' && !batch.running && (
          <ExportButton language={language} bookTitle={bookTitle} pageImages={pageImages} />
        )}
      />

      {migrationStatus && (
        <div style={{ background: 'var(--accent-dim)', color: 'var(--accent)', padding: '8px 32px', fontSize: '0.82rem', textAlign: 'center' }}>
          {migrationStatus}
        </div>
      )}

      {phase === 'home' && (
        <div className="home-screen">
          {!loadingLibrary && (
            <Library books={books} onOpen={handleOpenBook} onUploadAndOpen={handleUploadAndOpen} onDelete={handleDeleteBook} />
          )}
          <div className="home-upload-section">
            <PDFUpload onLoad={handleLoad} language={language} />
          </div>
        </div>
      )}

      {phase === 'reading' && pdfDoc && (
        <>
          <WordStats count={wordCount} loading={wordCountLoading} />

          <BatchProgress
            running={batch.running}
            done={batch.done}
            current={batch.current}
            total={batch.total}
            errors={batch.errors}
            errorList={batch.errorList}
            onCancel={batch.cancel}
            language={language}
            bookTitle={bookTitle}
            pageImages={pageImages}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 32px 0', flexWrap: 'wrap', gap: '8px' }}>
            <button
              className="btn-nav"
              onClick={() => setPhase('home')}
              style={{ minWidth: 'auto', padding: '6px 16px', fontSize: '0.78rem' }}
            >
              ← Biblioteka
            </button>

            {!batch.running && (
              <button
                className="btn-nav"
                style={{ minWidth: 'auto', padding: '6px 16px', fontSize: '0.78rem', borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
                onClick={() => {
                  if (pdfDocRef.current && getPageTextRef.current) {
                    batch.reset();
                    batch.start(pdfDocRef.current, startPage, endPage || totalPages, language, getPageTextRef.current, currentBookId);
                  }
                }}
              >
                ↻ Przetłumacz wszystko
              </button>
            )}
          </div>

          <PageReader
            pdfDoc={pdfDoc}
            currentPage={currentPage}
            totalPages={totalPages}
            startPage={startPage}
            endPage={endPage}
            language={language}
            pageImages={pageImages}
            onPageChange={setCurrentPage}
            onAddImage={handleAddImage}
            onRemoveImage={handleRemoveImage}
            onExtendRange={handleExtendRange}
            getPageText={getPageText}
            bookId={currentBookId}
          />
        </>
      )}
    </div>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(isLoggedIn());
  const [module, setModule] = useState('dashboard');
  const [writerProject, setWriterProject] = useState(null);

  useEffect(() => {
    const handler = () => setAuthenticated(false);
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  if (!authenticated) {
    return <LoginPage onLogin={() => { setAuthenticated(true); setModule('dashboard'); }} />;
  }

  if (module === 'dashboard') {
    return <Dashboard onSelect={m => setModule(m)} />;
  }

  if (module === 'writer') {
    if (writerProject) {
      return (
        <WriterProjectEditor
          project={writerProject}
          onBack={() => setWriterProject(null)}
        />
      );
    }
    return (
      <WriterHome
        onOpen={proj => setWriterProject(proj)}
        onBack={() => setModule('dashboard')}
      />
    );
  }

  // module === 'library' or 'reading'
  return <MainApp onBackToDashboard={() => setModule('dashboard')} />;
}
