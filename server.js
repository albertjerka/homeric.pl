import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool, { initDb } from './db.js';
import writerRoutes from './routes/writer.js';
import lindeRoutes from './routes/linde.js';

dotenv.config();

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET;

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://homeric.pl', 'http://homeric.pl']
  : ['http://localhost:3001', 'http://localhost:5173'];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '300mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Brak tokenu' });
  try {
    req.admin = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Nieprawidłowy token' });
  }
}

// ─── Auth endpoints ───────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Brak danych' });
  try {
    const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
    const admin = result.rows[0];
    if (!admin) return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
    const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ email: req.admin.email });
});

// ─── Claude ──────────────────────────────────────────────────────────────────

app.post('/api/analyze-page', requireAuth, async (req, res) => {
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

app.post('/api/count-words', requireAuth, (req, res) => {
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

app.get('/api/books', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT id, title, language, start_page, end_page, current_page, total_pages, created_at FROM books ORDER BY created_at DESC'
  );
  res.json(result.rows);
});

app.post('/api/books', requireAuth, async (req, res) => {
  const { title, language, start_page, end_page, current_page, total_pages } = req.body;
  const result = await pool.query(
    'INSERT INTO books (title, language, start_page, end_page, current_page, total_pages) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [title, language, start_page, end_page ?? null, current_page, total_pages]
  );
  res.json({ id: result.rows[0].id });
});

app.put('/api/books/:id', requireAuth, async (req, res) => {
  const allowed = ['current_page', 'end_page', 'language'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.json({ ok: true });
  const sets = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const vals = [...fields.map(f => req.body[f]), req.params.id];
  await pool.query(`UPDATE books SET ${sets} WHERE id = $${fields.length + 1}`, vals);
  res.json({ ok: true });
});

app.delete('/api/books/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM books WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

app.post('/api/books/:id/pdf', requireAuth, async (req, res) => {
  await pool.query('UPDATE books SET pdf_data = $1 WHERE id = $2', [req.body, req.params.id]);
  res.json({ ok: true });
});

app.get('/api/books/:id/pdf', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT pdf_data FROM books WHERE id = $1', [req.params.id]);
  const row = result.rows[0];
  if (!row?.pdf_data) return res.status(404).json({ error: 'Brak PDF' });
  res.set('Content-Type', 'application/pdf');
  res.send(row.pdf_data);
});

// ─── Pages ───────────────────────────────────────────────────────────────────

app.get('/api/pages/:bookId/:lang', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT page_num, data FROM pages WHERE book_id = $1 AND language = $2',
    [req.params.bookId, req.params.lang]
  );
  const out = {};
  result.rows.forEach(r => { out[r.page_num] = JSON.parse(r.data); });
  res.json(out);
});

app.get('/api/pages/:bookId/:pageNum/:lang', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT data FROM pages WHERE book_id = $1 AND page_num = $2 AND language = $3',
    [req.params.bookId, req.params.pageNum, req.params.lang]
  );
  if (!result.rows[0]) return res.status(404).json(null);
  res.json(JSON.parse(result.rows[0].data));
});

app.post('/api/pages', requireAuth, async (req, res) => {
  const { book_id, page_num, language, data } = req.body;
  await pool.query(
    `INSERT INTO pages (book_id, page_num, language, data)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (book_id, page_num, language) DO UPDATE SET data = EXCLUDED.data`,
    [book_id, page_num, language, JSON.stringify(data)]
  );
  res.json({ ok: true });
});

// ─── Images ──────────────────────────────────────────────────────────────────

app.get('/api/images/:bookId', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT page_num, data FROM images WHERE book_id = $1',
    [req.params.bookId]
  );
  const out = {};
  result.rows.forEach(r => { out[r.page_num] = JSON.parse(r.data); });
  res.json(out);
});

app.put('/api/images/:bookId/:pageNum', requireAuth, async (req, res) => {
  const { data } = req.body;
  if (data?.length) {
    await pool.query(
      `INSERT INTO images (book_id, page_num, data) VALUES ($1,$2,$3)
       ON CONFLICT (book_id, page_num) DO UPDATE SET data = EXCLUDED.data`,
      [req.params.bookId, req.params.pageNum, JSON.stringify(data)]
    );
  } else {
    await pool.query(
      'DELETE FROM images WHERE book_id = $1 AND page_num = $2',
      [req.params.bookId, req.params.pageNum]
    );
  }
  res.json({ ok: true });
});

// ─── Writer & Linde routes ───────────────────────────────────────────────────

app.use('/api/writer', writerRoutes);
app.use('/api/linde', lindeRoutes);

// ─── Start ───────────────────────────────────────────────────────────────────

initDb()
  .then(() => app.listen(PORT, '127.0.0.1', () => console.log(`Homeric backend działa na 127.0.0.1:${PORT}`)))
  .catch(err => { console.error('Błąd inicjalizacji bazy:', err); process.exit(1); });
