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
  const { title, content_json, content_html, content_text, word_count, notes, save_version } = req.body;
  await pool.query(
    `UPDATE writing_chapters
     SET title=$1, content_json=$2, content_html=$3, content_text=$4, word_count=$5, notes=$6, updated_at=NOW()
     WHERE id=$7 AND project_id IN (SELECT id FROM writing_projects WHERE admin_id=$8)`,
    [title, content_json || '{}', content_html || '', content_text || '', word_count || 0,
     notes || '', req.params.id, req.admin.id]
  );
  await pool.query(
    `UPDATE writing_projects SET word_count=(
       SELECT COALESCE(SUM(word_count),0) FROM writing_chapters WHERE project_id=writing_projects.id
     ), updated_at=NOW()
     WHERE id=(SELECT project_id FROM writing_chapters WHERE id=$1)`,
    [req.params.id]
  );
  if (save_version && content_json) {
    await pool.query(
      `INSERT INTO chapter_versions (chapter_id, content_json, content_html, content_text, word_count)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, content_json, content_html || '', content_text || '', word_count || 0]
    );
  }
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

// ─── Chapter versions ─────────────────────────────────────────────────────────

router.get('/chapters/:id/versions', async (req, res) => {
  const r = await pool.query(
    `SELECT cv.id, cv.word_count, cv.created_at
     FROM chapter_versions cv
     JOIN writing_chapters wc ON wc.id = cv.chapter_id
     JOIN writing_projects wp ON wp.id = wc.project_id
     WHERE cv.chapter_id = $1 AND wp.admin_id = $2
     ORDER BY cv.created_at DESC LIMIT 50`,
    [req.params.id, req.admin.id]
  );
  res.json(r.rows);
});

router.get('/versions/:id', async (req, res) => {
  const r = await pool.query(
    `SELECT cv.* FROM chapter_versions cv
     JOIN writing_chapters wc ON wc.id = cv.chapter_id
     JOIN writing_projects wp ON wp.id = wc.project_id
     WHERE cv.id = $1 AND wp.admin_id = $2`,
    [req.params.id, req.admin.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Nie znaleziono wersji' });
  res.json(r.rows[0]);
});

router.delete('/versions/:id', async (req, res) => {
  await pool.query(
    `DELETE FROM chapter_versions WHERE id=$1
     AND chapter_id IN (
       SELECT wc.id FROM writing_chapters wc
       JOIN writing_projects wp ON wp.id = wc.project_id
       WHERE wp.admin_id = $2
     )`,
    [req.params.id, req.admin.id]
  );
  res.json({ ok: true });
});

// ─── Export ───────────────────────────────────────────────────────────────────

router.get('/projects/:id/export', async (req, res) => {
  const proj = await pool.query(
    'SELECT * FROM writing_projects WHERE id=$1 AND admin_id=$2',
    [req.params.id, req.admin.id]
  );
  if (!proj.rows[0]) return res.status(404).json({ error: 'Nie znaleziono projektu' });
  const p = proj.rows[0];

  const chapters = await pool.query(
    'SELECT title, content_text, content_html FROM writing_chapters WHERE project_id=$1 ORDER BY order_index ASC, created_at ASC',
    [req.params.id]
  );

  const format = req.query.format || 'txt';

  if (format === 'txt') {
    let txt = `${p.title}\n${'═'.repeat(p.title.length)}\n\n`;
    if (p.description) txt += `${p.description}\n\n`;
    for (const ch of chapters.rows) {
      txt += `\n── ${ch.title} ──\n\n${ch.content_text || ''}\n`;
    }
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${p.title.replace(/[^a-z0-9ąćęłńóśźż ]/gi,'_')}.txt"`);
    return res.send(txt);
  }

  if (format === 'html') {
    let html = `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>${p.title}</title>
<style>
  body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 24px;line-height:1.8;color:#1a1a1a}
  h1{font-size:2em;margin-bottom:.3em} h2{font-size:1.4em;margin:2em 0 .5em;border-bottom:1px solid #ccc;padding-bottom:.3em}
  p{margin:.7em 0} blockquote{border-left:3px solid #888;padding-left:1em;color:#444;font-style:italic}
</style></head><body>
<h1>${p.title}</h1>
${p.description ? `<p style="color:#666;font-style:italic">${p.description}</p>` : ''}`;
    for (const ch of chapters.rows) {
      html += `\n<h2>${ch.title}</h2>\n${ch.content_html || '<p></p>'}`;
    }
    html += `\n</body></html>`;
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${p.title.replace(/[^a-z0-9ąćęłńóśźż ]/gi,'_')}.html"`);
    return res.send(html);
  }

  if (format === 'docx') {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      const children = [
        new Paragraph({ text: p.title, heading: HeadingLevel.TITLE }),
      ];
      if (p.description) {
        children.push(new Paragraph({ children: [new TextRun({ text: p.description, italics: true, color: '666666' })] }));
      }
      for (const ch of chapters.rows) {
        children.push(new Paragraph({ text: ch.title, heading: HeadingLevel.HEADING_1 }));
        const lines = (ch.content_text || '').split('\n');
        for (const line of lines) {
          children.push(new Paragraph({ children: [new TextRun(line)] }));
        }
      }
      const doc = new Document({ sections: [{ children }] });
      const buf = await Packer.toBuffer(doc);
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.set('Content-Disposition', `attachment; filename="${p.title.replace(/[^a-z0-9ąćęłńóśźż ]/gi,'_')}.docx"`);
      return res.send(buf);
    } catch (err) {
      return res.status(500).json({ error: `DOCX: ${err.message}` });
    }
  }

  res.status(400).json({ error: 'Nieznany format. Użyj: txt, html, docx' });
});

