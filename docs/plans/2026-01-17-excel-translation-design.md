# Excel 翻译功能设计文档

**版本**: TTime v1.1
**日期**: 2026-01-17
**状态**: 已确认

---

## 功能概述

TTime v1.1 新增 Excel 翻译功能，允许用户：
- 导入 Excel 文件（.xlsx）
- 自动翻译所有 Sheet 中的文本单元格
- 保留原有格式、样式、公式
- 跳过特殊符号、表情、术语表中的专业名词
- 利用缓存减少重复翻译的 API 调用
- 实时查看翻译进度，支持取消操作
- 导出为新文件（`原文件名_translated.xlsx`）

---

## 设计决策

| 决策点 | 选择 |
|--------|------|
| 入口位置 | 侧边栏新增「Excel」标签页 |
| 文件处理 | Rust 后端 (calamine + rust_xlsxwriter) |
| 缓存方式 | SQLite 数据库（translation_cache 表） |
| 专业名词 | 术语表 + Prompt 组合方案 |
| 进度展示 | 实时进度条 + 单元格计数 + 支持取消 |
| 输出方式 | 另存为新文件（`原文件名_translated.xlsx`） |
| 术语表位置 | 设置页面新增「术语表」区块 |

---

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│  前端 (React)                                           │
│  ├─ ExcelPage.tsx         Excel 翻译页面               │
│  ├─ excelStore.ts         Excel 翻译状态管理           │
│  └─ TermsSettings.tsx     术语表管理组件（设置页）      │
├─────────────────────────────────────────────────────────┤
│  Tauri IPC                                              │
│  ├─ start_excel_translation   开始翻译                 │
│  ├─ cancel_excel_translation  取消翻译                 │
│  ├─ get_excel_info            获取文件信息             │
│  └─ 事件: excel-progress      进度更新推送             │
├─────────────────────────────────────────────────────────┤
│  后端 (Rust)                                            │
│  ├─ excel/mod.rs          Excel 处理模块               │
│  │   ├─ reader.rs         读取 (calamine)              │
│  │   └─ writer.rs         写入 (rust_xlsxwriter)       │
│  ├─ translation/cache.rs  翻译缓存层                   │
│  └─ terms.rs              术语表管理                   │
├─────────────────────────────────────────────────────────┤
│  SQLite                                                 │
│  ├─ translation_cache     翻译缓存表                   │
│  └─ terms                 术语表                       │
└─────────────────────────────────────────────────────────┘
```

---

## 数据库设计

### 翻译缓存表 (translation_cache)

```sql
CREATE TABLE translation_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_text TEXT NOT NULL,          -- 原文
  translated_text TEXT NOT NULL,      -- 译文
  source_lang VARCHAR(10) NOT NULL,   -- 源语言
  target_lang VARCHAR(10) NOT NULL,   -- 目标语言
  engine VARCHAR(50) NOT NULL,        -- 翻译引擎
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  hit_count INTEGER DEFAULT 1,        -- 命中次数（用于统计）

  UNIQUE(source_text, source_lang, target_lang, engine)
);

CREATE INDEX idx_cache_lookup
  ON translation_cache(source_text, source_lang, target_lang, engine);
```

### 术语表 (terms)

```sql
CREATE TABLE terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL UNIQUE,          -- 术语（如 "GitHub"）
  translation TEXT,                   -- 固定译法（可选，为空则不翻译）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_term ON terms(term);
```

---

## 前端组件设计

### 1. Excel 翻译页面 (ExcelPage.tsx)

**页面布局：**

```
┌─────────────────────────────────────────────────────────┐
│  [选择文件] 按钮    或    拖拽 Excel 文件到此处          │
└─────────────────────────────────────────────────────────┘
                          ↓ 选择文件后
┌─────────────────────────────────────────────────────────┐
│  文件信息                                               │
│  ├─ 文件名: report.xlsx                                │
│  ├─ Sheet 数量: 3                                      │
│  └─ 待翻译单元格: 1,234 个                             │
├─────────────────────────────────────────────────────────┤
│  翻译设置                                               │
│  ├─ 源语言: [自动检测 ▼]                               │
│  ├─ 目标语言: [中文 ▼]                                 │
│  └─ 翻译引擎: [GLM-4-Flash ▼]                          │
├─────────────────────────────────────────────────────────┤
│  [开始翻译]                                             │
└─────────────────────────────────────────────────────────┘
                          ↓ 翻译中
┌─────────────────────────────────────────────────────────┐
│  翻译进度                                               │
│  ├─ Sheet 2/3: "销售数据"                              │
│  ├─ 单元格: 456/1,234 (37%)                            │
│  ├─ ████████░░░░░░░░░░░░░░ 37%                         │
│  ├─ 缓存命中: 89 次                                    │
│  └─ [取消翻译]                                         │
└─────────────────────────────────────────────────────────┘
                          ↓ 完成后
