import { useState, useEffect, useRef } from 'react';
import { getChapters, getChapter, getCharacters, getPlaces } from '../services/writerApi.js';
import WriterSidebar from './WriterSidebar.jsx';
import WriterChapterEditor from './WriterChapterEditor.jsx';
import LindePanel from './LindePanel.jsx';
import WriterAIPanel from './WriterAIPanel.jsx';

export default function WriterProjectEditor({ project, onBack }) {
  const [chapters, setChapters] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [places, setPlaces] = useState([]);
  const [activeChapter, setActiveChapter] = useState(null);
  const [rightPanel, setRightPanel] = useState('linde');
  const [selectedText, setSelectedText] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const pollingRef = useRef(null);

  useEffect(() => {
    getChapters(project.id).then(chs => {
      setChapters(chs);
      if (chs.length > 0) loadChapter(chs[0]);
    });
    getCharacters(project.id).then(setCharacters);
    getPlaces(project.id).then(setPlaces);
  }, [project.id]);

  // Poll selectedText from hidden input (set by WriterChapterEditor)
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      const el = document.getElementById('__chapter-selected-text');
      if (el) setSelectedText(el.value);
    }, 500);
    return () => clearInterval(pollingRef.current);
  }, []);

  async function loadChapter(ch) {
    const full = await getChapter(ch.id);
    setActiveChapter(full);
  }

  function handleSelectChapter(ch) {
    if (!ch) { setActiveChapter(null); return; }
    loadChapter(ch);
  }

  function handleInsert(text) {
    // Dispatch to editor via custom event
    window.dispatchEvent(new CustomEvent('writer:insert', { detail: text }));
  }

  return (
    <div className="writer-editor-layout">
      <WriterSidebar
        project={project}
        chapters={chapters}
        characters={characters}
        places={places}
        activeChapterId={activeChapter?.id}
        onSelectChapter={handleSelectChapter}
        onChaptersChange={setChapters}
        onCharactersChange={setCharacters}
        onPlacesChange={setPlaces}
        onBack={onBack}
      />

      <main className="writer-main">
        {activeChapter ? (
          <WriterChapterEditor
            key={activeChapter.id}
            chapter={activeChapter}
            onWordCountChange={setWordCount}
          />
        ) : (
          <div className="writer-no-chapter">
            <p>Wybierz rozdział z panelu po lewej lub dodaj nowy.</p>
          </div>
        )}
      </main>

      <aside className="writer-right">
        <div className="right-panel-tabs">
          <button className={rightPanel === 'linde' ? 'active' : ''} onClick={() => setRightPanel('linde')}>
            Słownik Lindego
          </button>
          <button className={rightPanel === 'ai' ? 'active' : ''} onClick={() => setRightPanel('ai')}>
            AI
          </button>
        </div>

        {rightPanel === 'linde' && (
          <LindePanel onInsertQuote={handleInsert} />
        )}
        {rightPanel === 'ai' && (
          <WriterAIPanel
            selectedText={selectedText}
            chapterText={activeChapter?.content_text || ''}
            projectId={project.id}
            chapterId={activeChapter?.id}
            onInsert={handleInsert}
          />
        )}
      </aside>
    </div>
  );
}
