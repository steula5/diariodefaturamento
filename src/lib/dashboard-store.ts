import type { DashboardData, Pedido, ReportPeriod } from '@/types/faturamento';
import { getBusinessDaysInMonth, getRemainingBusinessDays } from '@/lib/holidays';

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
  const [year, month] = data.mes.split('-').map(Number);
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

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
  const diasUteisMes = getBusinessDaysInMonth(data.mes);
  const projecao = mediaDiaria * diasUteisMes;
  const diasUteisFaltantes = getRemainingBusinessDays(data.mes, periodoRelatorio);
  const objetivoDiario = diasUteisFaltantes > 0 ? (data.meta - totalFaturamento) / diasUteisFaltantes : 0;

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const fatDiarioJSON = JSON.stringify(data.faturamentoDiario);

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
.chart-label{font-size:10px;fill:#64748b}
.chart-value{font-size:10px;fill:#334155}
@media(max-width:768px){.grid-kpi{grid-template-columns:repeat(2,1fr)}.grid-main{grid-template-columns:1fr}.card-value{font-size:.9rem}}
</style>
</head>
<body>
<div class="container">
<h1>Diário de Faturamento</h1>
<p class="subtitle">${monthNames[month - 1]} ${year} — Relatório Gerencial (${periodoRelatorioLabel})</p>

<div class="grid grid-kpi">
${data.meta > 0 ? `<div class="card"><div class="card-label">Meta do Mês</div><div class="card-value text-primary">${fmt(data.meta)}</div></div>` : ''}
<div class="card border-l-accent"><div class="card-label">Despacho Aprovado</div><div class="card-value text-primary">${fmt(totalDespacho)}</div><div style="font-size:.7rem;color:#64748b;margin-top:2px">${pedidosMesAtual.length} pedidos</div></div>
<div class="card border-l-warning" style="background:#fffbeb"><div class="card-label">Próximos Despachos</div><div class="card-value text-warning">${fmt(totalProximoMes)}</div><div style="font-size:.7rem;color:#64748b;margin-top:2px">${pedidosProximoMes.length} pedidos</div></div>
<div class="card border-l-success"><div class="card-label">Faturamento</div><div class="card-value text-success">${fmt(totalFaturamento)}</div></div>
${data.meta > 0 ? `<div class="card"><div class="card-label">Objetivo Diário</div><div class="card-value text-warning">${fmt(Math.max(0, objetivoDiario))}</div><div style="font-size:.7rem;color:#64748b;margin-top:2px">${diasUteisFaltantes} dias úteis restantes</div></div>` : ''}
<div class="card border-l-warning" style="background:#fef3c7"><div class="card-label">Dias Úteis Restantes</div><div class="card-value text-warning">${diasUteisFaltantes}</div><div style="font-size:.7rem;color:#64748b;margin-top:2px">dias para faturar este mês</div></div>
<div class="card border-l-info"><div class="card-label">Projeção de Faturamento</div><div class="card-value text-info" style="font-size:.9rem;line-height:1.3">${fmt(projecao)}</div>${diasComFat > 0 ? `<div style="font-size:.7rem;color:#64748b;margin-top:2px">Média: ${fmt(mediaDiaria)} × ${diasUteisMes} dias</div>` : ''}</div>
</div>

<div class="card" style="margin-bottom:20px">
<div class="card-label">Evolução Diária de Vendas</div>
<div class="chart-wrap">
<svg id="daily-sales-chart" class="chart-svg" viewBox="0 0 1000 220" preserveAspectRatio="none"></svg>
</div>
</div>

<div class="grid grid-main">
<div class="card">
<div class="card-label">Calendário — ${monthNames[month - 1]} ${year}</div>
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
var fmt=function(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v)};
var WEEKDAYS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
var selectedDay=null;

function renderCalendar(){
var cal=document.getElementById('calendar');
var yr=${year},mo=${month};
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
var cls=['cal-day'];
if(isToday)cls.push('today');
if(isWknd)cls.push('weekend');
if(fat>0)cls.push('has-fat');
if(selectedDay===d)cls.push('selected');
html+='<div class="'+cls.join(' ')+'" onclick="selectDay('+d+','+fat+')"><div>'+d+'</div>'+(fat>0?'<div class="fat-val">'+fmt(fat)+'</div>':'')+'</div>';
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
detail.innerHTML='<div class="day-title">Faturamento — Dia '+d+'/${month}/${year}</div><div class="day-value">'+fmt(fat)+'</div>';
} else {
detail.innerHTML='<div class="day-title">Dia '+d+'/${month}/${year}</div><div class="day-no-data">Sem faturamento registrado</div>';
}
detail.className='day-detail visible';
}

