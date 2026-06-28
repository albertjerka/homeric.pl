import { useState, useEffect, useRef } from 'react';
import { getChapters, getChapter, getCharacters, getPlaces, exportProject } from '../services/writerApi.js';
import WriterSidebar from './WriterSidebar.jsx';
import WriterChapterEditor from './WriterChapterEditor.jsx';
import LindePanel from './LindePanel.jsx';
import WriterAIPanel from './WriterAIPanel.jsx';
import ChapterVersions from './ChapterVersions.jsx';

export default function WriterProjectEditor({ project, onBack }) {
  const [chapters, setChapters] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [places, setPlaces] = useState([]);
  const [activeChapter, setActiveChapter] = useState(null);
  const [rightPanel, setRightPanel] = useState('linde');
  const [selectedText, setSelectedText] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const pollingRef = useRef(null);

  useEffect(() => {
    getChapters(project.id).then(chs => {
      setChapters(chs);
      if (chs.length > 0) loadChapter(chs[0]);
    });
    getCharacters(project.id).then(setCharacters);
    getPlaces(project.id).then(setPlaces);
  }, [project.id]);

  useEffect(() => {
    pollingRef.current = setInterval(() => {
      const el = document.getElementById('__chapter-selected-text');
      if (el) setSelectedText(el.value);
    }, 500);
    return () => clearInterval(pollingRef.current);
  }, []);

  // Insert text event from AI/Linde panels
  useEffect(() => {
    const handler = (e) => {
      // Dispatch to Tiptap via a hidden textarea trick
      const el = document.querySelector('.ProseMirror');
      if (el) el.focus();
      // Actually trigger via editor's custom event - handled in WriterChapterEditor
    };
    window.addEventListener('writer:insert', handler);
    return () => window.removeEventListener('writer:insert', handler);
  }, []);

  async function loadChapter(ch) {
    const full = await getChapter(ch.id);
    setActiveChapter(full);
  }

  function handleSelectChapter(ch) {
    if (!ch) { setActiveChapter(null); return; }
    loadChapter(ch);
  }

  function handleRestoreVersion(version) {
    setActiveChapter(prev => ({
      ...prev,
      content_json: version.content_json,
      content_html: version.content_html,
      content_text: version.content_text,
    }));
  }

  async function handleExport(format) {
    setExporting(true);
    try {
      const res = await exportProject(project.id, format);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Błąd eksportu: ${err.error || res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') || '';
      const fnMatch = cd.match(/filename="?([^"]+)"?/);
      a.download = fnMatch?.[1] || `${project.title}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Błąd: ${e.message}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={`writer-editor-layout${fullscreen ? ' writer-fullscreen' : ''}`}>
      {!fullscreen && (
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
      )}

      <main className="writer-main">
        {fullscreen && (
          <div className="fullscreen-topbar">
            <button className="btn-ghost-sm" onClick={() => setFullscreen(false)}>⊡ Wyjdź z pełnego ekranu</button>
            <span className="fullscreen-title">{project.title}</span>
          </div>
        )}
        {activeChapter ? (
          <WriterChapterEditor
            key={activeChapter.id}
            chapter={activeChapter}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen(f => !f)}
          />
        ) : (
          <div className="writer-no-chapter">
            {chapters.length === 0
              ? <p>Dodaj pierwszy rozdział w panelu po lewej, aby zacząć pisać.</p>
              : <p>Wybierz rozdział z panelu po lewej.</p>
            }
          </div>
        )}
      </main>

      {!fullscreen && (
        <aside className="writer-right">
          <div className="right-panel-tabs">
            <button className={rightPanel === 'linde' ? 'active' : ''} onClick={() => setRightPanel('linde')}>
              Słownik
            </button>
            <button className={rightPanel === 'ai' ? 'active' : ''} onClick={() => setRightPanel('ai')}>
              AI
            </button>
            <button className={rightPanel === 'versions' ? 'active' : ''} onClick={() => setRightPanel('versions')}>
              Wersje
            </button>
            <button className={rightPanel === 'export' ? 'active' : ''} onClick={() => setRightPanel('export')}>
              Eksport
            </button>
          </div>

          {rightPanel === 'linde' && <LindePanel />}
          {rightPanel === 'ai' && (
            <WriterAIPanel
              selectedText={selectedText}
              chapterText={activeChapter?.content_text || ''}
              projectId={project.id}
              chapterId={activeChapter?.id}
            />
          )}
          {rightPanel === 'versions' && (
            <ChapterVersions
              chapter={activeChapter}
              onRestore={handleRestoreVersion}
            />
          )}
          {rightPanel === 'export' && (
            <div className="export-panel">
              <div className="panel-title">Eksport książki</div>
              <p className="export-desc">
                Eksportuje wszystkie rozdziały projektu „<strong>{project.title}</strong>" do jednego pliku.
              </p>
              <div className="export-options">
                <button
                  className="export-option"
                  onClick={() => handleExport('txt')}
                  disabled={exporting}
                >
                  <div className="export-icon">📄</div>
                  <div>
                    <div className="export-label">Czysty tekst</div>
                    <div className="export-sub">.txt — wszystkie rozdziały</div>
                  </div>
                </button>
                <button
                  className="export-option"
                  onClick={() => handleExport('html')}
                  disabled={exporting}
                >
                  <div className="export-icon">🌐</div>
                  <div>
                    <div className="export-label">HTML</div>
                    <div className="export-sub">.html — z formatowaniem</div>
                  </div>
                </button>
                <button
                  className="export-option"
                  onClick={() => handleExport('docx')}
                  disabled={exporting}
                >
                  <div className="export-icon">📝</div>
                  <div>
                    <div className="export-label">Word / DOCX</div>
                    <div className="export-sub">.docx — do edycji w Word</div>
                  </div>
                </button>
              </div>
              {exporting && <div className="export-loading">Generowanie pliku…</div>}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
