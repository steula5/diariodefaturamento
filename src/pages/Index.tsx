import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { KPICards } from '@/components/KPICards';
import { MonthCalendar } from '@/components/MonthCalendar';
import { OrdersTable } from '@/components/OrdersTable';

import { DailySalesChart } from '@/components/DailySalesChart';
import {
  loadDashboardData,
  saveDashboardData,
  exportToJSON,
  mergePedidos,
  getCurrentMonth,
  exportToHTML,
  getDefaultReportPeriod,
} from '@/lib/dashboard-store';
import { parseExcelFile } from '@/lib/excel-parser';
import { parseDailyReport, isFeriadoFile } from '@/lib/daily-report-parser';
import type { DashboardData, Pedido, FaturamentoDia, ReportPeriod } from '@/types/faturamento';
import { Download, Upload, Trash2, FileSpreadsheet, FileDown } from 'lucide-react';
import { toast } from 'sonner';

function buildFaturamentoDiario(pedidos: Pedido[]): FaturamentoDia[] {
  const map = new Map<string, { valor: number; pedidos: string[] }>();
  // Only use daily report entries for calendar values, not individual pedidos
  pedidos.filter(p => p.isDailyReport).forEach(p => {
    const dateStr = p.dataCalendario || p.dataEmissao;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return;
    const [d, m, y] = parts;
    const key = `${y}-${m}-${d}`;
    const existing = map.get(key) || { valor: 0, pedidos: [] };
    existing.valor += p.valor;
    existing.pedidos.push(p.documento);
    map.set(key, existing);
  });
  return Array.from(map.entries()).map(([data, v]) => ({
    data,
    valor: v.valor,
    pedidos: v.pedidos,
  }));
}

