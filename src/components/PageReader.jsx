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
  const { getAnalysis, getCached, loading: analysisLoading, error } = usePageAnalysis(bookBase);

  const analysis = getCached(currentPage, language);
  const lastPage = endPage || totalPages;
  const atEnd = currentPage >= lastPage;

  useEffect(() => {
    if (!pdfDoc || !currentPage) return;
    setTextLoading(true);
    getPageText(pdfDoc, currentPage).then(text => {
      setPageText(text);
      setTextLoading(false);
      if (text.trim() && !getCached(currentPage, language)) {
        getAnalysis(text, language, currentPage);
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
