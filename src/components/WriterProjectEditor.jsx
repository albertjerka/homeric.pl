import { useState, useEffect, useRef } from 'react';
import { getChapters, getChapter, getCharacters, getPlaces, exportProject, updateChapter } from '../services/writerApi.js';
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
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const pollingRef = useRef(null);
  const editorInsertRef = useRef(null);

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

  // Insert/replace from AI panel into editor
  function handleAiInsert(text) {
    window.dispatchEvent(new CustomEvent('writer:insert', { detail: { text, mode: 'append' } }));
  }

  function handleAiReplace(text) {
    window.dispatchEvent(new CustomEvent('writer:insert', { detail: { text, mode: 'replace' } }));
  }

  async function handleAiNote(text) {
    if (!activeChapter) return;
    const newNotes = `${activeChapter.notes || ''}\n\n[Homer AI]\n${text}`.trim();
    await updateChapter(activeChapter.id, { notes: newNotes }).catch(() => {});
    setActiveChapter(prev => ({ ...prev, notes: newNotes }));
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

  const layoutClass = [
    'writer-editor-layout',
    fullscreen ? 'writer-fullscreen' : '',
    aiPanelOpen && !fullscreen ? 'ai-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClass}>
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
            <button className="btn-ghost-sm" onClick={() => setFullscreen(false)}>⊡ Wyjdź</button>
            <span className="fullscreen-title">{project.title}</span>
          </div>
        )}

        {!fullscreen && (
          <div className="writer-toolbar">
            <button
              className={`writer-ai-toggle${aiPanelOpen ? ' active' : ''}`}
              onClick={() => setAiPanelOpen(o => !o)}
              title="Otwórz / zamknij panel Homer AI"
            >
              <span style={{ fontFamily: 'serif', fontStyle: 'italic' }}>Η</span>
              {aiPanelOpen ? ' Zamknij AI' : ' Homer AI'}
            </button>
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
              ? <p>Dodaj pierwszy rozdział w panelu po lewej.</p>
              : <p>Wybierz rozdział z panelu po lewej.</p>
            }
          </div>
        )}
      </main>

      {/* Panel Homer AI jako prawa kolumna */}
      {aiPanelOpen && !fullscreen && (
        <aside className="writer-ai-column">
          <WriterAIPanel
            selectedText={selectedText}
            chapterText={activeChapter?.content_text || ''}
            projectId={project.id}
            chapterId={activeChapter?.id}
            onInsert={handleAiInsert}
            onReplace={handleAiReplace}
            onNote={handleAiNote}
          />
        </aside>
      )}

      {/* Prawy panel z Linde/Wersje/Eksport — gdy AI nie jest otwarty */}
      {!aiPanelOpen && !fullscreen && (
        <aside className="writer-right">
          <div className="right-panel-tabs">
            <button className={rightPanel === 'linde' ? 'active' : ''} onClick={() => setRightPanel('linde')}>Słownik</button>
            <button className={rightPanel === 'versions' ? 'active' : ''} onClick={() => setRightPanel('versions')}>Wersje</button>
            <button className={rightPanel === 'export' ? 'active' : ''} onClick={() => setRightPanel('export')}>Eksport</button>
          </div>

          {rightPanel === 'linde' && (
            <LindePanel
              onInsertQuote={text => window.dispatchEvent(new CustomEvent('writer:insert', { detail: { text, mode: 'append' } }))}
            />
          )}
          {rightPanel === 'versions' && (
            <ChapterVersions chapter={activeChapter} onRestore={handleRestoreVersion} />
          )}
          {rightPanel === 'export' && (
            <div className="export-panel">
              <div className="panel-title">Eksport książki</div>
              <p className="export-desc">„<strong>{project.title}</strong>"</p>
              <div className="export-options">
                {[
                  { format: 'txt', icon: '📄', label: 'Czysty tekst', sub: '.txt' },
                  { format: 'html', icon: '🌐', label: 'HTML', sub: '.html' },
                  { format: 'docx', icon: '📝', label: 'Word / DOCX', sub: '.docx' },
                ].map(({ format, icon, label, sub }) => (
                  <button key={format} className="export-option" onClick={() => handleExport(format)} disabled={exporting}>
                    <div className="export-icon">{icon}</div>
                    <div><div className="export-label">{label}</div><div className="export-sub">{sub}</div></div>
                  </button>
                ))}
              </div>
              {exporting && <div className="export-loading">Generowanie…</div>}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
