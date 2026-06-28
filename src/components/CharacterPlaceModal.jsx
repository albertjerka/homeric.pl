import { useState } from 'react';

export default function CharacterPlaceModal({ item, type, onSave, onClose }) {
  const label = type === 'character' ? 'postaci' : 'miejsca';
  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave({ ...form, name: form.name.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{item?.id ? `Edytuj ${label}` : `Nowa ${type === 'character' ? 'postać' : 'lokalizacja'}`}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="writer-form">
          <label>Nazwa *
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={type === 'character' ? 'Imię i nazwisko' : 'Nazwa miejsca'}
              autoFocus
            />
          </label>
          <label>Opis
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={type === 'character' ? 'Wygląd, charakter, rola w historii…' : 'Opis miejsca, atmosfera, znaczenie…'}
              rows={4}
            />
          </label>
          <label>Notatki
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Dodatkowe notatki, pomysły, cytaty…"
              rows={3}
            />
          </label>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Anuluj</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Zapisuję…' : 'Zapisz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
