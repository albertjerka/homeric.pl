import { useState, useCallback, useRef } from 'react';
import { analyzePage, generateImagePrompt } from '../services/api.js';
import { savePageCacheToDisk } from '../services/fileSystem.js';

const lsKey = (page, lang) => `uanna_page_${page}_${lang}`;

function isValid(data) {
  // Cache jest ważny jeśli ma tłumaczenie – image_prompt generujemy osobno
  return data && !!data.polish_translation;
}

export function usePageAnalysis(currentBookBase) {
  const [memCache, setMemCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(new Set());
  const promptInFlight = useRef(new Set());

  // Pobierz lub wykonaj pełną analizę strony
  const getAnalysis = useCallback(async (pageText, language, pageNumber) => {
    const key = `${pageNumber}-${language}`;
    if (memCache[key] && isValid(memCache[key])) return memCache[key];

    // Sprawdź localStorage
    try {
      const stored = localStorage.getItem(lsKey(pageNumber, language));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isValid(parsed)) {
          setMemCache(prev => ({ ...prev, [key]: parsed }));
          return parsed;
        }
      }
    } catch {}

    if (inFlight.current.has(key)) return null;
    inFlight.current.add(key);
    setLoading(true);
    setError(null);

    try {
      const result = await analyzePage(pageText, language, pageNumber);
      persistResult(key, pageNumber, language, result, currentBookBase, setMemCache);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      inFlight.current.delete(key);
      setLoading(false);
    }
  }, [memCache, currentBookBase]);

  // Dogenuj tylko image_prompt jeśli brakuje w istniejącej analizie
  const ensureImagePrompt = useCallback(async (pageText, language, pageNumber) => {
    const key = `${pageNumber}-${language}`;
    const current = memCache[key];
    if (!current || current.image_prompt) return; // już ma lub brak danych
    if (promptInFlight.current.has(key)) return;

    promptInFlight.current.add(key);
    try {
      const prompt = await generateImagePrompt(pageText, language, pageNumber);
      const updated = { ...current, image_prompt: prompt };
      persistResult(key, pageNumber, language, updated, currentBookBase, setMemCache);
    } catch {
      // nie blokuj — prompt opcjonalny
    } finally {
      promptInFlight.current.delete(key);
    }
  }, [memCache, currentBookBase]);

  const getCached = useCallback((pageNumber, language) => {
    const key = `${pageNumber}-${language}`;
    if (memCache[key] && isValid(memCache[key])) return memCache[key];
    try {
      const stored = localStorage.getItem(lsKey(pageNumber, language));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isValid(parsed)) return parsed;
      }
    } catch {}
    return null;
  }, [memCache]);

  const loadCacheFromDisk = useCallback(async (bookBase, language) => {
    try {
      const { loadPageCacheFromDisk } = await import('../services/fileSystem.js');
      const diskCache = await loadPageCacheFromDisk(bookBase, language);
      Object.entries(diskCache).forEach(([page, data]) => {
        if (!isValid(data)) return;
        const k = lsKey(page, language);
        if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(data));
      });
    } catch {}
  }, []);

  return { getAnalysis, getCached, ensureImagePrompt, loadCacheFromDisk, loading, error };
}

function persistResult(key, pageNumber, language, result, bookBase, setMemCache) {
  try { localStorage.setItem(lsKey(pageNumber, language), JSON.stringify(result)); } catch {}
  if (bookBase) savePageCacheToDisk(bookBase, pageNumber, language, result).catch(() => {});
  setMemCache(prev => ({ ...prev, [key]: result }));
}