┌─────────────────────────────────────────────────────────┐
│  ✓ 翻译完成                                            │
│  ├─ 已保存至: report_translated.xlsx                   │
│  ├─ 翻译单元格: 1,234 个                               │
│  ├─ 缓存命中: 312 次（节省 25% API 调用）              │
│  └─ [打开文件] [打开所在文件夹] [翻译新文件]            │
└─────────────────────────────────────────────────────────┘
```

### 2. 术语表设置 (TermsSettings.tsx)

**放置位置：** 设置页面新增「术语表」区块

```
┌─────────────────────────────────────────────────────────┐
│  术语表                                                 │
│  不翻译或使用固定译法的专业名词                         │
├─────────────────────────────────────────────────────────┤
│  [添加术语]                                             │
├─────────────────────────────────────────────────────────┤
│  术语          固定译法          操作                   │
│  ──────────────────────────────────────                 │
│  GitHub        (保持原样)        [编辑] [删除]          │
│  TTime         TTime 翻译软件    [编辑] [删除]          │
│  API           接口              [编辑] [删除]          │
└─────────────────────────────────────────────────────────┘
```

---

## 后端模块设计

### 1. Excel 处理模块 (src-tauri/src/excel/)

**文件结构：**
```
src-tauri/src/excel/
├─ mod.rs           模块入口，定义公共接口
├─ reader.rs        Excel 读取（使用 calamine）
├─ writer.rs        Excel 写入（使用 rust_xlsxwriter）
└─ translator.rs    翻译协调器（调度翻译、管理进度）
```

**核心数据结构：**
```rust
// Excel 文件信息
pub struct ExcelInfo {
    pub file_path: String,
    pub sheet_names: Vec<String>,
    pub total_cells: usize,        // 待翻译的文本单元格数
}

// 翻译进度
pub struct TranslationProgress {
    pub current_sheet: usize,
    pub total_sheets: usize,
    pub sheet_name: String,
    pub current_cell: usize,
    pub total_cells: usize,
    pub cache_hits: usize,         // 缓存命中次数
}

// 翻译结果
pub struct ExcelTranslationResult {
    pub output_path: String,
    pub translated_cells: usize,
    pub cache_hits: usize,
    pub cancelled: bool,           // 是否被用户取消
}
```

### 2. 翻译缓存层 (src-tauri/src/translation/cache.rs)

```rust
pub struct TranslationCache {
    db: SqlitePool,
}

impl TranslationCache {
    // 查询缓存
    pub async fn get(&self, text: &str, source: &str, target: &str, engine: &str)
        -> Option<String>;

    // 写入缓存
    pub async fn set(&self, text: &str, translated: &str, source: &str, target: &str, engine: &str);

    // 批量查询（优化性能）
    pub async fn get_batch(&self, texts: &[&str], source: &str, target: &str, engine: &str)
        -> HashMap<String, String>;

    // 清理缓存（可选，按时间或数量）
    pub async fn cleanup(&self, max_age_days: u32);
}
```

### 3. 术语表管理 (src-tauri/src/terms.rs)

```rust
pub struct Term {
    pub id: i64,
    pub term: String,
    pub translation: Option<String>,  // None = 保持原样
}

// IPC 命令
pub async fn get_terms() -> Vec<Term>;
pub async fn add_term(term: &str, translation: Option<&str>) -> Result<Term>;
pub async fn update_term(id: i64, term: &str, translation: Option<&str>) -> Result<()>;
pub async fn delete_term(id: i64) -> Result<()>;
```

### 4. 翻译流程（伪代码）

```rust
async fn translate_excel(file_path: &str, config: &TranslateConfig) {
    // 1. 读取 Excel 文件
    let workbook = reader::read_excel(file_path)?;

    // 2. 获取术语表
    let terms = get_terms().await?;

    // 3. 遍历每个 Sheet
    for (sheet_idx, sheet) in workbook.sheets.iter().enumerate() {
        // 4. 提取文本单元格
        for cell in sheet.text_cells() {
            // 检查是否取消
            if is_cancelled() { break; }

            // 5. 术语表匹配 → 直接替换或跳过
            if let Some(replacement) = match_term(&cell.value, &terms) {
                cell.translated = replacement;
                continue;
            }

            // 6. 查询缓存
            if let Some(cached) = cache.get(&cell.value, ...).await {
                cell.translated = cached;
                progress.cache_hits += 1;
                continue;
            }

            // 7. 调用翻译引擎（Prompt 中包含术语保护指令）
            let translated = translate_with_prompt(&cell.value, &config).await?;

            // 8. 写入缓存
            cache.set(&cell.value, &translated, ...).await;
            cell.translated = translated;

            // 9. 发送进度事件
            emit_progress(progress);
        }
    }

    // 10. 写入新 Excel 文件
    let output_path = writer::write_excel(&workbook, file_path)?;
}
```

---

## IPC 接口设计

### Tauri 命令

```rust
// 获取 Excel 文件信息（选择文件后调用）
#[tauri::command]
async fn get_excel_info(file_path: String) -> Result<ExcelInfo, String>;

