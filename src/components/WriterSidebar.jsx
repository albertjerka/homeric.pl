import { useState } from 'react';
import {
  createChapter, deleteChapter,
  createCharacter, updateCharacter, deleteCharacter,
  createPlace, updatePlace, deletePlace,
} from '../services/writerApi.js';

function QuickAddForm({ placeholder, onAdd }) {
  const [val, setVal] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (!val.trim()) return;
    await onAdd(val.trim());
    setVal('');
  }
  return (
    <form className="quick-add-form" onSubmit={submit}>
      <input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} />
      <button type="submit" className="btn-primary-sm">+</button>
    </form>
  );
}

function EntityList({ items, onDelete, onUpdate, nameKey = 'name' }) {
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');

  function startEdit(item) {
    setEditing(item.id);
    setEditVal(item[nameKey]);
  }

  async function saveEdit(item) {
    await onUpdate(item.id, { ...item, [nameKey]: editVal });
    setEditing(null);
  }

  return (
    <ul className="entity-list">
      {items.map(item => (
        <li key={item.id} className="entity-item">
          {editing === item.id ? (
            <span className="entity-edit-row">
              <input value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus />
              <button className="btn-primary-sm" onClick={() => saveEdit(item)}>✓</button>
              <button className="btn-ghost-sm" onClick={() => setEditing(null)}>✕</button>
            </span>
          ) : (
            <span className="entity-name-row">
              <span className="entity-name">{item[nameKey]}</span>
              <button className="icon-btn" title="Edytuj" onClick={() => startEdit(item)}>✏</button>
              <button className="icon-btn danger" title="Usuń" onClick={() => onDelete(item.id)}>×</button>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function WriterSidebar({
  project,
  chapters,
  characters,
  places,
  activeChapterId,
  onSelectChapter,
  onChaptersChange,
  onCharactersChange,
  onPlacesChange,
  onBack,
}) {
  const [tab, setTab] = useState('chapters');

  async function addChapter(title) {
    const ch = await createChapter(project.id, { title });
    onChaptersChange([...chapters, ch]);
    onSelectChapter(ch);
  }

  async function removeChapter(id) {
    if (!window.confirm('Usunąć ten rozdział?')) return;
    await deleteChapter(id);
    onChaptersChange(chapters.filter(c => c.id !== id));
    if (activeChapterId === id) onSelectChapter(null);
  }

  async function addCharacter(name) {
    const ch = await createCharacter(project.id, { name });
    onCharactersChange([...characters, ch]);
  }

  async function handleUpdateCharacter(id, data) {
    await updateCharacter(id, data);
    onCharactersChange(characters.map(c => c.id === id ? { ...c, ...data } : c));
  }

  async function removeCharacter(id) {
    if (!window.confirm('Usunąć tę postać?')) return;
    await deleteCharacter(id);
    onCharactersChange(characters.filter(c => c.id !== id));
  }

  async function addPlace(name) {
    const pl = await createPlace(project.id, { name });
    onPlacesChange([...places, pl]);
  }

  async function handleUpdatePlace(id, data) {
    await updatePlace(id, data);
    onPlacesChange(places.map(p => p.id === id ? { ...p, ...data } : p));
  }

  async function removePlace(id) {
    if (!window.confirm('Usunąć to miejsce?')) return;
    await deletePlace(id);
    onPlacesChange(places.filter(p => p.id !== id));
  }

  return (
    <div className="writer-sidebar">
      <div className="sidebar-top">
        <button className="btn-back" onClick={onBack}>← Projekty</button>
        <div className="sidebar-project-title" title={project.title}>{project.title}</div>
      </div>

      <div className="sidebar-tabs">
        <button className={tab === 'chapters' ? 'active' : ''} onClick={() => setTab('chapters')}>Rozdziały</button>
        <button className={tab === 'characters' ? 'active' : ''} onClick={() => setTab('characters')}>Postacie</button>
        <button className={tab === 'places' ? 'active' : ''} onClick={() => setTab('places')}>Miejsca</button>
      </div>

      {tab === 'chapters' && (
        <div className="sidebar-section">
          <ul className="chapter-list">
            {chapters.map(ch => (
              <li
                key={ch.id}
                className={`chapter-item${activeChapterId === ch.id ? ' active' : ''}`}
                onClick={() => onSelectChapter(ch)}
              >
                <span className="chapter-title">{ch.title}</span>
                <span className="chapter-words">{ch.word_count || 0} słów</span>
                <button
                  className="icon-btn danger"
                  title="Usuń"
                  onClick={e => { e.stopPropagation(); removeChapter(ch.id); }}
                >×</button>
              </li>
            ))}
            {chapters.length === 0 && <li className="no-items">Brak rozdziałów</li>}
          </ul>
          <QuickAddForm placeholder="Tytuł nowego rozdziału…" onAdd={addChapter} />
        </div>
      )}

      {tab === 'characters' && (
        <div className="sidebar-section">
          <EntityList
            items={characters}
            onDelete={removeCharacter}
            onUpdate={handleUpdateCharacter}
          />
          <QuickAddForm placeholder="Imię postaci…" onAdd={addCharacter} />
        </div>
      )}

      {tab === 'places' && (
        <div className="sidebar-section">
          <EntityList
            items={places}
            onDelete={removePlace}
            onUpdate={handleUpdatePlace}
          />
          <QuickAddForm placeholder="Nazwa miejsca…" onAdd={addPlace} />
        </div>
      )}
    </div>
  );
}
