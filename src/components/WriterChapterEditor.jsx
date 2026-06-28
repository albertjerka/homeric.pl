import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { updateChapter } from '../services/writerApi.js';

const AUTOSAVE_DELAY = 3000;

export default function WriterChapterEditor({ chapter, onWordCountChange, fullscreen, onToggleFullscreen }) {
  const [title, setTitle] = useState(chapter.title);
  const [notes, setNotes] = useState(chapter.notes || '');
  const [showNotes, setShowNotes] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const autosaveTimer = useRef(null);
  const latestChapter = useRef(chapter);
  const latestTitle = useRef(chapter.title);
  const latestNotes = useRef(chapter.notes || '');
  const [selectedText, setSelectedText] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Zacznij pisać swój rozdział…' }),
      CharacterCount,
    ],
    content: (() => {
      try {
        const j = chapter.content_json;
        if (j && j !== '{}' && j !== '') return JSON.parse(j);
      } catch {}
      return chapter.content_html || '';
    })(),
    onUpdate: ({ editor }) => {
      scheduleAutosave(editor);
      const words = editor.storage.characterCount?.words?.() || 0;
      onWordCountChange?.(words);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        setSelectedText(editor.state.doc.textBetween(from, to, ' '));
      } else {
        setSelectedText('');
      }
    },
  });

  useEffect(() => {
    latestChapter.current = chapter;
    if (editor) {
      try {
        const j = chapter.content_json;
        const content = (j && j !== '{}') ? JSON.parse(j) : (chapter.content_html || '');
        editor.commands.setContent(content, false);
      } catch {
        editor.commands.setContent(chapter.content_html || '', false);
      }
    }
    setTitle(chapter.title);
    setNotes(chapter.notes || '');
    latestTitle.current = chapter.title;
    latestNotes.current = chapter.notes || '';
    setSaveStatus('saved');
  }, [chapter.id]);

  useEffect(() => { latestTitle.current = title; }, [title]);
  useEffect(() => { latestNotes.current = notes; }, [notes]);

  const scheduleAutosave = useCallback((ed) => {
    setSaveStatus('dirty');
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => save(ed, false), AUTOSAVE_DELAY);
  }, []);

  async function save(ed, saveVersion = false) {
    if (!ed) return;
    setSaveStatus('saving');
    const json = JSON.stringify(ed.getJSON());
    const html = ed.getHTML();
    const text = ed.getText();
    const words = ed.storage.characterCount?.words?.() || 0;
    try {
      await updateChapter(latestChapter.current.id, {
        title: latestTitle.current,
        content_json: json,
        content_html: html,
        content_text: text,
        word_count: words,
        notes: latestNotes.current,
        save_version: saveVersion,
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  function saveNow() {
    clearTimeout(autosaveTimer.current);
    save(editor, true); // save_version = true on explicit save
  }

  function handleTitleChange(e) {
    setTitle(e.target.value);
    latestTitle.current = e.target.value;
    scheduleAutosave(editor);
  }

  function handleNotesChange(e) {
    setNotes(e.target.value);
    latestNotes.current = e.target.value;
    scheduleAutosave(editor);
  }

  const statusLabel = {
    saved: 'Zapisano ✓',
    dirty: 'Niezapisane…',
    saving: 'Zapisywanie…',
    error: 'Błąd zapisu',
  };

  const wordCount = editor?.storage.characterCount?.words?.() || 0;

  return (
    <div className={`chapter-editor${fullscreen ? ' fullscreen' : ''}`}>
      <div className="chapter-editor-toolbar">
        <input
          className="chapter-title-input"
          value={title}
          onChange={handleTitleChange}
          placeholder="Tytuł rozdziału"
        />
        <div className="chapter-meta">
          <span className="word-count">{wordCount.toLocaleString('pl-PL')} słów</span>
          <span className={`save-status save-${saveStatus}`}>{statusLabel[saveStatus]}</span>
          <button className="btn-ghost-sm" onClick={saveNow}>Zapisz wersję</button>
          <button
            className={`btn-ghost-sm${showNotes ? ' active-notes' : ''}`}
            onClick={() => setShowNotes(s => !s)}
            title="Notatki do rozdziału"
          >
            📝
          </button>
          <button
            className="btn-ghost-sm"
            onClick={onToggleFullscreen}
            title={fullscreen ? 'Wyjdź z pełnego ekranu' : 'Pełny ekran'}
          >
            {fullscreen ? '⊡' : '⊞'}
          </button>
        </div>
      </div>

      {showNotes && (
        <div className="chapter-notes">
          <textarea
            value={notes}
            onChange={handleNotesChange}
            placeholder="Notatki do tej sceny: pomysły, pytania, TODO, cytaty ze źródeł…"
            className="chapter-notes-textarea"
            rows={4}
          />
        </div>
      )}

      <div className="tiptap-toolbar">
        <button onClick={() => editor?.chain().focus().toggleBold().run()} className={editor?.isActive('bold') ? 'active' : ''} title="Pogrubienie"><strong>B</strong></button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={editor?.isActive('italic') ? 'active' : ''} title="Kursywa"><em>I</em></button>
        <button onClick={() => editor?.chain().focus().toggleStrike().run()} className={editor?.isActive('strike') ? 'active' : ''} title="Przekreślenie"><s>S</s></button>
        <span className="toolbar-sep" />
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} className={editor?.isActive('heading', { level: 1 }) ? 'active' : ''} title="Nagłówek 1">H1</button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={editor?.isActive('heading', { level: 2 }) ? 'active' : ''} title="Nagłówek 2">H2</button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className={editor?.isActive('heading', { level: 3 }) ? 'active' : ''} title="Nagłówek 3">H3</button>
        <span className="toolbar-sep" />
        <button onClick={() => editor?.chain().focus().toggleBlockquote().run()} className={editor?.isActive('blockquote') ? 'active' : ''} title="Cytat">❝</button>
        <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className={editor?.isActive('bulletList') ? 'active' : ''} title="Lista punktowana">•≡</button>
        <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={editor?.isActive('orderedList') ? 'active' : ''} title="Lista numerowana">1≡</button>
        <button onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Linia pozioma">—</button>
        <span className="toolbar-sep" />
        <button onClick={() => editor?.chain().focus().undo().run()} title="Cofnij">↩</button>
        <button onClick={() => editor?.chain().focus().redo().run()} title="Ponów">↪</button>
      </div>

      <EditorContent editor={editor} className="tiptap-content" />

      <input type="hidden" id="__chapter-selected-text" value={selectedText} readOnly />
    </div>
  );
}
