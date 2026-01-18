use calamine::{open_workbook, Reader, Xlsx, Data};
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
                    if let Data::String(s) = cell.clone() {
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
                    if let Data::String(s) = cell.clone() {
                        if !s.trim().is_empty() {
                            cells.push(CellData {
                                row: row_idx as u32,
                                col: col_idx as u32,
                                value: s,
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
