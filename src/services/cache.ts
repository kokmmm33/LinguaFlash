import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:linguaflash.db');
  }
  return db;
}

export interface CacheEntry {
  source_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  engine: string;
}

export async function getCache(
  text: string,
  sourceLang: string,
  targetLang: string,
  engine: string
): Promise<string | null> {
  const database = await getDb();
  const results = await database.select<{ translated_text: string }[]>(
    `SELECT translated_text FROM translation_cache
     WHERE source_text = $1 AND source_lang = $2 AND target_lang = $3 AND engine = $4`,
    [text, sourceLang, targetLang, engine]
  );

  if (results.length > 0) {
    // 更新命中次数和最后使用时间
    await database.execute(
      `UPDATE translation_cache
       SET hit_count = hit_count + 1, last_used_at = CURRENT_TIMESTAMP
       WHERE source_text = $1 AND source_lang = $2 AND target_lang = $3 AND engine = $4`,
      [text, sourceLang, targetLang, engine]
    );
    return results[0].translated_text;
  }
  return null;
}

export async function getBatchCache(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  engine: string
): Promise<Map<string, string>> {
  const database = await getDb();
  const result = new Map<string, string>();

  if (texts.length === 0) return result;

  // 使用 IN 查询批量获取
  const placeholders = texts.map((_, i) => `$${i + 1}`).join(',');
  const params = [...texts, sourceLang, targetLang, engine];

  const results = await database.select<{ source_text: string; translated_text: string }[]>(
    `SELECT source_text, translated_text FROM translation_cache
     WHERE source_text IN (${placeholders})
     AND source_lang = $${texts.length + 1}
     AND target_lang = $${texts.length + 2}
     AND engine = $${texts.length + 3}`,
    params
  );

  for (const row of results) {
    result.set(row.source_text, row.translated_text);
  }

  return result;
}

export async function setCache(entry: CacheEntry): Promise<void> {
  const database = await getDb();
  await database.execute(
    `INSERT INTO translation_cache (source_text, translated_text, source_lang, target_lang, engine)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(source_text, source_lang, target_lang, engine)
     DO UPDATE SET translated_text = $2, last_used_at = CURRENT_TIMESTAMP, hit_count = hit_count + 1`,
    [entry.source_text, entry.translated_text, entry.source_lang, entry.target_lang, entry.engine]
  );
}

export async function clearCache(): Promise<void> {
  const database = await getDb();
  await database.execute('DELETE FROM translation_cache');
}

export async function getCacheStats(): Promise<{ total: number; hits: number }> {
  const database = await getDb();
  const results = await database.select<{ total: number; hits: number }[]>(
    'SELECT COUNT(*) as total, SUM(hit_count) as hits FROM translation_cache'
  );
  return results[0] || { total: 0, hits: 0 };
}
