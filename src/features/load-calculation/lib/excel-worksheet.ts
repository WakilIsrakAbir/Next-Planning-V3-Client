import * as XLSX from 'xlsx';

export function formatExcelWorksheet(ws: XLSX.WorkSheet) {
  if (!ws || !ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);

  const headers: string[] = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    headers[C] = cell ? String(cell.v).toLowerCase() : '';
  }

  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellRef];
      if (!cell || cell.v === undefined || cell.v === null || cell.v === '') continue;

      const headerLower = headers[C] || '';
      const textCols = ['color', 'fabric construction', 'buyer', 'plan type', 'order'];
      const isText = textCols.some((t) => headerLower.includes(t));

      if (isText) {
        cell.t = 's';
        cell.v = String(cell.v);
      }
    }
  }
}
