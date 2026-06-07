// Lokalne zapisywanie PDFów, cache tłumaczeń i obrazków przez File System Access API (Chrome/Edge)
// Uchwyt do folderu zapisywany w osobnej bazie IndexedDB

const DB_NAME = 'uanna_fs_handles';
const DB_VERSION = 1;
const STORE = 'handles';

function openHandlesDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

export const isSupported = () => 'showDirectoryPicker' in window;

export async function pickFolder() {
  const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
  const db = await openHandlesDB();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(dirHandle, 'books');
    req.onsuccess = res; req.onerror = e => rej(e.target.error);
  });
  return dirHandle;
}

export async function getFolder() {
  const db = await openHandlesDB();
  const handle = await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('books');
    req.onsuccess = e => res(e.target.result || null);
    req.onerror = e => rej(e.target.error);
  });
  if (!handle) return null;
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') return handle;
  const ask = await handle.requestPermission({ mode: 'readwrite' });
  return ask === 'granted' ? handle : null;
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function writeFile(filename, content, isBinary = false) {
  const folder = await getFolder();
  if (!folder) return;
  const fh = await folder.getFileHandle(filename, { create: true });
  const w = await fh.createWritable();
  await w.write(isBinary ? content : JSON.stringify(content, null, 2));
  await w.close();
}

async function readJsonFile(filename) {
  const folder = await getFolder();
  if (!folder) return null;
  try {
    const fh = await folder.getFileHandle(filename);
    const file = await fh.getFile();
    return JSON.parse(await file.text());
  } catch { return null; }
}

// ─── PDF ────────────────────────────────────────────────────────────────────

export async function saveFileToDisk(filename, arrayBuffer) {
  const folder = await getFolder();
  if (!folder) throw new Error('Folder nie ustawiony');
  await writeFile(filename, arrayBuffer, true);
}

export async function loadFileFromDisk(filename) {
  const folder = await getFolder();
  if (!folder) return null;
  try {
    const fh = await folder.getFileHandle(filename);
    const file = await fh.getFile();
    return file.arrayBuffer();
  } catch { return null; }
}

// ─── Cache tłumaczeń ────────────────────────────────────────────────────────
// Plik: {bookBase}_{lang}.json  →  { "42": { ...analysis... }, "43": {...} }

function cacheFilename(bookBase, language) {
  return `${bookBase}_${language}.json`;
}

export async function savePageCacheToDisk(bookBase, pageNum, language, data) {
  try {
    const fname = cacheFilename(bookBase, language);
    const existing = await readJsonFile(fname) || {};
    existing[String(pageNum)] = data;
    await writeFile(fname, existing);
  } catch { /* nie blokuj UI */ }
}

export async function loadPageCacheFromDisk(bookBase, language) {
  return readJsonFile(cacheFilename(bookBase, language)) || {};
}

// ─── Obrazki ────────────────────────────────────────────────────────────────
// Plik: {bookBase}_images.json  →  { "5": ["data:image/...", ...], "12": [...] }

function imagesFilename(bookBase) {
  return `${bookBase}_images.json`;
}

export async function saveImagesToDisk(bookBase, pageImages) {
  try { await writeFile(imagesFilename(bookBase), pageImages); } catch { }
}

export async function loadImagesFromDisk(bookBase) {
  return readJsonFile(imagesFilename(bookBase)) || {};
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export function safeFilename(title, id) {
  return `${(title || 'ksiazka').replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ _-]/g, '')}_${id}.pdf`;
}

export function bookBase(title, id) {
  return `${(title || 'ksiazka').replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ _-]/g, '')}_${id}`;
}
