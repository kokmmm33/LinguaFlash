# Excel 格式保留功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 Excel 翻译功能从"读取→重建"改为"复制→就地修改"，完整保留所有格式、公式、图表

**Architecture:** 使用 umya-spreadsheet 替换 calamine + rust_xlsxwriter，通过 fs::copy 复制原文件后直接修改单元格值，自动保留所有格式和非文本内容

**Tech Stack:** Rust, umya-spreadsheet 1.4, std::fs

---

## Task 1: 更新 Cargo 依赖

**Files:**
- Modify: `src-tauri/Cargo.toml:15-25`

**Step 1: 移除旧依赖，添加新依赖**

在 `[dependencies]` 部分：

移除这两行：
```toml
calamine = "0.24"
rust_xlsxwriter = "0.64"
```

添加：
```toml
umya-spreadsheet = "1.4"
```

**Step 2: 验证依赖**

Run: `cd src-tauri && cargo check`
Expected: 编译错误（因为 reader.rs 和 writer.rs 还在使用旧 API），这是正常的

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore(deps): replace calamine+rust_xlsxwriter with umya-spreadsheet

替换 Excel 处理依赖以支持格式保留：
- 移除 calamine (只读) 和 rust_xlsxwriter (只写)
- 添加 umya-spreadsheet 1.4 (读写+格式保留)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 重写 Excel Reader

**Files:**
- Modify: `src-tauri/src/excel/reader.rs:1-76`

**Step 1: 替换 imports**

将文件开头的 imports 替换为：

```rust
use umya_spreadsheet::*;
use std::path::Path;
use super::{ExcelInfo, SheetData, CellData};
```

**Step 2: 重写 get_excel_info 函数**

完整替换 `get_excel_info` 函数（第 5-39 行）：

```rust
pub fn get_excel_info(file_path: &str) -> Result<ExcelInfo, String> {
    let path = Path::new(file_path);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let book = reader::xlsx::read(file_path)
        .map_err(|e| format!("无法打开 Excel 文件: {}", e))?;

    let sheet_count = book.get_sheet_count();
    let mut sheet_names = Vec::new();
    let mut total_cells = 0;

    for i in 0..sheet_count {
        let sheet = book.get_sheet(&i);
        sheet_names.push(sheet.get_name().to_string());

        // 统计文本单元格（跳过公式）
        for row in sheet.get_cell_collection() {
            for cell in row {
                if is_text_cell(cell) {
                    total_cells += 1;
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
```

**Step 3: 重写 read_excel 函数**

完整替换 `read_excel` 函数（第 41-75 行）：

```rust
pub fn read_excel(file_path: &str) -> Result<Vec<SheetData>, String> {
    let book = reader::xlsx::read(file_path)
        .map_err(|e| format!("无法打开 Excel 文件: {}", e))?;

    let sheet_count = book.get_sheet_count();
    let mut sheets = Vec::new();

    for i in 0..sheet_count {
        let sheet = book.get_sheet(&i);
        let sheet_name = sheet.get_name().to_string();
        let mut cells = Vec::new();

        for row in sheet.get_cell_collection() {
            for cell in row {
                if is_text_cell(cell) {
                    let coord = cell.get_coordinate();
                    cells.push(CellData {
                        row: coord.get_row_num(),
                        col: coord.get_col_num(),
                        value: cell.get_value().to_string(),
                        translated: None,
                    });
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

**Step 4: 添加辅助函数**

在文件末尾添加（第 76 行之后）：

```rust
/// 判断是否为需要翻译的文本单元格
fn is_text_cell(cell: &structs::Cell) -> bool {
    // 跳过公式单元格
    if cell.has_formula() {
        return false;
    }

    // 获取单元格值
    let value = cell.get_value().to_string();

    // 跳过空单元格
    if value.trim().is_empty() {
        return false;
    }

    // 这是需要翻译的文本单元格
    true
}
```

**Step 5: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: reader.rs 编译成功，writer.rs 仍有错误（预期行为）

**Step 6: Commit**

```bash
git add src-tauri/src/excel/reader.rs
git commit -m "refactor(excel): rewrite reader using umya-spreadsheet

