import { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header.jsx';
import Library from './components/Library.jsx';
import StorageBar from './components/StorageBar.jsx';
import PDFUpload from './components/PDFUpload.jsx';
import WordStats from './components/WordStats.jsx';
import PageReader from './components/PageReader.jsx';
import ExportButton from './components/ExportButton.jsx';
import BatchProgress from './components/BatchProgress.jsx';
import { usePDF } from './hooks/usePDF.js';
import { useBatchTranslation } from './hooks/useBatchTranslation.js';
import { countWords } from './services/api.js';
import { saveBook, getAllBooks, getBookPDF, updateBook, deleteBook } from './services/library.js';
import {
  getFolder, saveFileToDisk, loadFileFromDisk,
  saveImagesToDisk, loadImagesFromDisk,
  safeFilename, bookBase as makeBookBase,
} from './services/fileSystem.js';

function fileToDataURL(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

export default function App() {
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
  const [syncStatus, setSyncStatus] = useState('');
  const [currentBookBase, setCurrentBookBase] = useState(null);

  // Referencje do stanu dla batcha (unikamy closure stale values)
  const pdfDocRef = useRef(null);
  const getPageTextRef = useRef(null);

  const { pdfDoc, totalPages, loadPDF, loadPDFFromBuffer, getPageText, sampleTexts } = usePDF();
  const batch = useBatchTranslation();

  useEffect(() => { pdfDocRef.current = pdfDoc; }, [pdfDoc]);
  useEffect(() => { getPageTextRef.current = getPageText; }, [getPageText]);

  // Zapisuj obrazki na dysk przy każdej zmianie
  useEffect(() => {
    if (!currentBookBase || !Object.keys(pageImages).length) return;
    saveImagesToDisk(currentBookBase, pageImages).catch(() => {});
  }, [pageImages, currentBookBase]);

  useEffect(() => {
    getAllBooks().then(b => { setBooks(b); setLoadingLibrary(false); }).catch(() => setLoadingLibrary(false));
  }, []);

  useEffect(() => {
    if (currentBookId && currentPage) {
      updateBook(currentBookId, { currentPage }).catch(() => {});
      setBooks(prev => prev.map(b => b.id === currentBookId ? { ...b, currentPage } : b));
    }
  }, [currentPage, currentBookId]);

  async function syncToDisk(filename, arrayBuffer) {
    const folderHandle = await getFolder().catch(() => null);
    if (!folderHandle) return;
    setSyncStatus('saving');
    try {
      await saveFileToDisk(filename, arrayBuffer);
      setSyncStatus('ok');
    } catch (e) {
      setSyncStatus('error');
      console.warn('Błąd zapisu na dysk:', e.message);
    }
  }

  async function startReading(doc, title, lang, start, end, base) {
    setBookTitle(title);
    setLanguage(lang);
    setStartPage(start);
    setEndPage(end);
    setCurrentPage(start);
    setCurrentBookBase(base || null);
    setPhase('reading');
    setWordCountLoading(true);
    try {
      const texts = await sampleTexts(doc, lang);
      const result = await countWords(texts, lang);
      setWordCount(result.count);
    } catch { setWordCount(null); }
    finally { setWordCountLoading(false); }
  }

  const handleLoad = useCallback(async (file, start, end, title) => {
    batch.reset();
    const result = await loadPDF(file);
    if (!result) return;
    const { doc, arrayBuffer } = result;

    const total = doc.numPages;
    const clampedStart = Math.min(start, total);
    const clampedEnd = end ? Math.min(end, total) : null;
    const resolvedTitle = title || file.name.replace(/\.pdf$/i, '');

    // Zapis do IndexedDB – opcjonalny, nie blokuje czytania
    let id = null;
    try {
      id = await saveBook({
        title: resolvedTitle, language,
        startPage: clampedStart, endPage: clampedEnd,
        currentPage: clampedStart, totalPages: total,
        pdfData: arrayBuffer,
      });
      setCurrentBookId(id);
      setBooks(prev => [{
        id, title: resolvedTitle, language,
        startPage: clampedStart, endPage: clampedEnd,
        currentPage: clampedStart, totalPages: total,
      }, ...prev]);
    } catch (e) {
      console.warn('Nie udało się zapisać do biblioteki:', e.message);
    }

    const base = id ? makeBookBase(resolvedTitle, id) : null;
    if (id) syncToDisk(safeFilename(resolvedTitle, id), arrayBuffer);
    await startReading(doc, resolvedTitle, language, clampedStart, clampedEnd, base);

    // Jeśli podano zakres → batch tłumaczenie od razu (z zapisem na dysk)
    if (clampedEnd) {
      batch.start(doc, clampedStart, clampedEnd, language, getPageText, base);
    }
  }, [loadPDF, language, sampleTexts, getPageText, batch]);

  const handleOpenBook = useCallback(async (bookId) => {
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    batch.reset();
    const filename = safeFilename(book.title, bookId);
    let arrayBuffer = await loadFileFromDisk(filename).catch(() => null);
    if (!arrayBuffer) arrayBuffer = await getBookPDF(bookId);

    if (!arrayBuffer) { alert('Nie znaleziono pliku PDF. Wgraj książkę ponownie.'); return; }

    const doc = await loadPDFFromBuffer(arrayBuffer);
    if (!doc) return;

    setCurrentBookId(bookId);
    const base = makeBookBase(book.title, bookId);

    // Załaduj cache tłumaczeń z dysku → localStorage
    try {
      const { loadPageCacheFromDisk } = await import('./services/fileSystem.js');
      const diskCache = await loadPageCacheFromDisk(base, book.language);
      Object.entries(diskCache).forEach(([page, data]) => {
        const k = `uanna_page_${page}_${book.language}`;
        if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(data));
      });
    } catch {}

    // Załaduj obrazki z dysku
    try {
      const imgs = await loadImagesFromDisk(base);
      if (Object.keys(imgs).length) setPageImages(imgs);
    } catch {}

    const bookStart = book.startPage || 1;
    const bookEnd = book.endPage || doc.numPages;

    await startReading(doc, book.title, book.language, bookStart, book.endPage, base);
    setCurrentPage(book.currentPage || bookStart);

    // Uruchom batch dla stron które nie mają jeszcze tłumaczenia (z zapisem na dysk)
    batch.start(doc, bookStart, bookEnd, book.language, getPageText, base);
  }, [books, loadPDFFromBuffer, sampleTexts, batch, getPageText]);

  const handleDeleteBook = useCallback(async (bookId) => {
    await deleteBook(bookId);
    setBooks(prev => prev.filter(b => b.id !== bookId));
    if (currentBookId === bookId) { batch.cancel(); setPhase('home'); }
  }, [currentBookId, batch]);

  const handleExtendRange = useCallback(async (additionalPages) => {
    const newEnd = Math.min((endPage || totalPages) + additionalPages, totalPages);
    setEndPage(newEnd);
    if (currentBookId) {
      await updateBook(currentBookId, { endPage: newEnd });
      setBooks(prev => prev.map(b => b.id === currentBookId ? { ...b, endPage: newEnd } : b));
    }
    // Uruchom batch dla nowych stron
    if (pdfDocRef.current && getPageTextRef.current) {
      batch.start(pdfDocRef.current, (endPage || totalPages) + 1, newEnd, language, getPageTextRef.current);
    }
  }, [endPage, totalPages, currentBookId, language, batch]);

  const handleAddImage = useCallback(async (pageNum, files) => {
    const dataUrls = await Promise.all(files.map(fileToDataURL));
    setPageImages(prev => ({ ...prev, [pageNum]: [...(prev[pageNum] || []), ...dataUrls] }));
  }, []);

  const handleRemoveImage = useCallback((pageNum, idx) => {
    setPageImages(prev => ({ ...prev, [pageNum]: (prev[pageNum] || []).filter((_, i) => i !== idx) }));
  }, []);

  return (
    <div className="app-layout">
      <Header
        language={language}
        onLanguageChange={setLanguage}
        headerImage={headerImage}
        onHeaderImageChange={setHeaderImage}
        exportButton={phase === 'reading' && !batch.running && (
          <ExportButton language={language} bookTitle={bookTitle} pageImages={pageImages} />
        )}
      />

      {phase === 'home' && (
        <div className="home-screen">
          <StorageBar onFolderSet={() => {}} />
          {!loadingLibrary && (
            <Library books={books} onOpen={handleOpenBook} onDelete={handleDeleteBook} />
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {!batch.running && (
                <button
                  className="btn-nav"
                  style={{ minWidth: 'auto', padding: '6px 16px', fontSize: '0.78rem', borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
                  onClick={() => {
                    if (pdfDocRef.current && getPageTextRef.current) {
                      batch.reset();
                      batch.start(pdfDocRef.current, startPage, endPage || totalPages, language, getPageTextRef.current, currentBookBase);
                    }
                  }}
                >
                  ↻ Przetłumacz wszystko
                </button>
              )}
              {syncStatus === 'saving' && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Zapisuję…</span>}
              {syncStatus === 'ok'     && <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>✓ Dysk</span>}
              {syncStatus === 'error'  && <span style={{ fontSize: '0.75rem', color: '#e07080' }}>⚠ Błąd zapisu</span>}
            </div>
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
            bookBase={currentBookBase}
          />
        </>
      )}
    </div>
  );
}
