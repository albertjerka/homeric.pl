import { useState } from 'react';
import CharacterPlaceModal from './CharacterPlaceModal.jsx';
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

function EntityCard({ item, type, onEdit, onDelete }) {
  return (
    <div className="entity-card">
      <div className="entity-card-main" onClick={() => onEdit(item)}>
        <div className="entity-card-name">{item.name}</div>
        {item.description && (
          <div className="entity-card-desc">{item.description.slice(0, 80)}{item.description.length > 80 ? '…' : ''}</div>
        )}
      </div>
      <div className="entity-card-actions">
        <button className="icon-btn" title="Edytuj" onClick={() => onEdit(item)}>✏</button>
        <button className="icon-btn danger" title="Usuń" onClick={() => onDelete(item.id)}>×</button>
      </div>
    </div>
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
  const [modal, setModal] = useState(null); // { type: 'character'|'place', item: null|{...} }

  async function addChapter(title) {
    const ch = await createChapter(project.id, { title });
    onChaptersChange([...chapters, ch]);
    onSelectChapter(ch);
  }

  async function removeChapter(id) {
    if (!window.confirm('Usunąć ten rozdział? Treść zostanie bezpowrotnie utracona.')) return;
    await deleteChapter(id);
    onChaptersChange(chapters.filter(c => c.id !== id));
    if (activeChapterId === id) onSelectChapter(null);
  }

  async function saveCharacter(data) {
    if (modal.item?.id) {
      await updateCharacter(modal.item.id, data);
      onCharactersChange(characters.map(c => c.id === modal.item.id ? { ...c, ...data } : c));
    } else {
      const ch = await createCharacter(project.id, data);
      onCharactersChange([...characters, ch]);
    }
  }

  async function removeCharacter(id) {
    if (!window.confirm('Usunąć tę postać?')) return;
    await deleteCharacter(id);
    onCharactersChange(characters.filter(c => c.id !== id));
  }

  async function savePlace(data) {
    if (modal.item?.id) {
      await updatePlace(modal.item.id, data);
      onPlacesChange(places.map(p => p.id === modal.item.id ? { ...p, ...data } : p));
    } else {
      const pl = await createPlace(project.id, data);
      onPlacesChange([...places, pl]);
    }
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
                <span className="chapter-words">{ch.word_count || 0}w</span>
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
          <div className="entity-list-scroll">
            {characters.length === 0 && <div className="no-items">Brak postaci</div>}
            {characters.map(c => (
              <EntityCard
                key={c.id}
                item={c}
                type="character"
                onEdit={item => setModal({ type: 'character', item })}
                onDelete={removeCharacter}
              />
            ))}
          </div>
          <div className="entity-add-bar">
            <button className="btn-primary-sm" onClick={() => setModal({ type: 'character', item: null })}>
              + Nowa postać
            </button>
          </div>
        </div>
      )}

      {tab === 'places' && (
        <div className="sidebar-section">
          <div className="entity-list-scroll">
            {places.length === 0 && <div className="no-items">Brak miejsc</div>}
            {places.map(p => (
              <EntityCard
                key={p.id}
                item={p}
                type="place"
                onEdit={item => setModal({ type: 'place', item })}
                onDelete={removePlace}
              />
            ))}
          </div>
          <div className="entity-add-bar">
            <button className="btn-primary-sm" onClick={() => setModal({ type: 'place', item: null })}>
              + Nowa lokalizacja
            </button>
          </div>
        </div>
      )}

      {modal && (
        <CharacterPlaceModal
          item={modal.item}
          type={modal.type}
          onSave={modal.type === 'character' ? saveCharacter : savePlace}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
