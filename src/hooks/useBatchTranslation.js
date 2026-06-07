import { useState, useCallback, useRef } from 'react';
import { analyzePage } from '../services/api.js';
import { savePageCacheToDisk } from '../services/fileSystem.js';

const cacheKey = (page, lang) => `uanna_page_${page}_${lang}`;

function hasValidCache(page, language) {
  try {
    const s = localStorage.getItem(cacheKey(page, language));
    if (!s) return false;
    const d = JSON.parse(s);
    return !!(d && d.polish_translation);
  } catch { return false; }
}

export function useBatchTranslation() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [errorList, setErrorList] = useState([]);
  const abortRef = useRef(false);

  const start = useCallback(async (pdfDoc, startPage, endPage, language, getPageText, bookBase) => {
    const pages = endPage - startPage + 1;
    setTotal(pages);
    setCurrent(0);
    setErrorList([]);
    setDone(false);
    setRunning(true);
    abortRef.current = false;

    for (let page = startPage; page <= endPage; page++) {
      if (abortRef.current) break;

      if (hasValidCache(page, language)) {
        setCurrent(prev => prev + 1);
        continue;
      }

      try {
        const text = await getPageText(pdfDoc, page);
        if (text.trim()) {
          const result = await analyzePage(text, language, page);
          localStorage.setItem(cacheKey(page, language), JSON.stringify(result));
          // Zapisz też na dysk – żeby przeżyło wyczyszczenie localStorage
          if (bookBase) savePageCacheToDisk(bookBase, page, language, result).catch(() => {});
        }
      } catch (e) {
        setErrorList(prev => [...prev, `s.${page}: ${e.message?.slice(0, 60) || 'błąd API'}`]);
      }

      setCurrent(prev => prev + 1);
      if (!abortRef.current) await new Promise(r => setTimeout(r, 400));
    }

    setRunning(false);
    setDone(!abortRef.current);
  }, []);

  const cancel = useCallback(() => { abortRef.current = true; }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setDone(false);
    setCurrent(0);
    setTotal(0);
    setErrorList([]);
    abortRef.current = false;
  }, []);

  return { start, cancel, reset, running, done, current, total, errors: errorList.length, errorList };
}
