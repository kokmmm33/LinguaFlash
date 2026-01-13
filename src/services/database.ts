import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function initDatabase(): Promise<void> {
  db = await Database.load('sqlite:ttime.db');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_text TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      source_lang VARCHAR(10),
      target_lang VARCHAR(10),
      engine VARCHAR(50),
      is_favorite INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export interface HistoryRecord {
  id: number;
  source_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  engine: string;
  is_favorite: boolean;
  created_at: string;
}

export async function addHistory(record: Omit<HistoryRecord, 'id' | 'created_at' | 'is_favorite'>): Promise<number> {
  if (!db) throw new Error('Database not initialized');

  const result = await db.execute(
    `INSERT INTO history (source_text, translated_text, source_lang, target_lang, engine)
     VALUES ($1, $2, $3, $4, $5)`,
    [record.source_text, record.translated_text, record.source_lang, record.target_lang, record.engine]
  );

  return result.lastInsertId ?? 0;
}

export async function getHistory(limit = 100, offset = 0): Promise<HistoryRecord[]> {
  if (!db) throw new Error('Database not initialized');

  const results = await db.select<HistoryRecord[]>(
    `SELECT * FROM history ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return results.map(r => ({ ...r, is_favorite: Boolean(r.is_favorite) }));
}

export async function searchHistory(query: string): Promise<HistoryRecord[]> {
  if (!db) throw new Error('Database not initialized');

  const results = await db.select<HistoryRecord[]>(
    `SELECT * FROM history WHERE source_text LIKE $1 OR translated_text LIKE $1 ORDER BY created_at DESC LIMIT 100`,
    [`%${query}%`]
  );

  return results.map(r => ({ ...r, is_favorite: Boolean(r.is_favorite) }));
}

export async function toggleFavorite(id: number): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  await db.execute(`UPDATE history SET is_favorite = NOT is_favorite WHERE id = $1`, [id]);
}

export async function getFavorites(): Promise<HistoryRecord[]> {
  if (!db) throw new Error('Database not initialized');

  const results = await db.select<HistoryRecord[]>(
    `SELECT * FROM history WHERE is_favorite = 1 ORDER BY created_at DESC`
  );

  return results.map(r => ({ ...r, is_favorite: true }));
}

export async function deleteHistory(id: number): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  await db.execute(`DELETE FROM history WHERE id = $1`, [id]);
}

export async function clearHistory(): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  await db.execute(`DELETE FROM history`);
}
