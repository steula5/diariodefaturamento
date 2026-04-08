import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  loadOrcamentoData,
  saveOrcamentoData,
  exportToJSON,
  exportToHTML,
  exportToExcel,
  exportToPDF,
  getDefaultPeriod,
  getOrcamentoStatus,
  isOrcamentoConvertido,
  mergeOrcamentos,
  formatCurrency,
} from '@/lib/orcamento-store';
import { parseOrcamentoExcelFile } from '@/lib/orcamento-parser';
import { parseExcelFile } from '@/lib/excel-parser';
import type { OrcamentoData, Orcamento } from '@/types/faturamento';
import { Download, Upload, Trash2, FileSpreadsheet, FileDown, MoreVertical, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';

// Helper: Extract period (YYYY-MM) from dataEmissao (DD/MM/YYYY)
function extractPeriodFromDataEmissao(dataEmissao: string): string {
  const [day, month, year] = dataEmissao.split('/');
  return `${year}-${month}`;
}

// Helper: Get sorted unique periods from orcamentos
function getUniquePeriods(orcamentos: Orcamento[]): string[] {
  const periods = new Set(orcamentos.map(o => extractPeriodFromDataEmissao(o.dataEmissao)));
  return Array.from(periods).sort().reverse();
}

// Helper: Format YYYY-MM to human readable
function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
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
  const [faturadoInput, setFaturadoInput] = useState<string>(
    () => (loadOrcamentoData()?.totalFaturado ?? '').toString()
  );
  const [selectedPeriod, setSelectedPeriod] = useState<'todos' | string>('todos');
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
          ? {
              ...o,
              virou_pedido: numeroPedido || undefined as any,
              motivo_perda: numeroPedido ? undefined : o.motivo_perda,
              no_sistema: numeroPedido ? true : o.no_sistema,
            }
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
    const orcamentoAtual = data.orcamentos.find(o => o.documento === documento);
    if (!orcamentoAtual) {
      return;
    }

    const pedidoSet = new Set(pedidosDocumentos);
    const convertido = isOrcamentoConvertido(orcamentoAtual, pedidoSet);

    if (!noSistema && !convertido) {
      const motivoInformado = window.prompt(
        'Informe o motivo da perda deste orçamento:',
        orcamentoAtual.motivo_perda || ''
      );

      if (motivoInformado === null) {
        return;
      }

      const motivo = motivoInformado.trim();
      if (!motivo) {
        toast.error('Informe o motivo antes de marcar o orçamento como perdido.');
        return;
      }

      setData(prev => ({
        ...prev,
        orcamentos: prev.orcamentos.map(o =>
          o.documento === documento ? { ...o, no_sistema: false, motivo_perda: motivo } : o
        ),
      }));
      toast.success('Orçamento marcado como perdido.');
      return;
    }

    setData(prev => ({
      ...prev,
      orcamentos: prev.orcamentos.map(o =>
        o.documento === documento
          ? { ...o, no_sistema: noSistema, motivo_perda: noSistema ? undefined : o.motivo_perda }
          : o
      ),
    }));
  }, [data.orcamentos, pedidosDocumentos]);

  const handleMotivoPerdaUpdate = useCallback((documento: string, motivoPerda: string) => {
    const motivo = motivoPerda.trim();
    if (!motivo) {
      toast.error('O motivo da perda não pode ficar vazio.');
      return false;
    }

    setData(prev => ({
      ...prev,
      orcamentos: prev.orcamentos.map(o =>
        o.documento === documento ? { ...o, motivo_perda: motivo, no_sistema: false } : o
      ),
    }));
    toast.success('Motivo da perda atualizado.');
    return true;
  }, []);

  const handleAnalisadoToggle = useCallback((documento: string, analisado: boolean) => {
    setData(prev => {
      const updated = prev.orcamentos.map(o =>
        o.documento === documento ? { ...o, analisado } : o
      );
      return { ...prev, orcamentos: updated };
    });
  }, []);

  const handleFaturadoBlur = useCallback(() => {
    const parsed = parseFloat(faturadoInput.replace(/[^0-9,.]/g, '').replace(',', '.'));
    const value = isNaN(parsed) ? undefined : parsed;
    setData(prev => ({ ...prev, totalFaturado: value }));
    setFaturadoInput(value !== undefined ? value.toString() : '');
  }, [faturadoInput]);

  const handleClear = useCallback(() => {
    if (window.confirm('Tem certeza que deseja limpar todos os dados?')) {
      setData({
        mes: getDefaultPeriod(),
        orcamentos: [],
        orcamentoDiario: [],
      });
      setPedidosDocumentos([]);
      setFaturadoInput('');
      toast.success('Dados limpos!');
    }
  }, []);

  // Get unique periods and filtered orcamentos
  const availablePeriods = useMemo(() => getUniquePeriods(data.orcamentos), [data.orcamentos]);
  
  const filteredOrcamentos = useMemo(() => {
    if (selectedPeriod === 'todos') {
      return data.orcamentos;
    }
    return data.orcamentos.filter(o => extractPeriodFromDataEmissao(o.dataEmissao) === selectedPeriod);
  }, [data.orcamentos, selectedPeriod]);

  const pedidoSet = new Set(pedidosDocumentos);
  const isConvertido = (o: Orcamento) => isOrcamentoConvertido(o, pedidoSet);

  const totalOrcamentos = filteredOrcamentos.reduce((s, o) => s + o.valor, 0);
  const convertidos = filteredOrcamentos.filter(isConvertido);
  const totalConvertidosCalculado = convertidos.reduce((s, o) => s + o.valor, 0);
  const taxaConversao = totalOrcamentos > 0 ? (totalConvertidosCalculado / totalOrcamentos) * 100 : 0;

  const oportunidadesAbertas = filteredOrcamentos.filter(o => getOrcamentoStatus(o, pedidoSet) === 'em_aberto');
  const oportunidadesPerdidas = filteredOrcamentos.filter(o => getOrcamentoStatus(o, pedidoSet) === 'perdido');
  const totalAbertas = oportunidadesAbertas.reduce((s, o) => s + o.valor, 0);
  const totalPerdidas = oportunidadesPerdidas.reduce((s, o) => s + o.valor, 0);

  const totalFaturado = data.totalFaturado ?? 0;
  const fatVsOrc = totalOrcamentos > 0 ? (totalFaturado / totalOrcamentos) * 100 : 0;
  const coberturaOrc = totalFaturado > 0 ? (totalConvertidosCalculado / totalFaturado) * 100 : 0;
  const difFaturadoVsOrConvertido = totalFaturado - totalConvertidosCalculado;

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

        {/* Period Filter */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-slate-700">Filtrar por período:</label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Tudo</SelectItem>
                {availablePeriods.map(period => (
                  <SelectItem key={period} value={period}>
                    {formatPeriod(period)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick Info Cards — Conversão */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-blue-500 min-w-0">
            <div className="text-xs text-gray-600 truncate">Total em Orçamentos</div>
            <div className="text-lg font-bold text-gray-900 truncate">{formatCurrency(totalOrcamentos)}</div>
            <div className="text-xs text-gray-500 mt-1">{filteredOrcamentos.length} orçamentos</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-green-500 min-w-0">
            <div className="text-xs text-gray-600 truncate">Valores Convertidos</div>
            <div className="text-lg font-bold text-green-600 truncate">{formatCurrency(totalConvertidosCalculado)}</div>
            <div className="text-xs text-gray-500 mt-1">{convertidos.length} orçamentos</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-red-500 min-w-0">
            <div className="text-xs text-gray-600 truncate">Perdidos</div>
            <div className="text-lg font-bold text-red-600 truncate">{formatCurrency(totalPerdidas)}</div>
            <div className="text-xs text-gray-500 mt-1">{oportunidadesPerdidas.length} orçamentos marcados como perdidos</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-green-500 min-w-0">
            <div className="text-xs text-gray-600 truncate">Taxa de Conversão</div>
            <div className="text-lg font-bold text-green-600">{taxaConversao.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 mt-1">{convertidos.length} de {filteredOrcamentos.length} convertidos</div>
          </div>
        </div>

        {/* Cards de Oportunidade — baseados no Status */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-emerald-500">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <div className="text-sm font-semibold text-gray-700">Oportunidades em Aberto</div>
            </div>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalAbertas)}</div>
            <div className="text-xs text-gray-500 mt-1">{oportunidadesAbertas.length} orçamentos com status Ativo</div>
          </div>
        </div>

        {/* PV Faturado no Período */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <label htmlFor="totalFaturado" className="block text-sm font-semibold text-slate-700 mb-1">
                PV Faturado no Período
              </label>
              <p className="text-xs text-slate-500">Informe o valor de PV faturado no mês para comparar com o pipeline de orçamentos.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 font-medium">R$</span>
              <input
                id="totalFaturado"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={faturadoInput}
                onChange={e => setFaturadoInput(e.target.value)}
                onBlur={handleFaturadoBlur}
                onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Insights: Faturado vs Orçado */}
        {totalFaturado > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Faturado vs Orçado</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Faturado vs Pipeline */}
              <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-blue-500 min-w-0">
                <div className="text-xs text-gray-600 truncate">PV Faturado vs Pipeline</div>
                <div className={`text-lg font-bold truncate ${
                  fatVsOrc >= 100 ? 'text-green-600' : fatVsOrc >= 70 ? 'text-yellow-600' : 'text-red-600'
                }`}>{fatVsOrc.toFixed(1)}%</div>
                <div className="flex items-center gap-1 mt-1">
                  {fatVsOrc >= 100 ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : fatVsOrc >= 70 ? (
                    <Minus className="w-3 h-3 text-yellow-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-xs text-gray-500 truncate">{formatCurrency(totalFaturado)} PV faturado</span>
                </div>
              </div>

              {/* Cobertura por Orçamentos */}
              <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-purple-500 min-w-0">
                <div className="text-xs text-gray-600 truncate">Origem em Orçamentos</div>
                <div className={`text-lg font-bold truncate ${
                  coberturaOrc >= 60 ? 'text-green-600' : coberturaOrc >= 30 ? 'text-yellow-600' : 'text-slate-600'
                }`}>{coberturaOrc.toFixed(1)}%</div>
                <div className="text-xs text-gray-500 mt-1 truncate">{formatCurrency(totalConvertidosCalculado)} originados de ORC</div>
              </div>

              {/* Diferença Faturado - Orçado */}
              <div className={`bg-white rounded-lg shadow-sm p-3 border-l-4 min-w-0 ${
                difFaturadoVsOrConvertido >= 0 ? 'border-green-500' : 'border-red-400'
              }`}>
                <div className="text-xs text-gray-600 truncate">PV Faturado − OR Convertidos</div>
                <div className={`text-lg font-bold truncate ${
                  difFaturadoVsOrConvertido >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {difFaturadoVsOrConvertido >= 0 ? '+' : ''}{formatCurrency(difFaturadoVsOrConvertido)}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {difFaturadoVsOrConvertido >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-xs text-gray-500 truncate">
                    {difFaturadoVsOrConvertido >= 0 ? 'PV faturado acima dos OR convertidos' : 'PV faturado abaixo dos OR convertidos'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bar visual comparison */}
            <div className="bg-white rounded-lg shadow-sm p-4 mt-3">
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Pipeline de Orçamentos</span>
                <span>{formatCurrency(totalOrcamentos)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 mb-3">
                <div
                  className="bg-blue-500 h-3 rounded-full"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>PV Faturado</span>
                <span>{formatCurrency(totalFaturado)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 mb-3">
                <div
                  className={`h-3 rounded-full ${
                    totalFaturado >= totalOrcamentos ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${Math.min(100, fatVsOrc)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Convertidos de Orçamentos</span>
                <span>{formatCurrency(totalConvertidosCalculado)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div
                  className="bg-purple-500 h-3 rounded-full"
                  style={{ width: `${totalOrcamentos > 0 ? Math.min(100, (totalConvertidosCalculado / totalOrcamentos) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        )}

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
            orcamentos={filteredOrcamentos}
            pedidosDocumentos={pedidosDocumentos}
            onOrcamentoUpdate={handleOrcamentoUpdate}
            onCodClienteUpdate={handleCodClienteUpdate}
            onNoSistemaToggle={handleNoSistemaToggle}
            onAnalisadoToggle={handleAnalisadoToggle}
            onMotivoPerdaUpdate={handleMotivoPerdaUpdate}
          />
        </div>
      </div>
    </div>
  );
};

export default Orcamento;
