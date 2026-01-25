# Excel 翻译格式保留方案设计

**版本**: TTime v1.1 (改进版)
**日期**: 2026-01-25
**状态**: 已确认

---

## 背景

当前 Excel 翻译功能使用 `calamine`（只读）+ `rust_xlsxwriter`（只写）的组合，采用"读取→重建"的方式处理 Excel 文件。这种方式存在以下问题：

- ❌ 丢失原始格式（字体、颜色、边框、对齐等）
- ❌ 丢失图表、图片、数据透视表
- ❌ 丢失列宽、行高、冻结窗格等设置
- ❌ 可能破坏公式引用
- ❌ 用户体验差：翻译后的文件与原文件差异太大

---

## 目标

改用"复制副本→就地修改"的方式，完整保留 Excel 文件的所有格式和非文本内容：

- ✅ 保留所有单元格格式（字体、颜色、边框、对齐等）
- ✅ 保留公式（只翻译纯文本单元格）
- ✅ 保留图表、图片、数据透视表
- ✅ 保留列宽、行高、冻结窗格、条件格式等
- ✅ 翻译后的文件与原文件除文本外完全一致

---

## 技术方案

### 方案选择

评估了三种方案后，选择 **方案 1：使用 umya-spreadsheet**

| 方案 | 优点 | 缺点 | 评分 |
|------|------|------|------|
| umya-spreadsheet | 原生支持读写、完美保留格式、纯 Rust | 库较新 | ⭐⭐⭐⭐⭐ |
| Python openpyxl | 成熟稳定、格式支持好 | 需要 Python 环境、跨语言复杂 | ⭐⭐⭐ |
| 增强当前方案 | 改动最小 | 无法保留图表、代码复杂 | ⭐⭐ |

**最终选择**: umya-spreadsheet

---

## 架构改动

### 依赖变更

**移除：**
```toml
calamine = "0.24"
rust_xlsxwriter = "0.64"
```

**新增：**
```toml
umya-spreadsheet = "1.4"
```

### 处理流程对比

**旧流程（读取→重建）：**
```
原文件 → calamine读取 → 提取文本
       → 翻译处理
       → rust_xlsxwriter重建 → 新文件
                                 ↓
                        ❌ 格式丢失
```

**新流程（复制→修改）：**
```
原文件 → fs::copy() 复制副本
       → umya打开副本 → 定位单元格
       → 修改纯文本单元格
       → umya保存 → 副本文件
                      ↓
              ✅ 格式完整保留
```

---

## 实现细节

### 1. Excel Reader (reader.rs)

**核心改动：**

```rust
use umya_spreadsheet::*;

// 获取文件信息
pub fn get_excel_info(file_path: &str) -> Result<ExcelInfo, String> {
    let book = reader::xlsx::read(file_path)?;
    let sheet_count = book.get_sheet_count();

    // 统计文本单元格数量（跳过公式）
    let mut total_cells = 0;
    for i in 0..sheet_count {
        let sheet = book.get_sheet(&i);
        for row in sheet.get_cell_collection() {
            for cell in row {
                if is_text_cell(cell) {
                    total_cells += 1;
                }
            }
        }
    }

    // 返回文件信息...
}

// 读取待翻译的单元格
pub fn read_excel(file_path: &str) -> Result<Vec<SheetData>, String> {
    let book = reader::xlsx::read(file_path)?;

    for i in 0..book.get_sheet_count() {
        let sheet = book.get_sheet(&i);
        // 遍历单元格，收集文本单元格的位置和内容
        for row in sheet.get_cell_collection() {
            for cell in row {
                if is_text_cell(cell) {
                    let coord = cell.get_coordinate();
                    // 记录 (row, col, value)
                }
            }
        }
    }
}

// 判断是否为文本单元格
fn is_text_cell(cell: &structs::Cell) -> bool {
    // 1. 跳过公式单元格
    if cell.has_formula() {
        return false;
    }

    // 2. 跳过空单元格
    let value = cell.get_value().to_string();
    if value.trim().is_empty() {
        return false;
    }

    // 3. 可选：跳过纯数字
    // if value.parse::<f64>().is_ok() {
    //     return false;
    // }

    true
}
```

