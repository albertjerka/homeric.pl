const BASE = 'http://localhost:3002';

async function request(path, options = {}) {
  const r = await fetch(`${BASE}${path}`, options);
  if (!r.ok && r.status !== 404) throw new Error(`API error ${r.status}: ${path}`);
  return r;
}

// ─── Books ───────────────────────────────────────────────────────────────────

export async function getAllBooks() {
  return (await request('/api/books')).json();
}

export async function saveBook({ title, language, startPage, endPage, currentPage, totalPages }) {
  const r = await request('/api/books', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, language, start_page: startPage, end_page: endPage ?? null, current_page: currentPage, total_pages: totalPages }),
  });
  const { id } = await r.json();
  return id;
}

export async function uploadPDF(bookId, arrayBuffer) {
  await request(`/api/books/${bookId}/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: arrayBuffer,
  });
}

export async function getBookPDF(bookId) {
  const r = await request(`/api/books/${bookId}/pdf`);
  if (r.status === 404) return null;
  return r.arrayBuffer();
}

export async function updateBook(bookId, fields) {
  await request(`/api/books/${bookId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

export async function deleteBook(bookId) {
  await request(`/api/books/${bookId}`, { method: 'DELETE' });
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export async function getPage(bookId, pageNum, language) {
  const r = await request(`/api/pages/${bookId}/${pageNum}/${language}`);
  if (r.status === 404) return null;
  return r.json();
}

export async function getAllPages(bookId, language) {
  return (await request(`/api/pages/${bookId}/${language}`)).json();
}

export async function savePage(bookId, pageNum, language, data) {
  await request('/api/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_id: bookId, page_num: pageNum, language, data }),
  });
}

// ─── Images ──────────────────────────────────────────────────────────────────

export async function getImages(bookId) {
  return (await request(`/api/images/${bookId}`)).json();
}

export async function saveImages(bookId, pageNum, images) {
  await request(`/api/images/${bookId}/${pageNum}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: images }),
  });
}