const Index = () => {
  const [data, setData] = useState<DashboardData>(() => {
    return loadDashboardData() || {
      mes: getCurrentMonth(),
      meta: 0,
      pedidos: [],
      faturamentoDiario: [],
      periodoRelatorio: getDefaultReportPeriod(),
    };
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-update month only once when the app loads (on system start)
  useEffect(() => {
    setData(prev => {
      const currentMonth = getCurrentMonth();
      if (currentMonth !== prev.mes) {
        console.log(`Mês atualizado automaticamente: ${prev.mes} -> ${currentMonth}`);
        return { ...prev, mes: currentMonth };
      }
      return prev;
    });
  }, []); // Runs only once on component mount

  useEffect(() => {
    saveDashboardData(data);
  }, [data]);

  const handleFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const pedidos = parseExcelFile(buffer);
      if (pedidos.length === 0) {
        toast.error('Nenhum pedido encontrado na planilha.');
        return;
      }
      setData(prev => {
        const dailyReports = prev.pedidos.filter(p => p.isDailyReport);
        const existingPedidos = prev.pedidos.filter(p => !p.isDailyReport);
        const mergedPedidos = mergePedidos(existingPedidos, pedidos);
        const merged = [...mergedPedidos, ...dailyReports];
        return {
          ...prev,
          pedidos: merged,
        };
      });
      toast.success(`${pedidos.length} pedidos importados com sucesso!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar a planilha.');
    }
  }, []);

  const handleDayUpload = useCallback(async (dateKey: string, file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const [y, m, d] = dateKey.split('-');
      const calendarDate = `${d}/${m}/${y}`;

      // Check if this is a holiday marker file
      if (isFeriadoFile(buffer)) {
        setData(prev => {
          const existing = prev.feriadosPersonalizados || [];
          if (existing.includes(dateKey)) {
            toast.info(`${calendarDate} já está marcado como feriado.`);
            return prev;
          }
          toast.success(`Feriado registrado em ${calendarDate}.`);
          return {
            ...prev,
            feriadosPersonalizados: [...existing, dateKey],
          };
        });
        return;
      }

      const valor = parseDailyReport(buffer);
      if (valor <= 0) {
        toast.error('Valor do faturamento não encontrado no relatório.');
        return;
      }

      setData(prev => {
        // Remove any previous daily report entry for this day
        const dailyDocId = `FAT-${dateKey}`;
        const filtered = prev.pedidos.filter(p => p.documento !== dailyDocId);

        // Add synthetic entry for calendar display
        const dailyPedido: Pedido = {
          documento: dailyDocId,
          cliente: 'Faturamento do Dia',
          cidade: '',
          dataEmissao: calendarDate,
          dataCalendario: calendarDate,
          valor,
          codStatus: 4,
          status: 'DESPACHO APROVADO',
          isDailyReport: true,
        };

        const merged = [...filtered, dailyPedido];
        return {
          ...prev,
          pedidos: merged,
          faturamentoDiario: buildFaturamentoDiario(merged),
        };
      });
      toast.success(`Faturamento de ${calendarDate}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Erro ao processar o relatório.');
    }
  }, []);

  const handleMetaChange = useCallback((meta: number) => {
    setData(prev => ({ ...prev, meta }));
  }, []);

  const handleExport = useCallback(() => {
    exportToJSON(data);
    toast.success('JSON exportado!');
  }, [data]);

  const handleExportHTML = useCallback(() => {
    exportToHTML(data);
    toast.success('HTML exportado! Envie aos diretores.');
  }, [data]);

  const handleImportJSON = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text) as DashboardData;
        if (!imported.pedidos || !imported.mes) {
          toast.error('Arquivo JSON inválido.');
          return;
        }
        setData({
          ...imported,
          periodoRelatorio: imported.periodoRelatorio || getDefaultReportPeriod(),
        });
        toast.success('Dados importados com sucesso!');
      } catch {
        toast.error('Erro ao importar JSON.');
      }
    };
    input.click();
  }, []);

  const handleClear = useCallback(() => {
    if (confirm('Tem certeza que deseja limpar todos os dados?')) {
      setData({
        mes: getCurrentMonth(),
        meta: 0,
        pedidos: [],
        faturamentoDiario: [],
        periodoRelatorio: getDefaultReportPeriod(),
        observacoes: {},
        ordenacaoPedidos: [],
      });
      toast.success('Dados limpos.');
    }
  }, []);

  const handleClearPedidos = useCallback(() => {
    if (confirm('Tem certeza que deseja limpar apenas os pedidos?\nMeta e observações serão mantidas.')) {
      setData(prev => ({
        ...prev,
        pedidos: prev.pedidos.filter(p => p.isDailyReport),
        ordenacaoPedidos: [],
      }));
      toast.success('Pedidos limpos.');
    }
  }, []);

  const handleObservacaoChange = useCallback((doc: string, value: string) => {
    setData(prev => ({
      ...prev,
      observacoes: { ...(prev.observacoes || {}), [doc]: value },
    }));
  }, []);

  const handleClassificacaoChange = useCallback((doc: string, value: string) => {
    console.log(`handleClassificacaoChange: doc="${doc}", value="${value}"`);
    setData(prev => {
      const newClassificacoes = { ...(prev.classificacoes || {}), [doc]: value };
      console.log(`Classificações atualizadas:`, newClassificacoes);
      return {
        ...prev,
        classificacoes: newClassificacoes,
      };
    });
  }, []);

  const handleOrdenacaoPedidosChange = useCallback((order: string[]) => {
    setData(prev => ({ ...prev, ordenacaoPedidos: order }));
  }, []);

  const handleMonthChange = useCallback((newMonth: string) => {
    setData(prev => ({ ...prev, mes: newMonth }));
  }, []);

  const handlePeriodoRelatorioChange = useCallback((periodoRelatorio: ReportPeriod) => {
    setData(prev => ({ ...prev, periodoRelatorio }));
  }, []);

  const handleRemoveFeriado = useCallback((dateKey: string) => {
    setData(prev => {
      const [y, m, d] = dateKey.split('-');
      toast.success(`Feriado removido em ${d}/${m}/${y}.`);
      return {
        ...prev,
        feriadosPersonalizados: (prev.feriadosPersonalizados || []).filter(k => k !== dateKey),
      };
    });
  }, []);

  const [year, month] = data.mes.split('-').map(Number);
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-[1600px] mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">
                Diário de Faturamento
              </h1>
              <p className="text-xs text-muted-foreground">
                {monthNames[month - 1]} {year} — Painel Gerencial
              </p>
            </div>
            <nav className="flex items-center gap-2 pl-6 border-l border-border">
              <Link 
                to="/" 
                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                Faturamento
              </Link>
              <Link 
                to="/orcamento" 
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                Orçamentos
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Importar Planilha
            </button>
            <button
              onClick={handleImportJSON}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Importar JSON
            </button>
            <button
              onClick={handleExport}
              disabled={data.pedidos.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar JSON
            </button>
            <button
              onClick={handleExportHTML}
              disabled={data.pedidos.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-info text-info-foreground hover:bg-info/90 transition-colors disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              Exportar Relatório
            </button>
            <button
              onClick={handleClearPedidos}
              disabled={data.pedidos.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-warning/10 text-warning hover:bg-warning/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar Pedidos
            </button>
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[1600px] mx-auto px-4 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
          {/* Left: KPIs */}
          <div className="lg:col-span-2 space-y-4">
            <KPICards pedidos={data.pedidos} meta={data.meta} onMetaChange={handleMetaChange} periodoRelatorio={data.periodoRelatorio || getDefaultReportPeriod()} onPeriodoRelatorioChange={handlePeriodoRelatorioChange} mes={data.mes} faturamentoDiario={data.faturamentoDiario} classificacoes={data.classificacoes || {}} feriadosPersonalizados={data.feriadosPersonalizados} />
            
            <DailySalesChart faturamentoDiario={data.faturamentoDiario} mes={data.mes} />
          </div>

          {/* Center: Calendar */}
          <div className="lg:col-span-3">
            <MonthCalendar
              yearMonth={data.mes}
              faturamentoDiario={data.faturamentoDiario}
              onMonthChange={handleMonthChange}
              onDayUpload={handleDayUpload}
              onRemoveFeriado={handleRemoveFeriado}
              feriadosPersonalizados={data.feriadosPersonalizados}
            />
          </div>

          {/* Right: Orders */}
          <div className="lg:col-span-7">
            <OrdersTable
              pedidos={data.pedidos}
              observacoes={data.observacoes || {}}
              onObservacaoChange={handleObservacaoChange}
              classificacoes={data.classificacoes || {}}
              onClassificacaoChange={handleClassificacaoChange}
              mes={data.mes}
              ordenacaoPedidos={data.ordenacaoPedidos}
              onOrdenacaoPedidosChange={handleOrdenacaoPedidosChange}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
