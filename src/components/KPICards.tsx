import { formatCurrency, getClassification } from '@/lib/dashboard-store';
import { getBusinessDaysInMonth, getRemainingBusinessDays } from '@/lib/holidays';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Pedido, FaturamentoDia, ReportPeriod } from '@/types/faturamento';
import { Target, Package, CalendarDays, BarChart3, Clock, DollarSign, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';

interface KPICardsProps {
  pedidos: Pedido[];
  meta: number;
  onMetaChange: (meta: number) => void;
  periodoRelatorio: ReportPeriod;
  onPeriodoRelatorioChange: (periodo: ReportPeriod) => void;
  mes: string;
  faturamentoDiario: FaturamentoDia[];
  classificacoes: Record<string, string>;
  feriadosPersonalizados?: string[];
}

export function KPICards({
  pedidos,
  meta,
  onMetaChange,
  periodoRelatorio,
  onPeriodoRelatorioChange,
  mes,
  faturamentoDiario,
  classificacoes,
  feriadosPersonalizados,
}: KPICardsProps) {
  const [year, month] = mes.split('-').map(Number);

  const realPedidos = pedidos.filter(p => !p.isDailyReport);

  // Use useMemo to force recalculation when classificacoes change
  const { pedidosMesAtual, pedidosProximoMes, totalDespacho, totalProximoMes } = useMemo(() => {
    const mesAtual = realPedidos.filter(p => {
      const cls = getClassification(classificacoes[p.documento] || '');
      const matches = cls === 'a';
      if (matches || classificacoes[p.documento]) {
        console.log(`Pedido ${p.documento}: classificacao="${classificacoes[p.documento]}", cls="${cls}", matches=${matches}`);
      }
      return matches;
    });
    
    const proximoMes = realPedidos.filter(p => {
      const cls = getClassification(classificacoes[p.documento] || '');
      return cls === 'p';
    });

    const totalMesAtual = mesAtual.reduce((s, p) => s + p.valor, 0);
    const totalProx = proximoMes.reduce((s, p) => s + p.valor, 0);

    console.log('KPICards recalculating:', { 
      mesAtual: mesAtual.length, 
      proximoMes: proximoMes.length, 
      totalMesAtual, 
      totalProx,
      pedidosMesAtualIds: mesAtual.map(p => p.documento)
    });

    return {
      pedidosMesAtual: mesAtual,
      pedidosProximoMes: proximoMes,
      totalDespacho: totalMesAtual,
      totalProximoMes: totalProx,
    };
  }, [realPedidos, classificacoes]);

  // Faturamento Real
  const fatDiarioDoMes = faturamentoDiario.filter(f => {
    const [fy, fm] = f.data.split('-').map(Number);
    return fy === year && fm === month;
  });
  const totalFaturamento = fatDiarioDoMes.reduce((s, f) => s + f.valor, 0);

  // Projeção = média diária × dias úteis do mês
  const diasComFat = fatDiarioDoMes.length;
  const mediaDiaria = diasComFat > 0 ? totalFaturamento / diasComFat : 0;
  const diasUteisMes = getBusinessDaysInMonth(mes, feriadosPersonalizados);
  const projecao = mediaDiaria * diasUteisMes;

  // % Comparativo Meta
  const pctFatMeta = meta > 0 ? ((totalFaturamento - meta) / meta) * 100 : 0;

  // Dias úteis
  const diasUteisFaltantes = getRemainingBusinessDays(mes, periodoRelatorio, feriadosPersonalizados);

  // Objetivo diário
  const diasParaObjetivo = diasUteisFaltantes;
  const objetivoDiario = diasParaObjetivo > 0 ? (meta - totalFaturamento) / diasParaObjetivo : 0;

  return (
    <div className="space-y-3">
      <div className="kpi-card">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-warning" />
          <span className="kpi-label">Período do Relatório</span>
        </div>
        <Select value={periodoRelatorio} onValueChange={(value) => onPeriodoRelatorioChange(value as ReportPeriod)}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manha">Manhã</SelectItem>
            <SelectItem value="tarde">Tarde</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-[10px] text-muted-foreground mt-2">
          {periodoRelatorio === 'manha' ? 'Inclui o dia útil de hoje na contagem.' : 'Conta apenas os próximos dias úteis.'}
        </div>
      </div>

      {/* 1 - Meta */}
      <div className="kpi-card">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="kpi-label">Meta do Mês</span>
        </div>
        <input
          type="text"
          value={meta > 0 ? formatCurrency(meta) : ''}
          placeholder="Definir meta..."
          onChange={(e) => {
            const val = e.target.value.replace(/[^\d,]/g, '').replace(',', '.');
            onMetaChange(parseFloat(val) || 0);
          }}
          className="kpi-value w-full bg-transparent border-none outline-none text-primary placeholder:text-muted-foreground/50 placeholder:text-lg"
        />
      </div>

      {/* 2 - Despacho Aprovado (mês atual) */}
      <div className="kpi-card border-l-4 border-l-accent">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-4 h-4 text-accent" />
          <span className="kpi-label">Despacho Aprovado</span>
        </div>
        <div className="kpi-value text-accent">{formatCurrency(totalDespacho)}</div>
        <div className="text-[10px] text-muted-foreground mt-1">
          {pedidosMesAtual.length} pedidos este mês
        </div>
      </div>

      {/* Despacho Aprovado Próximos Meses - always visible */}
        <div className="kpi-card border-l-4 border-l-warning bg-warning/5">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-warning" />
            <span className="kpi-label">Próximos Despachos</span>
          </div>
          <div className="kpi-value text-warning">{formatCurrency(totalProximoMes)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {pedidosProximoMes.length} pedidos
          </div>
        </div>

      {/* 3 - Faturamento Real */}
      <div className="kpi-card border-l-4 border-l-success">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-success" />
          <span className="kpi-label">Faturamento</span>
        </div>
        <div className="kpi-value text-success">{formatCurrency(totalFaturamento)}</div>
      </div>

      {/* 4 - % Comparativo Faturamento vs Meta */}
      {meta > 0 && (
        <div className="kpi-card">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-foreground" />
            <span className="kpi-label">% Faturamento vs Meta</span>
          </div>
          <div className={`kpi-value ${pctFatMeta >= 0 ? 'text-success' : 'text-destructive'}`}>
            {pctFatMeta >= 0 ? '+' : ''}{pctFatMeta.toFixed(0)}%
          </div>
        </div>
      )}

      {/* 5 - Objetivo diário */}
      <div className="kpi-card">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-warning" />
          <span className="kpi-label">Objetivo Faturamento Diário</span>
        </div>
        <div className="kpi-value text-warning">{formatCurrency(Math.max(0, objetivoDiario))}</div>
        <div className="text-[10px] text-muted-foreground mt-1">
          {diasParaObjetivo} dias úteis restantes
        </div>
      </div>

      {/* 6 - Dias úteis */}
      <div className="kpi-card">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="w-4 h-4 text-info" />
          <span className="kpi-label">Dias Úteis no Mês</span>
        </div>
        <div className="kpi-value text-info">{diasUteisMes}</div>
      </div>

      {/* 6.5 - Dias úteis restantes para faturar */}
      <div className="kpi-card border-l-4 border-l-warning/60">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-warning" />
          <span className="kpi-label">Dias Úteis Restantes</span>
        </div>
        <div className="kpi-value text-warning">{diasUteisFaltantes}</div>
        <div className="text-[10px] text-muted-foreground mt-1">
          dias para faturar este mês
        </div>
      </div>

      {/* 7 - Projeção de Faturamento */}
      <div className="kpi-card border-l-4 border-l-info">
        <div className="flex items-center gap-2 mb-1">
          <ArrowRight className="w-4 h-4 text-info" />
          <span className="kpi-label">Projeção de Faturamento</span>
        </div>
        <div className="kpi-value text-info break-words overflow-wrap-break-word text-xs leading-tight">{formatCurrency(projecao)}</div>
        {diasComFat > 0 && (
          <div className="text-[10px] text-muted-foreground mt-1">
            Média diária: {formatCurrency(mediaDiaria)} × {diasUteisMes} dias
          </div>
        )}
      </div>
    </div>
  );
}
