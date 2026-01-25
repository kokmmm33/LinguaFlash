use umya_spreadsheet::*;
use std::path::Path;
use super::{ExcelInfo, SheetData, CellData};

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
        if let Some(sheet) = book.get_sheet(&i) {
            sheet_names.push(sheet.get_name().to_string());

            // 统计文本单元格（跳过公式）
            for cell in sheet.get_cell_collection() {
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

pub fn read_excel(file_path: &str) -> Result<Vec<SheetData>, String> {
    let book = reader::xlsx::read(file_path)
        .map_err(|e| format!("无法打开 Excel 文件: {}", e))?;

    let sheet_count = book.get_sheet_count();
    let mut sheets = Vec::new();

    for i in 0..sheet_count {
        if let Some(sheet) = book.get_sheet(&i) {
            let sheet_name = sheet.get_name().to_string();
            let mut cells = Vec::new();

            for cell in sheet.get_cell_collection() {
                if is_text_cell(cell) {
                    let coord = cell.get_coordinate();
                    cells.push(CellData {
                        row: *coord.get_row_num(),
                        col: *coord.get_col_num(),
                        value: cell.get_value().to_string(),
                        translated: None,
                    });
                }
            }

            sheets.push(SheetData {
                name: sheet_name,
                cells,
            });
        }
    }

    Ok(sheets)
}

/// 判断是否为需要翻译的文本单元格
fn is_text_cell(cell: &structs::Cell) -> bool {
    // 跳过公式单元格
    if cell.is_formula() {
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
