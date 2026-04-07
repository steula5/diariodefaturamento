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
import { Download, Upload, Trash2, FileSpreadsheet, FileDown, MoreVertical, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
  const [faturadoInput, setFaturadoInput] = useState<string>(
    () => (loadOrcamentoData()?.totalFaturado ?? '').toString()
  );
  const [pedidosConcretizadosInput, setPedidosConcretizadosInput] = useState<string>(
    () => (loadOrcamentoData()?.totalPedidosConcretizados ?? '').toString()
  );
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

  const handlePedidosConcretizadosBlur = useCallback(() => {
    const parsed = parseFloat(pedidosConcretizadosInput.replace(/[^0-9,.]/g, '').replace(',', '.'));
    const value = isNaN(parsed) ? undefined : parsed;
    setData(prev => ({ ...prev, totalPedidosConcretizados: value }));
    setPedidosConcretizadosInput(value !== undefined ? value.toString() : '');
  }, [pedidosConcretizadosInput]);

  const handleClear = useCallback(() => {
    if (window.confirm('Tem certeza que deseja limpar todos os dados?')) {
      setData({
        mes: getDefaultPeriod(),
        orcamentos: [],
        orcamentoDiario: [],
      });
      setPedidosDocumentos([]);
      setFaturadoInput('');
      setPedidosConcretizadosInput('');
      toast.success('Dados limpos!');
    }
  }, []);

  const pedidoSet = new Set(pedidosDocumentos);
  const isConvertido = (o: Orcamento) => Boolean(o.virou_pedido) || pedidoSet.has(o.documento);

  const totalOrcamentos = data.orcamentos.reduce((s, o) => s + o.valor, 0);
  const convertidos = data.orcamentos.filter(isConvertido);
  const totalConvertidosCalculado = convertidos.reduce((s, o) => s + o.valor, 0);
  const taxaConversao = totalOrcamentos > 0 ? (totalConvertidosCalculado / totalOrcamentos) * 100 : 0;

  const oportunidadesAbertas = data.orcamentos.filter(o => o.no_sistema === true && !isConvertido(o));
  const oportunidadesPerdidas = data.orcamentos.filter(o => !o.no_sistema && !isConvertido(o));
  const totalAbertas = oportunidadesAbertas.reduce((s, o) => s + o.valor, 0);
  const totalPerdidas = oportunidadesPerdidas.reduce((s, o) => s + o.valor, 0);

  const totalFaturado = data.totalFaturado ?? 0;
  const totalPVConcretizado = data.totalPedidosConcretizados ?? 0;
  const pvInformado = data.totalPedidosConcretizados !== undefined;
  const fatVsOrc = totalOrcamentos > 0 ? (totalFaturado / totalOrcamentos) * 100 : 0;
  const coberturaOrc = totalFaturado > 0 ? (totalConvertidosCalculado / totalFaturado) * 100 : 0;
  const faturadoSemOrcamento = Math.max(0, totalFaturado - totalConvertidosCalculado);
  const difFaturadoOrcado = totalFaturado - totalOrcamentos;
  const pvVsOrc = totalOrcamentos > 0 ? (totalPVConcretizado / totalOrcamentos) * 100 : 0;
  const pvVsFaturado = totalFaturado > 0 ? (totalPVConcretizado / totalFaturado) * 100 : 0;
  const gapPvParaOrc = totalPVConcretizado - totalOrcamentos;

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

        {/* Quick Info Cards — Conversão */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-blue-500 min-w-0">
            <div className="text-xs text-gray-600 truncate">Total em Orçamentos</div>
            <div className="text-lg font-bold text-gray-900 truncate">{formatCurrency(totalOrcamentos)}</div>
            <div className="text-xs text-gray-500 mt-1">{data.orcamentos.length} orçamentos</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-green-500 min-w-0">
            <div className="text-xs text-gray-600 truncate">Valores Convertidos</div>
            <div className="text-lg font-bold text-green-600 truncate">{formatCurrency(totalConvertidosCalculado)}</div>
            <div className="text-xs text-gray-500 mt-1">{convertidos.length} orçamentos</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-red-500 min-w-0">
            <div className="text-xs text-gray-600 truncate">Não Convertidos</div>
            <div className="text-lg font-bold text-red-600 truncate">{formatCurrency(totalPerdidas)}</div>
            <div className="text-xs text-gray-500 mt-1">{oportunidadesPerdidas.length} orçamentos inativos</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-green-500 min-w-0">
            <div className="text-xs text-gray-600 truncate">Taxa de Conversão</div>
            <div className="text-lg font-bold text-green-600">{taxaConversao.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 mt-1">{convertidos.length} de {data.orcamentos.length} convertidos</div>
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

        {/* Total Faturado no Período + Pedidos Concretizados */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <label htmlFor="totalFaturado" className="block text-sm font-semibold text-slate-700 mb-1">
                  Total Faturado no Período
                </label>
                <p className="text-xs text-slate-500">Informe o valor total faturado no mês para comparar com o pipeline de orçamentos.</p>
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

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <label htmlFor="totalPedidosConcretizados" className="block text-sm font-semibold text-slate-700 mb-1">
                  Pedidos Concretizados (PV)
                </label>
                <p className="text-xs text-slate-500">Opcional: informe o valor total de PVs no mês para comparar com OR e faturamento.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 font-medium">R$</span>
                <input
                  id="totalPedidosConcretizados"
                  type="text"
                  inputMode="decimal"
                  placeholder={totalConvertidosCalculado.toFixed(2)}
                  value={pedidosConcretizadosInput}
                  onChange={e => setPedidosConcretizadosInput(e.target.value)}
                  onBlur={handlePedidosConcretizadosBlur}
                  onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                  className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Insights: Faturado vs Orçado */}
        {totalFaturado > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Faturado vs Orçado</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Faturado vs Pipeline */}
              <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-blue-500 min-w-0">
                <div className="text-xs text-gray-600 truncate">Faturado vs Pipeline</div>
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
                  <span className="text-xs text-gray-500 truncate">{formatCurrency(totalFaturado)} faturado</span>
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

              {/* Faturado sem orçamento */}
              <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-orange-400 min-w-0">
                <div className="text-xs text-gray-600 truncate">Faturado (outras origens)</div>
                <div className="text-lg font-bold text-orange-600 truncate">{formatCurrency(faturadoSemOrcamento)}</div>
                <div className="text-xs text-gray-500 mt-1 truncate">Não originados de ORC</div>
              </div>

              {/* Diferença Faturado - Orçado */}
              <div className={`bg-white rounded-lg shadow-sm p-3 border-l-4 min-w-0 ${
                difFaturadoOrcado >= 0 ? 'border-green-500' : 'border-red-400'
              }`}>
                <div className="text-xs text-gray-600 truncate">Faturado − Pipeline</div>
                <div className={`text-lg font-bold truncate ${
                  difFaturadoOrcado >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {difFaturadoOrcado >= 0 ? '+' : ''}{formatCurrency(difFaturadoOrcado)}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {difFaturadoOrcado >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-xs text-gray-500 truncate">
                    {difFaturadoOrcado >= 0 ? 'Faturou acima do pipeline' : 'Faturou abaixo do pipeline'}
                  </span>
                </div>
              </div>
            </div>

            {pvInformado && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Comparativo com PV (manual)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-cyan-500 min-w-0">
                    <div className="text-xs text-gray-600 truncate">Total PV no Período</div>
                    <div className="text-lg font-bold text-cyan-700 truncate">{formatCurrency(totalPVConcretizado)}</div>
                    <div className="text-xs text-gray-500 mt-1 truncate">Valor informado manualmente</div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-cyan-500 min-w-0">
                    <div className="text-xs text-gray-600 truncate">PV vs Pipeline OR</div>
                    <div className={`text-lg font-bold truncate ${pvVsOrc >= 100 ? 'text-green-600' : pvVsOrc >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {pvVsOrc.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">PVs em relação ao total de OR</div>
                  </div>
                  <div className={`bg-white rounded-lg shadow-sm p-3 border-l-4 min-w-0 ${gapPvParaOrc >= 0 ? 'border-green-500' : 'border-red-400'}`}>
                    <div className="text-xs text-gray-600 truncate">PV − Pipeline OR</div>
                    <div className={`text-lg font-bold truncate ${gapPvParaOrc >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {gapPvParaOrc >= 0 ? '+' : ''}{formatCurrency(gapPvParaOrc)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">Diferença absoluta de PV para OR</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  PV representa {pvVsFaturado.toFixed(1)}% do faturado no período.
                </div>
              </div>
            )}

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
                <span>Total Faturado</span>
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
            orcamentos={data.orcamentos}
            pedidosDocumentos={pedidosDocumentos}
            onOrcamentoUpdate={handleOrcamentoUpdate}
            onCodClienteUpdate={handleCodClienteUpdate}
            onNoSistemaToggle={handleNoSistemaToggle}
            onAnalisadoToggle={handleAnalisadoToggle}
          />
        </div>
      </div>
    </div>
  );
};

export default Orcamento;
