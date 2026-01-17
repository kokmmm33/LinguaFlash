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
