import { useState } from 'react';
import type { Orcamento } from '@/types/faturamento';
import { formatCurrency } from '@/lib/orcamento-store';
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react';

interface OrcamentoTableProps {
  orcamentos: Orcamento[];
  pedidosDocumentos: string[];
  onOrcamentoUpdate?: (documento: string, numeroPedido: string) => void;
}

type SortField = 'documento' | 'cliente' | 'valor' | 'dataEmissao' | 'virou_pedido';
type SortOrder = 'asc' | 'desc';

export function OrcamentoTable({ orcamentos, pedidosDocumentos, onOrcamentoUpdate }: OrcamentoTableProps) {
  const [sortField, setSortField] = useState<SortField>('dataEmissao');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'convertidos' | 'nao_convertidos'>('todos');
  const [editingDocumento, setEditingDocumento] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const pedidoSet = new Set(pedidosDocumentos);
  const orcamentosComStatus = orcamentos.map(o => {
    // Considera convertido se tem virou_pedido preenchido (manual) OU está na lista de pedidos
    const convertido = Boolean(o.virou_pedido) || pedidoSet.has(o.documento);
    return {
      ...o,
      convertido,
    };
  });

  // Filter
  const filtered = orcamentosComStatus.filter(o => {
    if (filterStatus === 'convertidos') return o.convertido;
    if (filterStatus === 'nao_convertidos') return !o.convertido;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (sortField === 'virou_pedido') {
      aValue = a.convertido ? 1 : 0;
      bValue = b.convertido ? 1 : 0;
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

  const handleEditStart = (documento: string, currentValue: string) => {
    setEditingDocumento(documento);
    setEditingValue(currentValue || '');
  };

  const handleEditSave = (documento: string) => {
    if (onOrcamentoUpdate) {
      onOrcamentoUpdate(documento, editingValue);
    }
    setEditingDocumento(null);
  };

  const handleEditCancel = () => {
    setEditingDocumento(null);
    setEditingValue('');
  };

  const totalOrcamentos = orcamentosComStatus.reduce((s, o) => s + o.valor, 0);
  const totalNaoConvertidos = orcamentosComStatus.filter(o => !o.convertido).reduce((s, o) => s + o.valor, 0);
  const totalConvertidos = orcamentosComStatus.filter(o => o.convertido).reduce((s, o) => s + o.valor, 0);

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
            Convertidos ({orcamentosComStatus.filter(o => o.convertido).length})
          </button>
          <button
            onClick={() => setFilterStatus('nao_convertidos')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
              filterStatus === 'nao_convertidos'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Não Convertidos ({orcamentosComStatus.filter(o => !o.convertido).length})
          </button>
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
                  {editingDocumento === orcamento.documento ? (
                    <div className="flex items-center justify-center gap-2 bg-blue-50 p-2 rounded border border-blue-200">
                      <input
                        type="text"
                        placeholder="Nº pedido"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="w-20 px-2 py-1 text-xs border rounded"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditSave(orcamento.documento)}
                        className="text-green-600 hover:text-green-800 font-bold"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="text-red-600 hover:text-red-800 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleEditStart(orcamento.documento, String(orcamento.virou_pedido || ''))}
                      className="cursor-pointer"
                    >
                      {orcamento.convertido ? (
                        <div className="flex items-center justify-center">
                          <div className="bg-green-100 text-green-700 rounded-full p-1 flex items-center justify-center hover:bg-green-200 transition-colors" title={String(orcamento.virou_pedido || 'Convertido')}>
                            <Check className="w-4 h-4" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <div className="bg-red-100 text-red-700 rounded-full p-1 flex items-center justify-center hover:bg-red-200 transition-colors" title="Clique para adicionar nº pedido">
                            <X className="w-4 h-4" />
                          </div>
                        </div>
                      )}
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
