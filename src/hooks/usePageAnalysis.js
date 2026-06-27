import { useState, useCallback, useRef } from 'react';
import { analyzePage, generateImagePrompt } from '../services/api.js';
import { getPage, savePage } from '../services/dbApi.js';

function isValid(data) {
  return data && !!data.polish_translation;
}

export function usePageAnalysis(bookId) {
  const [memCache, setMemCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(new Set());
  const promptInFlight = useRef(new Set());

  const getAnalysis = useCallback(async (pageText, language, pageNumber) => {
    const key = `${pageNumber}-${language}`;
    if (memCache[key] && isValid(memCache[key])) return memCache[key];

    // Sprawdź bazę danych
    if (bookId) {
      try {
        const stored = await getPage(bookId, pageNumber, language);
        if (stored && isValid(stored)) {
          setMemCache(prev => ({ ...prev, [key]: stored }));
          return stored;
        }
      } catch {}
    }

    if (inFlight.current.has(key)) return null;
    inFlight.current.add(key);
    setLoading(true);
    setError(null);

    try {
      const result = await analyzePage(pageText, language, pageNumber);
      persist(key, pageNumber, language, result, bookId, setMemCache);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      inFlight.current.delete(key);
      setLoading(false);
    }
  }, [memCache, bookId]);

  const ensureImagePrompt = useCallback(async (pageText, language, pageNumber) => {
    const key = `${pageNumber}-${language}`;
    const current = memCache[key];
    if (!current || current.image_prompt) return;
    if (promptInFlight.current.has(key)) return;

    promptInFlight.current.add(key);
    try {
      const prompt = await generateImagePrompt(pageText, language, pageNumber);
      const updated = { ...current, image_prompt: prompt };
      persist(key, pageNumber, language, updated, bookId, setMemCache);
    } catch {
      // prompt opcjonalny
    } finally {
      promptInFlight.current.delete(key);
    }
  }, [memCache, bookId]);

  const getCached = useCallback((pageNumber, language) => {
    return memCache[`${pageNumber}-${language}`] ?? null;
  }, [memCache]);

  const preloadCache = useCallback(async (allPages) => {
    if (!allPages) return;
    const entries = {};
    Object.entries(allPages).forEach(([page, data]) => {
      if (isValid(data)) entries[`${page}-${data._lang || ''}`] = data;
    });
    setMemCache(prev => ({ ...prev, ...entries }));
  }, []);

  const loadCacheFromDB = useCallback(async (id, language) => {
    if (!id) return;
    try {
      const { getAllPages } = await import('../services/dbApi.js');
      const all = await getAllPages(id, language);
      const entries = {};
      Object.entries(all).forEach(([page, data]) => {
        if (isValid(data)) entries[`${page}-${language}`] = data;
      });
      setMemCache(prev => ({ ...prev, ...entries }));
    } catch {}
  }, []);

  return { getAnalysis, getCached, ensureImagePrompt, preloadCache, loadCacheFromDB, loading, error };
}

function persist(key, pageNumber, language, result, bookId, setMemCache) {
  setMemCache(prev => ({ ...prev, [key]: result }));
  if (bookId) savePage(bookId, pageNumber, language, result).catch(() => {});
}
