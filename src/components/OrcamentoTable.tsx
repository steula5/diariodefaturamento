import { useState } from 'react';
import type { Orcamento } from '@/types/faturamento';
import { formatCurrency } from '@/lib/orcamento-store';
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react';

interface OrcamentoTableProps {
  orcamentos: Orcamento[];
  pedidosDocumentos: string[];
}

type SortField = 'documento' | 'cliente' | 'valor' | 'dataEmissao' | 'virou_pedido';
type SortOrder = 'asc' | 'desc';

export function OrcamentoTable({ orcamentos, pedidosDocumentos }: OrcamentoTableProps) {
  const [sortField, setSortField] = useState<SortField>('dataEmissao');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'convertidos' | 'nao_convertidos'>('todos');

  const pedidoSet = new Set(pedidosDocumentos);
  const orcamentosComStatus = orcamentos.map(o => ({
    ...o,
    virou_pedido: pedidoSet.has(o.documento),
  }));

  // Filter
  const filtered = orcamentosComStatus.filter(o => {
    if (filterStatus === 'convertidos') return o.virou_pedido;
    if (filterStatus === 'nao_convertidos') return !o.virou_pedido;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (sortField === 'virou_pedido') {
      aValue = a.virou_pedido ? 1 : 0;
      bValue = b.virou_pedido ? 1 : 0;
    } else if (sortField === 'valor') {
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
    }

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const totalOrcamentos = orcamentosComStatus.reduce((s, o) => s + o.valor, 0);
  const totalNaoConvertidos = orcamentosComStatus.filter(o => !o.virou_pedido).reduce((s, o) => s + o.valor, 0);
  const totalConvertidos = orcamentosComStatus.filter(o => o.virou_pedido).reduce((s, o) => s + o.valor, 0);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <div className="w-4 h-4" />;
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  return (
    <div className="dashboard-section">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-4">Orçamentos</h2>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilterStatus('todos')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
              filterStatus === 'todos'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos ({orcamentosComStatus.length})
          </button>
          <button
            onClick={() => setFilterStatus('convertidos')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
              filterStatus === 'convertidos'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Convertidos ({orcamentosComStatus.filter(o => o.virou_pedido).length})
          </button>
          <button
            onClick={() => setFilterStatus('nao_convertidos')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
              filterStatus === 'nao_convertidos'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Não Convertidos ({orcamentosComStatus.filter(o => !o.virou_pedido).length})
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-gray-600">Total de Orçamentos</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(totalOrcamentos)}</div>
            <div className="text-xs text-gray-500 mt-1">{orcamentosComStatus.length} orçamentos</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-gray-600">Convertidos</div>
            <div className="text-xl font-bold text-green-600">{formatCurrency(totalConvertidos)}</div>
            <div className="text-xs text-gray-500 mt-1">{orcamentosComStatus.filter(o => o.virou_pedido).length} orçamentos</div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <div className="text-gray-600">Não Convertidos</div>
            <div className="text-xl font-bold text-red-600">{formatCurrency(totalNaoConvertidos)}</div>
            <div className="text-xs text-gray-500 mt-1">{orcamentosComStatus.filter(o => !o.virou_pedido).length} orçamentos</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-50">
              <th 
                className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('documento')}
              >
                <div className="flex items-center gap-2">
                  Documento <SortIcon field="documento" />
                </div>
              </th>
              <th 
                className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('cliente')}
              >
                <div className="flex items-center gap-2">
                  Cliente <SortIcon field="cliente" />
                </div>
              </th>
              <th 
                className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('dataEmissao')}
              >
                <div className="flex items-center gap-2">
                  Data Emissão <SortIcon field="dataEmissao" />
                </div>
              </th>
              <th 
                className="px-4 py-2 text-right cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('valor')}
              >
                <div className="flex items-center justify-end gap-2">
                  Valor <SortIcon field="valor" />
                </div>
              </th>
              <th 
                className="px-4 py-2 text-center cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('virou_pedido')}
              >
                <div className="flex items-center justify-center gap-2">
                  Virou Pedido <SortIcon field="virou_pedido" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((orcamento) => (
              <tr 
                key={orcamento.documento} 
                className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-2 font-medium text-blue-600">{orcamento.documento}</td>
                <td className="px-4 py-2">{orcamento.cliente}</td>
                <td className="px-4 py-2 text-gray-600">{orcamento.dataEmissao}</td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(orcamento.valor)}</td>
                <td className="px-4 py-2 text-center">
                  {orcamento.virou_pedido ? (
                    <div className="flex items-center justify-center">
                      <div className="bg-green-100 text-green-700 rounded-full p-1 flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <div className="bg-red-100 text-red-700 rounded-full p-1 flex items-center justify-center">
                        <X className="w-4 h-4" />
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nenhum orçamento encontrado com os critérios de filtro.
        </div>
      )}
    </div>
  );
}
