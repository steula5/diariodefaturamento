import { useRef } from 'react';
import { getDaysInMonth, formatCurrency } from '@/lib/orcamento-store';
import type { OrcamentoDia } from '@/types/faturamento';
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';

interface OrcamentoCalendarProps {
  yearMonth: string;
  orcamentoDiario: OrcamentoDia[];
  onMonthChange: (newMonth: string) => void;
  onDayUpload: (date: string, file: File) => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function OrcamentoCalendar({ yearMonth, orcamentoDiario, onMonthChange, onDayUpload }: OrcamentoCalendarProps) {
  const days = getDaysInMonth(yearMonth);
  const firstDayOfWeek = days[0].getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedDateRef = useRef<string>('');

  const orcMap = new Map<string, { valor: number; virou_pedido: number }>();
  orcamentoDiario.forEach(o => {
    orcMap.set(o.data, { valor: o.valor, virou_pedido: o.virou_pedido });
  });

  let runningTotal = 0;
  let daysWithOrc = 0;

  const [year, month] = yearMonth.split('-').map(Number);
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const goToPrevMonth = () => {
    const d = new Date(year, month - 2, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const goToNextMonth = () => {
    const d = new Date(year, month, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleDayClick = (dateKey: string) => {
    selectedDateRef.current = dateKey;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedDateRef.current) {
      onDayUpload(selectedDateRef.current, file);
    }
    e.target.value = '';
  };

  return (
    <div className="dashboard-section">
      <input
        type="file"
        accept=".xlsx,.xls"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Orçamentos - {monthNames[month - 1]} {year}</h2>
        <div className="flex gap-2">
          <button
            onClick={goToPrevMonth}
            className="p-1 hover:bg-gray-100 rounded"
            title="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToNextMonth}
            className="p-1 hover:bg-gray-100 rounded"
            title="Próximo mês"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-4">
        {WEEKDAYS.map(day => (
          <div key={day} className="text-center font-semibold text-sm text-gray-600 py-2">
            {day}
          </div>
        ))}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {days.map(date => {
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const orcData = orcMap.get(dateKey);
          const isToday = date.getTime() === today.getTime();

          if (orcData) {
            runningTotal += orcData.valor;
            daysWithOrc += 1;
          }

          return (
            <div
              key={dateKey}
              onClick={() => handleDayClick(dateKey)}
              className={`aspect-square rounded-lg p-2 text-sm cursor-pointer transition-all ${
                isToday ? 'ring-2 ring-primary' : ''
              } ${
                orcData
                  ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                  : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}
              title={`Clique para adicionar orçamentos de ${date.toLocaleDateString('pt-BR')}`}
            >
              <div className="font-semibold text-gray-700">{date.getDate()}</div>
              {orcData && (
                <>
                  <div className="text-xs text-gray-600 mt-1">
                    {formatCurrency(orcData.valor)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {orcData.virou_pedido > 0 && <span className="text-green-600">✓ {orcData.virou_pedido}</span>}
                  </div>
                </>
              )}
              {!orcData && <Upload className="w-3 h-3 text-gray-400 mt-1" />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-gray-600">Dias com orçamentos</div>
          <div className="text-xl font-bold text-gray-900">{daysWithOrc}</div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-gray-600">Total acumulado</div>
          <div className="text-xl font-bold text-blue-600">{formatCurrency(runningTotal)}</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-gray-600">Ticket médio</div>
          <div className="text-xl font-bold text-green-600">
            {daysWithOrc > 0 ? formatCurrency(runningTotal / daysWithOrc) : formatCurrency(0)}
          </div>
        </div>
      </div>
    </div>
  );
}