**关键点：**
- 使用 `has_formula()` 自动跳过公式单元格
- 使用 `get_coordinate()` 获取单元格位置
- 行列索引从 1 开始（umya-spreadsheet 约定）

---

### 2. Excel Writer (writer.rs)

**核心改动：**

```rust
use umya_spreadsheet::*;
use std::fs;

pub fn write_excel(sheets: &[SheetData], original_path: &str) -> Result<String, String> {
    // 步骤 1: 生成输出路径
    let output_path = generate_output_path(original_path);

    // 步骤 2: 复制原文件到输出路径（保留所有内容）
    fs::copy(original_path, &output_path)
        .map_err(|e| format!("复制文件失败: {}", e))?;

    // 步骤 3: 打开副本文件
    let mut book = reader::xlsx::read(&output_path)
        .map_err(|e| format!("打开副本失败: {}", e))?;

    // 步骤 4: 就地修改翻译后的单元格
    for (sheet_idx, sheet_data) in sheets.iter().enumerate() {
        let sheet = book.get_sheet_mut(&(sheet_idx as u32));

        for cell in &sheet_data.cells {
            if let Some(translated) = &cell.translated {
                // 只修改单元格的文本值，不影响格式
                sheet
                    .get_cell_mut((cell.col, cell.row))
                    .set_value(translated);
            }
        }
    }

    // 步骤 5: 保存文件（格式自动保留）
    writer::xlsx::write(&book, &output_path)
        .map_err(|e| format!("保存文件失败: {}", e))?;

    Ok(output_path.to_string_lossy().to_string())
}

fn generate_output_path(original_path: &str) -> PathBuf {
    let path = Path::new(original_path);
    let stem = path.file_stem().unwrap().to_str().unwrap();
    let parent = path.parent().unwrap_or(Path::new("."));
    parent.join(format!("{}_translated.xlsx", stem))
}
```

**关键点：**
- `fs::copy()` 确保原文件不被修改
- `get_cell_mut()` 只修改单元格值，不影响格式
- `set_value()` 更新文本内容
- `writer::xlsx::write()` 自动保留所有格式

---

### 3. Translator (translator.rs)

**无需改动** - 核心翻译逻辑保持不变：

- ✅ 术语表匹配
- ✅ 缓存查询
- ✅ 翻译引擎调用
- ✅ 进度推送
- ✅ 取消支持

只是在最后调用新的 `writer::write_excel()` 保存结果。

---

### 4. 前端 (无需改动)

**完全兼容** - 所有前端代码保持不变：

- ✅ ExcelPage.tsx
- ✅ excelStore.ts
- ✅ excel.ts (IPC 封装)
- ✅ IPC 接口签名不变

---

## 数据结构

