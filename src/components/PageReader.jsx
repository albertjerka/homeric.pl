import { useState, useEffect } from 'react';
import Navigation from './Navigation.jsx';
import PageView from './PageView.jsx';
import EndOfRangeBanner from './EndOfRangeBanner.jsx';
import { usePageAnalysis } from '../hooks/usePageAnalysis.js';

export default function PageReader({
  pdfDoc, currentPage, totalPages, startPage, endPage,
  language, pageImages, onPageChange, onAddImage, onRemoveImage,
  onExtendRange, getPageText, bookBase,
}) {
  const [pageText, setPageText] = useState('');
  const [textLoading, setTextLoading] = useState(false);
  const { getAnalysis, getCached, ensureImagePrompt, loading: analysisLoading, error } = usePageAnalysis(bookBase);

  const analysis = getCached(currentPage, language);
  const lastPage = endPage || totalPages;
  const atEnd = currentPage >= lastPage;

  useEffect(() => {
    if (!pdfDoc || !currentPage) return;
    setTextLoading(true);
    getPageText(pdfDoc, currentPage).then(text => {
      setPageText(text);
      setTextLoading(false);

      const cached = getCached(currentPage, language);
      if (text.trim()) {
        if (!cached) {
          // Brak analizy → pełna analiza (zawiera image_prompt)
          getAnalysis(text, language, currentPage);
        } else if (!cached.image_prompt) {
          // Jest analiza ale bez promptu → dogeneruj tylko prompt
          ensureImagePrompt(text, language, currentPage);
        }
      }
    });
  }, [pdfDoc, currentPage, language]);

  return (
    <div className="page-reader">
      <Navigation
        currentPage={currentPage}
        totalPages={totalPages}
        startPage={startPage}
        endPage={endPage}
        onNavigate={onPageChange}
        position="top"
      />

      <PageView
        pageText={pageText}
        analysis={analysis}
        loading={textLoading || analysisLoading}
        error={error}
        language={language}
        pageImages={pageImages[currentPage] || []}
        onAddImage={files => onAddImage(currentPage, files)}
        onRemoveImage={idx => onRemoveImage(currentPage, idx)}
      />

      {atEnd && (
        <EndOfRangeBanner currentPage={currentPage} onExtend={onExtendRange} />
      )}

      <Navigation
        currentPage={currentPage}
        totalPages={totalPages}
        startPage={startPage}
        endPage={endPage}
        onNavigate={onPageChange}
      />
    </div>
  );
}
