import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:linguaflash.db');
  }
  return db;
}

export interface Term {
  id: number;
  term: string;
  translation: string | null;
  created_at: string;
}

export async function getTerms(): Promise<Term[]> {
  const database = await getDb();
  return database.select<Term[]>('SELECT * FROM terms ORDER BY term');
}

export async function addTerm(term: string, translation: string | null): Promise<Term> {
  const database = await getDb();
  const result = await database.execute(
    'INSERT INTO terms (term, translation) VALUES ($1, $2)',
    [term, translation]
  );
  return {
    id: result.lastInsertId ?? 0,
    term,
    translation,
    created_at: new Date().toISOString(),
  };
}

export async function updateTerm(id: number, term: string, translation: string | null): Promise<void> {
  const database = await getDb();
  await database.execute(
    'UPDATE terms SET term = $1, translation = $2 WHERE id = $3',
    [term, translation, id]
  );
}

export async function deleteTerm(id: number): Promise<void> {
  const database = await getDb();
  await database.execute('DELETE FROM terms WHERE id = $1', [id]);
}
