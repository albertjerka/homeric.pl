import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db.js';

dotenv.config();

const app = express();
const PORT = 3002;

app.use(cors({ origin: ['http://localhost:3001'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '300mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Claude ──────────────────────────────────────────────────────────────────

app.post('/api/analyze-page', async (req, res) => {
  const { text, language, pageNumber } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Brak tekstu' });

  const langName = language === 'ru' ? 'rosyjskim' : language === 'uk' ? 'ukraińskim' : 'angielskim';

  const userPrompt = `Przeanalizuj następujący tekst literacki (strona ${pageNumber}) w języku ${langName}.
Odpowiedz WYŁĄCZNIE w formacie JSON (bez żadnego tekstu przed ani po JSON):

{
  "polish_translation": "pełne, literackie tłumaczenie całego tekstu na język polski",
  "sentences": [
    {
      "original": "zdanie w oryginale",
      "key_words": ["słowo1", "słowo2"],
      "polish": "tłumaczenie zdania"
    }
  ],
  "vocabulary": [
    {
      "word": "słowo w oryginale",
      "translation": "tłumaczenie",
      "note": "krótka nota gramatyczna lub kulturowa"
    }
  ],
  "context": {
    "summary": "2-3 zdania co się dzieje na tej stronie fabularnie",
    "notes": ["wyjaśnienie odniesienia kulturowego lub archaizmu"]
  }
}

Zasady:
- vocabulary: wybierz 8-12 najważniejszych słów do nauki
- key_words w sentences: pogrub słowa kluczowe z vocabulary
- notes w context: wyjaśnij nazwy bogów, miejsc, archaizmy, trudne wyrazy
- tłumaczenie polish_translation ma być eleganckie, literackie

TEKST:
${text}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: 'Jesteś ekspertem w nauczaniu języków obcych dla polskich uczniów. Analizujesz strony literackie i tworzysz materiały edukacyjne. Odpowiadasz wyłącznie w formacie JSON.',
      messages: [{ role: 'user', content: userPrompt }]
    });

    const raw = message.content[0].text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Nieprawidłowa odpowiedź JSON od Claude');
    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error('Błąd Claude API:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/count-words', (req, res) => {
  const { texts, language } = req.body;
  if (!texts || !texts.length) return res.json({ count: 0 });

  const joined = texts.join(' ').toLowerCase();
  const wordPattern = language === 'ru'
    ? /[а-яёa-z'-]{2,}/g
    : language === 'uk'
    ? /[а-яіїєґa-z'-]{2,}/g
    : /[a-z'-]{2,}/g;

  const words = joined.match(wordPattern) || [];
  res.json({ count: new Set(words).size });
});

// ─── Books ───────────────────────────────────────────────────────────────────

app.get('/api/books', (req, res) => {
  const books = db.prepare(
    'SELECT id, title, language, start_page, end_page, current_page, total_pages, created_at FROM books ORDER BY created_at DESC'
  ).all();
  res.json(books);
});

app.post('/api/books', (req, res) => {
  const { title, language, start_page, end_page, current_page, total_pages } = req.body;
  const result = db.prepare(
    'INSERT INTO books (title, language, start_page, end_page, current_page, total_pages) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, language, start_page, end_page ?? null, current_page, total_pages);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/books/:id', (req, res) => {
  const allowed = ['current_page', 'end_page', 'language'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.json({ ok: true });
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const vals = [...fields.map(f => req.body[f]), req.params.id];
  db.prepare(`UPDATE books SET ${sets} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

app.delete('/api/books/:id', (req, res) => {
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/books/:id/pdf', (req, res) => {
  db.prepare('UPDATE books SET pdf_data = ? WHERE id = ?').run(req.body, req.params.id);
  res.json({ ok: true });
});

app.get('/api/books/:id/pdf', (req, res) => {
  const row = db.prepare('SELECT pdf_data FROM books WHERE id = ?').get(req.params.id);
  if (!row?.pdf_data) return res.status(404).json({ error: 'Brak PDF' });
  res.set('Content-Type', 'application/pdf');
  res.send(row.pdf_data);
});

// ─── Pages ───────────────────────────────────────────────────────────────────

app.get('/api/pages/:bookId/:lang', (req, res) => {
  const rows = db.prepare(
    'SELECT page_num, data FROM pages WHERE book_id = ? AND language = ?'
  ).all(req.params.bookId, req.params.lang);
  const result = {};
  rows.forEach(r => { result[r.page_num] = JSON.parse(r.data); });
  res.json(result);
});

app.get('/api/pages/:bookId/:pageNum/:lang', (req, res) => {
  const row = db.prepare(
    'SELECT data FROM pages WHERE book_id = ? AND page_num = ? AND language = ?'
  ).get(req.params.bookId, req.params.pageNum, req.params.lang);
  if (!row) return res.status(404).json(null);
  res.json(JSON.parse(row.data));
});

app.post('/api/pages', (req, res) => {
  const { book_id, page_num, language, data } = req.body;
  db.prepare(
    'INSERT OR REPLACE INTO pages (book_id, page_num, language, data) VALUES (?, ?, ?, ?)'
  ).run(book_id, page_num, language, JSON.stringify(data));
  res.json({ ok: true });
});

// ─── Images ──────────────────────────────────────────────────────────────────

app.get('/api/images/:bookId', (req, res) => {
  const rows = db.prepare('SELECT page_num, data FROM images WHERE book_id = ?').all(req.params.bookId);
  const result = {};
  rows.forEach(r => { result[r.page_num] = JSON.parse(r.data); });
  res.json(result);
});

app.put('/api/images/:bookId/:pageNum', (req, res) => {
  const { data } = req.body;
  if (data?.length) {
    db.prepare('INSERT OR REPLACE INTO images (book_id, page_num, data) VALUES (?, ?, ?)').run(req.params.bookId, req.params.pageNum, JSON.stringify(data));
  } else {
    db.prepare('DELETE FROM images WHERE book_id = ? AND page_num = ?').run(req.params.bookId, req.params.pageNum);
  }
  res.json({ ok: true });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`UANNA backend działa na porcie ${PORT}`));
