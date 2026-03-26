import type { OrcamentoData, Orcamento, OrcamentoDia } from '@/types/faturamento';

const STORAGE_KEY = 'orcamento_dados';

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

export function loadOrcamentoData(): OrcamentoData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OrcamentoData;
  } catch {
    return null;
  }
}

export function saveOrcamentoData(data: OrcamentoData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function mergeOrcamentos(existing: Orcamento[], newOrcamentos: Orcamento[]): Orcamento[] {
  const map = new Map<string, Orcamento>();
  
  existing.forEach(o => {
    map.set(o.documento, o);
  });
  
  newOrcamentos.forEach(o => {
    map.set(o.documento, o);
  });
  
  return Array.from(map.values());
}

export function compareOrcamentosWithPedidos(orcamentos: Orcamento[], pedidosDocumentos: string[]): Orcamento[] {
  const pedidoSet = new Set(pedidosDocumentos);
  return orcamentos.map(o => ({
    ...o,
    virou_pedido: pedidoSet.has(o.documento),
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
    virou_pedido: pedidoSet.has(o.documento),
  }));

  const orcamentosNaoConvertidos = orcamentosComStatus.filter(o => !o.virou_pedido);
  const orcamentosConvertidos = orcamentosComStatus.filter(o => o.virou_pedido);

  const totalOrcamentos = orcamentosComStatus.reduce((s, o) => s + o.valor, 0);
  const totalNaoConvertidos = orcamentosNaoConvertidos.reduce((s, o) => s + o.valor, 0);
  const totalConvertidos = orcamentosConvertidos.reduce((s, o) => s + o.valor, 0);

  const rows = orcamentosComStatus.map(o => `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 8px; text-align: left;">${o.documento}</td>
      <td style="padding: 8px; text-align: left;">${o.cliente}</td>
      <td style="padding: 8px; text-align: left;">${o.dataEmissao}</td>
      <td style="padding: 8px; text-align: right;">${formatCurrency(o.valor)}</td>
      <td style="padding: 8px; text-align: center;">
        <span style="color: ${o.virou_pedido ? '#22c55e' : '#ef4444'}; font-weight: bold;">
          ${o.virou_pedido ? 'Sim' : 'Não'}
        </span>
      </td>
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
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin: 20px 0;
        }
        .card {
          background: #f0f9ff;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #1e40af;
        }
        .card h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
        .card .value { font-size: 24px; font-weight: bold; color: #1e40af; }
        table {
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
        <div class="card">
          <h3>Convertidos em Pedidos</h3>
          <div class="value success">${formatCurrency(totalConvertidos)}</div>
          <p>${orcamentosConvertidos.length} orçamentos</p>
        </div>
        <div class="card">
          <h3>NÃO Convertidos</h3>
          <div class="value warning">${formatCurrency(totalNaoConvertidos)}</div>
          <p>${orcamentosNaoConvertidos.length} orçamentos</p>
        </div>
      </div>

      <h2>Detalhes dos Orçamentos NÃO Convertidos em Pedidos</h2>
      ${orcamentosNaoConvertidos.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Documento</th>
              <th>Cliente</th>
              <th>Data Emissão</th>
              <th>Valor</th>
              <th>Virou Pedido</th>
            </tr>
          </thead>
          <tbody>
            ${orcamentosNaoConvertidos.map(o => `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 8px;">${o.documento}</td>
                <td style="padding: 8px;">${o.cliente}</td>
                <td style="padding: 8px;">${o.dataEmissao}</td>
                <td style="padding: 8px; text-align: right;">${formatCurrency(o.valor)}</td>
                <td style="padding: 8px; text-align: center; color: #ef4444; font-weight: bold;">Não</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>Todos os orçamentos foram convertidos em pedidos.</p>'}

      <h2>Todos os Orçamentos</h2>
      <table>
        <thead>
          <tr>
            <th>Documento</th>
            <th>Cliente</th>
            <th>Data Emissão</th>
            <th>Valor</th>
            <th>Virou Pedido</th>
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
