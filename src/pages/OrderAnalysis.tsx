import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Upload, FileSpreadsheet, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { 
  loadOrderAnalysisData, 
  saveOrderAnalysisData, 
  getPreviousSnapshot, 
  calculateDisappearedOrders,
  getDaysInMonth
} from '@/lib/order-analysis-store';
import { parseAllOrders } from '@/lib/excel-parser';
import { OrderAnalysisData, Pedido, OrderSnapshot } from '@/types/faturamento';
import { OrderComparisonTable } from '@/components/OrderComparisonTable';
import { formatCurrency } from '@/lib/dashboard-store';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const OrderAnalysis = () => {
  const [data, setData] = useState<OrderAnalysisData>(loadOrderAnalysisData);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceFileInputRef = useRef<HTMLInputElement>(null);
  const uploadDateRef = useRef<string>('');

  useEffect(() => {
    saveOrderAnalysisData(data);
  }, [data]);

  const handleDayClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    if (!data.snapshots[dateKey]) {
      uploadDateRef.current = dateKey;
      fileInputRef.current?.click();
    }
  };

  const handleUploadClick = (dateKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    uploadDateRef.current = dateKey;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const dateKey = uploadDateRef.current;
    if (!file || !dateKey) return;

    try {
      const buffer = await file.arrayBuffer();
      const orders = parseAllOrders(buffer);
      if (orders.length === 0) {
        toast.error('Nenhum pedido encontrado na planilha.');
        return;
      }

      setData(prev => ({
        ...prev,
        snapshots: {
          ...prev.snapshots,
          [dateKey]: {
            date: dateKey,
            orders,
            timestamp: Date.now(),
          }
        }
      }));
      setSelectedDate(dateKey);
      toast.success(`${orders.length} pedidos importados para ${dateKey}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar planilha.');
    }
    e.target.value = '';
  };

  const handleReferenceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const orders = parseAllOrders(buffer);
      if (orders.length === 0) {
        toast.error('Nenhum pedido encontrado na planilha mestre.');
        return;
      }

      setData(prev => ({
        ...prev,
        referenceSnapshot: {
          date: 'REFERENCIA',
          orders,
          timestamp: Date.now(),
        }
      }));
      toast.success(`${orders.length} pedidos importados como referência mestre.`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar planilha de referência.');
    }
    e.target.value = '';
  };

  const handleNoteChange = (doc: string, note: string) => {
    setData(prev => ({
      ...prev,
      exclusionNotes: { ...prev.exclusionNotes, [doc]: note }
    }));
  };

  const handleClearDay = (dateKey: string) => {
    if (confirm(`Limpar dados de ${dateKey}?`)) {
      setData(prev => {
        const newSnapshots = { ...prev.snapshots };
        delete newSnapshots[dateKey];
        return { ...prev, snapshots: newSnapshots };
      });
    }
  };

  // Logic for the selected day
  const currentSnapshot = data.snapshots[selectedDate];
  const previousSnapshot = data.referenceSnapshot || null;
  const disappearedOrders = currentSnapshot && previousSnapshot 
    ? calculateDisappearedOrders(currentSnapshot.orders, previousSnapshot.orders)
    : [];

  // Debug - Log volumes to console
  if (currentSnapshot && previousSnapshot) {
    console.log(`[Análise] Data: ${selectedDate}`);
    console.log(`[Análise] Pedidos Dia: ${currentSnapshot.orders.length}`);
    console.log(`[Análise] Pedidos Mestre: ${previousSnapshot.orders.length}`);
    console.log(`[Análise] Não encontrados no Mestre: ${disappearedOrders.length}`);
  }

  // Status counts for current snapshot
  const statusCounts = currentSnapshot?.orders.reduce((acc, p) => {
    acc[p.codStatus] = (acc[p.codStatus] || 0) + 1;
    return acc;
  }, {} as Record<number, number>) || {};

  // Calendar Logic
  const days = getDaysInMonth(currentMonth);
  const firstDay = days[0].getDay();
  const [year, month] = currentMonth.split('-').map(Number);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-[1600px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-lg font-bold text-foreground">Análise de Pedidos</h1>
              <p className="text-xs text-muted-foreground underline">Rastreamento Diário de Carteira</p>
            </div>
            <nav className="flex items-center gap-4 pl-6 border-l border-border">
              <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Faturamento</Link>
              <Link to="/orcamento" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Orçamentos</Link>
              <Link to="/analisedepedidos" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Análise</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {data.referenceSnapshot && (
              <div className="flex flex-col items-end mr-2 px-3 py-1 bg-primary/10 rounded-lg border border-primary/20">
                <span className="text-[9px] uppercase font-bold text-primary">Base Mestre</span>
                <span className="text-xs font-black text-primary">{data.referenceSnapshot.orders.length} pedidos</span>
              </div>
            )}
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analise-pedidos-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar
            </button>
            <button
              onClick={() => referenceFileInputRef.current?.click()}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${data.referenceSnapshot ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
            >
              <Upload className="w-3.5 h-3.5" />
              {data.referenceSnapshot ? 'Mestre Ativo' : 'Importar Mestre'}
            </button>
            <button
              onClick={() => {
                if (confirm('Limpar todos os snapshots de análise?')) {
                  setData({ snapshots: {}, exclusionNotes: {} });
                  toast.success('Dados limpos.');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar Tudo
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Calendar Sidebar */}
          <div className="lg:col-span-3 space-y-4">
            <div className="dashboard-section p-4">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => {
                  const d = new Date(year, month - 2, 1);
                  setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }} className="p-1 rounded hover:bg-secondary">
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <h3 className="text-sm font-semibold text-foreground">
                  {MONTH_NAMES[month - 1]} {year}
                </h3>
                <button onClick={() => {
                  const d = new Date(year, month, 1);
                  setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }} className="p-1 rounded hover:bg-secondary">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {WEEKDAYS.map(w => <div key={w} className="text-[10px] font-bold text-muted-foreground uppercase">{w}</div>)}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                {days.map(day => {
                  const key = day.toISOString().split('T')[0];
                  const hasSnapshot = !!data.snapshots[key];
                  const isSelected = selectedDate === key;
                  const isToday = key === new Date().toISOString().split('T')[0];

                  return (
                    <div
                      key={key}
                      onClick={() => handleDayClick(key)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (hasSnapshot) handleClearDay(key);
                      }}
                      className={`
                        p-1.5 rounded-lg border text-center cursor-pointer transition-all aspect-square flex flex-col items-center justify-center relative
                        ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-transparent hover:bg-muted/50'}
                        ${hasSnapshot ? 'bg-success/5 border-success/20' : ''}
                      `}
                    >
                      <span className={`text-xs font-medium ${isToday ? 'text-primary' : hasSnapshot ? 'text-success' : 'text-foreground'}`}>
                        {day.getDate()}
                      </span>
                      <button 
                        onClick={(e) => handleUploadClick(key, e)}
                        className={`mt-1 p-0.5 rounded-full hover:bg-primary/20 transition-colors ${hasSnapshot ? 'text-success' : 'text-muted-foreground/30'}`}
                      >
                        <Upload className="w-2.5 h-2.5" />
                      </button>
                      {hasSnapshot && (
                        <div className="absolute top-1 right-1 w-1 h-1 bg-success rounded-full" />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] text-muted-foreground mt-3 text-center italic">
                Clique no dia para visualizar | Ícone para upload <br /> Clique direito para limpar o dia
              </p>
            </div>

            {currentSnapshot && (
              <div className="dashboard-section p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase">Status em {selectedDate}</h4>
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {currentSnapshot.orders.length} itens
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(statusCounts).sort((a,b) => Number(a[0]) - Number(b[0])).map(([status, count]) => (
                    <div key={status} className="bg-muted/50 p-2 rounded-lg text-center">
                      <div className="text-[10px] font-bold text-muted-foreground">STATUS {status}</div>
                      <div className="text-sm font-bold text-foreground">{count}</div>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-border">
                  <div className="text-[10px] font-bold text-muted-foreground">TOTAL DO DIA</div>
                  <div className="text-lg font-black text-primary">
                    {formatCurrency(currentSnapshot.orders.reduce((sum, p) => sum + p.valor, 0))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-9">
            {currentSnapshot ? (
              <OrderComparisonTable 
                orders={currentSnapshot.orders}
                disappearedOrders={disappearedOrders}
                exclusionNotes={data.exclusionNotes}
                onNoteChange={handleNoteChange}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center dashboard-section p-12 text-center opacity-60">
                <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold text-foreground">Nenhum dado para {selectedDate}</h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
                  Clique no ícone de upload no calendário para importar a planilha de pedidos deste dia.
                </p>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Importar Planilha
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <input
        ref={referenceFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleReferenceFileChange}
      />
    </div>
  );
};

export default OrderAnalysis;
