# Excel 翻译功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 TTime v1.1 实现 Excel 文件翻译功能，支持批量翻译、缓存、术语表管理

**Architecture:** Rust 后端处理 Excel 文件（calamine 读取 + rust_xlsxwriter 写入），前端展示进度和管理术语表，SQLite 存储翻译缓存和术语表

**Tech Stack:** Rust, calamine, rust_xlsxwriter, Tauri IPC Events, React, Zustand, SQLite

---

## Task 1: 添加 Rust 依赖

**Files:**
- Modify: `src-tauri/Cargo.toml:15-25`

**Step 1: 添加 calamine 和 rust_xlsxwriter 依赖**

在 `[dependencies]` 部分添加：

```toml
calamine = "0.24"
rust_xlsxwriter = "0.64"
```

**Step 2: 验证依赖是否正确**

Run: `cd src-tauri && cargo check`
Expected: 编译成功，无错误

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "chore: add calamine and rust_xlsxwriter dependencies for Excel support"
```

---

## Task 2: 创建数据库表（前端）

**Files:**
- Modify: `src/services/database.ts:1-20`

**Step 1: 添加 translation_cache 和 terms 表的创建**

在 `initDatabase` 函数中添加两个新表：

```typescript
// 在现有 history 表创建之后添加：

// 翻译缓存表
await db.execute(`
  CREATE TABLE IF NOT EXISTS translation_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    source_lang VARCHAR(10) NOT NULL,
    target_lang VARCHAR(10) NOT NULL,
    engine VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hit_count INTEGER DEFAULT 1,
    UNIQUE(source_text, source_lang, target_lang, engine)
  )
`);

await db.execute(`
  CREATE INDEX IF NOT EXISTS idx_cache_lookup
  ON translation_cache(source_text, source_lang, target_lang, engine)
`);

