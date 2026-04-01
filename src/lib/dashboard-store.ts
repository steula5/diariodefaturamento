import type { DashboardData, Pedido, ReportPeriod } from '@/types/faturamento';
import { getBusinessDaysInMonth, getRemainingBusinessDays, isHoliday } from '@/lib/holidays';

const STORAGE_KEY = 'faturamento_dashboard';

// Helper function to normalize classification: empty or 'a' = 'a', 'p' = 'p'
export function getClassification(clasificacao: string): 'a' | 'p' {
  const cls = (clasificacao || '').toLowerCase().trim();
  const result = cls === 'p' ? 'p' : 'a';
  if (clasificacao && clasificacao !== 'p' && result !== 'p') {
    console.log(`getClassification("${clasificacao}") -> "${result}" (cls="${cls}")`);
  }
  return result;
}

export function getDefaultReportPeriod(date = new Date()): ReportPeriod {
  return date.getHours() < 12 ? 'manha' : 'tarde';
}

function normalizeDashboardData(data: DashboardData): DashboardData {
  return {
    ...data,
    periodoRelatorio: data.periodoRelatorio || getDefaultReportPeriod(),
  };
}

export function loadDashboardData(): DashboardData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeDashboardData(JSON.parse(raw) as DashboardData);
  } catch {
    return null;
  }
}

