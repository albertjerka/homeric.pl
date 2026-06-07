import { useState, useCallback, useRef } from 'react';
import { analyzePage } from '../services/api.js';

const cacheKey = (page, lang) => `uanna_page_${page}_${lang}`;

export function useBatchTranslation() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState(0);
  const abortRef = useRef(false);

  const start = useCallback(async (pdfDoc, startPage, endPage, language, getPageText) => {
    const pages = endPage - startPage + 1;
    setTotal(pages);
    setCurrent(0);
    setErrors(0);
    setDone(false);
    setRunning(true);
    abortRef.current = false;

    for (let page = startPage; page <= endPage; page++) {
      if (abortRef.current) break;

      // Pomiń jeśli już w cache
      if (localStorage.getItem(cacheKey(page, language))) {
        setCurrent(prev => prev + 1);
        continue;
      }

      try {
        const text = await getPageText(pdfDoc, page);
        if (text.trim()) {
          const result = await analyzePage(text, language, page);
          localStorage.setItem(cacheKey(page, language), JSON.stringify(result));
        }
      } catch {
        setErrors(prev => prev + 1);
      }

      setCurrent(prev => prev + 1);

      // Krótka przerwa między wywołaniami API
      if (!abortRef.current) await new Promise(r => setTimeout(r, 400));
    }

    setRunning(false);
    setDone(!abortRef.current);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setDone(false);
    setCurrent(0);
    setTotal(0);
    setErrors(0);
    abortRef.current = false;
  }, []);

  return { start, cancel, reset, running, done, current, total, errors };
}
