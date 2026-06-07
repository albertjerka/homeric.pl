import { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export function usePDF() {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Z pliku → zwraca { doc, arrayBuffer }
  const loadPDF = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      return { doc, arrayBuffer };
    } catch (err) {
      setError('Nie udało się wczytać PDF: ' + err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Z ArrayBuffer (z IndexedDB) → zwraca doc
  const loadPDFFromBuffer = useCallback(async (arrayBuffer) => {
    setLoading(true);
    setError(null);
    try {
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      return doc;
    } catch (err) {
      setError('Nie udało się wczytać PDF: ' + err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPageText = useCallback(async (doc, pageNum) => {
    try {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      return content.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
    } catch { return ''; }
  }, []);

  const sampleTexts = useCallback(async (doc, language) => {
    const total = doc.numPages;
    const step = Math.max(1, Math.floor(total / 30));
    const pageNums = [];
    for (let i = 1; i <= total; i += step) pageNums.push(i);
    return Promise.all(pageNums.map(n => getPageText(doc, n)));
  }, [getPageText]);

  return { pdfDoc, totalPages, loading, error, loadPDF, loadPDFFromBuffer, getPageText, sampleTexts };
}
