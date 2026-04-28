import type { OrcamentoData, Orcamento, OrcamentoDia } from '@/types/faturamento';
import * as XLSX from 'xlsx';

const STORAGE_KEY = 'orcamento_dados';

export type OrcamentoStatus = 'convertido' | 'perdido' | 'em_aberto';

export function getDefaultPeriod(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getDaysInMonth(yearMonth: string): Date[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const days: Date[] = [];
  const numDays = new Date(year, month, 0).getDate();
  for (let i = 1; i <= numDays; i++) {
    const date = new Date(year, month - 1, i);
    days.push(date);
  }
  return days;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function calculateDaysInPortfolio(dataEmissao: string): number {
  if (!dataEmissao) return 0;

  let day: number, month: number, year: number;

  if (dataEmissao.includes('/')) {
    [day, month, year] = dataEmissao.split('/').map(Number);
  } else if (dataEmissao.includes('-')) {
    [year, month, day] = dataEmissao.split('-').map(Number);
  } else {
    const d = new Date(dataEmissao);
    if (isNaN(d.getTime())) return 0;
    day = d.getDate();
    month = d.getMonth() + 1;
    year = d.getFullYear();
  }

  // Handle 2-digit years (e.g., 24 -> 2024)
  const fullYear = year < 100 ? year + 2000 : year;
  const emissionDate = new Date(fullYear, month - 1, day);
  
  const today = new Date();
  // Strip time from today for accurate day difference
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const differenceMs = todayDate.getTime() - emissionDate.getTime();
  return Math.floor(differenceMs / (1000 * 60 * 60 * 24));
}

function normalizeMotivoPerda(motivo?: string): string | undefined {
  const trimmed = motivo?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeOrcamento(orcamento: Orcamento): Orcamento {
  return {
    ...orcamento,
    no_sistema: orcamento.no_sistema ?? true,
    motivo_perda: normalizeMotivoPerda(orcamento.motivo_perda),
  };
}

export function isOrcamentoConvertido(orcamento: Orcamento, pedidoSet: Pick<Set<string>, 'has'>): boolean {
  return Boolean(orcamento.virou_pedido) || pedidoSet.has(orcamento.documento);
}

export function getOrcamentoStatus(orcamento: Orcamento, pedidoSet: Pick<Set<string>, 'has'>): OrcamentoStatus {
  if (isOrcamentoConvertido(orcamento, pedidoSet)) {
    return 'convertido';
  }

  return orcamento.no_sistema === false ? 'perdido' : 'em_aberto';
}

export function loadOrcamentoData(): OrcamentoData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrcamentoData;
    return {
      ...parsed,
      orcamentos: (parsed.orcamentos || []).map(normalizeOrcamento),
    };
  } catch {
    return null;
  }
}

export function saveOrcamentoData(data: OrcamentoData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...data,
    orcamentos: data.orcamentos.map(normalizeOrcamento),
  }));
}

export function mergeOrcamentos(existing: Orcamento[], newOrcamentos: Orcamento[]): Orcamento[] {
  const map = new Map<string, Orcamento>();
  
  existing.forEach(o => {
    map.set(o.documento, normalizeOrcamento(o));
  });
  
  newOrcamentos.forEach(o => {
    const current = map.get(o.documento);
    map.set(o.documento, normalizeOrcamento({
      ...o,
      cod_cliente: current?.cod_cliente,
      no_sistema: current?.no_sistema ?? true,
      virou_pedido: current?.virou_pedido,
      analisado: current?.analisado,
      motivo_perda: current?.motivo_perda,
      dono: current?.dono,
    }));
  });
  
  return Array.from(map.values());
}

export function compareOrcamentosWithPedidos(orcamentos: Orcamento[], pedidosDocumentos: string[]): Orcamento[] {
  const pedidoSet = new Set(pedidosDocumentos);
  return orcamentos.map(o => ({
    ...o,
    virou_pedido: o.virou_pedido || (pedidoSet.has(o.documento) ? o.documento : undefined),
  }));
}