使用 umya-spreadsheet 重写 Excel 读取器：
- 使用 reader::xlsx::read() 读取文件
- 通过 is_text_cell() 自动跳过公式单元格
- 使用 get_coordinate() 获取单元格位置（1-based）
- 保持对外接口不变

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 重写 Excel Writer

**Files:**
- Modify: `src-tauri/src/excel/writer.rs:1-35`

**Step 1: 替换 imports**

将文件开头的 imports 替换为：

```rust
use umya_spreadsheet::*;
use std::fs;
use std::path::{Path, PathBuf};
use super::SheetData;
```

**Step 2: 重写 write_excel 函数**

完整替换整个文件（第 1-35 行）：

```rust
use umya_spreadsheet::*;
use std::fs;
use std::path::{Path, PathBuf};
use super::SheetData;

pub fn write_excel(sheets: &[SheetData], original_path: &str) -> Result<String, String> {
    // 步骤 1: 生成输出路径
    let output_path = generate_output_path(original_path);

    // 步骤 2: 复制原文件到输出路径（保留所有格式和内容）
    fs::copy(original_path, &output_path)
        .map_err(|e| format!("复制文件失败: {}", e))?;

    // 步骤 3: 打开副本文件
    let mut book = reader::xlsx::read(&output_path)
        .map_err(|e| format!("打开副本文件失败: {}", e))?;

    // 步骤 4: 遍历每个 Sheet，就地修改翻译后的单元格
    for (sheet_idx, sheet_data) in sheets.iter().enumerate() {
        let sheet = book.get_sheet_mut(&(sheet_idx as u32));

        for cell in &sheet_data.cells {
            if let Some(translated) = &cell.translated {
                // 只修改单元格的文本值，格式自动保留
                sheet
                    .get_cell_mut((cell.col, cell.row))
                    .set_value(translated);
            }
        }
    }

    // 步骤 5: 保存文件（所有格式、公式、图表自动保留）
    writer::xlsx::write(&book, &output_path)
        .map_err(|e| format!("保存 Excel 文件失败: {}", e))?;

    Ok(output_path.to_string_lossy().to_string())
}

fn generate_output_path(original_path: &str) -> PathBuf {
    let path = Path::new(original_path);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
    let parent = path.parent().unwrap_or(Path::new("."));
    parent.join(format!("{}_translated.xlsx", stem))
}
```

**Step 3: 验证编译**

Run: `cd src-tauri && cargo build`
Expected: 编译成功，无错误

**Step 4: Commit**

```bash
git add src-tauri/src/excel/writer.rs
git commit -m "refactor(excel): rewrite writer using copy-and-modify approach

使用"复制→就地修改"方式重写 Excel 写入器：
- 使用 fs::copy() 复制原文件到输出路径
- 使用 umya-spreadsheet 打开副本
- 只修改翻译后的单元格值，不影响格式
- 自动保留所有格式、公式、图表、图片等

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 功能测试（手动）

**Step 1: 准备测试文件**

创建或获取一个包含以下特性的 Excel 文件：
- 多个 Sheet
- 带格式的文本（字体、颜色、边框）
- 公式（如 `=SUM(A1:A10)`）
- 图表或图片
- 合并单元格

保存到临时位置，如 `~/Desktop/test.xlsx`

**Step 2: 运行应用**

Run: `npm run tauri dev`

**Step 3: 测试翻译功能**

1. 进入 Excel 标签页
2. 选择测试文件
3. 配置翻译设置：
   - 源语言：自动检测
   - 目标语言：中文
4. 点击「开始翻译」
5. 等待翻译完成

**Step 4: 验证结果**

打开翻译后的文件（`test_translated.xlsx`），检查：

✅ 所有格式是否保留（字体、颜色、边框）
✅ 公式是否仍然有效（未被翻译成文本）
✅ 图表/图片是否完整
✅ 列宽、行高是否保持
✅ 合并单元格是否正确
✅ 文本是否正确翻译

**Step 5: 记录测试结果**

如果所有检查都通过，继续下一步。
如果有问题，记录具体现象并调试。

---

## Task 5: 更新前端文件选择器

**Files:**
- Modify: `src/pages/ExcelPage.tsx:1422-1428`

**Step 1: 限制只支持 .xlsx 格式**

找到 `handleSelectFile` 函数中的文件过滤器（约第 1422-1428 行）：

```typescript
const selected = await open({
  multiple: false,
  filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
});
```

修改为只允许 .xlsx：

```typescript
const selected = await open({
  multiple: false,
  filters: [{ name: 'Excel 2007+', extensions: ['xlsx'] }],
});
```

**Step 2: Commit**

```bash
git add src/pages/ExcelPage.tsx
git commit -m "feat(excel): restrict file picker to .xlsx only

