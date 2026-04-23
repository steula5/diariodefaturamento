import { useState } from 'react';
import type { Orcamento } from '@/types/faturamento';
import { formatCurrency, getOrcamentoStatus, isOrcamentoConvertido } from '@/lib/orcamento-store';
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react';

interface OrcamentoTableProps {
  orcamentos: Orcamento[];
  pedidosDocumentos: string[];
  onOrcamentoUpdate?: (documento: string, numeroPedido: string) => void;
  onCodClienteUpdate?: (documento: string, codCliente: string) => void;
  onNoSistemaToggle?: (documento: string, noSistema: boolean) => void;
  onAnalisadoToggle?: (documento: string, analisado: boolean) => void;
  onMotivoPerdaUpdate?: (documento: string, motivoPerda: string) => boolean | void;
  onDonoUpdate?: (documento: string, dono: string) => void;
}

type SortField = 'documento' | 'cliente' | 'valor' | 'dataEmissao' | 'virou_pedido' | 'dono';
type SortOrder = 'asc' | 'desc';

export function OrcamentoTable({ 
  orcamentos, 
  pedidosDocumentos, 
  onOrcamentoUpdate, 
  onCodClienteUpdate, 
  onNoSistemaToggle, 
  onAnalisadoToggle, 
  onMotivoPerdaUpdate,
  onDonoUpdate
}: OrcamentoTableProps) {
  const [sortField, setSortField] = useState<SortField>('dataEmissao');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'convertidos' | 'nao_convertidos'>('todos');
  const [editingDocumento, setEditingDocumento] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingCodDoc, setEditingCodDoc] = useState<string | null>(null);
  const [editingCodValue, setEditingCodValue] = useState('');
  const [editingMotivoDoc, setEditingMotivoDoc] = useState<string | null>(null);
  const [editingMotivoValue, setEditingMotivoValue] = useState('');
  const [editingDonoDoc, setEditingDonoDoc] = useState<string | null>(null);
  const [editingDonoValue, setEditingDonoValue] = useState('');

  const pedidoSet = new Set(pedidosDocumentos);
  const orcamentosComStatus = orcamentos.map(o => {
    const convertido = isOrcamentoConvertido(o, pedidoSet);
    return {
      ...o,
      convertido,
      status: getOrcamentoStatus(o, pedidoSet),
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

  const handleCodClienteStart = (documento: string, current: string) => {
    setEditingCodDoc(documento);
    setEditingCodValue(current || '');
  };

  const handleCodClienteSave = (documento: string) => {
    if (onCodClienteUpdate) onCodClienteUpdate(documento, editingCodValue);
    setEditingCodDoc(null);
  };

  const handleCodClienteCancel = () => {
    setEditingCodDoc(null);
    setEditingCodValue('');
  };

  const handleEditCancel = () => {
    setEditingDocumento(null);
    setEditingValue('');
  };

  const handleMotivoStart = (documento: string, currentValue: string) => {
    setEditingMotivoDoc(documento);
    setEditingMotivoValue(currentValue || '');
  };

  const handleMotivoCancel = () => {
    setEditingMotivoDoc(null);
    setEditingMotivoValue('');
  };

  const handleMotivoSave = (documento: string) => {
    const result = onMotivoPerdaUpdate?.(documento, editingMotivoValue);
    if (result !== false) {
      handleMotivoCancel();
    }
  };

  const handleDonoStart = (documento: string, current: string) => {
    setEditingDonoDoc(documento);
    setEditingDonoValue(current || '');
  };

  const handleDonoSave = (documento: string) => {
    if (onDonoUpdate) onDonoUpdate(documento, editingDonoValue);
    setEditingDonoDoc(null);
  };

  const handleDonoCancel = () => {
    setEditingDonoDoc(null);
    setEditingDonoValue('');
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
              <th className="px-4 py-2 text-center">Ativid. Sistema</th>
              <th className="px-4 py-2 text-center">Status</th>
              <th className="px-4 py-2 text-center">Analisado</th>
              <th className="px-4 py-2 text-left">Cód. Cliente</th>
              <th className="px-4 py-2 text-left">Motivo da Perda</th>
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
                onClick={() => handleSort('dono')}
              >
                <div className="flex items-center gap-2">
                  Dono <SortIcon field="dono" />
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
                className={`border-b border-gray-200 transition-colors ${
                  !orcamento.dono 
                    ? 'bg-yellow-50 hover:bg-yellow-100 text-slate-900 font-medium border-yellow-200' 
                    : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-2 font-medium text-blue-600">{orcamento.documento}</td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => onNoSistemaToggle && onNoSistemaToggle(orcamento.documento, !orcamento.no_sistema)}
                    title={orcamento.no_sistema ? 'Ativo no sistema — clique para marcar como perdido' : 'Inativo no sistema — clique para reativar'}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      orcamento.no_sistema
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      orcamento.no_sistema ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    {orcamento.no_sistema ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    orcamento.status === 'convertido'
                      ? 'bg-green-100 text-green-700'
                      : orcamento.status === 'perdido'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                  }`}>
                    {orcamento.status === 'convertido' ? 'Convertido' : orcamento.status === 'perdido' ? 'Perdido' : 'Em aberto'}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={Boolean(orcamento.analisado)}
                    onChange={(e) => onAnalisadoToggle && onAnalisadoToggle(orcamento.documento, e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-blue-600"
                    aria-label={`Marcar orçamento ${orcamento.documento} como analisado`}
                  />
                </td>
                <td className="px-4 py-2">
                  {editingCodDoc === orcamento.documento ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Cód."
                        value={editingCodValue}
                        onChange={(e) => setEditingCodValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCodClienteSave(orcamento.documento); if (e.key === 'Escape') handleCodClienteCancel(); }}
                        className="w-20 px-2 py-1 text-xs border rounded"
                        autoFocus
                      />
                      <button onClick={() => handleCodClienteSave(orcamento.documento)} className="text-green-600 hover:text-green-800 font-bold">✓</button>
                      <button onClick={handleCodClienteCancel} className="text-red-600 hover:text-red-800 font-bold">✕</button>
                    </div>
                  ) : (
                    <span
                      onClick={() => handleCodClienteStart(orcamento.documento, orcamento.cod_cliente || '')}
                      className="cursor-pointer px-2 py-0.5 rounded hover:bg-gray-100 text-gray-700 text-xs"
                      title="Clique para editar código do cliente"
                    >
                      {orcamento.cod_cliente || <span className="text-gray-300">—</span>}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {orcamento.status === 'perdido' ? (
                    editingMotivoDoc === orcamento.documento ? (
                      <div className="flex items-start gap-1">
                        <input
                          type="text"
                          value={editingMotivoValue}
                          onChange={(e) => setEditingMotivoValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleMotivoSave(orcamento.documento);
                            if (e.key === 'Escape') handleMotivoCancel();
                          }}
                          className="w-64 px-2 py-1 text-xs border rounded"
                          placeholder="Descreva o motivo"
                          autoFocus
                        />
                        <button onClick={() => handleMotivoSave(orcamento.documento)} className="text-green-600 hover:text-green-800 font-bold">✓</button>
                        <button onClick={handleMotivoCancel} className="text-red-600 hover:text-red-800 font-bold">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleMotivoStart(orcamento.documento, orcamento.motivo_perda || '')}
                        className="max-w-64 rounded bg-red-50 px-2 py-1 text-left text-xs text-red-700 hover:bg-red-100"
                        title="Clique para editar o motivo da perda"
                      >
                        {orcamento.motivo_perda || 'Informar motivo'}
                      </button>
                    )
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-2">{orcamento.cliente}</td>
                <td className="px-4 py-2">
                  {editingDonoDoc === orcamento.documento ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Nome do dono"
                        value={editingDonoValue}
                        onChange={(e) => setEditingDonoValue(e.target.value)}
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') handleDonoSave(orcamento.documento); 
                          if (e.key === 'Escape') handleDonoCancel(); 
                        }}
                        className="w-32 px-2 py-1 text-xs border rounded shadow-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleDonoSave(orcamento.documento)} className="text-green-600 hover:text-green-800 font-bold" title="Salvar">✓</button>
                      <button onClick={handleDonoCancel} className="text-red-600 hover:text-red-800 font-bold" title="Cancelar">✕</button>
                    </div>
                  ) : (
                    <span
                      onClick={() => handleDonoStart(orcamento.documento, orcamento.dono || '')}
                      className={`cursor-pointer px-2 py-1 rounded text-xs transition-colors ${
                        orcamento.dono 
                          ? 'hover:bg-gray-100 text-gray-700' 
                          : 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300 font-semibold'
                      }`}
                      title="Clique para editar dono do orçamento"
                    >
                      {orcamento.dono || 'Sem Dono'}
                    </span>
                  )}
                </td>
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
