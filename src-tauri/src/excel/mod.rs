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
