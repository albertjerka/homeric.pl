import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function normalize(q) {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const nq = normalize(q);
  const r = await pool.query(
    `SELECT le.id, le.headword, le.body, le.volume, le.page, ls.source_url
     FROM linde_entries le
     LEFT JOIN linde_sources ls ON ls.id = le.source_id
     WHERE le.normalized_headword ILIKE $1 OR le.normalized_headword ILIKE $2
     ORDER BY
       CASE WHEN le.normalized_headword = $3 THEN 0
            WHEN le.normalized_headword ILIKE $1 THEN 1
            ELSE 2 END,
       le.headword
     LIMIT 20`,
    [`${nq}%`, `%${nq}%`, nq]
  );

  await pool.query(
    `INSERT INTO linde_searches (admin_id, query, normalized_query, results_count)
     VALUES ($1,$2,$3,$4)`,
    [req.admin.id, q, nq, r.rows.length]
  ).catch(() => {});

  res.json(r.rows);
});

router.post('/import', async (req, res) => {
  const { file_path, title, volume } = req.body;
  if (!file_path) return res.status(400).json({ error: 'Podaj ścieżkę do pliku' });

  const { readFileSync, existsSync } = await import('fs');
  if (!existsSync(file_path)) return res.status(404).json({ error: `Plik nie istnieje: ${file_path}` });

  const text = readFileSync(file_path, 'utf8');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const src = await pool.query(
    `INSERT INTO linde_sources (title, volume, local_path, format, imported_at)
     VALUES ($1,$2,$3,'txt',NOW()) RETURNING id`,
    [title || 'Słownik Lindego', volume || '?', file_path]
  );
  const sourceId = src.rows[0].id;

  let imported = 0;
  let current = null;
  let bodyLines = [];

  async function flush() {
    if (!current) return;
    const body = bodyLines.join('\n');
    const nhead = normalize(current);
    await pool.query(
      `INSERT INTO linde_entries (source_id, headword, normalized_headword, body, volume, raw_text)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [sourceId, current, nhead, body, volume || '?', body]
    );
    imported++;
  }

  for (const line of lines) {
    // Heuristic: new headword line starts with uppercase and has no leading whitespace
    if (/^[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ\s]{1,40}$/.test(line) && line === line.toUpperCase()) {
      await flush();
      current = line;
      bodyLines = [];
    } else {
      bodyLines.push(line);
    }
  }
  await flush();

  res.json({ ok: true, imported, source_id: sourceId });
});

// ─── AI prompt ───────────────────────────────────────────────────────────────

router.post('/ask', async (req, res) => {
  const { prompt, image_base64, image_media_type } = req.body;
  if (!prompt?.trim() && !image_base64) {
    return res.status(400).json({ error: 'Podaj pytanie lub wgraj obraz.' });
  }

  // Wyodrębnij słowa kluczowe z prompta do wyszukiwania haseł
  const words = (prompt || '')
    .toLowerCase()
    .replace(/[^a-ząćęłńóśźż\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4)
    .map(w => {
      // normalizuj polskie litery
      return w.replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
               .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
               .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z');
    })
    .slice(0, 8);

  // Pobierz pasujące hasła (do 30)
  let entries = [];
  if (words.length > 0) {
    const conditions = words.map((w, i) => `le.normalized_headword ILIKE $${i + 1}`).join(' OR ');
    const params = words.map(w => `%${w}%`);
    const r = await pool.query(
      `SELECT le.headword, le.body FROM linde_entries le
       WHERE ${conditions}
       ORDER BY LENGTH(le.body) DESC
       LIMIT 30`,
      params
    );
    entries = r.rows;
  }

  // Zbuduj kontekst słownikowy
  const dictContext = entries.length > 0
    ? entries.map(e => `HASŁO: ${e.headword}\n${(e.body || '').slice(0, 600)}`).join('\n\n---\n\n')
    : 'Brak dopasowanych haseł w bazie — odpowiedz na podstawie własnej wiedzy o języku polskim.';

  const systemPrompt = `Jesteś uczonym językoznawcą i ekspertem od Słownika języka polskiego Samuela Bogumiła Lindego (wyd. 1807–1814).
Pomagasz pisarzom i badaczom rozumieć język staropolski, etymologię i semantykę słów.
Kiedy odpowiadasz, odwołuj się do konkretnych haseł ze słownika jeśli są dostępne.
Pisz po polsku, akademicko lecz przystępnie.`;

  const userContent = [];

  if (image_base64) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: image_media_type || 'image/jpeg', data: image_base64 },
    });
  }

  userContent.push({
    type: 'text',
    text: `PYTANIE UŻYTKOWNIKA:\n${prompt || 'Opisz co widzisz na obrazku i znajdź pasujące hasła słownikowe.'}\n\n` +
          `PASUJĄCE HASŁA ZE SŁOWNIKA LINDEGO:\n\n${dictContext}`,
  });

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const answer = message.content[0]?.text || '';

  res.json({
    answer,
    headwords: entries.map(e => e.headword),
  });
});

// ─── Słowo dnia ───────────────────────────────────────────────────────────────

router.get('/word-of-the-day', async (req, res) => {
  try {
    // Liczymy kwalifikujące się hasła (krótkie, sensowne, bez OCR-śmieci)
    const countR = await pool.query(`
      SELECT COUNT(*) FROM linde_entries
      WHERE LENGTH(headword) BETWEEN 4 AND 14
        AND LENGTH(COALESCE(body,'')) BETWEEN 60 AND 800
        AND headword ~ '^[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż]+$'
    `);
    const total = parseInt(countR.rows[0].count);

    if (!total) {
      return res.json({ empty: true, message: 'Słowniki nie zostały jeszcze zaimportowane.' });
    }

    // Deterministyczny offset — zmienia się każdego dnia, każde "losuj" dodaje random offset
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
    const randomSeed = parseInt(req.query.seed || 0);
    const offset = ((dayOfYear * 137 + randomSeed * 31) % total + total) % total;

    const r = await pool.query(`
      SELECT headword, body, volume FROM linde_entries
      WHERE LENGTH(headword) BETWEEN 4 AND 14
        AND LENGTH(COALESCE(body,'')) BETWEEN 60 AND 800
        AND headword ~ '^[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż]+$'
      ORDER BY id
      OFFSET $1 LIMIT 1
    `, [offset]);

    if (!r.rows[0]) return res.json({ empty: true });

    const e = r.rows[0];
    // Wyciągnij pierwsze zdanie definicji jako meaning
    const meaning = (e.body || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 260);

    res.json({
      headword: e.headword,
      source: `Słownik Lindego, Tom ${e.volume}`,
      meaning,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
