import { formatCurrency } from '@/lib/dashboard-store';
import type { Pedido } from '@/types/faturamento';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface SalesComparisonCardProps {
  pedidos: Pedido[];
  mes: string;
}

function getPedidosForDay(pedidos: Pedido[], day: number, month: number, year: number): Pedido[] {
  return pedidos.filter(p => {
    const parts = p.dataEmissao.split('/');
    if (parts.length !== 3) return false;
    const [d, m, y] = parts.map(Number);
    return d === day && m === month && y === year;
  });
}

export function SalesComparisonCard({ pedidos, mes }: SalesComparisonCardProps) {
  const [year, month] = mes.split('-').map(Number);
  const today = new Date();
  const currentDay = today.getDate();

  // Current month same day
  const pedidosHoje = getPedidosForDay(pedidos, currentDay, month, year);
  const valorHoje = pedidosHoje.reduce((s, p) => s + p.valor, 0);

  // Previous month same day
  const prevDate = new Date(year, month - 2, 1);
  const prevMonth = prevDate.getMonth() + 1;
  const prevYear = prevDate.getFullYear();
  const pedidosMesAnterior = getPedidosForDay(pedidos, currentDay, prevMonth, prevYear);
  const valorMesAnterior = pedidosMesAnterior.reduce((s, p) => s + p.valor, 0);

  const diff = valorMesAnterior > 0 ? ((valorHoje - valorMesAnterior) / valorMesAnterior) * 100 : 0;
  const hasComparison = valorMesAnterior > 0;

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="kpi-card">
      <span className="kpi-label">Comparativo Dia {currentDay}</span>
      <div className="mt-2 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground">{monthNames[month - 1]}/{year}</span>
          <span className="text-sm font-bold font-mono text-foreground">{formatCurrency(valorHoje)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground">{monthNames[prevMonth - 1]}/{prevYear}</span>
          <span className="text-sm font-mono text-muted-foreground">{formatCurrency(valorMesAnterior)}</span>
        </div>
        {hasComparison && (
          <div className={`flex items-center gap-1 text-xs font-medium ${diff >= 0 ? 'text-success' : 'text-destructive'}`}>
            {diff >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(diff).toFixed(1)}%
          </div>
        )}
        {!hasComparison && valorHoje > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Minus className="w-3.5 h-3.5" />
            Sem dados do mês anterior
          </div>
        )}
      </div>
    </div>
  );
}
