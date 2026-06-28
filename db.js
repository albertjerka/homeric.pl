import dotenv from 'dotenv';
dotenv.config();

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id           SERIAL PRIMARY KEY,
      email        TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS books (
      id           SERIAL PRIMARY KEY,
      title        TEXT NOT NULL,
      language     TEXT NOT NULL,
      start_page   INTEGER DEFAULT 1,
      end_page     INTEGER,
      current_page INTEGER DEFAULT 1,
      total_pages  INTEGER,
      pdf_data     BYTEA,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pages (
      book_id    INTEGER NOT NULL,
      page_num   INTEGER NOT NULL,
      language   TEXT NOT NULL,
      data       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (book_id, page_num, language),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS images (
      book_id  INTEGER NOT NULL,
      page_num INTEGER NOT NULL,
      data     TEXT NOT NULL,
      PRIMARY KEY (book_id, page_num),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS writing_projects (
      id          SERIAL PRIMARY KEY,
      admin_id    INTEGER REFERENCES admins(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      description TEXT DEFAULT '',
      genre       TEXT DEFAULT '',
      language    TEXT DEFAULT 'pl',
      notes       TEXT DEFAULT '',
      word_count  INTEGER DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS writing_chapters (
      id           SERIAL PRIMARY KEY,
      project_id   INTEGER NOT NULL REFERENCES writing_projects(id) ON DELETE CASCADE,
      title        TEXT NOT NULL DEFAULT 'Nowy rozdział',
      content_json TEXT DEFAULT '{}',
      content_html TEXT DEFAULT '',
      content_text TEXT DEFAULT '',
      order_index  INTEGER DEFAULT 0,
      word_count   INTEGER DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS writing_characters (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER NOT NULL REFERENCES writing_projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      notes       TEXT DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS writing_places (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER NOT NULL REFERENCES writing_projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      notes       TEXT DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS writer_ai_actions (
      id           SERIAL PRIMARY KEY,
      project_id   INTEGER REFERENCES writing_projects(id) ON DELETE SET NULL,
      chapter_id   INTEGER REFERENCES writing_chapters(id) ON DELETE SET NULL,
      action_type  TEXT,
      input_text   TEXT,
      output_text  TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS linde_sources (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      volume      TEXT,
      source_url  TEXT,
      local_path  TEXT,
      format      TEXT,
      imported_at TIMESTAMPTZ,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS linde_entries (
      id                  SERIAL PRIMARY KEY,
      source_id           INTEGER REFERENCES linde_sources(id) ON DELETE CASCADE,
      headword            TEXT NOT NULL,
      normalized_headword TEXT NOT NULL,
      body                TEXT,
      volume              TEXT,
      page                TEXT,
      raw_text            TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_linde_normalized ON linde_entries(normalized_headword);

    CREATE TABLE IF NOT EXISTS linde_searches (
      id               SERIAL PRIMARY KEY,
      admin_id         INTEGER REFERENCES admins(id) ON DELETE SET NULL,
      query            TEXT NOT NULL,
      normalized_query TEXT NOT NULL,
      results_count    INTEGER DEFAULT 0,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export default pool;
