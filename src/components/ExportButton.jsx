export default function ExportButton({ language, bookTitle, pageImages, prominent }) {
  function handleExport() {
    const pages = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const match = key?.match(/^uanna_page_(\d+)_([a-z]+)$/);
      if (match && match[2] === language) {
        try { pages.push({ pageNum: parseInt(match[1]), data: JSON.parse(localStorage.getItem(key)) }); }
        catch {}
      }
    }
    pages.sort((a, b) => a.pageNum - b.pageNum);

    if (!pages.length) {
      alert('Brak przetłumaczonych stron. Przejdź przez kilka stron najpierw.');
      return;
    }

    const win = window.open('', '_blank');
    win.document.write(buildHTML(pages, bookTitle, language, pageImages));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 800);
  }

  return (
    <button
      className={prominent ? 'btn-export-prominent' : 'btn-export'}
      onClick={handleExport}
      title="Otwiera okno wydruku – wybierz 'Zapisz jako PDF'"
    >
      ↓ Pobierz PDF
    </button>
  );
}

function buildHTML(pages, bookTitle, language, pageImages) {
  const langName = language === 'ru' ? 'rosyjski' : 'angielski';
  const date = new Date().toLocaleDateString('pl-PL');

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Crimson Pro', Georgia, serif; font-size: 11.5pt; color: #1a1a1a; background: #fff; padding: 0; }
    .title-page { text-align: center; padding: 80px 40px; page-break-after: always; }
    .sigil { font-size: 40pt; color: #b8924a; margin-bottom: 20px; }
    .title-page h1 { font-family: 'Inter', sans-serif; font-size: 22pt; color: #7a5c20; margin-bottom: 10px; font-weight: 500; }
    .title-page .sub { font-size: 12pt; color: #888; margin: 6px 0; font-family: 'Inter', sans-serif; }
    .title-page .author { font-size: 9pt; color: #bbb; margin-top: 32px; font-family: 'Inter', sans-serif; }
    .page { page-break-after: always; padding: 0 0 32px; }
    .page-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #c9a84c; padding-bottom: 6px; margin-bottom: 20px; }
    .page-num { font-family: 'Inter', sans-serif; font-size: 11pt; font-weight: 600; color: #7a5c20; }
    .page-lang { font-family: 'Inter', sans-serif; font-size: 8pt; color: #bbb; }
    h3 { font-family: 'Inter', sans-serif; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 2px; color: #7a5c20; margin: 20px 0 8px; padding-bottom: 3px; border-bottom: 1px solid #e8dcc8; }
    .translation { font-size: 11.5pt; line-height: 1.8; color: #111; margin-bottom: 4px; }
    .vocab-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 4px; }
    .vocab-table td { padding: 3px 8px 3px 0; vertical-align: top; line-height: 1.4; }
    .vocab-word { color: #1a3a8a; font-weight: 600; width: 32%; }
    .vocab-trans { color: #333; width: 35%; }
    .vocab-note { color: #888; font-style: italic; font-size: 9pt; }
    .context-summary { color: #555; font-style: italic; font-size: 10.5pt; line-height: 1.6; margin-bottom: 8px; }
    .context-note { color: #666; font-size: 9.5pt; line-height: 1.5; padding: 3px 0 3px 12px; border-left: 2px solid #c9a84c; margin-bottom: 4px; }
    .sentence-block { margin-bottom: 10px; padding: 8px 12px; background: #f8f5ef; border-radius: 5px; }
    .sentence-orig { color: #1a2a5a; font-size: 10.5pt; line-height: 1.5; margin-bottom: 3px; }
    .sentence-pl { color: #666; font-style: italic; font-size: 10pt; }
    .image-prompt { font-size: 9.5pt; color: #444; line-height: 1.55; padding: 10px 14px; background: #f5f0e8; border-left: 3px solid #c9a84c; border-radius: 0 5px 5px 0; }
    .page-image { max-width: 100%; max-height: 220px; margin: 8px 0; border-radius: 5px; display: block; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { page-break-after: always; }
      .title-page { page-break-after: always; }
    }
  `;

  const titlePage = `
    <div class="title-page">
      <div class="sigil">𒀭</div>
      <h1>${esc(bookTitle || 'UANNA')}</h1>
      <p class="sub">Nauczyciel języka z Twoich ulubionych tekstów</p>
      <p class="sub" style="margin-top:24px;">Język: <strong>${langName}</strong> &nbsp;·&nbsp; Stron: <strong>${pages.length}</strong> &nbsp;·&nbsp; ${date}</p>
      <p class="author">Autor: Albert Jerka</p>
    </div>`;

  const contentPages = pages.map(({ pageNum, data }) => {
    const imgs = pageImages?.[pageNum] || [];

    const vocab = data.vocabulary?.length ? `
      <h3>Słowniczek</h3>
      <table class="vocab-table">
        ${data.vocabulary.map(v => `
          <tr>
            <td class="vocab-word">${esc(v.word)}</td>
            <td class="vocab-trans">→ ${esc(v.translation)}</td>
            <td class="vocab-note">${esc(v.note || '')}</td>
          </tr>`).join('')}
      </table>` : '';

    const context = data.context ? `
      <h3>Kontekst i objaśnienia</h3>
      ${data.context.summary ? `<p class="context-summary">${esc(data.context.summary)}</p>` : ''}
      ${(data.context.notes || []).map(n => `<div class="context-note">${esc(n)}</div>`).join('')}` : '';

    const imagePrompt = data.image_prompt ? `
      <h3>🎬 Prompt do obrazka</h3>
      <div class="image-prompt">${esc(data.image_prompt)}</div>` : '';

    const sentences = data.sentences?.length ? `
      <h3>Zdanie po zdaniu</h3>
      ${data.sentences.map(s => `
        <div class="sentence-block">
          <div class="sentence-orig">${esc(s.original)}</div>
          <div class="sentence-pl">${esc(s.polish)}</div>
        </div>`).join('')}` : '';

    const images = imgs.length ? `
      <h3>Obrazki</h3>
      ${imgs.map(src => `<img class="page-image" src="${src}" />`).join('')}` : '';

    return `
      <div class="page">
        <div class="page-header">
          <span class="page-lang">${esc(bookTitle || 'UANNA')} · ${language.toUpperCase()}</span>
          <span class="page-num">Strona ${pageNum}</span>
        </div>
        <h3>Tłumaczenie polskie</h3>
        <div class="translation">${esc(data.polish_translation || '')}</div>
        ${vocab}${context}${imagePrompt}${sentences}${images}
      </div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><title>UANNA – ${esc(bookTitle || 'eksport')}</title><style>${css}</style></head><body>${titlePage}${contentPages}</body></html>`;
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
