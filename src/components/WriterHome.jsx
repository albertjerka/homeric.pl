import { useState, useEffect } from 'react';
import { getProjects, createProject, deleteProject } from '../services/writerApi.js';

function NewProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ title: '', description: '', genre: '', language: 'pl', notes: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setErr('Tytuł jest wymagany'); return; }
    setSaving(true);
    try {
      const proj = await createProject(form);
      onCreate(proj);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Nowa książka</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="writer-form">
          <label>Tytuł *
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Tytuł twojej książki" autoFocus />
          </label>
          <label>Opis
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="O czym jest ta książka?" rows={3} />
          </label>
          <div className="form-row">
            <label>Gatunek
              <input value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} placeholder="np. powieść historyczna" />
            </label>
            <label>Język
              <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                <option value="pl">Polski</option>
                <option value="en">English</option>
                <option value="ru">Русский</option>
                <option value="uk">Українська</option>
              </select>
            </label>
          </div>
          <label>Notatki
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Inspiracje, zamysł, styl..." rows={3} />
          </label>
          {err && <div className="form-error">{err}</div>}
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Anuluj</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Tworzę…' : 'Utwórz książkę'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WriterHome({ onOpen, onBack }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    getProjects().then(setProjects).finally(() => setLoading(false));
  }, []);

  function handleCreate(proj) {
    setProjects(p => [proj, ...p]);
    setShowNew(false);
    onOpen(proj);
  }

  async function handleDelete(proj) {
    if (!window.confirm(`Usunąć projekt „${proj.title}"? Tej operacji nie można cofnąć.`)) return;
    setDeleting(proj.id);
    try {
      await deleteProject(proj.id);
      setProjects(p => p.filter(x => x.id !== proj.id));
    } finally {
      setDeleting(null);
    }
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className="writer-home">
      <div className="writer-home-header">
        <button className="btn-back" onClick={onBack}>← Dashboard</button>
        <h2>✒ Pisarz — Twoje książki</h2>
        <button className="btn-primary" onClick={() => setShowNew(true)}>+ Nowa książka</button>
      </div>

      {loading && <div className="writer-loading">Ładowanie projektów…</div>}

      {!loading && projects.length === 0 && (
        <div className="writer-empty">
          <div className="empty-icon">📖</div>
          <h3>Nie masz jeszcze żadnych projektów pisarskich</h3>
          <p>Zacznij swoją pierwszą książkę klikając „Nowa książka".</p>
          <button className="btn-primary" onClick={() => setShowNew(true)}>+ Nowa książka</button>
        </div>
      )}

      <div className="project-list">
        {projects.map(proj => (
          <div key={proj.id} className="project-card">
            <div className="project-card-body" onClick={() => onOpen(proj)}>
              <h3>{proj.title}</h3>
              {proj.description && <p className="project-desc">{proj.description}</p>}
              <div className="project-meta">
                {proj.genre && <span className="tag">{proj.genre}</span>}
                {proj.language && <span className="tag">{proj.language.toUpperCase()}</span>}
                <span className="tag">{(proj.word_count || 0).toLocaleString('pl-PL')} słów</span>
              </div>
              <div className="project-dates">
                <span>Utworzono: {formatDate(proj.created_at)}</span>
                <span>Edytowano: {formatDate(proj.updated_at)}</span>
              </div>
            </div>
            <div className="project-card-actions">
              <button className="btn-primary-sm" onClick={() => onOpen(proj)}>Otwórz</button>
              <button
                className="btn-danger-sm"
                onClick={() => handleDelete(proj)}
                disabled={deleting === proj.id}
              >
                {deleting === proj.id ? '…' : 'Usuń'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}
    </div>
  );
}
