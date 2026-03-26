import * as XLSX from 'xlsx';
import type { Orcamento } from '@/types/faturamento';

export function parseOrcamentoExcelFile(data: ArrayBuffer): Orcamento[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  const orcamentos: Orcamento[] = [];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  
  // Find header row by looking for "Docto" in column A or B
  let headerRow = -1;
  let docCol = 0;
  for (let row = 0; row <= Math.min(range.e.r, 10); row++) {
    for (let col = 0; col <= 2; col++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (cell && String(cell.v).trim().toLowerCase().startsWith('docto')) {
        headerRow = row;
        docCol = col;
        break;
      }
    }
    if (headerRow >= 0) break;
  }
  
  if (headerRow < 0) return orcamentos;

  // Detect column layout based on where Docto is
  // New format (Docto in A): A=Doc, B=Cliente, E=Cidade, F=Emissão, H=Valor, I=CodStatus, J=Status
  // Old format (Docto in B): B=Doc, C=Cliente, F=Cidade, G=Emissão, I=Valor, J=CodStatus, L=Status
  const isNewFormat = docCol === 0;
  const colCliente   = isNewFormat ? 1 : 2;
  const colCidade    = isNewFormat ? 4 : 5;
  const colData      = isNewFormat ? 5 : 6;
  const colValor     = isNewFormat ? 7 : 8;
  const colCodStatus = isNewFormat ? 8 : 9;
  const colStatus    = isNewFormat ? 9 : 11;

  for (let row = headerRow + 1; row <= range.e.r; row++) {
    const docCell = sheet[XLSX.utils.encode_cell({ r: row, c: docCol })];
    const clienteCell = sheet[XLSX.utils.encode_cell({ r: row, c: colCliente })];
    const cidadeCell = sheet[XLSX.utils.encode_cell({ r: row, c: colCidade })];
    const dataCell = sheet[XLSX.utils.encode_cell({ r: row, c: colData })];
    const valorCell = sheet[XLSX.utils.encode_cell({ r: row, c: colValor })];
    const codStatusCell = sheet[XLSX.utils.encode_cell({ r: row, c: colCodStatus })];
    const statusCell = sheet[XLSX.utils.encode_cell({ r: row, c: colStatus })];

    if (!docCell || !docCell.v) continue;
    
    const documento = String(docCell.v).trim();
    if (!documento || documento.toLowerCase().startsWith('docto')) continue;

    // Keep only ORÇAMENTO entries (codStatus 35)
    const codStatusVal = codStatusCell ? Number(codStatusCell.v) || 0 : 0;
    if (codStatusVal !== 35) continue;

    let dataEmissao = '';
    if (dataCell) {
      if (dataCell.t === 'n') {
        const date = XLSX.SSF.parse_date_code(dataCell.v);
        const fullYear = date.y < 100 ? 2000 + date.y : date.y;
        dataEmissao = `${String(date.d).padStart(2, '0')}/${String(date.m).padStart(2, '0')}/${fullYear}`;
      } else {
        const raw = String(dataCell.v);
        const parts = raw.split('/');
        if (parts.length === 3 && parts[2].length === 2) {
          dataEmissao = `${parts[0]}/${parts[1]}/20${parts[2]}`;
        } else {
          dataEmissao = raw;
        }
      }
    }

    let valor = 0;
    if (valorCell) {
      if (typeof valorCell.v === 'number') {
        valor = valorCell.v;
      } else {
        valor = parseFloat(String(valorCell.v).replace(/\./g, '').replace(',', '.')) || 0;
      }
    }

    orcamentos.push({
      documento,
      cliente: clienteCell ? String(clienteCell.v).trim() : '',
      cidade: cidadeCell ? String(cidadeCell.v).trim() : '',
      dataEmissao,
      valor,
      codStatus: codStatusVal,
      status: statusCell ? String(statusCell.v).trim() : '',
    });
  }

  return orcamentos;
}