// 开始翻译
#[tauri::command]
async fn start_excel_translation(
    file_path: String,
    source_lang: String,
    target_lang: String,
    engine_type: String,
    engine_config: serde_json::Value,
) -> Result<ExcelTranslationResult, String>;

// 取消翻译
#[tauri::command]
async fn cancel_excel_translation() -> Result<(), String>;

// 术语表管理
#[tauri::command]
async fn get_terms() -> Result<Vec<Term>, String>;

#[tauri::command]
async fn add_term(term: String, translation: Option<String>) -> Result<Term, String>;

#[tauri::command]
async fn update_term(id: i64, term: String, translation: Option<String>) -> Result<(), String>;

#[tauri::command]
async fn delete_term(id: i64) -> Result<(), String>;
```

### Tauri 事件

```rust
// 翻译进度事件（后端 → 前端）
app_handle.emit("excel-progress", TranslationProgress {
    current_sheet: 2,
    total_sheets: 5,
    sheet_name: "销售数据".to_string(),
    current_cell: 120,
    total_cells: 500,
    cache_hits: 45,
})?;
```

---

## 前端状态管理

### excelStore.ts

```typescript
interface ExcelState {
  // 文件信息
  filePath: string | null;
  fileInfo: ExcelInfo | null;

  // 翻译配置
  sourceLang: string;
  targetLang: string;

  // 翻译状态
  status: 'idle' | 'loading' | 'translating' | 'completed' | 'cancelled' | 'error';
  progress: TranslationProgress | null;
  result: ExcelTranslationResult | null;
  error: string | null;

  // 方法
  setFile: (path: string) => Promise<void>;
  startTranslation: () => Promise<void>;
  cancelTranslation: () => Promise<void>;
  reset: () => void;
}
```

### termsStore.ts

```typescript
interface TermsState {
  terms: Term[];
  isLoading: boolean;

  // 方法
  loadTerms: () => Promise<void>;
  addTerm: (term: string, translation?: string) => Promise<void>;
  updateTerm: (id: number, term: string, translation?: string) => Promise<void>;
  deleteTerm: (id: number) => Promise<void>;
}
```

---

## Rust 依赖

```toml
[dependencies]
# Excel 读取
calamine = "0.24"

# Excel 写入
rust_xlsxwriter = "0.64"
```

---

## 翻译 Prompt 设计

```rust
fn build_excel_translation_prompt(
    text: &str,
    source_lang: &str,
    target_lang: &str,
    terms: &[Term]
) -> String {
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
        format!(
            "\n\n术语表（请严格遵守）：\n{}",
            term_list.join("\n")
        )
    };

    format!(
        r#"将以下{source}文本翻译成{target}。

要求：
1. 只输出译文，不要解释
2. 保留特殊符号、表情符号、数字、公式不翻译
3. 保留专有名词、品牌名、技术术语的原文
4. 如果无法确定是否应该翻译，保持原样{terms}

原文：
{text}"#,
        source = source_lang,
        target = target_lang,
        terms = terms_instruction,
        text = text
    )
}
```

---

## 文件结构总览

```
src-tauri/src/
├── lib.rs                 # 注册新的 IPC 命令
├── excel/
│   ├── mod.rs             # 模块入口
│   ├── reader.rs          # Excel 读取
│   ├── writer.rs          # Excel 写入
│   └── translator.rs      # 翻译协调器
├── translation/
│   ├── mod.rs             # 现有
│   ├── ollama.rs          # 现有
│   ├── glm.rs             # 现有
│   └── cache.rs           # 新增：翻译缓存
└── terms.rs               # 新增：术语表管理

src/
├── pages/
│   └── ExcelPage.tsx      # 新增：Excel 翻译页面
├── stores/
│   ├── excelStore.ts      # 新增：Excel 状态管理
│   └── termsStore.ts      # 新增：术语表状态管理
├── services/
│   ├── excel.ts           # 新增：Excel IPC 封装
│   └── terms.ts           # 新增：术语表 IPC 封装
└── components/
    ├── Sidebar.tsx        # 修改：新增 Excel 标签
    └── TermsSettings.tsx  # 新增：术语表管理组件
```
