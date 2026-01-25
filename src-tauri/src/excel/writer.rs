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
        if let Some(sheet) = book.get_sheet_mut(&sheet_idx) {
            for cell in &sheet_data.cells {
                if let Some(translated) = &cell.translated {
                    // 只修改单元格的文本值，格式自动保留
                    sheet
                        .get_cell_mut((cell.col, cell.row))
                        .set_value(translated);
                }
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