export function saveDashboardData(data: DashboardData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportToJSON(data: DashboardData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `faturamento_${data.mes}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToHTML(data: DashboardData): void {
  const html = generateStandaloneHTML(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio_faturamento_${data.mes}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function generateStandaloneHTML(data: DashboardData): string {
  const periodoRelatorio = data.periodoRelatorio || getDefaultReportPeriod();
  const periodoRelatorioLabel = periodoRelatorio === 'manha' ? 'Manhã' : 'Tarde';
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const monthsWithData = Array.from(new Set(
    data.faturamentoDiario.map(f => f.data.slice(0, 7))
  )).sort();
  const reportMonthKey = monthsWithData.includes(data.mes)
    ? data.mes
    : (monthsWithData[monthsWithData.length - 1] || data.mes);
  const [year, month] = reportMonthKey.split('-').map(Number);

  const classificacoes = data.classificacoes || {};
  const observacoes = data.observacoes || {};
  const realPedidos = data.pedidos.filter(p => !p.isDailyReport);

  const pedidosMesAtual = realPedidos.filter(p => getClassification(classificacoes[p.documento] || '') === 'a');
  const pedidosProximoMes = realPedidos.filter(p => getClassification(classificacoes[p.documento] || '') === 'p');

  const totalDespacho = pedidosMesAtual.reduce((s, p) => s + p.valor, 0);
  const totalProximoMes = pedidosProximoMes.reduce((s, p) => s + p.valor, 0);

  const fatDiarioDoMes = data.faturamentoDiario.filter(f => {
    const [fy, fm] = f.data.split('-').map(Number);
    return fy === year && fm === month;
  });
  const totalFaturamento = fatDiarioDoMes.reduce((s, f) => s + f.valor, 0);
  const diasComFat = fatDiarioDoMes.length;
  const mediaDiaria = diasComFat > 0 ? totalFaturamento / diasComFat : 0;
  const diasUteisMes = getBusinessDaysInMonth(reportMonthKey, data.feriadosPersonalizados);
  const projecao = mediaDiaria * diasUteisMes;
  const diasUteisFaltantes = getRemainingBusinessDays(reportMonthKey, periodoRelatorio, data.feriadosPersonalizados);
  const objetivoDiario = diasUteisFaltantes > 0 ? (data.meta - totalFaturamento) / diasUteisFaltantes : 0;

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const fatDiarioJSON = JSON.stringify(data.faturamentoDiario);
  const feriadosJSON = JSON.stringify(data.feriadosPersonalizados || []);
  const yearsInReport = new Set<number>([year]);
  data.faturamentoDiario.forEach(f => {
    yearsInReport.add(Number(f.data.split('-')[0]));
  });
  const feriadosNacionais = new Set<string>();
  yearsInReport.forEach(reportYear => {
    const date = new Date(reportYear, 0, 1);
    while (date.getFullYear() === reportYear) {
      if (isHoliday(date)) {
        feriadosNacionais.add(date.toISOString().split('T')[0]);
      }
      date.setDate(date.getDate() + 1);
    }
  });
  const feriadosNacionaisJSON = JSON.stringify(Array.from(feriadosNacionais));

  // Build sorted orders using custom order if available
  let sortedPedidos: Pedido[];
  if (data.ordenacaoPedidos && data.ordenacaoPedidos.length > 0) {
    sortedPedidos = [...realPedidos].sort((a, b) => {
      const idxA = data.ordenacaoPedidos!.indexOf(a.documento);
      const idxB = data.ordenacaoPedidos!.indexOf(b.documento);
      const posA = idxA >= 0 ? idxA : 9999;
      const posB = idxB >= 0 ? idxB : 9999;
      return posA - posB;
    });
  } else {
    // Default: P first, then A
    const sortedPPedidos = [...pedidosProximoMes];
    sortedPedidos = [...sortedPPedidos, ...pedidosMesAtual];
  }

  // No class column in export
  const ordersHTML = sortedPedidos.map(p => {
    const obs = observacoes[p.documento] || '';
    const cls = getClassification(classificacoes[p.documento] || '');
    const isP = cls === 'p';
    const bgStyle = isP ? 'background:#fef9c3;' : '';
    return `<tr style="${bgStyle}"><td class="mono" style="font-weight:600">${p.documento}</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.cliente}</td><td style="color:#64748b">${p.cidade}</td><td style="color:#64748b;font-size:.7rem">${p.dataEmissao}</td><td class="mono val-cell" style="text-align:right;font-weight:600;${isP ? 'color:#f59e0b' : ''}">${fmt(p.valor)}</td><td style="font-size:.65rem">${p.status || 'Desp. Aprovado'}</td><td class="obs-col" title="${obs}">${obs}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório de Faturamento — ${monthNames[month - 1]} ${year}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#f5f7fa;color:#1a1a2e;padding:20px;font-size:14px}
.container{max-width:1400px;margin:0 auto}
h1{font-size:1.4rem;font-weight:700;margin-bottom:4px}
.subtitle{font-size:.85rem;color:#64748b;margin-bottom:20px}
.grid{display:grid;gap:16px;margin-bottom:20px}
.grid-kpi{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.grid-main{grid-template-columns:340px 1fr}
.card{background:#fff;border-radius:12px;padding:14px 16px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden}
.card-label{font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:4px}
.card-value{font-size:1.05rem;font-weight:700;font-family:'Courier New',monospace;white-space:nowrap;line-height:1.3}
.text-primary{color:#2563eb}
.text-success{color:#10b981}
.text-warning{color:#f59e0b}
.text-danger{color:#ef4444}
.text-info{color:#3b82f6}
.border-l-accent{border-left:4px solid #2563eb}
.border-l-success{border-left:4px solid #10b981}
.border-l-warning{border-left:4px solid #f59e0b}
.border-l-info{border-left:4px solid #3b82f6}
table{width:100%;border-collapse:collapse;font-size:.75rem}
th{text-align:left;padding:6px 8px;border-bottom:2px solid #e2e8f0;color:#64748b;font-size:.65rem;text-transform:uppercase;white-space:nowrap}
td{padding:6px 8px;border-bottom:1px solid #f1f5f9}
tr:hover{background:#f8fafc}
.mono{font-family:'Courier New',monospace}
.val-cell{white-space:nowrap}
.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
.cal-header{text-align:center;font-size:.55rem;font-weight:700;color:#94a3b8;padding:3px;text-transform:uppercase}
.cal-day{border-radius:6px;padding:4px 2px;text-align:center;min-height:48px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:2px;border:1px solid transparent;font-size:.7rem;cursor:pointer;transition:all .15s}
.cal-day:hover{border-color:#2563eb;background:#eff6ff}
.cal-day.today{border-color:#2563eb;background:#eff6ff;box-shadow:0 0 0 2px rgba(37,99,235,.15)}
.cal-day.weekend{background:#f8fafc}
.cal-day.feriado{background:#fff7ed;border-color:#fed7aa}
.cal-day.has-fat{background:#ecfdf5}
.cal-day .fat-val{font-size:.5rem;font-weight:700;color:#10b981;font-family:'Courier New',monospace;word-break:break-all}
.cal-day.selected{border-color:#2563eb;background:#dbeafe;box-shadow:0 0 0 2px rgba(37,99,235,.25)}
.day-detail{background:#eff6ff;border-radius:8px;padding:16px;margin-top:8px;display:none;text-align:center}
.day-detail.visible{display:block}
.day-detail .day-title{font-size:.85rem;font-weight:600;color:#64748b;margin-bottom:8px}
.day-detail .day-value{font-size:1.5rem;font-weight:700;font-family:'Courier New',monospace;color:#10b981}
.day-detail .day-no-data{font-size:.85rem;color:#94a3b8}
.obs-col{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cal-totals{margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0}
.cal-totals .row{margin-bottom:8px}
.chart-wrap{width:100%;overflow-x:auto}
.chart-svg{width:100%;height:220px;display:block}
.chart-axis{stroke:#cbd5e1;stroke-width:1}
.chart-grid{stroke:#e2e8f0;stroke-width:1;stroke-dasharray:3 3}
.chart-line{fill:none;stroke:#2563eb;stroke-width:3}
.chart-area{fill:rgba(37,99,235,.14)}
.chart-dot{fill:#2563eb}
.chart-trend{fill:none;stroke-width:2.2;stroke-dasharray:7 5}
.chart-trend.up{stroke:#10b981}
.chart-trend.down{stroke:#ef4444}
.chart-trend.flat{stroke:#64748b}
.chart-label{font-size:10px;fill:#64748b}
.chart-value{font-size:10px;fill:#334155}
.chart-trend-summary{margin-top:8px;font-size:.72rem;color:#475569;font-weight:600}
.chart-trend-summary .trend-meta{font-weight:500;color:#64748b;margin-left:6px}
.chart-tip{position:fixed;background:#1e293b;color:#fff;font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;pointer-events:none;display:none;z-index:100;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.3)}
.chart-tip.vis{display:block}
.tab-btn{font-size:.65rem;font-weight:600;padding:4px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;cursor:pointer;transition:all .15s}
.tab-btn.tab-active{background:#2563eb;color:#fff;border-color:#2563eb}
.tab-btn:hover:not(.tab-active){background:#f1f5f9}
@media(max-width:768px){.grid-kpi{grid-template-columns:repeat(2,1fr)}.grid-main{grid-template-columns:1fr}.card-value{font-size:.9rem}}
</style>
</head>
<body>
<div class="container">
<h1>Diário de Faturamento</h1>
<p id="report-subtitle" class="subtitle">${monthNames[month - 1]} ${year} — Relatório Gerencial (${periodoRelatorioLabel})</p>

<div class="grid grid-kpi">
${data.meta > 0 ? `<div class="card"><div class="card-label">Meta do Mês</div><div class="card-value text-primary">${fmt(data.meta)}</div></div>` : ''}
<div class="card border-l-accent"><div class="card-label">Despacho Aprovado</div><div class="card-value text-primary">${fmt(totalDespacho)}</div><div style="font-size:.7rem;color:#64748b;margin-top:2px">${pedidosMesAtual.length} pedidos</div></div>
<div class="card border-l-warning" style="background:#fffbeb"><div class="card-label">Próximos Despachos</div><div class="card-value text-warning">${fmt(totalProximoMes)}</div><div style="font-size:.7rem;color:#64748b;margin-top:2px">${pedidosProximoMes.length} pedidos</div></div>
<div class="card border-l-success"><div class="card-label">Faturamento</div><div id="kpi-faturamento" class="card-value text-success">${fmt(totalFaturamento)}</div></div>
${data.meta > 0 ? `<div class="card"><div class="card-label">Objetivo Diário</div><div id="kpi-objetivo" class="card-value text-warning">${fmt(Math.max(0, objetivoDiario))}</div><div id="kpi-objetivo-meta" style="font-size:.7rem;color:#64748b;margin-top:2px">${diasUteisFaltantes} dias úteis restantes</div></div>` : ''}
<div class="card border-l-warning" style="background:#fef3c7"><div class="card-label">Dias Úteis Restantes</div><div id="kpi-dias-restantes" class="card-value text-warning">${diasUteisFaltantes}</div><div style="font-size:.7rem;color:#64748b;margin-top:2px">dias para faturar este mês</div></div>
<div class="card border-l-info"><div class="card-label">Projeção de Faturamento</div><div id="kpi-projecao" class="card-value text-info" style="font-size:.9rem;line-height:1.3">${fmt(projecao)}</div><div id="kpi-projecao-meta" style="font-size:.7rem;color:#64748b;margin-top:2px">${diasComFat > 0 ? `Média: ${fmt(mediaDiaria)} × ${diasUteisMes} dias` : ''}</div></div>
</div>

<div class="card" style="margin-bottom:20px">
<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
<div class="card-label" style="margin-bottom:0">Gráfico de Faturamento</div>
<div style="display:flex;gap:4px">
<button id="tab-diario" onclick="setTab('diario')" class="tab-btn tab-active">Evolução Diária</button>
<button id="tab-mensal" onclick="setTab('mensal')" class="tab-btn">Comparativo Mensal</button>
</div>
</div>
<div id="panel-diario">
<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px">
<button onclick="changeChartMonth(-1)" style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:16px;line-height:1;color:#64748b">&#8249;</button>
<span id="chart-month-label" style="font-size:.8rem;font-weight:600;color:#475569;min-width:130px;text-align:center"></span>
<button onclick="changeChartMonth(1)" style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:16px;line-height:1;color:#64748b">&#8250;</button>
</div>
<div class="chart-wrap">
<div id="chart-tip" class="chart-tip"></div>
<svg id="daily-sales-chart" class="chart-svg" viewBox="0 0 1000 220" preserveAspectRatio="none"></svg>
</div>
<div id="chart-trend-summary" class="chart-trend-summary"></div>
</div>
<div id="panel-mensal" style="display:none">
<div class="chart-wrap">
<svg id="monthly-chart" class="chart-svg" viewBox="0 0 1000 220" preserveAspectRatio="none"></svg>
</div>
<div id="monthly-chart-summary" class="chart-trend-summary" style="margin-top:8px"></div>
</div>
</div>

<div class="grid grid-main">
<div class="card">
<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
<div class="card-label" style="margin-bottom:0">Calendário</div>
<div style="display:flex;align-items:center;gap:8px">
<button onclick="changeCalendarMonth(-1)" style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:16px;line-height:1;color:#64748b">&#8249;</button>
<span id="calendar-month-label" style="font-size:.72rem;font-weight:600;color:#475569;min-width:120px;text-align:center"></span>
<button onclick="changeCalendarMonth(1)" style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:16px;line-height:1;color:#64748b">&#8250;</button>
</div>
</div>
<div class="card-label" style="margin-bottom:8px;font-size:.6rem;color:#94a3b8">Clique em um dia para ver o faturamento</div>
<div id="calendar"></div>
<div id="day-detail" class="day-detail"></div>
<div class="cal-totals">
<div class="row"><div class="card-label">Total Faturado</div><div class="card-value text-success" id="total-fat"></div></div>
<div class="row"><div class="card-label">Média Diária</div><div class="card-value" id="media-fat"></div></div>
</div>
</div>
<div class="card">
<div class="card-label">Pedidos — Despacho Aprovado (${realPedidos.length})</div>
<div style="overflow:auto;max-height:500px">
<table><thead><tr><th>Pedido</th><th>Cliente</th><th>Cidade</th><th>Emissão</th><th style="text-align:right">Valor</th><th>Status</th><th>Observação</th></tr></thead><tbody>${ordersHTML}</tbody></table>
</div>
</div>
</div>
<p style="text-align:center;font-size:.7rem;color:#94a3b8;margin-top:20px">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
</div>
<script>
var fatDiario=${fatDiarioJSON};
var feriadosPersonalizados=${feriadosJSON};
var feriadosNacionais=${feriadosNacionaisJSON};
var MONTH_NAMES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var REPORT_YEAR=${year},REPORT_MONTH=${month},PERIODO='${periodoRelatorio}';
var REPORT_META=${data.meta};
var fmt=function(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v)};
var fmtScale=function(v){
  var inThousands=Math.round(v/1000);
  if(inThousands<1000) return inThousands+'K';
  var inMillions=inThousands/1000;
  var rounded=Math.round(inMillions*10)/10;
  var text=String(rounded);
  if(text.endsWith('.0')) text=text.slice(0,-2);
  return text+'M';
};
var WEEKDAYS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
var selectedDay=null;
var tipLabels=[];
var monthTipLabels=[];
var tip=null;
var chartYear=REPORT_YEAR,chartMonth=REPORT_MONTH;
var calendarYear=REPORT_YEAR,calendarMonth=REPORT_MONTH;
var allHolidays=feriadosPersonalizados.concat(feriadosNacionais.filter(function(d){return feriadosPersonalizados.indexOf(d)===-1;}));
var availableMonths=(function(){
  var seen={},list=[];
  fatDiario.forEach(function(f){
    var p=f.data.split('-');var key=p[0]+'-'+p[1];
    if(!seen[key]){seen[key]=1;list.push({y:+p[0],m:+p[1]});}
  });
  list.sort(function(a,b){return a.y!==b.y?a.y-b.y:a.m-b.m});
  var curKey=REPORT_YEAR+'-'+(REPORT_MONTH<10?'0'+REPORT_MONTH:''+REPORT_MONTH);
  if(!seen[curKey]) list.push({y:REPORT_YEAR,m:REPORT_MONTH});
  return list;
})();
function showTip(e,label){if(!tip)tip=document.getElementById('chart-tip');tip.textContent=label;tip.className='chart-tip vis';moveTip(e)}
function moveTip(e){var x=e.clientX+14,y=e.clientY-42;if(x+260>window.innerWidth)x=e.clientX-260;tip.style.left=x+'px';tip.style.top=y+'px'}
function hideTip(){if(tip)tip.className='chart-tip'}
function setTab(tab){
  document.getElementById('panel-diario').style.display=tab==='diario'?'block':'none';
  document.getElementById('panel-mensal').style.display=tab==='mensal'?'block':'none';
  document.getElementById('tab-diario').className='tab-btn'+(tab==='diario'?' tab-active':'');
  document.getElementById('tab-mensal').className='tab-btn'+(tab==='mensal'?' tab-active':'');
  if(tab==='mensal') renderMonthlyChart(); else renderDailySalesChart();
}
function changeChartMonth(dir){
  var idx=-1;
  for(var i=0;i<availableMonths.length;i++){if(availableMonths[i].y===chartYear&&availableMonths[i].m===chartMonth){idx=i;break;}}
  var ni=idx+dir;
  if(ni<0||ni>=availableMonths.length) return;
  chartYear=availableMonths[ni].y;chartMonth=availableMonths[ni].m;
  renderDailySalesChart();
}

function changeCalendarMonth(dir){
  var idx=-1;
  for(var i=0;i<availableMonths.length;i++){
    if(availableMonths[i].y===calendarYear&&availableMonths[i].m===calendarMonth){idx=i;break;}
  }
  var ni=idx+dir;
  if(ni<0||ni>=availableMonths.length) return;
  calendarYear=availableMonths[ni].y;
  calendarMonth=availableMonths[ni].m;
  selectedDay=null;
  var detail=document.getElementById('day-detail');
  if(detail) detail.className='day-detail';
  updateMonthCards();
  renderCalendar();
}

function getMonthKey(year,month){
  return year+'-'+String(month).padStart(2,'0');
}

function getMonthStats(year,month){
  var monthKey=getMonthKey(year,month);
  var totalFaturamento=0;
  var diasComFat=0;
  fatDiario.forEach(function(f){
    if(f.data.slice(0,7)===monthKey){
      totalFaturamento+=f.valor;
      diasComFat+=1;
    }
  });

  var diasUteisMes=0;
  var diasUteisFaltantes=0;
  var now=new Date();
  now.setHours(0,0,0,0);
  var date=new Date(year,month-1,1);
  while(date.getMonth()===month-1){
    var dow=date.getDay();
    var key=date.toISOString().split('T')[0];
    var isBusiness=dow!==0&&dow!==6&&!allHolidays.includes(key);
    if(isBusiness){
      diasUteisMes+=1;
      var isToday=date.getTime()===now.getTime();
      if(date>now || (PERIODO==='manha' && isToday)) diasUteisFaltantes+=1;
    }
    date.setDate(date.getDate()+1);
  }

  var mediaDiaria=diasComFat>0?totalFaturamento/diasComFat:0;
  var projecao=mediaDiaria*diasUteisMes;
  var objetivoDiario=diasUteisFaltantes>0?(REPORT_META-totalFaturamento)/diasUteisFaltantes:0;
  return {
    totalFaturamento: totalFaturamento,
    diasComFat: diasComFat,
    diasUteisMes: diasUteisMes,
    diasUteisFaltantes: diasUteisFaltantes,
    mediaDiaria: mediaDiaria,
    projecao: projecao,
    objetivoDiario: objetivoDiario,
  };
}

function updateMonthCards(){
  var stats=getMonthStats(calendarYear,calendarMonth);
  var subtitle=document.getElementById('report-subtitle');
  if(subtitle) subtitle.textContent=MONTH_NAMES[calendarMonth-1]+' '+calendarYear+' — Relatório Gerencial (${periodoRelatorioLabel})';
  var faturamento=document.getElementById('kpi-faturamento');
  if(faturamento) faturamento.textContent=fmt(stats.totalFaturamento);
  var objetivo=document.getElementById('kpi-objetivo');
  if(objetivo) objetivo.textContent=fmt(Math.max(0,stats.objetivoDiario));
  var objetivoMeta=document.getElementById('kpi-objetivo-meta');
  if(objetivoMeta) objetivoMeta.textContent=stats.diasUteisFaltantes+' dias úteis restantes';
  var diasRestantes=document.getElementById('kpi-dias-restantes');
  if(diasRestantes) diasRestantes.textContent=String(stats.diasUteisFaltantes);
  var projecao=document.getElementById('kpi-projecao');
  if(projecao) projecao.textContent=fmt(stats.projecao);
  var projecaoMeta=document.getElementById('kpi-projecao-meta');
  if(projecaoMeta) {
    projecaoMeta.textContent=stats.diasComFat>0
      ? 'Média: '+fmt(stats.mediaDiaria)+' × '+stats.diasUteisMes+' dias'
      : '';
  }
}

function renderCalendar(){
var cal=document.getElementById('calendar');
var label=document.getElementById('calendar-month-label');
if(label) label.textContent=MONTH_NAMES[calendarMonth-1]+' '+calendarYear;
var yr=calendarYear,mo=calendarMonth;
var first=new Date(yr,mo-1,1);
var last=new Date(yr,mo,0);
var today=new Date();today.setHours(0,0,0,0);
var fatMap=new Map();
fatDiario.forEach(function(f){fatMap.set(f.data,f.valor)});
var html='<div class="calendar-grid">';
WEEKDAYS.forEach(function(w){html+='<div class="cal-header">'+w+'</div>'});
for(var i=0;i<first.getDay();i++)html+='<div></div>';
var total=0,count=0;
for(var d=1;d<=last.getDate();d++){
var dt=new Date(yr,mo-1,d);
var key=dt.toISOString().split('T')[0];
var fat=fatMap.get(key)||0;
if(fat>0){total+=fat;count++}
var isToday=dt.getTime()===today.getTime();
var isWknd=dt.getDay()===0||dt.getDay()===6;
var isFeriado=allHolidays.includes(key);
var cls=['cal-day'];
if(isToday)cls.push('today');
if(isWknd)cls.push('weekend');
if(isFeriado)cls.push('feriado');
if(fat>0)cls.push('has-fat');
if(selectedDay===d)cls.push('selected');
html+='<div class="'+cls.join(' ')+'" onclick="selectDay('+d+','+fat+')"><div style="'+(isFeriado?'color:#f97316':'')+'">'+d+(isFeriado?' 🏖':'')+'</div>'+(fat>0?'<div class="fat-val">'+fmt(fat)+'</div>':'')+'</div>';
}
html+='</div>';
cal.innerHTML=html;
document.getElementById('total-fat').textContent=fmt(total);
document.getElementById('media-fat').textContent=count>0?fmt(total/count):'—';
}

function selectDay(d,fat){
selectedDay=selectedDay===d?null:d;
renderCalendar();
var detail=document.getElementById('day-detail');
if(!selectedDay){detail.className='day-detail';return}
if(fat>0){
detail.innerHTML='<div class="day-title">Faturamento — Dia '+d+'/'+calendarMonth+'/'+calendarYear+'</div><div class="day-value">'+fmt(fat)+'</div>';
} else {
detail.innerHTML='<div class="day-title">Dia '+d+'/'+calendarMonth+'/'+calendarYear+'</div><div class="day-no-data">Sem faturamento registrado</div>';
}
detail.className='day-detail visible';
}

function renderDailySalesChart(){
var label=document.getElementById('chart-month-label');
if(label) label.textContent=MONTH_NAMES[chartMonth-1]+' '+chartYear;
var svg=document.getElementById('daily-sales-chart');
var trendSummary=document.getElementById('chart-trend-summary');
if(!svg) return;

var yr=chartYear,mo=chartMonth;
var now=new Date();
var isCurrentMonth=now.getFullYear()===yr && (now.getMonth()+1)===mo;
var lastDay=new Date(yr,mo,0).getDate();

// manha: exclui hoje (dados incompletos); tarde: inclui hoje
var cutoffDate;
if(isCurrentMonth){
  var td=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  cutoffDate=PERIODO==='manha'?new Date(td.getTime()-86400000):td;
} else {
  cutoffDate=new Date(yr,mo,0);
}

var fatMap=new Map();
fatDiario.forEach(function(f){
  var p=f.data.split('-').map(Number);
  if(p[0]===yr && p[1]===mo) fatMap.set(p[2],f.valor);
});

var points=[];
for(var d=1;d<=lastDay;d++){
  var dt=new Date(yr,mo-1,d);
  var wk=dt.getDay();
  if(wk===0||wk===6) continue;
  var dtKey=dt.toISOString().split('T')[0];
  if(allHolidays.includes(dtKey)) continue;
  if(dt>cutoffDate) continue;
  points.push({day:d,value:fatMap.get(d)||0});
}

if(points.length===0){
  svg.innerHTML='<text x="500" y="110" text-anchor="middle" class="chart-label">Sem dias úteis para exibir no período</text>';
  if(trendSummary) trendSummary.textContent='Tendência: sem dados no período.';
  return;
}

var maxVal=1;
points.forEach(function(p){if(p.value>maxVal)maxVal=p.value;});

var left=52,right=20,top=16,bottom=28;
var w=1000,h=220;
var chartW=w-left-right,chartH=h-top-bottom;

function xAt(i){
  if(points.length===1) return left+chartW/2;
  return left+(i*(chartW/(points.length-1)));
}
function yAt(v){return top+((maxVal-v)/maxVal)*chartH;}
function clamp(v,mn,mx){return Math.max(mn,Math.min(mx,v));}

var trendClass='flat';
var trendLabel='estável';
var trendPath='';
var trendMeta='';
if(points.length>=2){
  var n=points.length;
  var sumX=0,sumY=0,sumXY=0,sumXX=0;
  points.forEach(function(p,i){
    sumX+=i;
    sumY+=p.value;
    sumXY+=i*p.value;
    sumXX+=i*i;
  });
  var den=(n*sumXX)-(sumX*sumX);
  var slope=den===0?0:((n*sumXY)-(sumX*sumY))/den;
  var intercept=(sumY-(slope*sumX))/n;

  var startVal=intercept;
  var endVal=(slope*(n-1))+intercept;
  var startYRaw=yAt(clamp(startVal,0,maxVal));
  var endYRaw=yAt(clamp(endVal,0,maxVal));

  // Em dados muito estáveis, amplifica visualmente a linha para facilitar leitura de direção.
  var pxDelta=Math.abs(endYRaw-startYRaw);
  var minVisibleDeltaPx=14;
  var startY=startYRaw;
  var endY=endYRaw;
  var ampFactor=1;
  if(pxDelta<minVisibleDeltaPx){
    var midY=(startYRaw+endYRaw)/2;
    ampFactor=Math.min(minVisibleDeltaPx/Math.max(pxDelta,0.5),10);
    startY=clamp(midY+((startYRaw-midY)*ampFactor),top,top+chartH);
    endY=clamp(midY+((endYRaw-midY)*ampFactor),top,top+chartH);
  }
  trendPath='M '+xAt(0)+' '+startY+' L '+xAt(n-1)+' '+endY;
  var avgVal=sumY/n;
  var slopePctPerDay=avgVal>0?(slope/avgVal)*100:0;
  var deltaPct=avgVal>0?((endVal-startVal)/avgVal)*100:0;

  var strongThreshold=0.12;
  var lightThreshold=0.03;
  if(slopePctPerDay>strongThreshold){
    trendClass='up';
    trendLabel='subindo';
  } else if(slopePctPerDay<-strongThreshold){
    trendClass='down';
    trendLabel='descendo';
  } else if(slopePctPerDay>lightThreshold){
    trendClass='up';
    trendLabel='leve alta';
  } else if(slopePctPerDay<-lightThreshold){
    trendClass='down';
    trendLabel='leve queda';
  }

  var ampText=ampFactor>1.01?' | linha ampliada '+ampFactor.toFixed(1)+'x':'';
  trendMeta='(inclinação '+slopePctPerDay.toFixed(3).replace('.',',')+'%/dia útil | variação '+deltaPct.toFixed(2).replace('.',',')+'%'+ampText+')';
}
if(trendSummary){
  trendSummary.innerHTML='Tendência de <strong>'+MONTH_NAMES[mo-1]+' '+yr+'</strong>: <strong>'+trendLabel+'</strong>. <span class="trend-meta">'+trendMeta+'</span>';
}

var yTicks=4;
var grid='';
for(var t=0;t<=yTicks;t++){
  var yg=top+(t*(chartH/yTicks));
  var vg=maxVal-(t*(maxVal/yTicks));
  grid+='<line x1="'+left+'" y1="'+yg+'" x2="'+(w-right)+'" y2="'+yg+'" class="chart-grid" />';
  grid+='<text x="'+(left-6)+'" y="'+(yg+3)+'" text-anchor="end" class="chart-label">'+(vg===0?'0':fmtScale(vg))+'</text>';
}

var linePath='',areaPath='M '+xAt(0)+' '+(top+chartH)+' ';
points.forEach(function(p,i){
  var x=xAt(i),y=yAt(p.value);
  linePath+=(i===0?'M ':' L ')+x+' '+y;
  areaPath+='L '+x+' '+y+' ';
});
areaPath+='L '+xAt(points.length-1)+' '+(top+chartH)+' Z';

tipLabels=[];
points.forEach(function(p){
  tipLabels.push('Dia '+p.day+(p.value>0?' — '+fmt(p.value):' — Sem faturamento'));
});

var hitZones='',xLabels='';
points.forEach(function(p,i){
  var x=xAt(i);
  var x1=i===0?left:(xAt(i-1)+x)/2;
  var x2=i===points.length-1?(w-right):(x+xAt(i+1))/2;
  hitZones+='<rect x="'+x1+'" y="'+top+'" width="'+(x2-x1)+'" height="'+chartH+'" fill="transparent" style="cursor:crosshair" onmouseover="showTip(event,tipLabels['+i+'])" onmouseout="hideTip()" />';
  if(p.value>0) hitZones+='<circle cx="'+x+'" cy="'+yAt(p.value)+'" r="3.5" class="chart-dot" style="pointer-events:none" />';
  xLabels+='<text x="'+x+'" y="'+(h-6)+'" text-anchor="middle" class="chart-label">'+p.day+'</text>';
});

svg.innerHTML=''
  +'<line x1="'+left+'" y1="'+(top+chartH)+'" x2="'+(w-right)+'" y2="'+(top+chartH)+'" class="chart-axis" />'
  +grid
  +'<path d="'+areaPath+'" class="chart-area" />'
  +'<path d="'+linePath+'" class="chart-line" />'
  +(trendPath?'<path d="'+trendPath+'" class="chart-trend '+trendClass+'" />':'')
  +hitZones
  +xLabels;
}

function renderMonthlyChart(){
  var svg=document.getElementById('monthly-chart');
  var summary=document.getElementById('monthly-chart-summary');
  if(!svg) return;
  var monthTotals={};
  fatDiario.forEach(function(f){
    var p=f.data.split('-');var k=p[0]+'-'+p[1];
    monthTotals[k]=(monthTotals[k]||0)+f.valor;
  });
  var months=Object.keys(monthTotals).sort();
  if(months.length===0){
    svg.innerHTML='<text x="500" y="110" text-anchor="middle" class="chart-label">Sem dados para comparativo mensal</text>';
    if(summary) summary.textContent='Sem dados registrados.';
    return;
  }
  var w=1000,h=220,left=60,right=20,top=20,bottom=42;
  var chartW=w-left-right,chartH=h-top-bottom;
  var n=months.length;
  var barW=Math.min(80,Math.floor(chartW/n*0.6));
  var maxVal=1;
  months.forEach(function(k){if(monthTotals[k]>maxVal)maxVal=monthTotals[k];});
  var curKey=REPORT_YEAR+'-'+(REPORT_MONTH<10?'0'+REPORT_MONTH:''+REPORT_MONTH);
  monthTipLabels=[];
  months.forEach(function(k){
    var parts=k.split('-');
    monthTipLabels.push(MONTH_NAMES[+parts[1]-1]+' '+parts[0]+': '+fmt(monthTotals[k]));
  });
  var yTicks=4,grid='';
  for(var t=0;t<=yTicks;t++){
    var yg=top+(t*(chartH/yTicks));
    var vg=maxVal-(t*(maxVal/yTicks));
    grid+='<line x1="'+left+'" y1="'+yg+'" x2="'+(w-right)+'" y2="'+yg+'" class="chart-grid" />';
    grid+='<text x="'+(left-6)+'" y="'+(yg+3)+'" text-anchor="end" class="chart-label">'+(vg===0?'0':fmtScale(vg))+'</text>';
  }
  var bars='',xLabels='',valLabels='';
  months.forEach(function(k,i){
    var x=left+(i+0.5)*(chartW/n);
    var val=monthTotals[k];
    var bh=Math.max(2,(val/maxVal)*chartH);
    var y=top+chartH-bh;
    var isCur=k===curKey;
    var color=isCur?'#2563eb':'#93c5fd';
    var parts=k.split('-');
    var lbl=MONTH_NAMES[+parts[1]-1].substring(0,3)+'/'+parts[0].substring(2);
    bars+='<rect x="'+(x-barW/2)+'" y="'+y+'" width="'+barW+'" height="'+bh+'" rx="4" fill="'+color+'" opacity="0.9" onmouseover="showTip(event,monthTipLabels['+i+'])" onmouseout="hideTip()" style="cursor:pointer" />';
    xLabels+='<text x="'+x+'" y="'+(h-6)+'" text-anchor="middle" style="font-size:9px;fill:'+(isCur?'#2563eb':'#64748b')+';font-weight:'+(isCur?'700':'400')+'">'+lbl+'</text>';
    if(val>0) valLabels+='<text x="'+x+'" y="'+(y-4)+'" text-anchor="middle" style="font-size:9px;fill:#334155">'+fmtScale(val)+'</text>';
  });
  svg.innerHTML=''
    +'<line x1="'+left+'" y1="'+(top+chartH)+'" x2="'+(w-right)+'" y2="'+(top+chartH)+'" class="chart-axis" />'
    +grid+bars+xLabels+valLabels;
  if(summary){
    var total=months.reduce(function(s,k){return s+monthTotals[k];},0);
    var avg=total/months.length;
    var best=months[0];
    months.forEach(function(k){if(monthTotals[k]>monthTotals[best])best=k;});
    var bestParts=best.split('-');
    summary.innerHTML='<strong>'+months.length+' meses</strong> registrados. Média mensal: <strong>'+fmt(avg)+'</strong>. Melhor mês: <strong>'+MONTH_NAMES[+bestParts[1]-1]+'/'+bestParts[0]+'</strong> ('+fmt(monthTotals[best])+').';
  }
}

updateMonthCards();
renderCalendar();
renderDailySalesChart();
</script>
</body>
</html>`;
}

export function mergePedidos(existing: Pedido[], incoming: Pedido[]): Pedido[] {
  const map = new Map<string, Pedido>();
  existing.forEach(p => map.set(p.documento, p));
  incoming.forEach(p => map.set(p.documento, p));
  return Array.from(map.values());
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function getDaysInMonth(yearMonth: string): Date[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const days: Date[] = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}


function parseDate(dateStr: string): Date | null {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  const fullYear = y < 100 ? 2000 + y : y;
  return new Date(fullYear, m - 1, d);
}

export function calcDiasAtraso(dataEmissao: string): number {
  const d = parseDate(dataEmissao);
  if (!d) return 0;
  const today = new Date();
  today.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}
