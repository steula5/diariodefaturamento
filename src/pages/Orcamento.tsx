import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { OrcamentoTable } from '@/components/OrcamentoTable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  loadOrcamentoData,
  saveOrcamentoData,
  exportToJSON,
  exportToHTML,
  exportToExcel,
  exportToPDF,
  getDefaultPeriod,
  mergeOrcamentos,
  formatCurrency,
} from '@/lib/orcamento-store';
import { parseOrcamentoExcelFile } from '@/lib/orcamento-parser';
import { parseExcelFile } from '@/lib/excel-parser';
import type { OrcamentoData, Orcamento } from '@/types/faturamento';
import { Download, Upload, Trash2, FileSpreadsheet, FileDown, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';

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
        toast.error(
          'Nenhum orçamento encontrado. Verifique se a planilha tem documentos começando com "OR"'
        );
        return;
      }
      setData(prev => {
        const mergedOrcamentos = mergeOrcamentos(prev.orcamentos, orcamentos);
        return {
          ...prev,
          orcamentos: mergedOrcamentos,
          orcamentoDiario: [],
        };
      });
      toast.success(`${orcamentos.length} orçamentos importados com sucesso!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar a planilha de orçamentos.');
    }
  }, []);

  const handlePedidosFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const pedidos = parseExcelFile(buffer);
      const docIds = pedidos.map(p => p.documento);
      setPedidosDocumentos(docIds);
      toast.success(`${pedidos.length} pedidos importados! Comparação atualizada.`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar a planilha de pedidos.');
    }
  }, []);

  const handleExport = useCallback(() => {
    exportToJSON(data);
    toast.success('JSON exportado!');
  }, [data]);

  const handleExportHTML = useCallback(() => {
    exportToHTML(data, pedidosDocumentos);
    toast.success('Relatório HTML exportado!');
  }, [data, pedidosDocumentos]);

  const handleExportExcel = useCallback(() => {
    exportToExcel(data, pedidosDocumentos);
    toast.success('Planilha Excel exportada!');
  }, [data, pedidosDocumentos]);

  const handleExportPDF = useCallback(() => {
    exportToPDF(data, pedidosDocumentos);
    toast.success('Abrindo PDF para impressão...');
  }, [data, pedidosDocumentos]);

  const handleOrcamentoUpdate = useCallback((documento: string, numeroPedido: string) => {
    setData(prev => {
      const updated = prev.orcamentos.map(o =>
        o.documento === documento
          ? { ...o, virou_pedido: numeroPedido || undefined as any }
          : o
      );
      return { ...prev, orcamentos: updated };
    });
    toast.success('Orçamento atualizado!');
  }, []);

  const handleCodClienteUpdate = useCallback((documento: string, codCliente: string) => {
    setData(prev => {
      const updated = prev.orcamentos.map(o =>
        o.documento === documento
          ? { ...o, cod_cliente: codCliente || undefined }
          : o
      );
      return { ...prev, orcamentos: updated };
    });
  }, []);

  const handleNoSistemaToggle = useCallback((documento: string, noSistema: boolean) => {
    setData(prev => {
      const updated = prev.orcamentos.map(o =>
        o.documento === documento ? { ...o, no_sistema: noSistema } : o
      );
      return { ...prev, orcamentos: updated };
    });
  }, []);

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

  const pedidoSet = new Set(pedidosDocumentos);
  const isConvertido = (o: Orcamento) => Boolean(o.virou_pedido) || pedidoSet.has(o.documento);

  const totalOrcamentos = data.orcamentos.reduce((s, o) => s + o.valor, 0);
  const convertidos = data.orcamentos.filter(isConvertido);
  const naoConvertidos = data.orcamentos.filter(o => !isConvertido(o));
  const totalConvertidos = convertidos.reduce((s, o) => s + o.valor, 0);
  const totalNaoConvertidos = naoConvertidos.reduce((s, o) => s + o.valor, 0);
  const taxaConversao = totalOrcamentos > 0 ? (totalConvertidos / totalOrcamentos) * 100 : 0;

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-blue-500 min-w-0">
            <div className="text-xs text-gray-600 truncate">Total em Orçamentos</div>
            <div className="text-lg font-bold text-gray-900 truncate">{formatCurrency(totalOrcamentos)}</div>
            <div className="text-xs text-gray-500 mt-1">{data.orcamentos.length} orçamentos</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-green-500 min-w-0">
            <div className="text-xs text-gray-600 truncate">Valores Convertidos</div>
            <div className="text-lg font-bold text-green-600 truncate">{formatCurrency(totalConvertidos)}</div>
            <div className="text-xs text-gray-500 mt-1">{convertidos.length} orçamentos</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-red-500 min-w-0">
            <div className="text-xs text-gray-600 truncate">Não Convertidos</div>
            <div className="text-lg font-bold text-red-600 truncate">{formatCurrency(totalNaoConvertidos)}</div>
            <div className="text-xs text-gray-500 mt-1">{naoConvertidos.length} orçamentos</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-green-500 min-w-0">
            <div className="text-xs text-gray-600 truncate">Taxa de Conversão</div>
            <div className="text-lg font-bold text-green-600">{taxaConversao.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 mt-1">{convertidos.length} de {data.orcamentos.length} convertidos</div>
          </div>
        </div>

        {/* Action Menu */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Ações</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <MoreVertical className="w-5 h-5 text-slate-600" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Importar</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Orçamentos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => pedidosInputRef.current?.click()}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Pedidos (para comparação)
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuLabel>Exportar</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportHTML}>
                <FileDown className="w-4 h-4 mr-2" />
                HTML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <Download className="w-4 h-4 mr-2" />
                PDF (Imprimir)
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleClear} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar Dados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
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

        <div className="bg-white rounded-lg shadow-sm p-6">
          <OrcamentoTable
            orcamentos={data.orcamentos}
            pedidosDocumentos={pedidosDocumentos}
            onOrcamentoUpdate={handleOrcamentoUpdate}
            onCodClienteUpdate={handleCodClienteUpdate}
            onNoSistemaToggle={handleNoSistemaToggle}
          />
        </div>
      </div>
    </div>
  );
};

export default Orcamento;
