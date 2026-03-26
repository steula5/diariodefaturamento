import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { OrcamentoCalendar } from '@/components/OrcamentoCalendar';
import { OrcamentoTable } from '@/components/OrcamentoTable';
import {
  loadOrcamentoData,
  saveOrcamentoData,
  exportToJSON,
  exportToHTML,
  getDefaultPeriod,
  mergeOrcamentos,
  compareOrcamentosWithPedidos,
  getDaysInMonth,
  formatCurrency,
} from '@/lib/orcamento-store';
import { parseOrcamentoExcelFile } from '@/lib/orcamento-parser';
import { parseExcelFile } from '@/lib/excel-parser';
import type { OrcamentoData, Orcamento, OrcamentoDia } from '@/types/faturamento';
import { Download, Upload, Trash2, FileSpreadsheet, FileDown } from 'lucide-react';
import { toast } from 'sonner';

function buildOrcamentoDiario(orcamentos: Orcamento[], pedidosDocumentos: string[]): OrcamentoDia[] {
  const pedidoSet = new Set(pedidosDocumentos);
  const map = new Map<string, { valor: number; orcamentos: string[]; virou_pedido: number }>();

  orcamentos.filter(o => o.isDailyReport).forEach(o => {
    const dateStr = o.dataCalendario || o.dataEmissao;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return;
    const [d, m, y] = parts;
    const key = `${y}-${m}-${d}`;
    const existing = map.get(key) || { valor: 0, orcamentos: [], virou_pedido: 0 };
    existing.valor += o.valor;
    existing.orcamentos.push(o.documento);
    if (pedidoSet.has(o.documento)) existing.virou_pedido += 1;
    map.set(key, existing);
  });

  return Array.from(map.entries()).map(([data, v]) => ({
    data,
    valor: v.valor,
    orcamentos: v.orcamentos,
    virou_pedido: v.virou_pedido,
  }));
}

