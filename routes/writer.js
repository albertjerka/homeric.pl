import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ─── Projects ────────────────────────────────────────────────────────────────

router.get('/projects', async (req, res) => {
  const r = await pool.query(
    `SELECT id, title, description, genre, language, notes, word_count, created_at, updated_at
     FROM writing_projects WHERE admin_id = $1 ORDER BY updated_at DESC`,
    [req.admin.id]
  );
  res.json(r.rows);
});

router.post('/projects', async (req, res) => {
  const { title, description, genre, language, notes } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Tytuł jest wymagany' });
  const r = await pool.query(
    `INSERT INTO writing_projects (admin_id, title, description, genre, language, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.admin.id, title.trim(), description || '', genre || '', language || 'pl', notes || '']
  );
  res.json(r.rows[0]);
});

router.get('/projects/:id', async (req, res) => {
  const r = await pool.query(
    'SELECT * FROM writing_projects WHERE id = $1 AND admin_id = $2',
    [req.params.id, req.admin.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Nie znaleziono projektu' });
  res.json(r.rows[0]);
});

router.put('/projects/:id', async (req, res) => {
  const { title, description, genre, language, notes } = req.body;
  await pool.query(
    `UPDATE writing_projects SET title=$1, description=$2, genre=$3, language=$4, notes=$5, updated_at=NOW()
     WHERE id=$6 AND admin_id=$7`,
    [title, description, genre, language, notes, req.params.id, req.admin.id]
  );
  res.json({ ok: true });
});

router.delete('/projects/:id', async (req, res) => {
  await pool.query(
    'DELETE FROM writing_projects WHERE id=$1 AND admin_id=$2',
    [req.params.id, req.admin.id]
  );
  res.json({ ok: true });
});

// ─── Chapters ────────────────────────────────────────────────────────────────

router.get('/projects/:id/chapters', async (req, res) => {
  const proj = await pool.query(
    'SELECT id FROM writing_projects WHERE id=$1 AND admin_id=$2',
    [req.params.id, req.admin.id]
  );
  if (!proj.rows[0]) return res.status(403).json({ error: 'Brak dostępu' });
  const r = await pool.query(
    `SELECT id, title, order_index, word_count, created_at, updated_at
     FROM writing_chapters WHERE project_id=$1 ORDER BY order_index ASC, created_at ASC`,
    [req.params.id]
  );
  res.json(r.rows);
});

router.post('/projects/:id/chapters', async (req, res) => {
  const proj = await pool.query(
    'SELECT id FROM writing_projects WHERE id=$1 AND admin_id=$2',
    [req.params.id, req.admin.id]
  );
  if (!proj.rows[0]) return res.status(403).json({ error: 'Brak dostępu' });
  const { title } = req.body;
  const orderR = await pool.query(
    'SELECT COALESCE(MAX(order_index),0)+1 AS next FROM writing_chapters WHERE project_id=$1',
    [req.params.id]
  );
  const r = await pool.query(
    `INSERT INTO writing_chapters (project_id, title, order_index)
     VALUES ($1,$2,$3) RETURNING *`,
    [req.params.id, title?.trim() || 'Nowy rozdział', orderR.rows[0].next]
  );
  res.json(r.rows[0]);
});

router.get('/chapters/:id', async (req, res) => {
  const r = await pool.query(
    `SELECT wc.* FROM writing_chapters wc
     JOIN writing_projects wp ON wp.id = wc.project_id
     WHERE wc.id=$1 AND wp.admin_id=$2`,
    [req.params.id, req.admin.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Nie znaleziono rozdziału' });
  res.json(r.rows[0]);
});

router.put('/chapters/:id', async (req, res) => {
  const { title, content_json, content_html, content_text, word_count } = req.body;
  await pool.query(
    `UPDATE writing_chapters
     SET title=$1, content_json=$2, content_html=$3, content_text=$4, word_count=$5, updated_at=NOW()
     WHERE id=$6 AND project_id IN (SELECT id FROM writing_projects WHERE admin_id=$7)`,
    [title, content_json || '{}', content_html || '', content_text || '', word_count || 0,
     req.params.id, req.admin.id]
  );
  const words = word_count || 0;
  await pool.query(
    `UPDATE writing_projects SET word_count=(
       SELECT COALESCE(SUM(word_count),0) FROM writing_chapters WHERE project_id=writing_projects.id
     ), updated_at=NOW()
     WHERE id=(SELECT project_id FROM writing_chapters WHERE id=$1)`,
    [req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/chapters/:id', async (req, res) => {
  await pool.query(
    `DELETE FROM writing_chapters WHERE id=$1
     AND project_id IN (SELECT id FROM writing_projects WHERE admin_id=$2)`,
    [req.params.id, req.admin.id]
  );
  res.json({ ok: true });
});

// ─── Characters ───────────────────────────────────────────────────────────────

router.get('/projects/:id/characters', async (req, res) => {
  const r = await pool.query(
    `SELECT wch.* FROM writing_characters wch
     JOIN writing_projects wp ON wp.id=wch.project_id
     WHERE wch.project_id=$1 AND wp.admin_id=$2 ORDER BY wch.name`,
    [req.params.id, req.admin.id]
  );
  res.json(r.rows);
});

router.post('/projects/:id/characters', async (req, res) => {
  const { name, description, notes } = req.body;
  const r = await pool.query(
    `INSERT INTO writing_characters (project_id, name, description, notes)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, name, description || '', notes || '']
  );
  res.json(r.rows[0]);
});