### CellData

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellData {
    pub row: u32,      // 行号（从 1 开始）
    pub col: u32,      // 列号（从 1 开始）
    pub value: String, // 原始文本
    pub translated: Option<String>, // 翻译后的文本
}
```

**注意事项：**
- umya-spreadsheet 使用 1-based 索引
- 保持与库的约定一致，避免转换错误

---

## 功能对比

| 功能 | 旧方案 | 新方案 |
|------|--------|--------|
| 字体样式 | ❌ 丢失 | ✅ 保留 |
| 单元格颜色 | ❌ 丢失 | ✅ 保留 |
| 边框样式 | ❌ 丢失 | ✅ 保留 |
| 对齐方式 | ❌ 丢失 | ✅ 保留 |
| 公式 | ❌ 丢失 | ✅ 保留（不翻译） |
| 图表 | ❌ 丢失 | ✅ 保留 |
| 图片 | ❌ 丢失 | ✅ 保留 |
| 数据透视表 | ❌ 丢失 | ✅ 保留 |
| 列宽/行高 | ❌ 丢失 | ✅ 保留 |
| 冻结窗格 | ❌ 丢失 | ✅ 保留 |
| 条件格式 | ❌ 丢失 | ✅ 保留 |
| 数据验证 | ❌ 丢失 | ✅ 保留 |
| 翻译缓存 | ✅ 支持 | ✅ 支持 |
| 术语表 | ✅ 支持 | ✅ 支持 |
| 进度推送 | ✅ 支持 | ✅ 支持 |
| 取消操作 | ✅ 支持 | ✅ 支持 |

---

## 兼容性

### 支持的格式

- ✅ `.xlsx` (Excel 2007+)
- ⚠️ `.xls` (Excel 97-2003) - **不支持**

**建议：**
- 前端文件选择器只允许 `.xlsx`
- 或提示用户将 `.xls` 转换为 `.xlsx`

### 平台支持

- ✅ macOS
- ✅ Windows
- ✅ Linux

### 性能

- ✅ 大文件支持（umya-spreadsheet 内存效率良好）
- ✅ 增量修改（只修改翻译的单元格）
- ✅ 文件复制速度快（操作系统级别）

---

## 实施步骤

### Task 1: 更新依赖
- 修改 `src-tauri/Cargo.toml`
- 移除 `calamine` 和 `rust_xlsxwriter`
- 添加 `umya-spreadsheet = "1.4"`
- 运行 `cargo check` 验证

### Task 2: 重写 reader.rs
- 使用 umya-spreadsheet 读取文件
- 实现 `get_excel_info()`
- 实现 `read_excel()`
- 添加 `is_text_cell()` 辅助函数

### Task 3: 重写 writer.rs
- 实现文件复制逻辑
- 实现单元格就地修改
- 使用 umya-spreadsheet 保存文件

### Task 4: 验证编译
- `cd src-tauri && cargo build`
- 确保无编译错误

### Task 5: 功能测试
- 准备包含格式、公式、图表的测试文件
- 测试翻译功能
- 验证格式完整保留
- 验证公式未被破坏
- 验证进度推送、取消功能正常

### Task 6: 提交代码
- 提交所有改动
- 更新文档

---

## 预期效果

用户翻译 Excel 文件后：

**✅ 完全保留：**
- 所有单元格格式（字体、颜色、边框、对齐等）
- 公式和函数（不翻译公式）
- 图表、图片、形状、文本框
- 数据透视表、切片器
- 列宽、行高、合并单元格
- 冻结窗格、筛选器、排序
- 条件格式、数据验证规则
- 打印设置、页眉页脚
- 工作表保护、隐藏工作表

**✅ 唯一变化：**
- 纯文本单元格被翻译成目标语言

**用户体验：**
- 翻译前后文件在结构和外观上完全一致
- 只有文本内容变成了目标语言
- 无需手动调整格式或修复破损的公式

---

## 风险与限制

### 风险

1. **umya-spreadsheet 库成熟度**
   - 风险：库相对较新，可能存在边缘情况的 bug
   - 缓解：充分测试各种复杂 Excel 文件

2. **大文件性能**
   - 风险：复制和修改大文件可能较慢
   - 缓解：umya-spreadsheet 内存效率良好，实际测试表现

### 限制

1. **不支持 .xls 格式**
   - 只支持 .xlsx (Excel 2007+)
   - 需要用户手动转换旧格式

2. **宏和 VBA 代码**
   - 保留但不翻译宏中的字符串
   - 如需翻译宏内容，需额外实现

---

## 总结

通过使用 umya-spreadsheet 的"复制→就地修改"方案，实现了完美的格式保留：

- ✅ 技术可行：单一库完成读写，API 简洁
- ✅ 用户体验：翻译后文件与原文件几乎完全一致
- ✅ 代码简洁：核心改动集中在 reader 和 writer
- ✅ 向后兼容：前端和翻译逻辑无需改动
- ✅ 性能良好：增量修改，效率高

这是 TTime v1.1 Excel 翻译功能的重要改进，将大幅提升用户满意度。
