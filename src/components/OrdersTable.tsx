import { formatCurrency, calcDiasAtraso, getClassification } from '@/lib/dashboard-store';
import type { Pedido } from '@/types/faturamento';
import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface OrdersTableProps {
  pedidos: Pedido[];
  observacoes: Record<string, string>;
  onObservacaoChange: (doc: string, value: string) => void;
  classificacoes: Record<string, string>;
  onClassificacaoChange: (doc: string, value: string) => void;
  mes: string;
  ordenacaoPedidos?: string[];
  onOrdenacaoPedidosChange?: (order: string[]) => void;
}

function getStatusBadgeClass(): string {
  return 'status-badge status-despacho';
}

function getStatusLabel(status: string): string {
  return status || 'Desp. Aprovado';
}

function SortableRow({
  p, dias, obs, isProximoMes, classificacoes, onClassificacaoChange, onObservacaoChange,
}: {
  p: Pedido; dias: number; obs: string; isProximoMes: boolean;
  classificacoes: Record<string, string>;
  onClassificacaoChange: (doc: string, value: string) => void;
  onObservacaoChange: (doc: string, value: string) => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: p.documento });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-border/50 transition-colors ${
        isProximoMes ? 'bg-warning/10 hover:bg-warning/15' : 'hover:bg-muted/30'
      }`}
    >
      <td className="py-1 px-1 text-center">
        <div className="flex items-center gap-0.5">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/50 hover:text-muted-foreground">
            <GripVertical className="w-3 h-3" />
          </button>
          <input
            type="text"
            value={classificacoes[p.documento] || ''}
            onChange={(e) => onClassificacaoChange(p.documento, e.target.value.slice(0, 1))}
            placeholder="a"
            maxLength={1}
            className="w-[24px] text-center bg-transparent border border-border/50 rounded px-0.5 py-1 text-xs font-bold uppercase placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 text-warning"
          />
        </div>
      </td>
      <td className="py-2 px-2 font-mono font-medium">{p.documento}</td>
      <td className="py-2 px-2 max-w-[200px] truncate">{p.cliente}</td>
      <td className="py-2 px-1 hidden md:table-cell text-muted-foreground truncate max-w-[80px]">{p.cidade}</td>
      <td className="py-2 px-1 text-muted-foreground text-[10px]">{p.dataEmissao}</td>
      <td className={`py-2 px-2 text-right font-mono font-medium ${isProximoMes ? 'text-warning' : ''}`}>{formatCurrency(p.valor)}</td>
      <td className="py-2 px-2 text-center">
        <span className={`font-mono font-bold ${dias > 7 ? 'text-destructive' : dias > 3 ? 'text-warning' : 'text-muted-foreground'}`}>
          {dias}d
        </span>
      </td>
      <td className="py-2 px-2">
        <span className={getStatusBadgeClass()}>
          {getStatusLabel(p.status)}
        </span>
      </td>
      <td className="py-1 px-1">
        <input
          type="text"
          value={obs}
          onChange={(e) => onObservacaoChange(p.documento, e.target.value)}
          placeholder="..."
          className="w-full min-w-[120px] bg-transparent border border-border/50 rounded px-1.5 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
        />
      </td>
    </tr>
  );
}

export function OrdersTable({ pedidos, observacoes, onObservacaoChange, classificacoes, onClassificacaoChange, mes, ordenacaoPedidos, onOrdenacaoPedidosChange }: OrdersTableProps) {
  const [sortBy, setSortBy] = useState<'valor' | 'carteira'>('carteira');

  const realPedidos = pedidos.filter(p => !p.isDailyReport);

  // If custom order exists, use it for all pedidos
  let sorted: Pedido[];
  if (ordenacaoPedidos && ordenacaoPedidos.length > 0) {
    sorted = [...realPedidos].sort((a, b) => {
      const idxA = ordenacaoPedidos.indexOf(a.documento);
      const idxB = ordenacaoPedidos.indexOf(b.documento);
      const posA = idxA >= 0 ? idxA : 9999;
      const posB = idxB >= 0 ? idxB : 9999;
      return posA - posB;
    });
  } else {
    // Default behavior: P first, then A
    const pPedidos = realPedidos.filter(p => getClassification(classificacoes[p.documento] || '') === 'p');
    const nonPPedidos = realPedidos.filter(p => getClassification(classificacoes[p.documento] || '') === 'a');

    // Sort non-P pedidos by sort preference
    const sortedNonP = [...nonPPedidos].sort((a, b) => {
      if (sortBy === 'valor') return b.valor - a.valor;
      return calcDiasAtraso(b.dataEmissao) - calcDiasAtraso(a.dataEmissao);
    });

    sorted = [...pPedidos, ...sortedNonP];
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const allIds = sorted.map(p => p.documento);
    const oldIndex = allIds.indexOf(active.id as string);
    const newIndex = allIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(allIds, oldIndex, newIndex);
    onOrdenacaoPedidosChange?.(newOrder);
  };

  const allDocIds = sorted.map(p => p.documento);

  return (
    <div className="dashboard-section">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Pedidos Despacho Aprovado ({realPedidos.length})
        </h3>
      </div>

      <div className="flex gap-1.5 mb-3">
        {(['carteira', 'valor'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
              sortBy === s
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'carteira' ? '↕ Dias em Carteira' : '↕ Valor'}
          </button>
        ))}
      </div>

      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-center py-2 px-1 text-muted-foreground font-semibold w-[55px]">Class.</th>
              <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Pedido</th>
              <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Cliente</th>
              <th className="text-left py-2 px-1 text-muted-foreground font-semibold hidden md:table-cell w-[80px]">Cidade</th>
              <th className="text-left py-2 px-1 text-muted-foreground font-semibold w-[75px]">Emissão</th>
              <th className="text-right py-2 px-2 text-muted-foreground font-semibold">Valor</th>
              <th className="text-center py-2 px-2 text-muted-foreground font-semibold">Dias em Carteira</th>
              <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Status</th>
              <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Observação</th>
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={allDocIds} strategy={verticalListSortingStrategy}>
              <tbody>
                {sorted.map((p) => {
                  const dias = calcDiasAtraso(p.dataEmissao);
                  const obs = observacoes[p.documento] || '';
                  const cls = getClassification(classificacoes[p.documento] || '');
                  const isProximoMes = cls === 'p';
                  return (
                    <SortableRow
                      key={p.documento}
                      p={p}
                      dias={dias}
                      obs={obs}
                      isProximoMes={isProximoMes}
                      classificacoes={classificacoes}
                      onClassificacaoChange={onClassificacaoChange}
                      onObservacaoChange={onObservacaoChange}
                    />
                  );
                })}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>
    </div>
  );
}