router.put('/characters/:id', async (req, res) => {
  const { name, description, notes } = req.body;
  await pool.query(
    `UPDATE writing_characters SET name=$1, description=$2, notes=$3, updated_at=NOW()
     WHERE id=$4 AND project_id IN (SELECT id FROM writing_projects WHERE admin_id=$5)`,
    [name, description, notes, req.params.id, req.admin.id]
  );
  res.json({ ok: true });
});

router.delete('/characters/:id', async (req, res) => {
  await pool.query(
    `DELETE FROM writing_characters WHERE id=$1
     AND project_id IN (SELECT id FROM writing_projects WHERE admin_id=$2)`,
    [req.params.id, req.admin.id]
  );
  res.json({ ok: true });
});

// ─── Places ───────────────────────────────────────────────────────────────────

router.get('/projects/:id/places', async (req, res) => {
  const r = await pool.query(
    `SELECT wpl.* FROM writing_places wpl
     JOIN writing_projects wp ON wp.id=wpl.project_id
     WHERE wpl.project_id=$1 AND wp.admin_id=$2 ORDER BY wpl.name`,
    [req.params.id, req.admin.id]
  );
  res.json(r.rows);
});

router.post('/projects/:id/places', async (req, res) => {
  const { name, description, notes } = req.body;
  const r = await pool.query(
    `INSERT INTO writing_places (project_id, name, description, notes)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, name, description || '', notes || '']
  );
  res.json(r.rows[0]);
});

router.put('/places/:id', async (req, res) => {
  const { name, description, notes } = req.body;
  await pool.query(
    `UPDATE writing_places SET name=$1, description=$2, notes=$3, updated_at=NOW()
     WHERE id=$4 AND project_id IN (SELECT id FROM writing_projects WHERE admin_id=$5)`,
    [name, description, notes, req.params.id, req.admin.id]
  );
  res.json({ ok: true });
});

router.delete('/places/:id', async (req, res) => {
  await pool.query(
    `DELETE FROM writing_places WHERE id=$1
     AND project_id IN (SELECT id FROM writing_projects WHERE admin_id=$2)`,
    [req.params.id, req.admin.id]
  );
  res.json({ ok: true });
});

// ─── AI placeholder ───────────────────────────────────────────────────────────

router.post('/ai', async (req, res) => {
  const { action_type, selected_text, chapter_context, instruction } = req.body;
  if (!selected_text && !chapter_context) {
    return res.status(400).json({ error: 'Brak tekstu do przetworzenia' });
  }

  const prompts = {
    improve_style: 'Popraw styl poniższego fragmentu. Zachowaj sens, popraw rytm zdania i podnieś jakość literacką.',
    expand_scene: 'Rozwiń poniższą scenę. Dodaj opisy zmysłowe, emocje postaci i szczegóły miejsca.',
    archaic_tone: 'Przepisz poniższy fragment na bardziej literacki, lekko archaiczny styl polski. Zachowaj sens, nie dodawaj nowych wydarzeń, popraw rytm zdania i podnieś styl. Nie przesadzaj z archaizmami.',
    propose_dialogue: 'Na podstawie poniższego kontekstu zaproponuj naturalny dialog między postaciami.',
    summarize_chapter: 'Napisz zwięzłe streszczenie poniższego rozdziału w 3-5 zdaniach.',
  };

  const systemPrompt = prompts[action_type] || instruction || 'Pomóż z poniższym tekstem literackim.';
  const text = selected_text || chapter_context;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: 'Jesteś asystentem pisarskim specjalizującym się w literaturze polskiej. Odpowiadasz tylko przetworzonym tekstem, bez komentarzy.',
      messages: [{ role: 'user', content: `${systemPrompt}\n\nTEKST:\n${text}` }],
    });
    await pool.query(
      `INSERT INTO writer_ai_actions (project_id, chapter_id, action_type, input_text, output_text)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.body.project_id || null, req.body.chapter_id || null, action_type, text, message.content[0].text]
    );
    res.json({ result: message.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
