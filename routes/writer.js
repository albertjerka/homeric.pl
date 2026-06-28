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

// Słowa puste — nie szukamy ich w słownikach
const STOP_WORDS = new Set([
  'i','w','na','się','że','oraz','albo','to','jest','był','ma','nie','a','o','z','do',
  'po','przez','przy','za','ale','bo','czy','jak','już','też','tylko','go','mu','jej',
  'ich','tam','tu','co','kto','który','gdy','kiedy','mnie','jego','te','ten','ta','więc',
  'są','by','dla','od','ze','we','im','on','ona','ono','oni','one','mój','twój','nasz',
  'wasz','tego','tej','temu','tą','tym','tych','tymi','pan','pani','być','mieć','robić',
  'więcej','mniej','było','będzie','się','swoją','swoje','swój','tego','tej','te','ci',
]);

// Pola semantyczne — rozszerzają wyszukiwanie o słowa bliskoznaczne
const SEMANTIC_FIELDS = [
  { key: ['smut','zal','bol','plak','zasmuc'], words: ['żal','boleść','frasunek','żałość','strapienie','zgryzota','tęsknota'] },
  { key: ['trwog','lek','strach','bac','bojaz'], words: ['lęk','bojaźń','trwoga','zatrwożenie','przestrach'] },
  { key: ['radosc','wesol','smia','uciech','szczesci'], words: ['wesele','uciecha','rozkosz','szczęście'] },
  { key: ['gniw','zlosc','wsciek','zapalcz'], words: ['złość','zapalczywość','oburzenie','wzburzenie'] },
  { key: ['ogien','plomien','zar','pozog','zarze'], words: ['płomień','żar','pożoga','zarzewie','zapłon'] },
  { key: ['wod','rzek','nurt','fal','topiel','strum'], words: ['nurt','fala','głębia','topiel','zdrój','strumień'] },
  { key: ['las','bor','puszcz','kneja'], words: ['bór','puszcza','kneja','ostępy','gąszcz'] },
  { key: ['los','dol','niedol','przeznacz'], words: ['dola','niedola','przeznaczenie','fatum','powinność'] },
  { key: ['pamiec','wspomn'], words: ['wspomnienie','pomnienie','niepamięć'] },
  { key: ['smierc','zgon','koniec','zatrat','skon'], words: ['zgon','skon','zatrata'] },
  { key: ['sila','moc','poteg','dzielnosc','krzepk'], words: ['moc','potęga','dzielność','krzepkość'] },
  { key: ['piekn','urod','wdziek','powab'], words: ['uroda','wdzięk','powab','śliczność'] },
  { key: ['dusz','serc','sumien','duch'], words: ['serce','sumienie','duch','wnętrze','czucie'] },
  { key: ['dom','chata','siedzib','domost'], words: ['domostwo','siedziba','ostoja','chata'] },
  { key: ['swiat','blask','jasn','zorz','promien'], words: ['blask','jasność','zorza','świt','promień','lśnienie'] },
  { key: ['walka','boj','bitw','potyczk'], words: ['bój','bitwa','potyczka','starcie','zmaganie'] },
  { key: ['milosc','milowa','ukoch'], words: ['miłowanie','ukochanie','przywiązanie'] },
];

// Końcówki fleksyjne do usuwania przy stemming
const SUFFIXES = [
  'ącego','ących','ącym','ącej','ości','anie','enie','ność','iem',
  'ego','emu','ami','ach','ący','ącą','ym','ej','ość','nie','owi','ią'
].sort((a, b) => b.length - a.length);

function stemPL(norm) {
  for (const suf of SUFFIXES) {
    if (norm.length - suf.length >= 3 && norm.endsWith(suf)) {
      return norm.slice(0, norm.length - suf.length);
    }
  }
  return norm;
}

function generateSearchPatterns(word) {
  const norm = normPL(word.toLowerCase());
  const patterns = new Set();
  patterns.add(`${norm}%`);
  const stem = stemPL(norm);
  if (stem !== norm && stem.length >= 3) patterns.add(`${stem}%`);
  for (let len = 4; len <= Math.min(6, norm.length - 1); len++) {
    patterns.add(`${norm.slice(0, len)}%`);
  }
  for (const field of SEMANTIC_FIELDS) {
    if (field.key.some(k => norm.startsWith(k) || (k.length >= 4 && norm.startsWith(k.slice(0, 4))))) {
      for (const w of field.words) patterns.add(`${normPL(w)}%`);
    }
  }
  return [...patterns].slice(0, 10);
}

