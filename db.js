import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'uanna.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    language    TEXT    NOT NULL,
    start_page  INTEGER DEFAULT 1,
    end_page    INTEGER,
    current_page INTEGER DEFAULT 1,
    total_pages INTEGER,
    pdf_data    BLOB,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pages (
    book_id    INTEGER NOT NULL,
    page_num   INTEGER NOT NULL,
    language   TEXT    NOT NULL,
    data       TEXT    NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (book_id, page_num, language),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS images (
    book_id  INTEGER NOT NULL,
    page_num INTEGER NOT NULL,
    data     TEXT    NOT NULL,
    PRIMARY KEY (book_id, page_num),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  );
`);

export default db;
