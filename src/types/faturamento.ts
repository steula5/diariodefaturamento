export interface Pedido {
  documento: string;
  cliente: string;
  cidade: string;
  dataEmissao: string;
  dataCalendario?: string; // DD/MM/YYYY - date for calendar display (upload day)
  valor: number;
  codStatus: number;
  status: string;
  isDailyReport?: boolean; // true for synthetic daily report entries
}

export interface FaturamentoDia {
  data: string; // YYYY-MM-DD
  valor: number;
  pedidos: string[]; // documento IDs
}

export type ReportPeriod = 'manha' | 'tarde';

export interface DashboardData {
  mes: string; // YYYY-MM
  meta: number;
  pedidos: Pedido[];
  faturamentoDiario: FaturamentoDia[];
  periodoRelatorio?: ReportPeriod;
  observacoes?: Record<string, string>;
  classificacoes?: Record<string, string>; // 'a' = aprovado mês atual, 'p' = próximo mês
  ordenacaoPedidos?: string[]; // custom order for all pedidos (documento IDs)
}
