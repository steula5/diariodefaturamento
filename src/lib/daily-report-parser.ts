import * as XLSX from 'xlsx';

/**
 * Parses a daily CFOP summary report (e.g., "11-03.xlsx").
 * Reads the last data row (Total...) and calculates:
 * Value = TOTAL - IPI - ICMS (columns detected by header name, with fallback to fixed positions)
 */
export function parseDailyReport(data: ArrayBuffer): number {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  // Find header row and Total row by scanning column B
  let headerRow = -1;
  let totalRow = -1;
  for (let r = 0; r <= range.e.r; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 1 })]; // Column B
    if (!cell) continue;
    const val = String(cell.v).toLowerCase().trim();
    if (val.includes('total')) {
      totalRow = r;
    } else if (headerRow === -1 && (val.includes('cfop') || val.includes('descri') || val.includes('cód'))) {
      headerRow = r;
    }
  }

  if (totalRow === -1) {
    throw new Error('Linha "Total" não encontrada no relatório.');
  }

  const parseVal = (col: number): number => {
    const cell = sheet[XLSX.utils.encode_cell({ r: totalRow, c: col })];
    if (!cell) return 0;
    if (typeof cell.v === 'number') return cell.v;
    return parseFloat(String(cell.v).replace(/\./g, '').replace(',', '.')) || 0;
  };

  // Try to detect IPI and ICMS columns dynamically from the header row
  let totalCol = 3;   // Column D fallback
  let ipiCol = 10;    // Column K fallback
  let icmsCol = 12;   // Column M fallback

  if (headerRow !== -1) {
    for (let c = 0; c <= range.e.c; c++) {
      const hCell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
      if (!hCell) continue;
      const h = String(hCell.v).toLowerCase().trim();
      if (h === 'total') {
        totalCol = c;
      } else if (h === 'ipi') {
        // Match only the exact "IPI" column, not "Ipi não Apr." or similar
        ipiCol = c;
      } else if (h.includes('retido') || h === 'icm.retido' || h === 'icms retido' || h === 'icm retido') {
        // Match only ICMS Retido, not the base ICMS column
        icmsCol = c;
      }
    }
  }

  const total = parseVal(totalCol);
  const ipi = parseVal(ipiCol);
  const icmRetido = parseVal(icmsCol);

  return total - ipi - icmRetido;
}
