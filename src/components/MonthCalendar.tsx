import { useRef } from 'react';
import { getDaysInMonth, formatCurrency } from '@/lib/dashboard-store';
import { isHoliday } from '@/lib/holidays';
import type { FaturamentoDia } from '@/types/faturamento';
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';

interface MonthCalendarProps {
  yearMonth: string;
  faturamentoDiario: FaturamentoDia[];
  onMonthChange: (newMonth: string) => void;
  onDayUpload: (date: string, file: File) => void;
  onClearDay?: (date: string) => void;
  feriadosPersonalizados?: string[];
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function MonthCalendar({ yearMonth, faturamentoDiario, onMonthChange, onDayUpload, onClearDay, feriadosPersonalizados }: MonthCalendarProps) {
  const days = getDaysInMonth(yearMonth);
  const firstDayOfWeek = days[0].getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedDateRef = useRef<string>('');

  const fatMap = new Map<string, number>();
  faturamentoDiario.forEach(f => {
    fatMap.set(f.data, (fatMap.get(f.data) || 0) + f.valor);
  });

  let runningTotal = 0;
  let daysWithFat = 0;

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
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex items-center justify-between mb-4">
        <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-secondary transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <h3 className="text-sm font-semibold text-foreground">
          {monthNames[month - 1]} {year}
        </h3>
        <button onClick={goToNextMonth} className="p-1 rounded hover:bg-secondary transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mb-2">Clique no dia para importar planilha</p>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase py-1">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(day => {
          const key = day.toISOString().split('T')[0];
          const fat = fatMap.get(key) || 0;
          if (fat > 0) {
            runningTotal += fat;
            daysWithFat++;
          }
          const isToday = day.getTime() === today.getTime();
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const isPast = day < today;
          const hasFat = fat > 0;
          const isCustomHoliday = !!(feriadosPersonalizados && feriadosPersonalizados.includes(key));
          const isNationalHoliday = isHoliday(day);
          const canClearDay = hasFat || isCustomHoliday;

          return (
            <div
              key={key}
              onClick={() => handleDayClick(key)}
              onContextMenu={(e) => {
                if (canClearDay && onClearDay) {
                  e.preventDefault();
                  onClearDay(key);
                }
              }}
              title={
                canClearDay
                  ? `Clique para importar planilha | clique direito para limpar o dia`
                  : isNationalHoliday
                  ? `Feriado nacional`
                  : `Clique para importar planilha em ${day.getDate()}/${month}/${year}`
              }
              className={`
                rounded-lg p-1.5 text-center min-h-[56px] flex flex-col justify-between border transition-colors cursor-pointer
                hover:border-primary/40 hover:bg-primary/5
                ${isToday ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-transparent'}
                ${isCustomHoliday ? 'bg-orange-500/10 border-orange-400/40' : isNationalHoliday ? 'bg-red-500/8' : isWeekend ? 'bg-muted/50' : ''}
                ${hasFat ? 'bg-success/8' : ''}
                ${isPast && !hasFat && !isWeekend && !isCustomHoliday && !isNationalHoliday ? 'opacity-50' : ''}
              `}
            >
              <div className="flex items-center justify-center gap-0.5">
                <div className={`text-xs font-medium ${isToday ? 'text-primary' : isCustomHoliday ? 'text-orange-500' : isNationalHoliday ? 'text-red-500' : 'text-foreground'}`}>
                  {day.getDate()}
                </div>
                {!isCustomHoliday && !isNationalHoliday && <Upload className="w-2.5 h-2.5 text-muted-foreground/40" />}
                {(isCustomHoliday || isNationalHoliday) && <span className="text-[8px]">🏖</span>}
              </div>
              {hasFat && (
                <div className="text-[9px] font-bold text-success font-mono">
                  {formatCurrency(fat)}
                </div>
              )}
              {isCustomHoliday && !hasFat && (
                <div className="text-[8px] text-orange-400 font-medium">feriado</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Running totals */}
      <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
        <div>
          <span className="kpi-label">Total Faturado</span>
          <div className="text-lg font-bold font-mono text-success">{formatCurrency(runningTotal)}</div>
        </div>
        <div className="text-right">
          <span className="kpi-label">Média Diária</span>
          <div className="text-lg font-bold font-mono text-foreground">
            {daysWithFat > 0 ? formatCurrency(runningTotal / daysWithFat) : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