const Orcamento = () => {
  const [data, setData] = useState<OrcamentoData>(() => {
    return loadOrcamentoData() || {
      mes: getDefaultPeriod(),
      orcamentos: [],
      orcamentoDiario: [],
    };
  });

  const [pedidosDocumentos, setPedidosDocumentos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pedidosInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setData(prev => {
      const currentMonth = getDefaultPeriod();
      if (currentMonth !== prev.mes) {
        console.log(`Mês atualizado automaticamente: ${prev.mes} -> ${currentMonth}`);
        return { ...prev, mes: currentMonth };
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    saveOrcamentoData(data);
  }, [data]);

  const handleOrcamentoFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const orcamentos = parseOrcamentoExcelFile(buffer);
      if (orcamentos.length === 0) {
        toast.error('Nenhum orçamento encontrado na planilha.');
        return;
      }
      setData(prev => {
        const dailyReports = prev.orcamentos.filter(p => p.isDailyReport);
        const existingOrcamentos = prev.orcamentos.filter(p => !p.isDailyReport);
        const mergedOrcamentos = mergeOrcamentos(existingOrcamentos, orcamentos);
        const merged = [...mergedOrcamentos, ...dailyReports];
        return {
          ...prev,
          orcamentos: merged,
          orcamentoDiario: buildOrcamentoDiario(merged, pedidosDocumentos),
        };
      });
      toast.success(`${orcamentos.length} orçamentos importados com sucesso!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar a planilha de orçamentos.');
    }
  }, [pedidosDocumentos]);

  const handlePedidosFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const pedidos = parseExcelFile(buffer);
      const docIds = pedidos.map(p => p.documento);
      setPedidosDocumentos(docIds);

      setData(prev => {
        return {
          ...prev,
          orcamentoDiario: buildOrcamentoDiario(prev.orcamentos, docIds),
        };
      });

      toast.success(`${pedidos.length} pedidos importados! Comparação atualizada.`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar a planilha de pedidos.');
    }
  }, []);

  const handleDayUpload = useCallback(async (dateKey: string, file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const orcamentos = parseOrcamentoExcelFile(buffer);
      if (orcamentos.length === 0) {
        toast.error('Nenhum orçamento encontrado no relatório.');
        return;
      }

      const [y, m, d] = dateKey.split('-');
      const calendarDate = `${d}/${m}/${y}`;
      const totalValor = orcamentos.reduce((s, o) => s + o.valor, 0);

      setData(prev => {
        const dailyDocId = `ORC-${dateKey}`;
        const filtered = prev.orcamentos.filter(p => p.documento !== dailyDocId);

        const dailyOrcamento: Orcamento = {
          documento: dailyDocId,
          cliente: 'Orçamentos do Dia',
          cidade: '',
          dataEmissao: calendarDate,
          dataCalendario: calendarDate,
          valor: totalValor,
          codStatus: 35,
          status: 'ORÇAMENTO',
          isDailyReport: true,
          virou_pedido: false,
        };

        const merged = [...filtered, dailyOrcamento];
        return {
          ...prev,
          orcamentos: merged,
          orcamentoDiario: buildOrcamentoDiario(merged, pedidosDocumentos),
        };
      });
      toast.success(`Orçamentos de ${calendarDate}: ${formatCurrency(totalValor)} (${orcamentos.length} orçamentos)`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Erro ao processar o relatório.');
    }
  }, [pedidosDocumentos]);

  const handleMonthChange = useCallback((newMonth: string) => {
    setData(prev => ({ ...prev, mes: newMonth }));
  }, []);

  const handleExport = useCallback(() => {
    exportToJSON(data);
    toast.success('JSON exportado!');
  }, [data]);

  const handleExportHTML = useCallback(() => {
    exportToHTML(data, pedidosDocumentos);
    toast.success('Relatório HTML exportado!');
  }, [data, pedidosDocumentos]);

  const handleClear = useCallback(() => {
    if (window.confirm('Tem certeza que deseja limpar todos os dados?')) {
      setData({
        mes: getDefaultPeriod(),
        orcamentos: [],
        orcamentoDiario: [],
      });
      setPedidosDocumentos([]);
      toast.success('Dados limpos!');
    }
  }, []);

  const totalOrcamentos = data.orcamentos.reduce((s, o) => s + o.valor, 0);
  const totalNaoConvertidos = data.orcamentos
    .filter(o => !pedidosDocumentos.includes(o.documento))
    .reduce((s, o) => s + o.valor, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <nav className="flex items-center gap-3">
              <Link 
                to="/" 
                className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
              >
                Faturamento
              </Link>
              <span className="text-slate-400">/</span>
              <span className="text-sm font-medium text-slate-900">
                Orçamentos
              </span>
            </nav>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Análise de Orçamentos</h1>
          <p className="text-slate-600">
            Monitore orçamentos que não viraram pedidos. Orçamentos ficam até 7 dias no sistema.
          </p>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
            <div className="text-sm text-gray-600">Total em Orçamentos</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalOrcamentos)}</div>
            <div className="text-xs text-gray-500 mt-1">{data.orcamentos.length} orçamentos</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
            <div className="text-sm text-gray-600">Não Convertidos</div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalNaoConvertidos)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {data.orcamentos.filter(o => !pedidosDocumentos.includes(o.documento)).length} orçamentos
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
            <div className="text-sm text-gray-600">Taxa de Conversão</div>
            <div className="text-2xl font-bold text-green-600">
              {data.orcamentos.length > 0 
                ? ((1 - totalNaoConvertidos / totalOrcamentos) * 100).toFixed(1) + '%'
                : '0%'
              }
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {data.orcamentos.filter(o => pedidosDocumentos.includes(o.documento)).length} orçamentos
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importar Orçamentos
            </button>
            <button
              onClick={() => pedidosInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Importar Pedidos (para comparação)
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar JSON
            </button>
            <button
              onClick={handleExportHTML}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Exportar HTML
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Limpar Dados
            </button>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleOrcamentoFile(e.target.files[0])}
            className="hidden"
          />
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={pedidosInputRef}
            onChange={(e) => e.target.files?.[0] && handlePedidosFile(e.target.files[0])}
            className="hidden"
          />
        </div>

        {/* Calendar and Table */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <OrcamentoCalendar
            yearMonth={data.mes}
            orcamentoDiario={data.orcamentoDiario}
            onMonthChange={handleMonthChange}
            onDayUpload={handleDayUpload}
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <OrcamentoTable
            orcamentos={data.orcamentos}
            pedidosDocumentos={pedidosDocumentos}
          />
        </div>
      </div>
    </div>
  );
};

export default Orcamento;