function renderDailySalesChart(){
var svg=document.getElementById('daily-sales-chart');
if(!svg) return;

var yr=${year},mo=${month};
var now=new Date();
var isCurrentMonth=now.getFullYear()===yr && (now.getMonth()+1)===mo;
var cutoffDate=new Date(now.getFullYear(),now.getMonth(),now.getDate());
var lastDay=new Date(yr,mo,0).getDate();

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
  if(isCurrentMonth && dt>cutoffDate) continue;
  points.push({ day:d, value:fatMap.get(d)||0 });
}

if(points.length===0){
  svg.innerHTML='<text x="500" y="110" text-anchor="middle" class="chart-label">Sem dias úteis para exibir no período</text>';
  return;
}

var maxVal=1;
points.forEach(function(p){if(p.value>maxVal)maxVal=p.value;});

var left=48,right=20,top=16,bottom=28;
var w=1000,h=220;
var chartW=w-left-right,chartH=h-top-bottom;

function xAt(i){
  if(points.length===1) return left+chartW/2;
  return left+(i*(chartW/(points.length-1)));
}
function yAt(v){
  return top+((maxVal-v)/maxVal)*chartH;
}

var yTicks=4;
var grid='';
for(var t=0;t<=yTicks;t++){
  var y=top+(t*(chartH/yTicks));
  var val=maxVal-(t*(maxVal/yTicks));
  grid+='<line x1="'+left+'" y1="'+y+'" x2="'+(w-right)+'" y2="'+y+'" class="chart-grid" />';
  grid+='<text x="'+(left-8)+'" y="'+(y+3)+'" text-anchor="end" class="chart-label">'+(val===0?'0':Math.round(val/1000)+'k')+'</text>';
}

var linePath='';
var areaPath='M '+xAt(0)+' '+(top+chartH)+' ';
points.forEach(function(p,i){
  var x=xAt(i),y=yAt(p.value);
  linePath+=(i===0?'M ':' L ')+x+' '+y;
  areaPath+='L '+x+' '+y+' ';
});
areaPath+='L '+xAt(points.length-1)+' '+(top+chartH)+' Z';

var xLabels='';
points.forEach(function(p,i){
  if(i%3===0 || i===points.length-1){
    var x=xAt(i);
    xLabels+='<text x="'+x+'" y="'+(h-8)+'" text-anchor="middle" class="chart-label">'+p.day+'</text>';
  }
});

var dots='';
points.forEach(function(p,i){
  if(p.value>0){
    var x=xAt(i),y=yAt(p.value);
    dots+='<circle cx="'+x+'" cy="'+y+'" r="2.8" class="chart-dot"><title>Dia '+p.day+': '+fmt(p.value)+'</title></circle>';
  }
});

svg.innerHTML=''
  +'<line x1="'+left+'" y1="'+(top+chartH)+'" x2="'+(w-right)+'" y2="'+(top+chartH)+'" class="chart-axis" />'
  +grid
  +'<path d="'+areaPath+'" class="chart-area" />'
  +'<path d="'+linePath+'" class="chart-line" />'
  +dots
  +xLabels;
}

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
