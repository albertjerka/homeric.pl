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

// ─── Homer AI — helpers ──────────────────────────────────────────────────────

const NORM_MAP = [['ą','a'],['ć','c'],['ę','e'],['ł','l'],['ń','n'],['ó','o'],['ś','s'],['ź','z'],['ż','z']];
function normPL(s) {
  let r = s.toLowerCase();
  for (const [a,b] of NORM_MAP) r = r.replaceAll(a, b);
  return r;
}

async function findDictionaryTerms(text, limit = 20) {
  const words = [...new Set(
    (text || '').toLowerCase()
      .replace(/[^a-ząćęłńóśźż\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4)
      .map(normPL)
  )].slice(0, 10);

  if (!words.length) return [];

  const conditions = words.map((w, i) => `normalized_headword ILIKE $${i+1}`).join(' OR ');
  const r = await pool.query(
    `SELECT headword, body, volume FROM linde_entries WHERE ${conditions}
     ORDER BY LENGTH(COALESCE(body,'')) DESC LIMIT $${words.length+1}`,
    [...words.map(w => `%${w}%`), limit]
  );
  return r.rows.map(e => ({
    headword: e.headword,
    source: `Linde Tom ${e.volume}`,
    body: (e.body || '').slice(0, 400),
  }));
}

const AI_MODES = {
  improve_style: {
    label: 'Popraw styl',
    system: 'Jesteś Homeric AI — literackim redaktorem języka polskiego. Popraw styl fragmentu, zachowując sens, ton i fakty. Nie streszczaj. Nie upraszczaj nadmiernie. Popraw rytm zdania, obrazowość i precyzję.',
  },
  archaic_tone: {
    label: 'Archaiczne',
    system: 'Jesteś Homeric AI — redaktorem stylu archaizującego. Przepisz fragment na piękniejszą, lekko dawną polszczyznę. Korzystaj z podanych haseł ze Słownika Lindego. Szukaj słów pochodnych, znaczeniowo bliskich i dawnych odpowiedników. Nie rób pastiszu. Tekst ma być literacki, ozdobny, szlachetny i czytelny.',
  },
  ornate: {
    label: 'Ozdobne',
    system: 'Jesteś Homeric AI — stylistą prozy literackiej. Rozwiń obrazowość, rytm i metaforykę zdania. Zachowaj sens, ale nadaj mu większą siłę, barwę i elegancję. Użyj słów podanych w polu "Słowa do sceny". Jeśli dostępne są hasła ze Słownika Lindego, wykorzystaj je jako inspirację.',
  },
  epic_tone: {
    label: 'Ton epicki',
    system: 'Jesteś Homeric AI — redaktorem stylu epickiego. Nadaj fragmentowi podniosłość, rytm i ciężar opowieści. Zachowaj sens i nie dodawaj nowych wydarzeń bez potrzeby. Tekst ma brzmieć jak fragment wielkiej opowieści.',
  },
  expand_scene: {
    label: 'Rozwiń scenę',
    system: 'Jesteś Homeric AI — asystentem pisarskim. Rozwiń poniższą scenę literacką. Dodaj opisy zmysłowe (wzrok, słuch, zapach, dotyk), pogłęb emocje postaci, wprowadź szczegóły miejsca. Nie zmieniaj fabuły.',
  },
  propose_dialogue: {
    label: 'Dialog',
    system: 'Jesteś Homeric AI — dramaturgiem. Na podstawie kontekstu literackiego zaproponuj naturalny, dramaturgicznie żywy dialog między postaciami. Dialog ma pasować do stylu i epoki.',
  },
  propose_variants: {
    label: 'Warianty zdania',
    system: 'Jesteś Homeric AI — tworzysz warianty jednego zdania. Podaj 5 różnych wersji: prostą, literacką, archaizującą, ozdobną i epicką. Każdą podpisz. Nie gub sensu oryginału.',
  },
  linde_words: {
    label: 'Słowa Lindego',
    system: 'Jesteś Homeric AI — leksykografem i stylistą. Znajdź mocniejsze, bardziej wyraziste lub archaiczne odpowiedniki słów z tekstu. Skorzystaj z haseł Słownika Lindego. Podaj listę: słowo oryginalne → propozycje.',
  },
  custom: {
    label: 'Własny prompt',
    system: 'Jesteś Homeric AI — elitarnym asystentem pisarskim specjalizującym się w literaturze polskiej, historycznej i klasycznej. Wykonaj polecenie użytkownika.',
  },
};

// ─── AI — historia dla rozdziału ─────────────────────────────────────────────

router.get('/chapters/:chapterId/ai-messages', async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  const r = await pool.query(
    `SELECT m.id, m.mode, m.prompt, m.input_text, m.output_text,
            m.selected_text, m.linde_terms_json, m.scene_words_json, m.created_at,
            s.id AS session_id
     FROM writer_ai_messages m
     JOIN writer_ai_sessions s ON s.id = m.session_id
     WHERE s.chapter_id = $1 AND m.role = 'assistant'
     ORDER BY m.created_at DESC
     LIMIT 50`,
    [chapterId]
  );
  res.json(r.rows);
});

// ─── AI — kontekst ze słowników ──────────────────────────────────────────────

