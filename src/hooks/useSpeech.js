import { useState, useCallback, useEffect, useRef } from 'react';

const VOICE_PREFS = {
  ru: ['Yuri', 'Milena', 'ru-RU', 'ru'],
  en: ['Daniel', 'Samantha', 'en-US', 'en'],
};

function pickVoice(language) {
  const voices = window.speechSynthesis?.getVoices() || [];
  const prefs = VOICE_PREFS[language] || [];
  for (const pref of prefs) {
    const found = voices.find(v => v.name === pref || v.lang.startsWith(pref));
    if (found) return found;
  }
  return null;
}

export function useSpeech(language) {
  const [speaking, setSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState(null);
  const activeKey = useRef(null);

  const lang = language === 'ru' ? 'ru-RU' : 'en-US';

  // Głosy ładują się asynchronicznie – czekamy na zdarzenie
  useEffect(() => {
    window.speechSynthesis?.getVoices(); // trigger load
    window.speechSynthesis?.addEventListener('voiceschanged', () => {});
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  const speak = useCallback((text, rate = 0.85) => {
    if (!window.speechSynthesis) return;

    // Kliknięcie tego samego → stop
    if (activeKey.current === text && speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setCurrentText(null);
      activeKey.current = null;
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;

    const voice = pickVoice(language);
    if (voice) utterance.voice = voice;

    activeKey.current = text;
    utterance.onstart = () => { setSpeaking(true); setCurrentText(text); };
    utterance.onend   = () => { setSpeaking(false); setCurrentText(null); activeKey.current = null; };
    utterance.onerror = () => { setSpeaking(false); setCurrentText(null); activeKey.current = null; };

    window.speechSynthesis.speak(utterance);
  }, [lang, language, speaking]);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setCurrentText(null);
    activeKey.current = null;
  }, []);

  return { speak, stop, speaking, currentText };
}
