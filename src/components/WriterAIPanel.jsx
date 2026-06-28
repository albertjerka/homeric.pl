import { useState } from 'react';
import { aiAction } from '../services/writerApi.js';

const ACTIONS = [
  { key: 'improve_style', label: 'Popraw styl' },
  { key: 'expand_scene', label: 'Rozwiń scenę' },
  { key: 'archaic_tone', label: 'Nadaj ton archaiczny' },
  { key: 'propose_dialogue', label: 'Zaproponuj dialog' },
  { key: 'summarize_chapter', label: 'Streszcz rozdział' },
];

export default function WriterAIPanel({ selectedText, chapterText, projectId, chapterId, onInsert }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function handleAction(actionType) {
    const text = selectedText || chapterText;
    if (!text?.trim()) {
      setError('Zaznacz fragment tekstu lub upewnij się, że rozdział ma treść.');
      return;
    }
    setLoading(true);
    setError('');
    setResult('');
    try {
      const r = await aiAction({
        action_type: actionType,
        selected_text: selectedText || undefined,
        chapter_context: selectedText ? undefined : chapterText,
        project_id: projectId,
        chapter_id: chapterId,
      });
      setResult(r.result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ai-panel">
      <div className="panel-title">Asystent Pisarza</div>

      {selectedText && (
        <div className="ai-selected-preview">
          <span className="ai-label">Zaznaczony tekst:</span>
          <p>{selectedText.slice(0, 120)}{selectedText.length > 120 ? '…' : ''}</p>
        </div>
      )}

      {!selectedText && (
        <p className="ai-hint">Zaznacz fragment tekstu w edytorze lub działaj na całym rozdziale.</p>
      )}

      <div className="ai-actions">
        {ACTIONS.map(a => (
          <button
            key={a.key}
            className="btn-ai"
            disabled={loading}
            onClick={() => handleAction(a.key)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {loading && <div className="ai-loading">Claude pisze…</div>}
      {error && <div className="ai-error">{error}</div>}

      {result && (
        <div className="ai-result">
          <div className="ai-result-header">
            <span>Wynik:</span>
            {onInsert && (
              <button className="btn-primary-sm" onClick={() => onInsert(result)}>
                Wstaw do rozdziału
              </button>
            )}
          </div>
          <div className="ai-result-text">{result}</div>
        </div>
      )}
    </div>
  );
}
