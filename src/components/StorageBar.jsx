import { useState, useEffect } from 'react';
import { isSupported, pickFolder, getFolder } from '../services/fileSystem.js';

export default function StorageBar({ onFolderSet }) {
  const [folderReady, setFolderReady] = useState(false);
  const fsSupported = isSupported();

  useEffect(() => {
    getFolder().then(h => setFolderReady(!!h)).catch(() => {});
  }, []);

  async function handlePickFolder() {
    try {
      await pickFolder();
      setFolderReady(true);
      onFolderSet?.();
    } catch (e) {
      if (e.name !== 'AbortError') alert('Błąd wyboru folderu: ' + e.message);
    }
  }

  if (!fsSupported) return null;

  return (
    <div className="storage-bar">
      <span className="storage-bar-label">Folder na dysku:</span>
      <button
        className={`storage-btn${folderReady ? ' active' : ''}`}
        onClick={handlePickFolder}
        title={folderReady ? 'Folder ustawiony – kliknij aby zmienić' : 'Wybierz folder UANNA/ksiazki na dysku'}
      >
        {folderReady ? '💾 Dysk ✓' : '💾 Ustaw folder'}
      </button>
      {folderReady && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Książki zapisywane automatycznie w wybranym folderze
        </span>
      )}
    </div>
  );
}
