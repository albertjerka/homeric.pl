import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Normalizacja: usuń polskie znaki (tak jak przy imporcie)
function normQ(q) {
  return q.toLowerCase().trim()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
    .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
    .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z')
    .replace(/\s+/g,' ');
}

// Warianty pisowni — Linde używa staropolskiej ortografii
// np. bestia→bestya, żałość→zalosc (już obsługuje normQ), etc.
function spellingVariants(norm) {
  const v = new Set([norm]);
  // ia ↔ ya (bestia ↔ bestya, familja ↔ famylya, etc.)
  v.add(norm.replace(/ia/g, 'ya'));
  v.add(norm.replace(/ya/g, 'ia'));
  // ie ↔ ye
  v.add(norm.replace(/ie/g, 'ye'));
  v.add(norm.replace(/ye/g, 'ie'));
  // końcówka -ść → -sc (normQ usuwa ogonki, więc zalość → zalosc) — już ok
  return [...v].filter(x => x.length >= 2 && x !== norm || x === norm);
}

// Słowa meta-pytań (nie są terminem wyszukiwania)
const META_WORDS = new Set([
  'daj','wszystkie','slowa','slownik','slownika','pochodne','bliskoznaczne',
  'archaiczne','znaczenie','oznaczalo','oznaczal','oznaczaja','oznacza',
  'jakie','jakich','ktore','zwiazane','pasujace','przykłady','przyklady',
  'historia','opis','definicja','haslo','hasla','tom','strona','linde',
  'lindego','jezyk','polski','staropolski','znajdz','szukaj','podaj',
  'wymien','liste','lista','oraz','albo','niby','forma','formy','zwiazek',
  'similar','words','related','what','does','mean','find','synonyms',
  'bliskoznacznik','antonimy','antonim','synonimy','synonim',
]);

// Wyodrębnij sensowne terminy wyszukiwania z promptu
function extractSearchTerms(prompt) {
  const norm = normQ(prompt);
  const words = norm
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !META_WORDS.has(w));

  // Unikalne, max 5, preferuj dłuższe (bardziej specyficzne)
  return [...new Set(words)]
    .sort((a, b) => b.length - a.length)
    .slice(0, 5);
}

// Główne zapytanie słownikowe z rankingiem
async function searchInLinde(rawQuery, limit = 20) {
  const nq = normQ(rawQuery);
  const variants = spellingVariants(nq);  // [bestia, bestya, ...]

  // exact patterns: dla każdego wariantu
  const exactVals = variants;
  // prefix patterns
  const prefixVals = variants.map(v => `${v}%`);
  // contains headword
  const containsHW = variants.map(v => `%${v}%`);
  // body search — tylko oryginalny zapytanie (z dużymi literami)
  const bodyPattern = `%${rawQuery.toLowerCase().trim()}%`;

  const r = await pool.query(
    `SELECT
       le.id, le.headword, le.normalized_headword, le.body, le.volume, le.page,
       CASE
         WHEN le.normalized_headword = ANY($1) THEN 100
         WHEN le.normalized_headword LIKE ANY($2) THEN 80
         WHEN le.normalized_headword LIKE ANY($3) THEN 60
         WHEN le.body ILIKE $4 THEN 30
         ELSE 10
       END AS score
     FROM linde_entries le
     WHERE
       le.normalized_headword = ANY($1)
       OR le.normalized_headword LIKE ANY($2)
       OR le.normalized_headword LIKE ANY($3)
       OR le.body ILIKE $4
       AND LENGTH(le.headword) >= 2
     ORDER BY score DESC, LENGTH(COALESCE(le.body,'')) DESC
     LIMIT $5`,
    [exactVals, prefixVals, containsHW, bodyPattern, limit]
  );

  // Filtruj OCR-śmieci
  const VOWELS = /[aeiouyąęóAEIOUĄĘÓ]/;
  return r.rows.filter(row => {
    const hw = row.headword || '';
    if (hw.length < 2) return false;
    const letters = hw.replace(/[^a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ]/g, '');
    if (letters.length < 2) return false;
    const vowelCount = (hw.match(/[aeiouyąęóAEIOUĄĘÓ]/g) || []).length;
    // min 1 samogłoska na 5 liter (MOHHTŁ: 6 liter, 1 samogłoska O → ok tylko do 5)
    if (vowelCount === 0) return false;
    if (letters.length > 5 && vowelCount < 2) return false;
    // nie pokazuj wpisów SŁOWO-SŁOWO (OCR-artefakty z kreskami)
    if (/^[A-ZĄĆĘŁŃÓŚŹŻ]+-[A-ZĄĆĘŁŃÓŚŹŻ]+$/.test(hw) && row.score <= 30) return false;
    return true;
  });
}