// ─── Homer AI ────────────────────────────────────────────────────────────────

router.post('/ai', async (req, res) => {
  const {
    action_type, selected_text, chapter_context, instruction,
    image_base64, image_media_type,
  } = req.body;

  const text = selected_text || chapter_context || '';
  if (!text.trim() && !image_base64) {
    return res.status(400).json({ error: 'Brak tekstu ani obrazka do przetworzenia' });
  }

  const systemPrompts = {
    improve_style: 'Popraw styl poniższego fragmentu literackiego. Zachowaj sens i narrację, popraw rytm zdań, usuń powtórzenia, podnieś jakość językową. Odpowiedz tylko poprawionym tekstem.',
    expand_scene: 'Rozwiń poniższą scenę literacką. Dodaj opisy zmysłowe (wzrok, słuch, zapach, dotyk), pogłęb emocje postaci, wprowadź szczegóły miejsca. Nie zmieniaj fabuły. Odpowiedz tylko rozbudowanym tekstem.',
    archaic_tone: 'Przepisz poniższy fragment na bardziej literacki, lekko archaiczny styl polski. Zachowaj sens i fabułę, popraw rytm zdania, podnieś styl. Nie przesadzaj z archaizmami — tekst ma być czytelny. Odpowiedz tylko przepisanym tekstem.',
    propose_dialogue: 'Na podstawie poniższego kontekstu literackiego zaproponuj naturalny, dramaturgicznie żywy dialog między postaciami. Dialog ma pasować do stylu i epoki. Odpowiedz tylko dialogiem w formacie scenicznym.',
    summarize_chapter: 'Napisz literackie, zwięzłe streszczenie poniższego fragmentu w 3–5 zdaniach. Zachowaj atmosferę i kluczowe momenty. Odpowiedz tylko streszczeniem.',
    custom: instruction || 'Wykonaj poniższe zadanie dotyczące tekstu lub obrazu literackiego. Odpowiedz po polsku.',
  };

  const system = systemPrompts[action_type] || systemPrompts.custom;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userContent = [];

    if (image_base64) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image_media_type || 'image/jpeg',
          data: image_base64,
        },
      });
    }

    if (text.trim()) {
      const label = action_type === 'custom' ? 'KONTEKST' : 'TEKST';
      userContent.push({ type: 'text', text: `${label}:\n${text}` });
    } else if (image_base64 && action_type === 'custom') {
      userContent.push({ type: 'text', text: instruction || 'Opisz i zinterpretuj ten obraz w kontekście literackim.' });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `Jesteś Homer AI — elitarnym asystentem pisarskim specjalizującym się w literaturze polskiej, historycznej i klasycznej. ${system}`,
      messages: [{ role: 'user', content: userContent }],
    });

    const output = message.content[0].text;

    await pool.query(
      `INSERT INTO writer_ai_actions
         (project_id, chapter_id, action_type, input_text, output_text, image_data, image_media_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        req.body.project_id || null,
        req.body.chapter_id || null,
        action_type,
        text.slice(0, 2000),
        output,
        image_base64 || null,
        image_media_type || null,
      ]
    );

    res.json({ result: output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