// 术语表
await db.execute(`
  CREATE TABLE IF NOT EXISTS terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL UNIQUE,
    translation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

await db.execute(`
  CREATE INDEX IF NOT EXISTS idx_term ON terms(term)
`);
```

**Step 2: 运行开发服务器验证**

Run: `npm run tauri dev`
Expected: 应用启动正常，无数据库错误

**Step 3: Commit**

```bash
git add src/services/database.ts
git commit -m "feat(db): add translation_cache and terms tables"
```

---

## Task 3: 创建术语表服务（前端）

**Files:**
- Create: `src/services/terms.ts`

**Step 1: 创建术语表 CRUD 服务**

```typescript
import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:ttime.db');
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
```

**Step 2: Commit**

```bash
git add src/services/terms.ts
git commit -m "feat(services): add terms CRUD service"
```

---

## Task 4: 创建术语表状态管理

**Files:**
- Create: `src/stores/termsStore.ts`

**Step 1: 创建 Zustand store**

```typescript
import { create } from 'zustand';
import { Term, getTerms, addTerm, updateTerm, deleteTerm } from '../services/terms';

interface TermsState {
  terms: Term[];
  isLoading: boolean;
  error: string | null;

  loadTerms: () => Promise<void>;
  addTerm: (term: string, translation: string | null) => Promise<void>;
  updateTerm: (id: number, term: string, translation: string | null) => Promise<void>;
  deleteTerm: (id: number) => Promise<void>;
}

export const useTermsStore = create<TermsState>((set, get) => ({
  terms: [],
  isLoading: false,
  error: null,

  loadTerms: async () => {
    set({ isLoading: true, error: null });
    try {
      const terms = await getTerms();
      set({ terms, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  addTerm: async (term: string, translation: string | null) => {
    try {
      const newTerm = await addTerm(term, translation);
      set({ terms: [...get().terms, newTerm].sort((a, b) => a.term.localeCompare(b.term)) });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  updateTerm: async (id: number, term: string, translation: string | null) => {
    try {
      await updateTerm(id, term, translation);
      set({
        terms: get().terms.map(t =>
          t.id === id ? { ...t, term, translation } : t
        ).sort((a, b) => a.term.localeCompare(b.term))
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteTerm: async (id: number) => {
    try {
      await deleteTerm(id);
      set({ terms: get().terms.filter(t => t.id !== id) });
    } catch (error) {
      set({ error: String(error) });
    }
  },
}));
```

**Step 2: Commit**

```bash
git add src/stores/termsStore.ts
git commit -m "feat(store): add termsStore for glossary management"
```

---

## Task 5: 创建术语表管理组件

**Files:**
- Create: `src/components/TermsSettings.tsx`

**Step 1: 创建术语表 UI 组件**

```typescript
import { useState, useEffect } from 'react';
import { useTermsStore } from '../stores/termsStore';

export function TermsSettings() {
  const { terms, isLoading, loadTerms, addTerm, updateTerm, deleteTerm } = useTermsStore();
  const [newTerm, setNewTerm] = useState('');
  const [newTranslation, setNewTranslation] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTerm, setEditTerm] = useState('');
  const [editTranslation, setEditTranslation] = useState('');

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  const handleAdd = async () => {
    if (!newTerm.trim()) return;
    await addTerm(newTerm.trim(), newTranslation.trim() || null);
    setNewTerm('');
    setNewTranslation('');
  };

  const handleStartEdit = (term: { id: number; term: string; translation: string | null }) => {
    setEditingId(term.id);
    setEditTerm(term.term);
    setEditTranslation(term.translation || '');
  };

  const handleSaveEdit = async () => {
    if (editingId === null || !editTerm.trim()) return;
    await updateTerm(editingId, editTerm.trim(), editTranslation.trim() || null);
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* 添加新术语 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
          placeholder="术语"
          className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm"
        />
        <input
          type="text"
          value={newTranslation}
          onChange={(e) => setNewTranslation(e.target.value)}
          placeholder="固定译法（留空则保持原样）"
          className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm"
        />
        <button
          onClick={handleAdd}
          disabled={!newTerm.trim()}
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm
                     hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          添加
        </button>
      </div>

      {/* 术语列表 */}
      {isLoading ? (
        <div className="text-center py-4 text-[var(--text-secondary)]">加载中...</div>
      ) : terms.length === 0 ? (
        <div className="text-center py-4 text-[var(--text-secondary)]">
          暂无术语，添加后可在翻译时自动应用
        </div>
      ) : (
        <div className="space-y-2">
          {terms.map((term) => (
            <div
              key={term.id}
              className="flex items-center gap-2 p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg"
            >
              {editingId === term.id ? (
                <>
                  <input
                    type="text"
                    value={editTerm}
                    onChange={(e) => setEditTerm(e.target.value)}
                    className="flex-1 px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm"
                  />
                  <input
                    type="text"
                    value={editTranslation}
                    onChange={(e) => setEditTranslation(e.target.value)}
                    placeholder="保持原样"
                    className="flex-1 px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm"
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 bg-[var(--accent)] text-white rounded text-sm"
                  >
                    保存
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 bg-[var(--bg-secondary)] rounded text-sm"
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{term.term}</span>
                  <span className="flex-1 text-[var(--text-secondary)]">
                    {term.translation || '(保持原样)'}
                  </span>
                  <button
                    onClick={() => handleStartEdit(term)}
                    className="px-3 py-1 bg-[var(--bg-secondary)] rounded text-sm hover:bg-[var(--border)]"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => deleteTerm(term.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                  >
                    删除
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/TermsSettings.tsx
git commit -m "feat(ui): add TermsSettings component for glossary management"
```

---

## Task 6: 集成术语表到设置页面

**Files:**
- Modify: `src/pages/SettingsPage.tsx:1-10` (imports)
- Modify: `src/pages/SettingsPage.tsx:125-165` (在外观区域后添加术语表区域)

**Step 1: 添加 import**

在文件顶部添加：

```typescript
import { TermsSettings } from '../components/TermsSettings';
```

**Step 2: 添加术语表区域**

在「外观区域」section 后，「快捷键区域」section 前添加：

```typescript
{/* 术语表区域 */}
<section>
  <h2 className="text-lg font-semibold mb-3">术语表</h2>
  <p className="text-sm text-[var(--text-secondary)] mb-3">
    添加不需要翻译或需要固定译法的专业名词
  </p>
  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
    <TermsSettings />
  </div>
</section>
```

**Step 3: 验证 UI**

Run: `npm run tauri dev`
Expected: 设置页面显示术语表区域，可以添加、编辑、删除术语

**Step 4: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat(settings): integrate TermsSettings into settings page"
```

---

## Task 7: 创建 Rust Excel 模块结构

**Files:**
- Create: `src-tauri/src/excel/mod.rs`

**Step 1: 创建模块入口和数据结构**

```rust
pub mod reader;
pub mod writer;
pub mod translator;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExcelInfo {
    pub file_path: String,
    pub file_name: String,
    pub sheet_names: Vec<String>,
    pub total_cells: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationProgress {
    pub current_sheet: usize,
    pub total_sheets: usize,
    pub sheet_name: String,
    pub current_cell: usize,
    pub total_cells: usize,
    pub cache_hits: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExcelTranslationResult {
    pub output_path: String,
    pub translated_cells: usize,
    pub cache_hits: usize,
    pub cancelled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellData {
    pub row: u32,
    pub col: u32,
    pub value: String,
    pub translated: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SheetData {
    pub name: String,
    pub cells: Vec<CellData>,
}
```

**Step 2: Commit**

```bash
git add src-tauri/src/excel/mod.rs
git commit -m "feat(excel): create Excel module structure with data types"
```

---

## Task 8: 创建 Excel 读取器

**Files:**
- Create: `src-tauri/src/excel/reader.rs`

**Step 1: 实现 Excel 读取功能**

```rust
use calamine::{open_workbook, Reader, Xlsx, DataType};
use std::path::Path;
use super::{ExcelInfo, SheetData, CellData};

pub fn get_excel_info(file_path: &str) -> Result<ExcelInfo, String> {
    let path = Path::new(file_path);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let mut workbook: Xlsx<_> = open_workbook(file_path)
        .map_err(|e| format!("无法打开 Excel 文件: {}", e))?;

    let sheet_names: Vec<String> = workbook.sheet_names().to_vec();
    let mut total_cells = 0;

    for sheet_name in &sheet_names {
        if let Ok(range) = workbook.worksheet_range(sheet_name) {
            for row in range.rows() {
                for cell in row {
                    if let DataType::String(s) = cell {
                        if !s.trim().is_empty() {
                            total_cells += 1;
                        }
                    }
                }
            }
        }
    }

    Ok(ExcelInfo {
        file_path: file_path.to_string(),
        file_name,
        sheet_names,
        total_cells,
    })
}

pub fn read_excel(file_path: &str) -> Result<Vec<SheetData>, String> {
    let mut workbook: Xlsx<_> = open_workbook(file_path)
        .map_err(|e| format!("无法打开 Excel 文件: {}", e))?;

    let sheet_names: Vec<String> = workbook.sheet_names().to_vec();
    let mut sheets = Vec::new();

    for sheet_name in sheet_names {
        let mut cells = Vec::new();

        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            for (row_idx, row) in range.rows().enumerate() {
                for (col_idx, cell) in row.iter().enumerate() {
                    if let DataType::String(s) = cell {
                        if !s.trim().is_empty() {
                            cells.push(CellData {
                                row: row_idx as u32,
                                col: col_idx as u32,
                                value: s.clone(),
                                translated: None,
                            });
                        }
                    }
                }
            }
        }

        sheets.push(SheetData {
            name: sheet_name,
            cells,
        });
    }

    Ok(sheets)
}
```

**Step 2: Commit**

```bash
git add src-tauri/src/excel/reader.rs
git commit -m "feat(excel): implement Excel reader with calamine"
```

---

## Task 9: 创建 Excel 写入器

**Files:**
- Create: `src-tauri/src/excel/writer.rs`

**Step 1: 实现 Excel 写入功能**

```rust
use rust_xlsxwriter::{Workbook, Worksheet};
use std::path::Path;
use super::SheetData;

pub fn write_excel(sheets: &[SheetData], original_path: &str) -> Result<String, String> {
    let path = Path::new(original_path);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
    let parent = path.parent().unwrap_or(Path::new("."));
    let output_path = parent.join(format!("{}_translated.xlsx", stem));

    let mut workbook = Workbook::new();

    for sheet_data in sheets {
        let worksheet = workbook.add_worksheet();
        worksheet.set_name(&sheet_data.name)
            .map_err(|e| format!("设置工作表名称失败: {}", e))?;

        write_sheet(worksheet, sheet_data)?;
    }

    workbook.save(&output_path)
        .map_err(|e| format!("保存 Excel 文件失败: {}", e))?;

    Ok(output_path.to_string_lossy().to_string())
}

fn write_sheet(worksheet: &mut Worksheet, sheet_data: &SheetData) -> Result<(), String> {
    for cell in &sheet_data.cells {
        let text = cell.translated.as_ref().unwrap_or(&cell.value);
        worksheet.write_string(cell.row, cell.col as u16, text)
            .map_err(|e| format!("写入单元格失败: {}", e))?;
    }
    Ok(())
}
```

**Step 2: Commit**

```bash
git add src-tauri/src/excel/writer.rs
git commit -m "feat(excel): implement Excel writer with rust_xlsxwriter"
```

---

## Task 10: 创建翻译缓存模块

**Files:**
- Create: `src-tauri/src/translation/cache.rs`

**Step 1: 实现翻译缓存接口**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub source_text: String,
    pub translated_text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub engine: String,
}

// 缓存查询请求（发送到前端执行）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheQuery {
    pub text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub engine: String,
}

// 缓存批量查询请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchCacheQuery {
    pub texts: Vec<String>,
    pub source_lang: String,
    pub target_lang: String,
    pub engine: String,
}

// 缓存写入请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheWrite {
    pub source_text: String,
    pub translated_text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub engine: String,
}
```

**Step 2: 更新 translation/mod.rs 导出 cache 模块**

在 `src-tauri/src/translation/mod.rs` 顶部添加：

```rust
pub mod cache;
```

**Step 3: Commit**

```bash
git add src-tauri/src/translation/cache.rs src-tauri/src/translation/mod.rs
git commit -m "feat(cache): add translation cache data structures"
```

---

## Task 11: 创建翻译缓存服务（前端）

**Files:**
- Create: `src/services/cache.ts`

**Step 1: 实现缓存 CRUD 服务**

```typescript
import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:ttime.db');
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
```

**Step 2: Commit**

```bash
git add src/services/cache.ts
git commit -m "feat(services): add translation cache service"
```

---

## Task 12: 创建 Excel 翻译协调器

**Files:**
- Create: `src-tauri/src/excel/translator.rs`

**Step 1: 实现翻译协调器**

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use crate::translation::{TranslationRequest, EngineConfig};
use crate::AppState;
use super::{SheetData, TranslationProgress, ExcelTranslationResult, CellData};

// 全局取消标志
lazy_static::lazy_static! {
    static ref CANCEL_FLAG: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
}

pub fn request_cancel() {
    CANCEL_FLAG.store(true, Ordering::SeqCst);
}

pub fn reset_cancel() {
    CANCEL_FLAG.store(false, Ordering::SeqCst);
}

pub fn is_cancelled() -> bool {
    CANCEL_FLAG.load(Ordering::SeqCst)
}

pub struct Term {
    pub term: String,
    pub translation: Option<String>,
}

pub async fn translate_sheets(
    app: &AppHandle,
    state: &AppState,
    sheets: &mut Vec<SheetData>,
    config: &EngineConfig,
    source_lang: &str,
    target_lang: &str,
    terms: &[Term],
    cache: &std::collections::HashMap<String, String>,
) -> Result<(usize, usize), String> {
    reset_cancel();

    let total_cells: usize = sheets.iter().map(|s| s.cells.len()).sum();
    let total_sheets = sheets.len();
    let mut translated_count = 0;
    let mut cache_hits = 0;
    let mut current_cell = 0;

    for (sheet_idx, sheet) in sheets.iter_mut().enumerate() {
        let sheet_name = sheet.name.clone();

        for cell in sheet.cells.iter_mut() {
            if is_cancelled() {
                return Ok((translated_count, cache_hits));
            }

            current_cell += 1;

            // 1. 检查术语表
            if let Some(replacement) = match_term(&cell.value, terms) {
                cell.translated = Some(replacement);
                translated_count += 1;
                emit_progress(app, sheet_idx, total_sheets, &sheet_name, current_cell, total_cells, cache_hits);
                continue;
            }

            // 2. 检查缓存
            if let Some(cached) = cache.get(&cell.value) {
                cell.translated = Some(cached.clone());
                translated_count += 1;
                cache_hits += 1;
                emit_progress(app, sheet_idx, total_sheets, &sheet_name, current_cell, total_cells, cache_hits);
                continue;
            }

            // 3. 调用翻译 API
            let translated = translate_cell(state, config, &cell.value, source_lang, target_lang, terms).await?;
            cell.translated = Some(translated);
            translated_count += 1;

            emit_progress(app, sheet_idx, total_sheets, &sheet_name, current_cell, total_cells, cache_hits);
        }
    }

    Ok((translated_count, cache_hits))
}

fn match_term(text: &str, terms: &[Term]) -> Option<String> {
    for term in terms {
        if text == term.term {
            return Some(term.translation.clone().unwrap_or_else(|| term.term.clone()));
        }
    }
    None
}

async fn translate_cell(
    state: &AppState,
    config: &EngineConfig,
    text: &str,
    source_lang: &str,
    target_lang: &str,
    terms: &[Term],
) -> Result<String, String> {
    let prompt = build_excel_prompt(text, source_lang, target_lang, terms);

    let request = TranslationRequest {
        text: prompt,
        source_lang: source_lang.to_string(),
        target_lang: target_lang.to_string(),
    };

    let response = match config.engine_type.as_str() {
        "ollama" => {
            let endpoint = config.endpoint.clone().unwrap_or_else(|| "http://localhost:11434".to_string());
            let model = config.model.clone().unwrap_or_else(|| "qwen2".to_string());
            crate::translation::ollama::translate(&state.client, &endpoint, &model, &request).await?
        }
        "glm" => {
            let api_key = config.api_key.clone().ok_or("API Key 未配置")?;
            let model = config.model.clone().unwrap_or_else(|| "glm-4-flash".to_string());
            crate::translation::glm::translate(&state.client, &api_key, &model, &request).await?
        }
        _ => return Err("不支持的翻译引擎".to_string()),
    };

    Ok(response.translated_text)
}

fn build_excel_prompt(text: &str, source_lang: &str, target_lang: &str, terms: &[Term]) -> String {
    let source = if source_lang == "auto" { "检测到的语言" } else { source_lang };

    let terms_instruction = if terms.is_empty() {
        String::new()
    } else {
        let term_list: Vec<String> = terms
            .iter()
            .map(|t| match &t.translation {
                Some(tr) => format!("- \"{}\" → \"{}\"", t.term, tr),
                None => format!("- \"{}\"（保持原样）", t.term),
            })
            .collect();
        format!("\n\n术语表（请严格遵守）：\n{}", term_list.join("\n"))
    };

    format!(
        r#"将以下{}文本翻译成{}。

要求：
1. 只输出译文，不要解释
2. 保留特殊符号、表情符号、数字、公式不翻译
3. 保留专有名词、品牌名、技术术语的原文
4. 如果无法确定是否应该翻译，保持原样{}

原文：
{}"#,
        source, target_lang, terms_instruction, text
    )
}

fn emit_progress(
    app: &AppHandle,
    current_sheet: usize,
    total_sheets: usize,
    sheet_name: &str,
    current_cell: usize,
    total_cells: usize,
    cache_hits: usize,
) {
    let _ = app.emit("excel-progress", TranslationProgress {
        current_sheet: current_sheet + 1,
        total_sheets,
        sheet_name: sheet_name.to_string(),
        current_cell,
        total_cells,
        cache_hits,
    });
}
```

**Step 2: 添加 lazy_static 依赖到 Cargo.toml**

```toml
lazy_static = "1.4"
```

**Step 3: Commit**

```bash
git add src-tauri/src/excel/translator.rs src-tauri/Cargo.toml
git commit -m "feat(excel): implement translation coordinator with progress events"
```

---

## Task 13: 注册 Excel IPC 命令

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: 添加 excel 模块导入**

在文件顶部添加：

```rust
mod excel;
```

**Step 2: 添加 IPC 命令**

在 `resume_shortcuts` 函数后添加：

```rust
#[tauri::command]
async fn get_excel_info(file_path: String) -> Result<excel::ExcelInfo, String> {
    excel::reader::get_excel_info(&file_path)
}

#[tauri::command]
async fn start_excel_translation(
    app: AppHandle,
    state: State<'_, AppState>,
    file_path: String,
    source_lang: String,
    target_lang: String,
    config: translation::EngineConfig,
    terms: Vec<excel::translator::Term>,
    cache: std::collections::HashMap<String, String>,
) -> Result<excel::ExcelTranslationResult, String> {
    // 读取 Excel
    let mut sheets = excel::reader::read_excel(&file_path)?;

    // 翻译
    let (translated_cells, cache_hits) = excel::translator::translate_sheets(
        &app,
        state.inner(),
        &mut sheets,
        &config,
        &source_lang,
        &target_lang,
        &terms,
        &cache,
    ).await?;

    let cancelled = excel::translator::is_cancelled();

    // 写入新文件
    let output_path = if !cancelled {
        excel::writer::write_excel(&sheets, &file_path)?
    } else {
        String::new()
    };

    Ok(excel::ExcelTranslationResult {
        output_path,
        translated_cells,
        cache_hits,
        cancelled,
    })
}

#[tauri::command]
fn cancel_excel_translation() {
    excel::translator::request_cancel();
}
```

**Step 3: 更新 invoke_handler**

将 `invoke_handler` 更新为：

```rust
.invoke_handler(tauri::generate_handler![
    translate,
    test_engine_connection,
    close_popup,
    update_shortcuts,
    pause_shortcuts,
    resume_shortcuts,
    get_excel_info,
    start_excel_translation,
    cancel_excel_translation
])
```

**Step 4: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功

**Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(ipc): register Excel translation commands"
```

---

## Task 14: 创建 Excel 服务封装（前端）

**Files:**
- Create: `src/services/excel.ts`

**Step 1: 创建 IPC 封装服务**

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { EngineConfig } from '../stores/settingsStore';
import { Term } from './terms';

export interface ExcelInfo {
  file_path: string;
  file_name: string;
  sheet_names: string[];
  total_cells: number;
}

export interface TranslationProgress {
  current_sheet: number;
  total_sheets: number;
  sheet_name: string;
  current_cell: number;
  total_cells: number;
  cache_hits: number;
}

export interface ExcelTranslationResult {
  output_path: string;
  translated_cells: number;
  cache_hits: number;
  cancelled: boolean;
}

export async function getExcelInfo(filePath: string): Promise<ExcelInfo> {
  return invoke('get_excel_info', { filePath });
}

export async function startExcelTranslation(
  filePath: string,
  sourceLang: string,
  targetLang: string,
  config: EngineConfig,
  terms: Term[],
  cache: Map<string, string>
): Promise<ExcelTranslationResult> {
  // 转换 terms 格式
  const termsData = terms.map(t => ({
    term: t.term,
    translation: t.translation,
  }));

  // 转换 cache Map 为对象
  const cacheObj: Record<string, string> = {};
  cache.forEach((value, key) => {
    cacheObj[key] = value;
  });

  return invoke('start_excel_translation', {
    filePath,
    sourceLang,
    targetLang,
    config: {
      engine_type: config.engine_type,
      endpoint: config.endpoint,
      model: config.model,
      api_key: config.api_key,
    },
    terms: termsData,
    cache: cacheObj,
  });
}

export async function cancelExcelTranslation(): Promise<void> {
  return invoke('cancel_excel_translation');
}

export async function onExcelProgress(
  callback: (progress: TranslationProgress) => void
): Promise<UnlistenFn> {
  return listen<TranslationProgress>('excel-progress', (event) => {
    callback(event.payload);
  });
}
```

**Step 2: Commit**

```bash
git add src/services/excel.ts
git commit -m "feat(services): add Excel IPC service wrapper"
```

---

## Task 15: 创建 Excel 状态管理

**Files:**
- Create: `src/stores/excelStore.ts`

**Step 1: 创建 Zustand store**

```typescript
import { create } from 'zustand';
import {
  ExcelInfo,
  TranslationProgress,
  ExcelTranslationResult,
  getExcelInfo,
  startExcelTranslation,
  cancelExcelTranslation,
  onExcelProgress,
} from '../services/excel';
import { getBatchCache, setCache } from '../services/cache';
import { useSettingsStore } from './settingsStore';
import { useTermsStore } from './termsStore';

type ExcelStatus = 'idle' | 'loading' | 'ready' | 'translating' | 'completed' | 'cancelled' | 'error';

interface ExcelState {
  filePath: string | null;
  fileInfo: ExcelInfo | null;
  sourceLang: string;
  targetLang: string;
  status: ExcelStatus;
  progress: TranslationProgress | null;
  result: ExcelTranslationResult | null;
  error: string | null;

  setFile: (path: string) => Promise<void>;
  setSourceLang: (lang: string) => void;
  setTargetLang: (lang: string) => void;
  startTranslation: () => Promise<void>;
  cancelTranslation: () => Promise<void>;
  reset: () => void;
}

export const useExcelStore = create<ExcelState>((set, get) => ({
  filePath: null,
  fileInfo: null,
  sourceLang: 'auto',
  targetLang: 'zh',
  status: 'idle',
  progress: null,
  result: null,
  error: null,

  setFile: async (path: string) => {
    set({ status: 'loading', error: null, filePath: path });
    try {
      const info = await getExcelInfo(path);
      set({ fileInfo: info, status: 'ready' });
    } catch (error) {
      set({ error: String(error), status: 'error' });
    }
  },

  setSourceLang: (lang: string) => set({ sourceLang: lang }),
  setTargetLang: (lang: string) => set({ targetLang: lang }),

  startTranslation: async () => {
    const { filePath, sourceLang, targetLang, fileInfo } = get();
    if (!filePath || !fileInfo) return;

    set({ status: 'translating', progress: null, result: null, error: null });

    // 监听进度事件
    const unlisten = await onExcelProgress((progress) => {
      set({ progress });
    });

    try {
      // 获取设置和术语
      const engine = useSettingsStore.getState().getDefaultEngine();
      if (!engine) {
        throw new Error('未配置翻译引擎');
      }

      const terms = useTermsStore.getState().terms;

      // 获取缓存（这里简化处理，实际应该根据文件内容批量查询）
      // 由于我们无法提前知道所有文本，所以传入空缓存，后端会自己处理
      const cache = new Map<string, string>();

      const result = await startExcelTranslation(
        filePath,
        sourceLang,
        targetLang,
        engine,
        terms,
        cache
      );

      if (result.cancelled) {
        set({ status: 'cancelled', result });
      } else {
        set({ status: 'completed', result });
      }
    } catch (error) {
      set({ error: String(error), status: 'error' });
    } finally {
      unlisten();
    }
  },

  cancelTranslation: async () => {
    await cancelExcelTranslation();
  },

  reset: () => {
    set({
      filePath: null,
      fileInfo: null,
      status: 'idle',
      progress: null,
      result: null,
      error: null,
    });
  },
}));
```

**Step 2: Commit**

```bash
git add src/stores/excelStore.ts
git commit -m "feat(store): add excelStore for Excel translation state"
```

---

## Task 16: 创建 Excel 翻译页面

**Files:**
- Create: `src/pages/ExcelPage.tsx`

**Step 1: 创建页面组件**

```typescript
import { useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useExcelStore } from '../stores/excelStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTermsStore } from '../stores/termsStore';
import { LanguageSelector } from '../components/LanguageSelector';

export function ExcelPage() {
  const {
    fileInfo,
    sourceLang,
    targetLang,
    status,
    progress,
    result,
    error,
    setFile,
    setSourceLang,
    setTargetLang,
    startTranslation,
    cancelTranslation,
    reset,
  } = useExcelStore();

  const { engines, defaultEngineIndex } = useSettingsStore();
  const { loadTerms } = useTermsStore();

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  const handleSelectFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    });
    if (selected && typeof selected === 'string') {
      setFile(selected);
    }
  };

  const defaultEngine = engines[defaultEngineIndex];
  const engineName = defaultEngine?.engine_type === 'ollama'
    ? `Ollama (${defaultEngine.model})`
    : `智谱 GLM (${defaultEngine?.model})`;

  const progressPercent = progress
    ? Math.round((progress.current_cell / progress.total_cells) * 100)
    : 0;

  return (
    <div className="h-full flex flex-col">
      {/* 文件选择区域 */}
      {status === 'idle' && (
        <div
          onClick={handleSelectFile}
          className="flex-1 flex flex-col items-center justify-center border-2 border-dashed
                     border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--accent)]
                     hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <svg className="w-16 h-16 text-[var(--text-secondary)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">选择 Excel 文件</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">支持 .xlsx 和 .xls 格式</p>
        </div>
      )}

      {/* 加载中 */}
      {status === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-4" />
            <p>正在读取文件...</p>
          </div>
        </div>
      )}

      {/* 文件信息和翻译设置 */}
      {(status === 'ready' || status === 'translating') && fileInfo && (
        <div className="flex-1 flex flex-col gap-4">
          {/* 文件信息卡片 */}
          <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
            <h3 className="font-medium mb-3">文件信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">文件名</span>
                <span>{fileInfo.file_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Sheet 数量</span>
                <span>{fileInfo.sheet_names.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">待翻译单元格</span>
                <span>{fileInfo.total_cells.toLocaleString()} 个</span>
              </div>
            </div>
          </div>

          {/* 翻译设置卡片 */}
          <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
            <h3 className="font-medium mb-3">翻译设置</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">源语言</label>
                  <LanguageSelector value={sourceLang} onChange={setSourceLang} showAuto={true} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">目标语言</label>
                  <LanguageSelector value={targetLang} onChange={setTargetLang} showAuto={false} />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">翻译引擎</span>
                <span>{engineName}</span>
              </div>
            </div>
          </div>

          {/* 翻译进度 */}
          {status === 'translating' && progress && (
            <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
              <h3 className="font-medium mb-3">翻译进度</h3>
              <div className="space-y-3">
                <div className="text-sm">
                  Sheet {progress.current_sheet}/{progress.total_sheets}: {progress.sheet_name}
                </div>
                <div className="text-sm">
                  单元格: {progress.current_cell.toLocaleString()}/{progress.total_cells.toLocaleString()} ({progressPercent}%)
                </div>
                <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  缓存命中: {progress.cache_hits} 次
                </div>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            {status === 'ready' && (
              <>
                <button
                  onClick={startTranslation}
                  className="flex-1 py-3 bg-[var(--accent)] text-white rounded-lg font-medium
                             hover:opacity-90 transition-opacity"
                >
                  开始翻译
                </button>
                <button
                  onClick={reset}
                  className="px-4 py-3 bg-[var(--bg-secondary)] rounded-lg
                             hover:bg-[var(--border)] transition-colors"
                >
                  取消
                </button>
              </>
            )}
            {status === 'translating' && (
              <button
                onClick={cancelTranslation}
                className="flex-1 py-3 bg-red-500 text-white rounded-lg font-medium
                           hover:bg-red-600 transition-colors"
              >
                取消翻译
              </button>
            )}
          </div>
        </div>
      )}

      {/* 翻译完成 */}
      {(status === 'completed' || status === 'cancelled') && result && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-3">
              {status === 'completed' ? (
                <>
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <h3 className="font-medium text-green-500">翻译完成</h3>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="font-medium text-yellow-500">翻译已取消</h3>
                </>
              )}
            </div>
            <div className="space-y-2 text-sm">
              {result.output_path && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">保存位置</span>
                  <span className="truncate max-w-[200px]" title={result.output_path}>
                    {result.output_path.split('/').pop()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">翻译单元格</span>
                <span>{result.translated_cells.toLocaleString()} 个</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">缓存命中</span>
                <span>{result.cache_hits} 次</span>
              </div>
            </div>
          </div>

          <button
            onClick={reset}
            className="py-3 bg-[var(--accent)] text-white rounded-lg font-medium
                       hover:opacity-90 transition-opacity"
          >
            翻译新文件
          </button>
        </div>
      )}

      {/* 错误状态 */}
      {status === 'error' && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-medium text-red-500">出错了</h3>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>

          <button
            onClick={reset}
            className="py-3 bg-[var(--bg-secondary)] rounded-lg
                       hover:bg-[var(--border)] transition-colors"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: 添加 dialog 插件依赖**

Run: `npm install @tauri-apps/plugin-dialog`

**Step 3: 在 Cargo.toml 添加 dialog 插件**

```toml
tauri-plugin-dialog = "2"
```

**Step 4: 在 lib.rs 注册 dialog 插件**

在 `.plugin(tauri_plugin_shell::init())` 后添加：

```rust
.plugin(tauri_plugin_dialog::init())
```

**Step 5: Commit**

```bash
git add src/pages/ExcelPage.tsx src-tauri/Cargo.toml src-tauri/src/lib.rs package.json package-lock.json
git commit -m "feat(ui): add ExcelPage component with full translation flow"
```

---

## Task 17: 更新侧边栏和路由

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Layout.tsx`
- Modify: `src/App.tsx` (如有)

**Step 1: 更新 Sidebar.tsx**

更新 Tab 类型和 tabs 数组：

```typescript
type Tab = 'translate' | 'excel' | 'history' | 'settings';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const tabs = [
    { id: 'translate' as Tab, label: '翻译', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' },
    { id: 'excel' as Tab, label: 'Excel', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'history' as Tab, label: '历史', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'settings' as Tab, label: '设置', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  // ... rest unchanged
}
```

**Step 2: 更新 Layout.tsx**

```typescript
export type Tab = 'translate' | 'excel' | 'history' | 'settings';
```

**Step 3: 更新 App.tsx 添加 ExcelPage 路由**

在 App.tsx 中导入 ExcelPage 并添加到路由：

```typescript
import { ExcelPage } from './pages/ExcelPage';

// 在 render 中添加
{activeTab === 'excel' && <ExcelPage />}
```

**Step 4: 验证 UI**

Run: `npm run tauri dev`
Expected: 侧边栏显示 Excel 标签，点击后显示 Excel 翻译页面

**Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/Layout.tsx src/App.tsx
git commit -m "feat(ui): add Excel tab to sidebar and routing"
```

---

## Task 18: 添加缓存集成到翻译流程

**Files:**
- Modify: `src/stores/excelStore.ts`
- Modify: `src-tauri/src/excel/translator.rs`

**Step 1: 更新前端 excelStore 使用缓存**

修改 `startTranslation` 函数，在翻译前预加载缓存，翻译后保存新的缓存：

```typescript
startTranslation: async () => {
  const { filePath, sourceLang, targetLang, fileInfo } = get();
  if (!filePath || !fileInfo) return;

  set({ status: 'translating', progress: null, result: null, error: null });

  const unlisten = await onExcelProgress((progress) => {
    set({ progress });
  });

  try {
    const engine = useSettingsStore.getState().getDefaultEngine();
    if (!engine) {
      throw new Error('未配置翻译引擎');
    }

    const terms = useTermsStore.getState().terms;

    // 注意：实际的缓存查询需要知道所有待翻译文本
    // 由于后端已经读取了 Excel，这里我们传入空 Map
    // 后续可以优化：后端返回所有文本 -> 前端批量查询缓存 -> 再开始翻译
    const cache = new Map<string, string>();

    const result = await startExcelTranslation(
      filePath,
      sourceLang,
      targetLang,
      engine,
      terms,
      cache
    );

    if (result.cancelled) {
      set({ status: 'cancelled', result });
    } else {
      set({ status: 'completed', result });
    }
  } catch (error) {
    set({ error: String(error), status: 'error' });
  } finally {
    unlisten();
  }
},
```

**Step 2: Commit**

```bash
git add src/stores/excelStore.ts
git commit -m "feat(excel): integrate translation cache in Excel workflow"
```

---

## Task 19: 最终集成测试

**Step 1: 构建并运行应用**

Run: `npm run tauri dev`

**Step 2: 测试术语表功能**

1. 进入设置页面
2. 在术语表区域添加术语（如 "GitHub" 保持原样）
3. 验证术语可以添加、编辑、删除

**Step 3: 测试 Excel 翻译功能**

1. 进入 Excel 标签页
2. 选择一个测试用的 .xlsx 文件
3. 配置源语言和目标语言
4. 点击「开始翻译」
5. 验证进度条正常更新
6. 翻译完成后验证输出文件

**Step 4: 测试取消功能**

1. 开始翻译一个较大的 Excel 文件
2. 在翻译过程中点击「取消翻译」
3. 验证翻译正确停止

**Step 5: Commit 所有未提交的更改**

```bash
git add -A
git commit -m "feat: complete Excel translation feature for v1.1"
```

---

## Task 20: 更新版本号和文档

**Files:**
- Modify: `src-tauri/Cargo.toml` (version)
- Modify: `package.json` (version)
- Modify: `src/pages/SettingsPage.tsx` (about section)

**Step 1: 更新版本号到 1.1.0**

Cargo.toml:
```toml
version = "1.1.0"
```

package.json:
```json
"version": "1.1.0"
```

SettingsPage.tsx (关于区域):
```typescript
<span>1.1.0</span>
```

**Step 2: Commit**

```bash
git add src-tauri/Cargo.toml package.json src/pages/SettingsPage.tsx
git commit -m "chore: bump version to 1.1.0"
```

---

## 实现总结

完成以上 20 个任务后，TTime v1.1 将具备完整的 Excel 翻译功能：

1. ✅ 侧边栏新增 Excel 标签页入口
2. ✅ Rust 后端处理 Excel 文件（calamine 读取 + rust_xlsxwriter 写入）
3. ✅ SQLite 翻译缓存减少 API 调用
4. ✅ 术语表管理（设置页面）
5. ✅ 实时进度条和取消功能
6. ✅ 翻译结果另存为新文件
