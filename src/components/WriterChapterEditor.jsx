import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { updateChapter } from '../services/writerApi.js';

const AUTOSAVE_DELAY = 3000;

export default function WriterChapterEditor({ chapter, onWordCountChange }) {
  const [title, setTitle] = useState(chapter.title);
  const [saveStatus, setSaveStatus] = useState('saved');
  const autosaveTimer = useRef(null);
  const latestChapter = useRef(chapter);
  const latestTitle = useRef(chapter.title);
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
    if (editor && chapter.id !== latestChapter.current?.id) {
      try {
        const j = chapter.content_json;
        const content = (j && j !== '{}') ? JSON.parse(j) : (chapter.content_html || '');
        editor.commands.setContent(content, false);
      } catch {
        editor.commands.setContent(chapter.content_html || '', false);
      }
    }
    setTitle(chapter.title);
    latestTitle.current = chapter.title;
    setSaveStatus('saved');
  }, [chapter.id]);

  useEffect(() => {
    latestTitle.current = title;
  }, [title]);

  const scheduleAutosave = useCallback((ed) => {
    setSaveStatus('dirty');
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => save(ed), AUTOSAVE_DELAY);
  }, []);

  async function save(ed) {
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
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  function saveNow() {
    clearTimeout(autosaveTimer.current);
    save(editor);
  }

  function handleTitleChange(e) {
    setTitle(e.target.value);
    latestTitle.current = e.target.value;
    scheduleAutosave(editor);
  }

  function insertText(text) {
    editor?.commands.insertContent(text);
  }

  const statusLabel = {
    saved: 'Zapisano',
    dirty: 'Niezapisane…',
    saving: 'Zapisywanie…',
    error: 'Błąd zapisu',
  };

  const wordCount = editor?.storage.characterCount?.words?.() || 0;

  return (
    <div className="chapter-editor">
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
          <button className="btn-ghost-sm" onClick={saveNow}>Zapisz teraz</button>
        </div>
      </div>

      <div className="tiptap-toolbar">
        <button onClick={() => editor?.chain().focus().toggleBold().run()} className={editor?.isActive('bold') ? 'active' : ''} title="Pogrubienie">B</button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={editor?.isActive('italic') ? 'active' : ''} title="Kursywa"><em>I</em></button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} className={editor?.isActive('heading', { level: 1 }) ? 'active' : ''} title="Nagłówek 1">H1</button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={editor?.isActive('heading', { level: 2 }) ? 'active' : ''} title="Nagłówek 2">H2</button>
        <button onClick={() => editor?.chain().focus().toggleBlockquote().run()} className={editor?.isActive('blockquote') ? 'active' : ''} title="Cytat">❝</button>
        <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className={editor?.isActive('bulletList') ? 'active' : ''} title="Lista">≡</button>
        <span className="toolbar-sep" />
        <button onClick={() => editor?.chain().focus().undo().run()} title="Cofnij">↩</button>
        <button onClick={() => editor?.chain().focus().redo().run()} title="Ponów">↪</button>
      </div>

      <EditorContent editor={editor} className="tiptap-content" />

      {/* expose selectedText and insertText to parent via ref-like pattern */}
      <input type="hidden" id="__chapter-selected-text" value={selectedText} readOnly />
    </div>
  );
}