export function exportToJSON(data: OrcamentoData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orcamentos_${data.mes}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToHTML(data: OrcamentoData, pedidosDocumentos: string[]): void {
  const html = generateStandaloneHTML(data, pedidosDocumentos);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio_orcamentos_${data.mes}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function generateStandaloneHTML(data: OrcamentoData, pedidosDocumentos: string[]): string {
  const [year, month] = data.mes.split('-').map(Number);
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  
  const pedidoSet = new Set(pedidosDocumentos);
  const orcamentosComStatus = data.orcamentos.map(o => ({
    ...o,
    convertido: isOrcamentoConvertido(o, pedidoSet),
    status: getOrcamentoStatus(o, pedidoSet),
    motivo_perda: normalizeMotivoPerda(o.motivo_perda),
  }));

  const orcamentosNaoConvertidos = orcamentosComStatus.filter(o => !o.convertido);
  const orcamentosConvertidos = orcamentosComStatus.filter(o => o.convertido);
  const orcamentosPerdidos = orcamentosComStatus.filter(o => o.status === 'perdido');

  const totalOrcamentos = orcamentosComStatus.reduce((s, o) => s + o.valor, 0);
  const totalNaoConvertidos = orcamentosNaoConvertidos.reduce((s, o) => s + o.valor, 0);
  const totalConvertidos = orcamentosConvertidos.reduce((s, o) => s + o.valor, 0);
  const taxaConversao = totalOrcamentos > 0 ? (totalConvertidos / totalOrcamentos) * 100 : 0;

  const rows = orcamentosComStatus.map(o => `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 8px; text-align: left;">${o.documento}</td>
      <td style="padding: 8px; text-align: left;">${o.cliente}</td>
      <td style="padding: 8px; text-align: left;">${o.dataEmissao}</td>
      <td style="padding: 8px; text-align: right;">${calculateDaysInPortfolio(o.dataEmissao)} dias</td>
      <td style="padding: 8px; text-align: right;">${formatCurrency(o.valor)}</td>
      <td style="padding: 8px; text-align: center;">
        <span style="display: inline-block; padding: 4px 8px; border-radius: 999px; font-weight: bold; font-size: 12px; color: ${o.status === 'convertido' ? '#166534' : o.status === 'perdido' ? '#991b1b' : '#1d4ed8'}; background: ${o.status === 'convertido' ? '#dcfce7' : o.status === 'perdido' ? '#fee2e2' : '#dbeafe'};">
          ${o.status === 'convertido' ? 'Convertido' : o.status === 'perdido' ? 'Perdido' : 'Em aberto'}
        </span>
      </td>
      <td style="padding: 8px; text-align: left;">${o.status === 'perdido' ? (o.motivo_perda || '-') : ''}</td>
      <td style="padding: 8px; text-align: left;">${o.virou_pedido || ''}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Relatório de Orçamentos - ${monthNames[month - 1]} ${year}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          color: #333;
        }
        h1 { color: #1e40af; margin-bottom: 10px; }
        h2 { font-size: 18px; margin-top: 20px; margin-bottom: 10px; color: #1e40af; }
        .summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin: 20px 0;
        }
        .card {
          background: #f0f9ff;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #1e40af;
        }
        .card h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
        .card .value { font-size: 24px; font-weight: bold; color: #1e40af; }        .card.green { background: #f0fdf4; border-left-color: #22c55e; }
        .card.green .value { color: #16a34a; }
        .card.red { background: #fef2f2; border-left-color: #ef4444; }
        .card.red .value { color: #dc2626; }
        .card.green-taxa { background: #f0fdf4; border-left-color: #22c55e; }
        .card.green-taxa .value { color: #16a34a; }        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        table thead {
          background: #1e40af;
          color: white;
        }
        table th {
          padding: 12px;
          text-align: left;
        }
        .success { color: #22c55e; }
        .warning { color: #ef4444; }
      </style>
    </head>
    <body>
      <h1>Relatório de Orçamentos</h1>
      <p><strong>Período:</strong> ${monthNames[month - 1]} de ${year}</p>
      <p><strong>Data do Relatório:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>

      <div class="summary">
        <div class="card">
          <h3>Total de Orçamentos</h3>
          <div class="value">${formatCurrency(totalOrcamentos)}</div>
          <p>${orcamentosComStatus.length} orçamentos</p>
        </div>
        <div class="card green">
          <h3>Convertidos em Pedidos</h3>
          <div class="value">${formatCurrency(totalConvertidos)}</div>
          <p>${orcamentosConvertidos.length} orçamentos</p>
        </div>
        <div class="card red">
          <h3>NÃO Convertidos</h3>
          <div class="value">${formatCurrency(orcamentosPerdidos.reduce((s, o) => s + o.valor, 0))}</div>
          <p>${orcamentosPerdidos.length} orçamentos perdidos</p>
        </div>
        <div class="card green-taxa">
          <h3>Taxa de Conversão</h3>
          <div class="value">${taxaConversao.toFixed(1)}%</div>
          <p>${orcamentosConvertidos.length} de ${orcamentosComStatus.length} convertidos</p>
        </div>
      </div>

      <h2>Orçamentos Perdidos</h2>
      ${orcamentosPerdidos.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Documento</th>
              <th>Cliente</th>
              <th>Data Emissão</th>
              <th>Dias em Carteira</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            ${orcamentosPerdidos.map(o => `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 8px;">${o.documento}</td>
                <td style="padding: 8px;">${o.cliente}</td>
                <td style="padding: 8px;">${o.dataEmissao}</td>
                <td style="padding: 8px; text-align: right;">${calculateDaysInPortfolio(o.dataEmissao)} dias</td>
                <td style="padding: 8px; text-align: right;">${formatCurrency(o.valor)}</td>
                <td style="padding: 8px; text-align: center;"><span style="display:inline-block;padding:4px 8px;border-radius:999px;background:#fee2e2;color:#991b1b;font-weight:bold;font-size:12px;">Perdido</span></td>
                <td style="padding: 8px;">${o.motivo_perda || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>Nenhum orçamento foi marcado como perdido.</p>'}

      <h2>Todos os Orçamentos</h2>
      <table>
        <thead>
          <tr>
            <th>Documento</th>
            <th>Cliente</th>
            <th>Data Emissão</th>
            <th>Dias em Carteira</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Motivo da Perda</th>
            <th>Nº Pedido</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

export function exportToExcel(data: OrcamentoData, pedidosDocumentos: string[]): void {
  const pedidoSet = new Set(pedidosDocumentos);
  const [year, month] = data.mes.split('-').map(Number);
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const isConvExcel = (o: Orcamento) => isOrcamentoConvertido(o, pedidoSet);
  const convertidosExcel = data.orcamentos.filter(isConvExcel);
  const perdidosExcel = data.orcamentos.filter(o => getOrcamentoStatus(o, pedidoSet) === 'perdido');
  const totalExcel = data.orcamentos.reduce((s, o) => s + o.valor, 0);
  const totalConvExcel = convertidosExcel.reduce((s, o) => s + o.valor, 0);
  const taxaExcel = totalExcel > 0 ? (totalConvExcel / totalExcel) * 100 : 0;

  // Summary sheet
  const summaryData = [
    { 'Indicador': 'Total em Orçamentos', 'Valor': formatCurrency(totalExcel), 'Quantidade': data.orcamentos.length },
    { 'Indicador': 'Valores Convertidos', 'Valor': formatCurrency(totalConvExcel), 'Quantidade': convertidosExcel.length },
    { 'Indicador': 'Valores Não Convertidos', 'Valor': formatCurrency(totalExcel - totalConvExcel), 'Quantidade': data.orcamentos.length - convertidosExcel.length },
    { 'Indicador': 'Orçamentos Perdidos', 'Valor': formatCurrency(perdidosExcel.reduce((s, o) => s + o.valor, 0)), 'Quantidade': perdidosExcel.length },
    { 'Indicador': 'Taxa de Conversão', 'Valor': taxaExcel.toFixed(1) + '%', 'Quantidade': '' },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 12 }];

  // Prepare data for Excel
  const excelData = data.orcamentos.map(o => ({
    'Documento': o.documento,
    'Cliente': o.cliente,
    'Cidade': o.cidade,
    'Data Emissão': o.dataEmissao,
    'Dias em Carteira': calculateDaysInPortfolio(o.dataEmissao),
    'Valor': o.valor,
    'Convertido': isConvExcel(o) ? 'Sim' : 'Não',
    'Status': getOrcamentoStatus(o, pedidoSet) === 'convertido' ? 'Convertido' : getOrcamentoStatus(o, pedidoSet) === 'perdido' ? 'Perdido' : 'Em aberto',
    'Motivo da Perda': getOrcamentoStatus(o, pedidoSet) === 'perdido' ? normalizeMotivoPerda(o.motivo_perda) || '' : '',
    'Nº Pedido': o.virou_pedido || '',
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');
  XLSX.utils.book_append_sheet(wb, ws, 'Orçamentos');

  // Format columns
  ws['!cols'] = [
    { wch: 12 },  // Documento
    { wch: 25 },  // Cliente
    { wch: 20 },  // Cidade
    { wch: 12 },  // Data Emissão
    { wch: 16 },  // Dias em Carteira
    { wch: 12 },  // Valor
    { wch: 12 },  // Convertido
    { wch: 14 },  // Status
    { wch: 40 },  // Motivo da Perda
    { wch: 12 },  // Nº Pedido
  ];

  XLSX.writeFile(wb, `orcamentos_${data.mes}.xlsx`);
}

export function exportToPDF(data: OrcamentoData, pedidosDocumentos: string[]): void {
  // For PDF, we'll use a simple approach: open print dialog with a formatted page
  const pedidoSet = new Set(pedidosDocumentos);
  const [year, month] = data.mes.split('-').map(Number);
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const orcamentosComStatus = data.orcamentos.map(o => ({
    ...o,
    convertido: isOrcamentoConvertido(o, pedidoSet),
    status: getOrcamentoStatus(o, pedidoSet),
    motivo_perda: normalizeMotivoPerda(o.motivo_perda),
  }));

  const oportunidadesPerdidas = orcamentosComStatus.filter(o => o.status === 'perdido');
  const totalOrcamentos = orcamentosComStatus.reduce((s, o) => s + o.valor, 0);
  const totalNaoConvertidos = oportunidadesPerdidas.reduce((s, o) => s + o.valor, 0);
  const orcamentosConvertidos = orcamentosComStatus.filter(o => o.convertido);
  const totalConvertidos = orcamentosConvertidos.reduce((s, o) => s + o.valor, 0);
  const taxaConversao = totalOrcamentos > 0 ? (totalConvertidos / totalOrcamentos) * 100 : 0;
  const totalFaturado = data.totalFaturado ?? 0;
  const origemEmOrcamentos = totalFaturado > 0 ? (totalConvertidos / totalFaturado) * 100 : 0;
  const gapPvFaturadoParaOrConvertido = totalFaturado - totalConvertidos;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório de Orçamentos - ${monthNames[month - 1]} ${year}</title>
      <style>
        * { margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 20mm; color: #333; }
        h1 { color: #1e40af; margin-bottom: 10px; }
        h2 { font-size: 16px; margin-top: 20px; margin-bottom: 10px; color: #1e40af; }
        .info { margin: 10px 0; font-size: 12px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
        .card { padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .card h3 { font-size: 12px; color: #666; margin-bottom: 5px; }
        .card .value { font-size: 18px; font-weight: bold; color: #1e40af; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
        table th { background: #1e40af; color: white; padding: 8px; text-align: left; }
        table td { padding: 6px; border-bottom: 1px solid #ddd; }
        table tr:nth-child(even) { background: #f9f9f9; }
        .page-break { page-break-after: always; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>Relatório de Orçamentos</h1>
      <div class="info"><strong>Período:</strong> ${monthNames[month - 1]} de ${year}</div>
      <div class="info"><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</div>

      <div class="summary">
        <div class="card">
          <h3>Total de Orçamentos</h3>
          <div class="value">${formatCurrency(totalOrcamentos)}</div>
          <p style="font-size:11px;color:#666;margin-top:4px;">${orcamentosComStatus.length} orçamentos</p>
        </div>
        <div class="card">
          <h3>Convertidos</h3>
          <div class="value" style="color: #22c55e;">${formatCurrency(totalConvertidos)}</div>
          <p style="font-size:11px;color:#666;margin-top:4px;">${orcamentosConvertidos.length} orçamentos</p>
        </div>
        <div class="card">
          <h3>Não Convertidos</h3>
          <div class="value" style="color: #ef4444;">${formatCurrency(totalNaoConvertidos)}</div>
          <p style="font-size:11px;color:#666;margin-top:4px;">${oportunidadesPerdidas.length} orçamentos inativos</p>
        </div>
        <div class="card">
          <h3>Taxa de Conversão</h3>
          <div class="value" style="color: #22c55e;">${taxaConversao.toFixed(1)}%</div>
          <p style="font-size:11px;color:#666;margin-top:4px;">${orcamentosConvertidos.length} de ${orcamentosComStatus.length} convertidos</p>
        </div>
      </div>

      <h2>Comparativo de PV Faturado</h2>
      <div class="summary" style="grid-template-columns: repeat(3, 1fr); margin-top: 10px;">
        <div class="card">
          <h3>PV Faturado no Período</h3>
          <div class="value" style="color: #0891b2;">${formatCurrency(totalFaturado)}</div>
          <p style="font-size:11px;color:#666;margin-top:4px;">Valor informado no painel</p>
        </div>
        <div class="card">
          <h3>Origem em Orçamentos</h3>
          <div class="value" style="color: ${origemEmOrcamentos >= 60 ? '#16a34a' : origemEmOrcamentos >= 30 ? '#ca8a04' : '#475569'};">${origemEmOrcamentos.toFixed(1)}%</div>
          <p style="font-size:11px;color:#666;margin-top:4px;">${formatCurrency(totalConvertidos)} originados de ORC</p>
        </div>
        <div class="card">
          <h3>PV Faturado - OR Convertidos</h3>
          <div class="value" style="color: ${gapPvFaturadoParaOrConvertido >= 0 ? '#16a34a' : '#dc2626'};">${gapPvFaturadoParaOrConvertido >= 0 ? '+' : ''}${formatCurrency(gapPvFaturadoParaOrConvertido)}</div>
          <p style="font-size:11px;color:#666;margin-top:4px;">Diferença absoluta entre PV faturado e OR convertidos</p>
        </div>
      </div>

      <h2>Orçamentos Não Convertidos - Inativos (${oportunidadesPerdidas.length})</h2>
      ${oportunidadesPerdidas.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Documento</th>
            <th>Cliente</th>
            <th>Cidade</th>
            <th>Data</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          ${oportunidadesPerdidas.map(o => `
            <tr>
              <td>${o.documento}</td>
              <td>${o.cliente}</td>
              <td>${o.cidade}</td>
              <td>${o.dataEmissao}</td>
              <td style="text-align: right;">${formatCurrency(o.valor)}</td>
              <td style="text-align: center;"><span style="display:inline-block;padding:4px 8px;border-radius:999px;background:#fee2e2;color:#991b1b;font-weight:bold;font-size:12px;">Perdido</span></td>
              <td>${o.motivo_perda || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : '<p style="font-size: 12px; color: #666;">Todos os orçamentos foram convertidos em pedidos.</p>'}

      <h2 style="margin-top: 30px;">Todos os Orçamentos (${orcamentosComStatus.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Documento</th>
            <th>Cliente</th>
            <th>Cidade</th>
            <th>Data</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Motivo</th>
            <th>Nº Pedido</th>
          </tr>
        </thead>
        <tbody>
          ${orcamentosComStatus.map(o => `
            <tr>
              <td>${o.documento}</td>
              <td>${o.cliente}</td>
              <td>${o.cidade}</td>
              <td>${o.dataEmissao}</td>
              <td style="text-align: right;">${formatCurrency(o.valor)}</td>
              <td>${o.status === 'convertido' ? 'Convertido' : o.status === 'perdido' ? 'Perdido' : 'Em aberto'}</td>
              <td>${o.status === 'perdido' ? (o.motivo_perda || '-') : ''}</td>
              <td>${o.virou_pedido || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    const cleanup = () => URL.revokeObjectURL(url);

    printWindow.addEventListener('load', () => {
      printWindow.focus();
      printWindow.print();
    }, { once: true });

    printWindow.addEventListener('afterprint', cleanup, { once: true });
    printWindow.addEventListener('beforeunload', cleanup, { once: true });
  } else {
    URL.revokeObjectURL(url);
  }
}
