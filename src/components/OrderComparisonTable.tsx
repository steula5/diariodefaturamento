import { Pedido } from '@/types/faturamento';
import { formatCurrency } from '@/lib/dashboard-store';
import { Search, Info, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface OrderComparisonTableProps {
  orders: Pedido[];
  disappearedOrders: Pedido[];
  exclusionNotes: Record<string, string>;
  onNoteChange: (doc: string, note: string) => void;
}

export function OrderComparisonTable({ orders, disappearedOrders, exclusionNotes, onNoteChange }: OrderComparisonTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'disappeared'>('current');

  const filteredOrders = orders.filter(p => 
    p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.documento.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDisappeared = disappearedOrders.filter(p => 
    p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.documento.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-section space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex bg-muted p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('current')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'current' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Pedidos do Dia ({orders.length})
          </button>
          <button 
            onClick={() => setActiveTab('disappeared')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'disappeared' ? 'bg-card text-destructive shadow-sm' : 'text-muted-foreground hover:text-destructive'}`}
          >
            Desaparecidos ({disappearedOrders.length})
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar pedido ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-1.5 text-xs bg-muted border-none rounded-lg focus:ring-1 focus:ring-primary w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Documento</th>
              <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cliente / Cidade</th>
              <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Valor</th>
              {activeTab === 'disappeared' && (
                <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Motivo da Exclusão</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(activeTab === 'current' ? filteredOrders : filteredDisappeared).map((p) => (
              <tr key={p.documento} className={`group hover:bg-muted/50 transition-colors ${activeTab === 'disappeared' ? 'text-destructive/80' : ''}`}>
                <td className="px-4 py-3 text-xs font-mono font-medium">{p.documento}</td>
                <td className="px-4 py-3">
                  <div className="text-xs font-semibold text-foreground">{p.cliente}</div>
                  <div className="text-[10px] text-muted-foreground">{p.cidade}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${p.codStatus === 4 ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                    {p.codStatus} - {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-mono font-bold text-right">
                  {formatCurrency(p.valor)}
                </td>
                {activeTab === 'disappeared' && (
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      placeholder="Digite o motivo..."
                      value={exclusionNotes[p.documento] || ''}
                      onChange={(e) => onNoteChange(p.documento, e.target.value)}
                      className="w-full px-3 py-1 text-xs bg-muted/50 border-none rounded focus:ring-1 focus:ring-destructive"
                    />
                  </td>
                )}
              </tr>
            ))}
            {(activeTab === 'current' ? filteredOrders : filteredDisappeared).length === 0 && (
              <tr>
                <td colSpan={activeTab === 'disappeared' ? 5 : 4} className="px-4 py-12 text-center text-muted-foreground text-xs italic">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
