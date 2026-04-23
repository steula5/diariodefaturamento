import * as XLSX from 'xlsx';
import type { Pedido } from '@/types/faturamento';

export function parseExcelFile(data: ArrayBuffer): Pedido[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  const pedidos: Pedido[] = [];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  
  // Find header row and column mapping
  let headerRow = -1;
  let cols: Record<string, number> = { doc: -1, cliente: -1, cidade: -1, data: -1, valor: -1, codStatus: -1, status: -1 };
  
  for (let row = 0; row <= Math.min(range.e.r, 50); row++) {
    for (let col = 0; col <= Math.min(range.e.c, 20); col++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (cell && cell.v) {
        const val = String(cell.v).trim().toLowerCase();
        if (val === 'docto' || val === 'documento' || val === 'pedido') cols.doc = col;
        else if (val.includes('cliente') || val.includes('razao') || val.includes('razão')) cols.cliente = col;
        else if (val.includes('cidade') || val.includes('munic')) cols.cidade = col;
        else if (val.includes('emiss') || val.includes('emissao') || val.includes('emissão')) cols.data = col;
        else if (val === 'valor' || val.includes('total')) cols.valor = col;
        else if (val.includes('cod.status') || val.includes('cod status')) cols.codStatus = col;
        else if (val === 'status') cols.status = col;
      }
    }
    if (cols.doc >= 0) {
      headerRow = row;
      break;
    }
  }
  
  if (headerRow < 0) return pedidos;

  for (let row = headerRow + 1; row <= range.e.r; row++) {
    const docCell = sheet[XLSX.utils.encode_cell({ r: row, c: cols.doc })];
    if (!docCell || !docCell.v) continue;
    
    const documento = String(docCell.v).trim();
    if (!documento || documento.toLowerCase().startsWith('docto')) continue;

    const codStatusVal = cols.codStatus >= 0 ? (Number(sheet[XLSX.utils.encode_cell({ r: row, c: cols.codStatus })]?.v) || 0) : 0;
    if (codStatusVal !== 4) continue;

    let dataEmissao = '';
    const dataCell = cols.data >= 0 ? sheet[XLSX.utils.encode_cell({ r: row, c: cols.data })] : null;
    if (dataCell) {
      if (dataCell.t === 'n') {
        const date = XLSX.SSF.parse_date_code(dataCell.v);
        const fullYear = date.y < 100 ? 2000 + date.y : date.y;
        dataEmissao = `${String(date.d).padStart(2, '0')}/${String(date.m).padStart(2, '0')}/${fullYear}`;
      } else {
        dataEmissao = String(dataCell.v);
      }
    }

    let valor = 0;
    const valorCell = cols.valor >= 0 ? sheet[XLSX.utils.encode_cell({ r: row, c: cols.valor })] : null;
    if (valorCell) {
      if (typeof valorCell.v === 'number') {
        valor = valorCell.v;
      } else {
        valor = parseFloat(String(valorCell.v).replace(/\./g, '').replace(',', '.')) || 0;
      }
    }

    pedidos.push({
      documento,
      cliente: cols.cliente >= 0 ? String(sheet[XLSX.utils.encode_cell({ r: row, c: cols.cliente })]?.v || '').trim() : '',
      cidade: cols.cidade >= 0 ? String(sheet[XLSX.utils.encode_cell({ r: row, c: cols.cidade })]?.v || '').trim() : '',
      dataEmissao,
      valor,
      codStatus: codStatusVal,
      status: cols.status >= 0 ? String(sheet[XLSX.utils.encode_cell({ r: row, c: cols.status })]?.v || '').trim() : '',
    });
  }

  return pedidos;
}

export function parseAllOrders(data: ArrayBuffer): Pedido[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  const pedidos: Pedido[] = [];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  
  // Dynamic header mapping
  let headerRow = -1;
  let cols: Record<string, number> = { doc: -1, cliente: -1, cidade: -1, data: -1, valor: -1, codStatus: -1, status: -1 };
  
  for (let row = 0; row <= Math.min(range.e.r, 50); row++) {
    for (let col = 0; col <= Math.min(range.e.c, 20); col++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (cell && cell.v) {
        const val = String(cell.v).trim().toLowerCase();
        if (val === 'docto' || val === 'documento' || val === 'pedido') cols.doc = col;
        else if (val.includes('cliente') || val.includes('razao') || val.includes('razão')) cols.cliente = col;
        else if (val.includes('cidade') || val.includes('munic')) cols.cidade = col;
        else if (val.includes('emiss') || val.includes('emissao') || val.includes('emissão')) cols.data = col;
        else if (val === 'valor' || val.includes('total')) cols.valor = col;
        else if (val.includes('cod.status') || val.includes('cod status')) cols.codStatus = col;
        else if (val === 'status') cols.status = col;
      }
    }
    if (cols.doc >= 0) {
      headerRow = row;
      break;
    }
  }
  
  if (headerRow < 0) return pedidos;

  for (let row = headerRow + 1; row <= range.e.r; row++) {
    const docCell = sheet[XLSX.utils.encode_cell({ r: row, c: cols.doc })];
    if (!docCell || !docCell.v) continue;
    
    const documento = String(docCell.v).trim();
    if (!documento || documento.toLowerCase().startsWith('docto')) continue;

    const codStatusVal = cols.codStatus >= 0 ? (Number(sheet[XLSX.utils.encode_cell({ r: row, c: cols.codStatus })]?.v) || 0) : 0;

    let dataEmissao = '';
    const dataCell = cols.data >= 0 ? sheet[XLSX.utils.encode_cell({ r: row, c: cols.data })] : null;
    if (dataCell) {
      if (dataCell.t === 'n') {
        const date = XLSX.SSF.parse_date_code(dataCell.v);
        const fullYear = date.y < 100 ? 2000 + date.y : date.y;
        dataEmissao = `${String(date.d).padStart(2, '0')}/${String(date.m).padStart(2, '0')}/${fullYear}`;
      } else {
        dataEmissao = String(dataCell.v);
      }
    }

    let valor = 0;
    const valorCell = cols.valor >= 0 ? sheet[XLSX.utils.encode_cell({ r: row, c: cols.valor })] : null;
    if (valorCell) {
      if (typeof valorCell.v === 'number') {
        valor = valorCell.v;
      } else {
        valor = parseFloat(String(valorCell.v).replace(/\./g, '').replace(',', '.')) || 0;
      }
    }

    pedidos.push({
      documento,
      cliente: cols.cliente >= 0 ? String(sheet[XLSX.utils.encode_cell({ r: row, c: cols.cliente })]?.v || '').trim() : '',
      cidade: cols.cidade >= 0 ? String(sheet[XLSX.utils.encode_cell({ r: row, c: cols.cidade })]?.v || '').trim() : '',
      dataEmissao,
      valor,
      codStatus: codStatusVal,
      status: cols.status >= 0 ? String(sheet[XLSX.utils.encode_cell({ r: row, c: cols.status })]?.v || '').trim() : '',
    });
  }

  return pedidos;
}