umya-spreadsheet 只支持 .xlsx 格式，移除对旧 .xls 格式的支持。
用户需要将旧文件转换为 .xlsx 后再翻译。

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 更新设计文档状态

**Files:**
- Modify: `docs/plans/2026-01-25-excel-translation-format-preservation.md:5`

**Step 1: 更新文档状态**

将第 5 行的状态从"已确认"改为"已实施"：

```markdown
**状态**: 已实施
```

**Step 2: 添加实施日期**

在状态行后添加：

```markdown
**实施日期**: 2026-01-25
```

**Step 3: Commit**

```bash
git add docs/plans/2026-01-25-excel-translation-format-preservation.md
git commit -m "docs: mark Excel format preservation design as implemented

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 最终验证和清理

**Step 1: 完整构建**

Run: `cd src-tauri && cargo build --release`
Expected: 构建成功，无警告（除了现有的 dead_code 警告）

**Step 2: 运行完整测试流程**

1. Run: `npm run tauri dev`
2. 测试 Excel 翻译功能
3. 验证进度推送正常
4. 验证取消功能正常
5. 验证术语表功能正常
6. 验证缓存功能正常

**Step 3: 检查 git 状态**

Run: `git status`
Expected: 工作树干净，所有更改已提交

**Step 4: 查看提交历史**

Run: `git log --oneline -7`
Expected: 看到 7 个新提交（1 个依赖 + 1 个 reader + 1 个 writer + 1 个前端 + 1 个文档 + gitignore + 设计文档）

---

## 预期效果

实施完成后，Excel 翻译功能将：

✅ 完整保留所有单元格格式
✅ 保留公式（不翻译公式）
✅ 保留图表、图片、数据透视表
✅ 保留列宽、行高、合并单元格
✅ 保留条件格式、数据验证
✅ 翻译后的文件与原文件在结构和外观上完全一致

用户体验：
- 翻译前后唯一的差别就是文本变成了目标语言
- 无需手动调整格式
- 无需修复破损的公式
- 可以直接使用翻译后的文件

---

## 回滚计划

如果出现问题需要回滚：

```bash
# 查看当前分支
git log --oneline -10

# 回滚到实施前的提交（找到 "chore: add .worktrees to gitignore" 的提交）
git reset --hard <commit-hash>

# 如果已经合并到 main，需要创建 revert 提交
git revert <commit-range>
```

备用方案：
- 保留新的 umya-spreadsheet 依赖
- 恢复旧的 reader.rs 和 writer.rs
- 使用 `git checkout <commit> -- src-tauri/src/excel/`

---

## 注意事项

1. **索引差异**：umya-spreadsheet 使用 1-based 索引（行列从 1 开始），这与 calamine 的 0-based 不同。当前实现已正确处理。

2. **文件格式**：只支持 .xlsx（Excel 2007+），不支持旧的 .xls 格式。

3. **大文件**：umya-spreadsheet 对大文件的支持良好，但如果遇到性能问题，可以考虑添加进度提示。

4. **错误处理**：所有文件操作都有错误处理，但建议在生产环境中添加更详细的日志。

5. **测试覆盖**：当前是手动测试，未来可以考虑添加自动化测试。
