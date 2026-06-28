import { useState, useRef } from 'react';
import { aiAction } from '../services/writerApi.js';

const ACTIONS = [
  {
    key: 'improve_style',
    label: 'Popraw styl',
    icon: '✦',
    hint: 'Poprawi rytm zdań i podniesie jakość literacką zachowując sens.',
  },
  {
    key: 'expand_scene',
    label: 'Rozwiń scenę',
    icon: '⟳',
    hint: 'Doda opisy zmysłowe, emocje postaci i szczegóły miejsca.',
  },
  {
    key: 'archaic_tone',
    label: 'Nadaj ton archaiczny',
    icon: '⸸',
    hint: 'Przepisze na lekko archaiczny, literacki styl polski.',
  },
  {
    key: 'propose_dialogue',
    label: 'Zaproponuj dialog',
    icon: '❝',
    hint: 'Stworzy naturalny dialog pasujący do kontekstu sceny.',
  },
  {
    key: 'summarize_chapter',
    label: 'Streszcz rozdział',
    icon: '▤',
    hint: 'Napisze zwięzłe streszczenie w 3–5 zdaniach.',
  },
];

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function WriterAIPanel({ selectedText, chapterText, projectId, chapterId, onInsert }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [image, setImage] = useState(null); // { file, base64, type, previewUrl }
  const imageRef = useRef();

  async function handleAction(actionType) {
    await run({ action_type: actionType });
  }

  async function handleCustomPrompt(e) {
    e.preventDefault();
    if (!customPrompt.trim() && !image) return;
    await run({ action_type: 'custom', instruction: customPrompt });
  }

  async function run({ action_type, instruction }) {
    const text = selectedText || chapterText;
    if (!text?.trim() && !image) {
      setError('Zaznacz fragment tekstu, upewnij się że rozdział ma treść, lub wgraj obrazek.');
      return;
    }
    setLoading(true);
    setError('');
    setResult('');
    try {
      const payload = {
        action_type,
        instruction: instruction || undefined,
        selected_text: selectedText || undefined,
        chapter_context: selectedText ? undefined : (text || undefined),
        project_id: projectId,
        chapter_id: chapterId,
      };
      if (image) {
        payload.image_base64 = image.base64;
        payload.image_media_type = image.type;
      }
      const r = await aiAction(payload);
      setResult(r.result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await toBase64(file);
    const previewUrl = URL.createObjectURL(file);
    setImage({ file, base64, type: file.type, previewUrl });
  }

  function removeImage() {
    if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    if (imageRef.current) imageRef.current.value = '';
  }

  return (
    <div className="ai-panel homer-ai">
      <div className="homer-ai-header">
        <div className="homer-ai-logo">
          <span className="homer-ai-symbol">Η</span>
          <div>
            <div className="homer-ai-name">Homer AI</div>
            <div className="homer-ai-sub">Asystent Pisarza</div>
          </div>
        </div>
      </div>

      {selectedText ? (
        <div className="ai-selected-preview">
          <span className="ai-label">Zaznaczony fragment:</span>
          <p>{selectedText.slice(0, 150)}{selectedText.length > 150 ? '…' : ''}</p>
        </div>
      ) : (
        <p className="ai-hint">Zaznacz fragment w edytorze lub Homer AI użyje całego rozdziału.</p>
      )}

      <div className="homer-actions">
        {ACTIONS.map(a => (
          <button
            key={a.key}
            className="homer-btn"
            disabled={loading}
            onClick={() => handleAction(a.key)}
            title={a.hint}
          >
            <span className="homer-btn-icon">{a.icon}</span>
            <span className="homer-btn-label">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="homer-divider">lub napisz własny prompt</div>

      <form className="homer-prompt-form" onSubmit={handleCustomPrompt}>
        <textarea
          className="homer-prompt-input"
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          placeholder="Napisz instrukcję dla Homer AI po polsku... np. Opisz tę scenę widzianą oczami dziecka - lub: Znajdź archaizmy i zaproponuj nowoczesne odpowiedniki"
          rows={4}
        />

        <div className="homer-prompt-actions">
          <label className="homer-image-btn" title="Wgraj zdjęcie lub screenshot">
            {image ? '📷 Zmień obraz' : '🖼 Wgraj obraz'}
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageChange}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={loading || (!customPrompt.trim() && !image)}>
            {loading ? 'Homer pisze…' : 'Wyślij'}
          </button>
        </div>

        {image && (
          <div className="homer-image-preview">
            <img src={image.previewUrl} alt="Podgląd" />
            <button type="button" className="homer-image-remove" onClick={removeImage} title="Usuń obraz">✕</button>
          </div>
        )}
      </form>

      {loading && (
        <div className="homer-loading">
          <span className="homer-loading-dot" />
          Homer AI pisze odpowiedź…
        </div>
      )}

      {error && <div className="ai-error">{error}</div>}

      {result && (
        <div className="ai-result">
          <div className="ai-result-header">
            <span>Odpowiedź Homer AI:</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {onInsert && (
                <button className="btn-primary-sm" onClick={() => onInsert(result)}>
                  Wstaw do rozdziału
                </button>
              )}
              <button
                className="btn-ghost-sm"
                onClick={() => navigator.clipboard?.writeText(result).catch(() => {})}
              >
                Kopiuj
              </button>
            </div>
          </div>
          <div className="ai-result-text">{result}</div>
        </div>
      )}
    </div>
  );
}
