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
  `);
}

export default pool;
