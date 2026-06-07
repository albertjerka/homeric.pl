import { useState, useCallback, useRef } from 'react';
import { analyzePage } from '../services/api.js';
import { savePageCacheToDisk } from '../services/fileSystem.js';

const lsKey = (page, lang) => `uanna_page_${page}_${lang}`;

export function usePageAnalysis(currentBookBase) {
  const [memCache, setMemCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(new Set());

  const getAnalysis = useCallback(async (pageText, language, pageNumber) => {
    const key = `${pageNumber}-${language}`;
    if (memCache[key]) return memCache[key];

    // localStorage
    try {
      const stored = localStorage.getItem(lsKey(pageNumber, language));
      if (stored) {
        const parsed = JSON.parse(stored);
        setMemCache(prev => ({ ...prev, [key]: parsed }));
        return parsed;
      }
    } catch {}

    if (inFlight.current.has(key)) return null;
    inFlight.current.add(key);
    setLoading(true);
    setError(null);

    try {
      const result = await analyzePage(pageText, language, pageNumber);

      // localStorage
      try { localStorage.setItem(lsKey(pageNumber, language), JSON.stringify(result)); } catch {}

      // Dysk (w tle, nie blokuje)
      if (currentBookBase) {
        savePageCacheToDisk(currentBookBase, pageNumber, language, result);
      }

      setMemCache(prev => ({ ...prev, [key]: result }));
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      inFlight.current.delete(key);
      setLoading(false);
    }
  }, [memCache, currentBookBase]);

  const getCached = useCallback((pageNumber, language) => {
    const key = `${pageNumber}-${language}`;
    if (memCache[key]) return memCache[key];
    try {
      const stored = localStorage.getItem(lsKey(pageNumber, language));
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  }, [memCache]);

  // Ładuje cały cache z dysku do localStorage (wywołaj przy otwarciu książki)
  const loadCacheFromDisk = useCallback(async (bookBase, language) => {
    try {
      const { loadPageCacheFromDisk } = await import('../services/fileSystem.js');
      const diskCache = await loadPageCacheFromDisk(bookBase, language);
      const entries = Object.entries(diskCache);
      if (!entries.length) return;
      entries.forEach(([page, data]) => {
        const k = lsKey(page, language);
        if (!localStorage.getItem(k)) {
          localStorage.setItem(k, JSON.stringify(data));
        }
      });
    } catch {}
  }, []);

  return { getAnalysis, getCached, loadCacheFromDisk, loading, error };
}
