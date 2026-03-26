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

// Orçamento types
export interface Orcamento {
  documento: string;
  cliente: string;
  cidade: string;
  dataEmissao: string;
  dataCalendario?: string; // DD/MM/YYYY - date for calendar display (upload day)
  valor: number;
  codStatus: number;
  status: string;
  isDailyReport?: boolean; // true for synthetic daily report entries
  virou_pedido?: string; // número do pedido if converted, undefined if not
}

export interface OrcamentoDia {
  data: string; // YYYY-MM-DD
  valor: number;
  orcamentos: string[]; // documento IDs
  virou_pedido: number; // count of orcamentos that became pedidos
}

export interface OrcamentoData {
  mes: string; // YYYY-MM
  orcamentos: Orcamento[];
  orcamentoDiario: OrcamentoDia[];
  observacoes?: Record<string, string>;
  ordenacaoOrcamentos?: string[]; // custom order for all orcamentos (documento IDs)
}
