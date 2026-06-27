import { saveBook, savePage, getAllBooks } from './dbApi.js';

const LS_PREFIX = 'uanna_page_';
const MIGRATION_FLAG = 'uanna_migrated_v1';

export async function migrateFromLocalStorage(onProgress) {
  if (localStorage.getItem(MIGRATION_FLAG)) return null;

  // Znajdź wszystkie klucze uanna_page_*
  const keys = Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX));
  if (!keys.length) {
    localStorage.setItem(MIGRATION_FLAG, '1');
    return null;
  }

  // Zgrupuj po języku
  const byLang = {};
  for (const key of keys) {
    // format: uanna_page_${page}_${lang}
    const rest = key.slice(LS_PREFIX.length);
    const lastUnderscore = rest.lastIndexOf('_');
    const page = Number(rest.slice(0, lastUnderscore));
    const lang = rest.slice(lastUnderscore + 1);
    if (!page || !lang) continue;

    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (!data?.polish_translation) continue;
      if (!byLang[lang]) byLang[lang] = [];
      byLang[lang].push({ page, data, key });
    } catch {}
  }

  const langs = Object.keys(byLang);
  if (!langs.length) {
    localStorage.setItem(MIGRATION_FLAG, '1');
    return null;
  }

  const importedBooks = [];

  for (const lang of langs) {
    const entries = byLang[lang].sort((a, b) => a.page - b.page);
    const maxPage = entries[entries.length - 1].page;
    const langLabel = lang === 'ru' ? 'Rosyjski' : lang === 'uk' ? 'Ukraiński' : 'Angielski';

    onProgress?.(`Importuję ${entries.length} stron (${langLabel})…`);

    const bookId = await saveBook({
      title: `Import ${langLabel} ${new Date().toLocaleDateString('pl-PL')}`,
      language: lang,
      startPage: entries[0].page,
      endPage: maxPage,
      currentPage: entries[0].page,
      totalPages: maxPage,
    });

    for (const { page, data, key } of entries) {
      await savePage(bookId, page, lang, data);
      localStorage.removeItem(key);
    }

    importedBooks.push({ bookId, title: `Import ${langLabel}`, count: entries.length });
  }

  localStorage.setItem(MIGRATION_FLAG, '1');
  return importedBooks;
}
