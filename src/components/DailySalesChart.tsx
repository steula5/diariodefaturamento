import { formatCurrency, getDaysInMonth } from '@/lib/dashboard-store';
import type { FaturamentoDia } from '@/types/faturamento';

interface DailySalesChartProps {
  faturamentoDiario: FaturamentoDia[];
  mes: string;
}

export function DailySalesChart({ faturamentoDiario, mes }: DailySalesChartProps) {
  const days = getDaysInMonth(mes);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fatMap = new Map<string, number>();
  faturamentoDiario.forEach(f => fatMap.set(f.data, f.valor));

  // Only business days up to today
  const chartDays = days.filter(d => d.getDay() !== 0 && d.getDay() !== 6 && d <= today);
  const values = chartDays.map(d => fatMap.get(d.toISOString().split('T')[0]) || 0);
  const maxVal = Math.max(...values, 1);

  if (chartDays.length === 0) return null;

  return (
    <div className="kpi-card">
      <span className="kpi-label">Evolução Diária de Vendas</span>
      <div className="mt-3 flex items-end gap-[2px]" style={{ height: '80px' }}>
        {values.map((val, i) => {
          const height = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const day = chartDays[i].getDate();
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <div
                className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors min-h-[2px]"
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`Dia ${day}: ${formatCurrency(val)}`}
              />
              {i % 3 === 0 && (
                <span className="text-[8px] text-muted-foreground mt-0.5">{day}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