// ─── GET /api/linde/search — czyste wyszukiwanie słownikowe bez AI ────────────

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  try {
    const rows = await searchInLinde(q, 20);

    await pool.query(
      `INSERT INTO linde_searches (admin_id, query, normalized_query, results_count)
       VALUES ($1,$2,$3,$4)`,
      [req.admin.id, q, normQ(q), rows.length]
    ).catch(() => {});

    // Oznacz typ trafienia dla frontendu
    const nq = normQ(q);
    const variants = spellingVariants(nq);
    const withType = rows.map(row => ({
      ...row,
      match_type:
        variants.includes(row.normalized_headword) ? 'exact' :
        variants.some(v => row.normalized_headword?.startsWith(v)) ? 'prefix' :
        row.score >= 60 ? 'headword' : 'body',
    }));

    res.json(withType);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Import TXT ───────────────────────────────────────────────────────────────

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
    const nhead = normQ(current);
    await pool.query(
      `INSERT INTO linde_entries (source_id, headword, normalized_headword, body, volume, raw_text)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [sourceId, current, nhead, body, volume || '?', body]
    );
    imported++;
  }

  for (const line of lines) {
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

// ─── POST /api/linde/ask — AI z wynikami z bazy ──────────────────────────────

router.post('/ask', async (req, res) => {
  const { prompt, image_base64, image_media_type } = req.body;
  if (!prompt?.trim() && !image_base64) {
    return res.status(400).json({ error: 'Podaj pytanie lub wgraj obraz.' });
  }

  // 1. Wyodrębnij terminy wyszukiwania (nie wszystkie słowa z promptu!)
  const searchTerms = image_base64 ? [] : extractSearchTerms(prompt || '');

  // 2. Szukaj każdego terminu w bazie — tylko wysokiej jakości trafienia
  let entries = [];
  const usedHeadwords = [];

  for (const term of searchTerms) {
    const found = await searchInLinde(term, 8);
    // Bierz tylko trafienia exact/prefix (score >= 80) lub wyraźne headword (score >= 60)
    const quality = found.filter(e => e.score >= 60);
    for (const e of quality) {
      if (!entries.some(x => x.id === e.id)) {
        entries.push(e);
        if (!usedHeadwords.includes(e.headword)) usedHeadwords.push(e.headword);
      }
    }
    if (entries.length >= 25) break;
  }

  // 3. Zbuduj kontekst dla AI
  let dictContext;
  if (entries.length > 0) {
    dictContext =
      `HASŁA Z BAZY LINDEGO (${entries.length} wyników dla: ${searchTerms.join(', ')}):\n\n` +
      entries.slice(0, 15).map(e =>
        `HASŁO: ${e.headword} (Tom ${e.volume || '?'}, s. ${e.page || '?'}) [dopasowanie: ${e.score === 100 ? 'dokładne' : e.score >= 80 ? 'prefiks' : e.score >= 60 ? 'zawiera' : 'treść'}]\n` +
        `${(e.body || '').slice(0, 500)}`
      ).join('\n\n---\n\n');
  } else {
    dictContext = searchTerms.length > 0
      ? `WYNIK WYSZUKIWANIA: Nie znaleziono dokładnych haseł dla: ${searchTerms.join(', ')}.\n` +
        `W bazie jest 35 831 haseł Lindego. Sprawdzone warianty pisowni: ` +
        searchTerms.flatMap(t => spellingVariants(normQ(t))).join(', ') + `.`
      : `BRAK ZAPYTANIA TEKSTOWEGO — odpowiedz na podstawie obrazka.`;
  }

  const systemPrompt = `Jesteś uczonym językoznawcą i ekspertem od Słownika języka polskiego Samuela Bogumiła Lindego (wyd. 1807–1814).
Pomagasz pisarzom rozumieć język staropolski, etymologię i semantykę.

ZASADA: Opieraj się wyłącznie na HASŁACH Z BAZY podanych poniżej. Jeśli baza nie zawiera hasła, powiedz wprost: "Nie znaleziono dokładnego hasła w zaimportowanej bazie." Możesz potem podać hipotezy, ale wyraźnie oznaczone jako hipotezy.
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
    text: `PYTANIE:\n${prompt || 'Opisz obrazek i znajdź pasujące hasła.'}\n\n${dictContext}`,
  });

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  res.json({
    answer: message.content[0]?.text || '',
    headwords: usedHeadwords,      // tylko realne trafienia z bazy
    searchTerms,                    // co zostało wysłane do SQL
    resultsCount: entries.length,
  });
});

// ─── Słowo dnia ───────────────────────────────────────────────────────────────

router.get('/word-of-the-day', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');

    const r = await pool.query(`
      SELECT headword, body, volume FROM linde_entries
      WHERE LENGTH(headword) BETWEEN 4 AND 14
        AND LENGTH(COALESCE(body,'')) BETWEEN 60 AND 800
        AND headword ~ '^[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż]+$'
      ORDER BY RANDOM()
      LIMIT 1
    `);

    if (!r.rows[0]) return res.json({ empty: true, message: 'Słowniki nie zostały jeszcze zaimportowane.' });

    const e = r.rows[0];
    res.json({
      headword: e.headword,
      source: `Słownik Lindego, Tom ${e.volume}`,
      meaning: (e.body || '').replace(/\s+/g, ' ').trim().slice(0, 260),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
