const DB_NAME = 'uanna_library';
const DB_VERSION = 1;
const STORE = 'books';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

export async function saveBook(bookData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add({ ...bookData, addedAt: Date.now() });
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

export async function updateBook(id, updates) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = e => {
      const putReq = store.put({ ...e.target.result, ...updates, updatedAt: Date.now() });
      putReq.onsuccess = () => resolve();
      putReq.onerror = e => reject(e.target.error);
    };
    getReq.onerror = e => reject(e.target.error);
  });
}

// Zwraca metadane bez pdfData (do wyświetlania listy)
export async function getAllBooks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = e => resolve(
      e.target.result.map(({ pdfData, ...meta }) => meta).reverse()
    );
    req.onerror = e => reject(e.target.error);
  });
}

export async function getBookPDF(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = e => resolve(e.target.result?.pdfData || null);
    req.onerror = e => reject(e.target.error);
  });
}

export async function deleteBook(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e.target.error);
  });
}
