import { useState, useEffect } from 'react';
import { getChapterVersions, getVersion, deleteVersion } from '../services/writerApi.js';

export default function ChapterVersions({ chapter, onRestore }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!chapter) return;
    setLoading(true);
    setPreview(null);
    getChapterVersions(chapter.id).then(setVersions).finally(() => setLoading(false));
  }, [chapter?.id]);

  async function handlePreview(v) {
    const full = await getVersion(v.id);
    setPreview(full);
  }

  async function handleRestore(v) {
    if (!window.confirm('Przywrócić tę wersję? Bieżąca treść rozdziału zostanie zastąpiona.')) return;
    const full = preview?.id === v.id ? preview : await getVersion(v.id);
    onRestore(full);
  }

  async function handleDelete(v) {
    if (!window.confirm('Usunąć tę wersję?')) return;
    await deleteVersion(v.id);
    setVersions(vv => vv.filter(x => x.id !== v.id));
    if (preview?.id === v.id) setPreview(null);
  }

  function fmt(d) {
    return new Date(d).toLocaleString('pl-PL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  if (!chapter) {
    return <div className="versions-empty">Wybierz rozdział, aby zobaczyć historię wersji.</div>;
  }

  return (
    <div className="versions-panel">
      <div className="panel-title">Historia wersji</div>
      <div className="versions-hint">
        Wersja jest zapisywana przy każdym kliknięciu „Zapisz teraz".
      </div>

      {loading && <div className="versions-loading">Ładowanie…</div>}

      {!loading && versions.length === 0 && (
        <div className="versions-empty">
          Brak zapisanych wersji. Kliknij „Zapisz teraz" w edytorze, aby stworzyć wersję.
        </div>
      )}

      <div className="versions-list">
        {versions.map(v => (
          <div key={v.id} className={`version-item${preview?.id === v.id ? ' selected' : ''}`}>
            <div className="version-date">{fmt(v.created_at)}</div>
            <div className="version-words">{v.word_count || 0} słów</div>
            <div className="version-actions">
              <button className="btn-ghost-sm" onClick={() => handlePreview(v)}>Podgląd</button>
              <button className="btn-primary-sm" onClick={() => handleRestore(v)}>Przywróć</button>
              <button className="btn-icon-danger" onClick={() => handleDelete(v)} title="Usuń">×</button>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div className="version-preview">
          <div className="version-preview-header">
            <span>Podgląd — {fmt(preview.created_at)}</span>
            <button className="btn-ghost-sm" onClick={() => setPreview(null)}>Zamknij</button>
          </div>
          <div
            className="version-preview-content"
            dangerouslySetInnerHTML={{ __html: preview.content_html || '<em>(brak treści)</em>' }}
          />
        </div>
      )}
    </div>
  );
}
