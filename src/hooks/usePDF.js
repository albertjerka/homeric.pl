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
      // pdf.js transferuje buffer do workera – robimy kopię do zapisu
      const bufferForPDF = arrayBuffer.slice(0);
      const doc = await pdfjsLib.getDocument({ data: bufferForPDF }).promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      return { doc, arrayBuffer }; // oryginał do IndexedDB/dysku
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
      const items = content.items.filter(it => it.str != null);
      if (!items.length) return '';

      let text = '';
      for (let i = 0; i < items.length; i++) {
        const cur = items[i];
        text += cur.str;

        const nxt = items[i + 1];
        if (!nxt) continue;

        const curY   = cur.transform[5];
        const nxtY   = nxt.transform[5];
        const sameLine = Math.abs(curY - nxtY) < 3;

        if (!sameLine || cur.hasEOL) {
          // Nowa linia
          text += ' ';
          continue;
        }

        // Sprawdź czy między elementami jest odstęp (spacja)
        const curRight = cur.transform[4] + (cur.width || 0);
        const nxtLeft  = nxt.transform[4];
        const gap      = nxtLeft - curRight;
        const charW    = cur.str.length > 0 ? (cur.width || 0) / cur.str.length : 4;

        // Jeśli odstęp > 30% szerokości znaku → spacja, inaczej sklejamy
        if (gap > charW * 0.3) {
          text += ' ';
        }
      }

      return text.replace(/\s+/g, ' ').trim();
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
