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

export default router;
