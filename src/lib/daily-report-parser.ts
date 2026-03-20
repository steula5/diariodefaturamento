import * as XLSX from 'xlsx';

/**
 * Parses a daily CFOP summary report (e.g., "11-03.xlsx").
 * Reads the last data row (Total...) and calculates:
 * Value = Column D (TOTAL) - Column K (IPI) - Column M (Icm.Retido)
 */
export function parseDailyReport(data: ArrayBuffer): number {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  // Find the "Total..." row by scanning column B
  let totalRow = -1;
  for (let r = 0; r <= range.e.r; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 1 })]; // Column B
    if (cell && String(cell.v).toLowerCase().includes('total')) {
      totalRow = r;
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

  const total = parseVal(3);  // Column D
  const ipi = parseVal(10);   // Column K
  const icmRetido = parseVal(12); // Column M

  return total - ipi - icmRetido;
}