router.post('/ai/dictionary-context', async (req, res) => {
  const { text, mode } = req.body;
  const terms = await findDictionaryTerms(text, 20);
  res.json({ terms });
});

// ─── Homer AI — główny endpoint ──────────────────────────────────────────────

router.post('/ai', async (req, res) => {
  const {
    mode = 'improve_style',
    prompt: userPrompt,
    input_text,
    selected_text,
    chapter_context,
    scene_words = [],
    use_linde = true,
    project_id,
    chapter_id,
    image_base64,
    image_media_type,
    // legacy compat
    action_type,
    instruction,
  } = req.body;

  const effectiveMode = mode || action_type || 'improve_style';
  const text = selected_text || input_text || chapter_context || '';

  if (!text.trim() && !image_base64) {
    return res.status(400).json({ error: 'Brak tekstu ani obrazka do przetworzenia.' });
  }

  const modeConfig = AI_MODES[effectiveMode] || AI_MODES.custom;
  const customInstruction = userPrompt || instruction || '';

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Pobierz kontekst ze słownika Lindego
    let lindeTerms = [];
    if (use_linde && text.trim()) {
      lindeTerms = await findDictionaryTerms(text, 20);
    }

    // Zbuduj prompt użytkownika
    let userTextParts = [];

    if (customInstruction.trim()) {
      userTextParts.push(`INSTRUKCJA UŻYTKOWNIKA:\n${customInstruction}`);
    }
    if (scene_words.length > 0) {
      userTextParts.push(`SŁOWA DO SCENY (obowiązkowo użyj jako inspiracji):\n${scene_words.join(', ')}`);
    }
    if (lindeTerms.length > 0) {
      const lindeSection = lindeTerms
        .map(t => `HASŁO: ${t.headword} (${t.source})\n${t.body}`)
        .join('\n\n---\n\n');
      userTextParts.push(`KONTEKST ZE SŁOWNIKA LINDEGO:\n${lindeSection}`);
    }
    if (text.trim()) {
      userTextParts.push(`TEKST DO OPRACOWANIA:\n${text}`);
    }

    userTextParts.push(
      `\nOdpowiedz w JSON (bez markdown, tylko obiekt JSON):\n` +
      `{"variants":[{"label":"Wersja poprawiona","text":"..."},{"label":"Wersja archaizująca","text":"..."},{"label":"Wersja ozdobna","text":"..."},{"label":"Wersja epicka","text":"..."}],"linde_inspirations":["słowo1","słowo2"],"editor_note":"krótka uwaga"}\n` +
      `Jeśli tryb nie wymaga wielu wariantów (np. dialog, streszczenie), użyj jednego wariantu z odpowiednim label.`
    );

    const userContent = [];
    if (image_base64) {
      userContent.push({ type: 'image', source: { type: 'base64', media_type: image_media_type || 'image/jpeg', data: image_base64 } });
    }
    userContent.push({ type: 'text', text: userTextParts.join('\n\n') });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: modeConfig.system,
      messages: [{ role: 'user', content: userContent }],
    });

    const rawOutput = message.content[0].text;

    // Spróbuj sparsować jako JSON, fallback do legacy
    let structured;
    try {
      const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
      structured = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      structured = null;
    }

    if (!structured) {
      structured = {
        variants: [{ label: 'Odpowiedź', text: rawOutput }],
        linde_inspirations: [],
        editor_note: '',
      };
    }

    // Zapisz w nowej tabeli writer_ai_messages
    let sessionId;
    try {
      let sessionR;
      if (chapter_id) {
        sessionR = await pool.query(
          `SELECT id FROM writer_ai_sessions WHERE chapter_id=$1 ORDER BY created_at DESC LIMIT 1`,
          [chapter_id]
        );
      }
      if (!sessionR?.rows?.length) {
        sessionR = await pool.query(
          `INSERT INTO writer_ai_sessions (project_id, chapter_id, title)
           VALUES ($1,$2,$3) RETURNING id`,
          [project_id||null, chapter_id||null, `Sesja AI — ${new Date().toLocaleString('pl-PL')}`]
        );
      }
      sessionId = sessionR.rows[0].id;

      await pool.query(
        `INSERT INTO writer_ai_messages
           (session_id, role, mode, prompt, input_text, output_text, selected_text, linde_terms_json, scene_words_json)
         VALUES ($1,'assistant',$2,$3,$4,$5,$6,$7,$8)`,
        [
          sessionId, effectiveMode,
          customInstruction.slice(0, 2000),
          text.slice(0, 2000),
          JSON.stringify(structured),
          (selected_text || '').slice(0, 1000),
          JSON.stringify(lindeTerms.map(t => t.headword)),
          JSON.stringify(scene_words),
        ]
      );
    } catch {}

    // Legacy: też zapisz w writer_ai_actions
    await pool.query(
      `INSERT INTO writer_ai_actions (project_id, chapter_id, action_type, input_text, output_text, image_data, image_media_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [project_id||null, chapter_id||null, effectiveMode, text.slice(0,2000), rawOutput, image_base64||null, image_media_type||null]
    ).catch(() => {});

    res.json({ result: rawOutput, structured, lindeTerms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