async function findDictionaryTermsForWriting(text, sceneWords = []) {
  const contentWords = (text || '').toLowerCase()
    .replace(/[^a-ząćęłńóśźż\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));

  const allWords = [
    ...[...new Set(contentWords)].slice(0, 10),
    ...sceneWords.map(w => w.toLowerCase()),
  ];
  if (!allWords.length) return [];

  const allPatterns = new Set();
  for (const w of allWords) {
    for (const p of generateSearchPatterns(w)) allPatterns.add(p);
  }

  const arr = [...allPatterns].slice(0, 60);
  if (!arr.length) return [];

  const r = await pool.query(
    `SELECT DISTINCT ON (headword) headword, body, volume
     FROM linde_entries
     WHERE normalized_headword LIKE ANY($1::text[])
     ORDER BY headword, LENGTH(COALESCE(body,'')) DESC
     LIMIT 35`,
    [arr]
  );

  return r.rows.map(e => ({
    headword: e.headword,
    source: `Linde Tom ${e.volume}`,
    meaning: (e.body || '').slice(0, 220),
    body: (e.body || '').slice(0, 400),
  }));
}

async function findDictionaryTerms(text, limit = 30) {
  if (!text?.trim()) return [];

  // Wszystkie słowa ≥3 znaki, znormalizowane, unikalne
  const words = [...new Set(
    text.toLowerCase()
      .replace(/[^a-ząćęłńóśźż\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3)
      .map(normPL)
  )].slice(0, 14);

  if (!words.length) return [];

  // Prefix match (silniejsze) + substring match (słabsze) dla każdego słowa
  const parts = [];
  const params = [];
  for (const w of words) {
    parts.push(`(normalized_headword LIKE $${params.length+1} OR normalized_headword LIKE $${params.length+2})`);
    params.push(`${w}%`);
    params.push(`%${w}%`);
  }
  params.push(limit);

  const r = await pool.query(
    `SELECT DISTINCT ON (headword) headword, body, volume
     FROM linde_entries
     WHERE ${parts.join(' OR ')}
     ORDER BY headword, LENGTH(COALESCE(body,'')) DESC
     LIMIT $${params.length}`,
    params
  );

  return r.rows.map(e => ({
    headword: e.headword,
    source: `Linde Tom ${e.volume}`,
    body: (e.body || '').slice(0, 350),
  }));
}

// Parsowanie odpowiedzi JSON od Claude — odporny na markdown i błędy formatu
function parseAiResponse(raw) {
  // Usuń bloki markdown ```json ... ``` jeśli są
  let clean = raw.replace(/^```json\s*/gm, '').replace(/^```\s*/gm, '');

  // Znajdź obiekt JSON
  let parsed = null;
  try {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {}

  if (!parsed) {
    // Fallback: całość jako jeden wariant
    return {
      dictionary_material: [],
      related_words: [],
      variants: [{ label: 'Odpowiedź', text: raw }],
      editor_note: '',
    };
  }

  // Normalizuj pola
  return {
    dictionary_material: Array.isArray(parsed.dictionary_material) ? parsed.dictionary_material : [],
    related_words: Array.isArray(parsed.related_words) ? parsed.related_words : [],
    variants: Array.isArray(parsed.variants) && parsed.variants.length
      ? parsed.variants
      : [{ label: 'Odpowiedź', text: raw }],
    editor_note: parsed.editor_note || '',
  };
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

// ─── AI — historia dla rozdziału ─────────────────────────────────────────────

router.get('/chapters/:chapterId/ai-messages', async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  const r = await pool.query(
    `SELECT m.id, m.mode, m.prompt, m.input_text, m.output_text,
            m.selected_text, m.linde_terms_json, m.scene_words_json, m.created_at
     FROM writer_ai_messages m
     JOIN writer_ai_sessions s ON s.id = m.session_id
     WHERE s.chapter_id = $1 AND m.role = 'assistant'
     ORDER BY m.created_at DESC LIMIT 50`,
    [chapterId]
  );
  res.json(r.rows);
});

// ─── AI — kontekst słownikowy ─────────────────────────────────────────────────

router.post('/ai/dictionary-context', async (req, res) => {
  const { text, scene_words } = req.body;
  const terms = await findDictionaryTermsForWriting(text, scene_words || []);
  res.json({ terms });
});

// ─── Homer AI — główny endpoint ──────────────────────────────────────────────

const HOMER_AI_SYSTEM = `Jesteś Homeric AI — literackim redaktorem, stylistą i pomocnikiem pisarza. Twoim zadaniem nie jest szybkie parafrazowanie, ale praca pisarska ze słownikiem, znaczeniem, rytmem i obrazem.

ZASADA: Przy każdej pracy nad tekstem najpierw analizujesz słownictwo, a dopiero potem tworzysz warianty.

ETAP 1 — ANALIZA SŁOWNIKOWA:
Wydobywasz z tekstu słowa ważne (rzeczowniki, czasowniki, przymiotniki, obrazy, emocje) i ignorujesz słowa puste (spójniki, zaimki, przyimki). Dla każdego ważnego słowa szukasz w przekazanym materiale słownikowym (KONTEKST SŁOWNIKOWY): haseł, znaczeń, słów pochodnych, bliskoznacznych, archaicznych odpowiedników. Korzystasz z Lindego i dostępnych słowników.

ETAP 2 — WARIANTY LITERACKIE:
Tworzysz minimum 4 warianty. Styl archaiczny nie oznacza losowych starych słów — oznacza dawny rytm, szlachetniejszy szyk, pojęcia moralne (cnota, hańba, powinność, sumienie, dola, niedola) i obrazowe (cień, blask, pył, żar, mgła, świt). Inspirujesz się prozą XIX-wieczną (Sienkiewicz, Kraszewski, Orzeszkowa, Prus), ale tworzysz tekst oryginalny.

FORMAT ODPOWIEDZI — zwróć WYŁĄCZNIE czysty JSON (bez nawiasów \`\`\`, bez tekstu przed lub po):

{
  "dictionary_material": [
    { "headword": "hasło z Linde", "source": "Linde Tom X", "meaning": "krótkie znaczenie do 150 znaków", "suggested_use": "przykład frazy z tym słowem" }
  ],
  "related_words": [
    { "base": "słowo z tekstu", "words": ["bliskoznaczne1", "archaiczny_odpowiednik", "pochodne"] }
  ],
  "variants": [
    { "label": "Wersja poprawiona", "text": "..." },
    { "label": "Wersja archaizująca", "text": "..." },
    { "label": "Wersja ozdobna", "text": "..." },
    { "label": "Wersja epicka", "text": "..." }
  ],
  "editor_note": "Co zmieniono i dlaczego — 1-3 zdania."
}`;

const MODE_EXTRA_PROMPT = {
  improve_style: 'Główny cel: poprawiony rytm, precyzja i styl bez archaizowania.',
  archaic_tone: 'Główny cel: dawna polszczyzna, szlachetniejszy szyk, pojęcia moralne i obrazowe, umiarkowana archaizacja. Wersja archaizująca powinna być wyraźnie różna od poprawionej. Wersja bardzo archaizująca może użyć: trwoga, frasunek, żałość, boleść, przeto, jeno, tedy, snadź, zali, albowiem.',
  ornate: 'Główny cel: metafora, rytm, bogatsza obrazowość, silniejsze czasowniki. Wersja ozdobna powinna być poetycka ale czytelna.',
  epic_tone: 'Główny cel: podniosłość, ciężar słowa, ton wielkiej opowieści. Wersja epicka ma brzmieć jak fragment eposu lub powieści historycznej.',
  expand_scene: 'Główny cel: rozwinięcie sceny — opisy zmysłowe, emocje postaci, szczegóły miejsca. Daj 2 warianty rozwinięcia o różnej długości.',
  propose_dialogue: 'Główny cel: naturalny, dramaturgicznie żywy dialog między postaciami pasujący do stylu i epoki.',
  propose_variants: 'Główny cel: 5 wariantów o różnym stylu: prosty, literacki, archaizujący, ozdobny, epicki.',
  linde_words: 'Główny cel: lista mocniejszych i bardziej wyrazistych odpowiedników słów z tekstu, czerpiąc z Lindego. W variants wpisz listę: "słowo oryginalne → propozycja1, propozycja2".',
  custom: 'Wykonaj polecenie użytkownika.',
};

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
    history = [],
    action_type,
    instruction,
  } = req.body;

  const effectiveMode = mode || action_type || 'improve_style';
  const text = selected_text || input_text || chapter_context || '';
  const customInstruction = userPrompt || instruction || '';

  if (!text.trim() && !image_base64 && !customInstruction.trim()) {
    return res.status(400).json({ error: 'Brak tekstu, promptu ani obrazka.' });
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Etap słownikowy — zawsze przed AI
    const lindeTerms = (use_linde && (text.trim() || scene_words.length))
      ? await findDictionaryTermsForWriting(text, scene_words)
      : [];

    // Kontekst słownikowy do promptu
    const lindeContext = lindeTerms.length
      ? 'KONTEKST SŁOWNIKOWY (Słownik Lindego — użyj jako materiału stylistycznego):\n' +
        lindeTerms.map(t => `• ${t.headword} [${t.source}]: ${t.meaning}`).join('\n') +
        '\n\n'
      : '';

    // Kontekst historii (ostatnie 3 wymiany)
    const histContext = history.slice(-6).length
      ? 'HISTORIA ROZMOWY:\n' +
        history.slice(-6).map(h => `${h.role === 'user' ? 'PISARZ' : 'AI'}: ${String(h.content).slice(0, 350)}`).join('\n\n') +
        '\n\n'
      : '';

    const sceneContext = scene_words.length
      ? `SŁOWA DO SCENY (obowiązkowo wpleć w warianty): ${scene_words.join(', ')}\n\n`
      : '';

    const modeExtra = MODE_EXTRA_PROMPT[effectiveMode] || MODE_EXTRA_PROMPT.custom;

    const userMessage = [
      histContext,
      lindeContext,
      sceneContext,
      `TRYB: ${effectiveMode}\n${modeExtra}\n\n`,
      customInstruction.trim() ? `INSTRUKCJA PISARZA: ${customInstruction}\n\n` : '',
      text.trim() ? `TEKST DO OPRACOWANIA:\n${text}\n\n` : '',
    ].join('').trim();

    const userContent = image_base64
      ? [
          { type: 'image', source: { type: 'base64', media_type: image_media_type || 'image/jpeg', data: image_base64 } },
          { type: 'text', text: userMessage },
        ]
      : userMessage;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3500,
      system: HOMER_AI_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    });

    const rawOutput = message.content[0].text;
    const structured = parseAiResponse(rawOutput);

    // Zapisz w bazie
    try {
      let sessionR = chapter_id
        ? await pool.query(`SELECT id FROM writer_ai_sessions WHERE chapter_id=$1 ORDER BY created_at DESC LIMIT 1`, [chapter_id])
        : { rows: [] };
      if (!sessionR.rows.length) {
        sessionR = await pool.query(
          `INSERT INTO writer_ai_sessions (project_id, chapter_id, title) VALUES ($1,$2,$3) RETURNING id`,
          [project_id||null, chapter_id||null, `Sesja AI`]
        );
      }
      await pool.query(
        `INSERT INTO writer_ai_messages
           (session_id, role, mode, prompt, input_text, output_text, selected_text, linde_terms_json, scene_words_json)
         VALUES ($1,'assistant',$2,$3,$4,$5,$6,$7,$8)`,
        [
          sessionR.rows[0].id, effectiveMode,
          customInstruction.slice(0, 2000), text.slice(0, 2000),
          rawOutput.slice(0, 4000),
          (selected_text || '').slice(0, 1000),
          JSON.stringify(lindeTerms.map(t => t.headword)),
          JSON.stringify(scene_words),
        ]
      );
    } catch {}

    await pool.query(
      `INSERT INTO writer_ai_actions (project_id, chapter_id, action_type, input_text, output_text, image_data, image_media_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [project_id||null, chapter_id||null, effectiveMode, text.slice(0,2000), rawOutput.slice(0,4000), image_base64||null, image_media_type||null]
    ).catch(() => {});

    res.json({ structured, lindeTerms, mode: effectiveMode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
