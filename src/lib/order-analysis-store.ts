import { OrderAnalysisData, OrderSnapshot, Pedido } from '@/types/faturamento';

const STORAGE_KEY = 'order-analysis-data';

export function loadOrderAnalysisData(): OrderAnalysisData {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return { snapshots: {}, exclusionNotes: {} };
  }
  try {
    return JSON.parse(saved);
  } catch (e) {
    console.error('Error loading order analysis data:', e);
    return { snapshots: {}, exclusionNotes: {} };
  }
}

export function saveOrderAnalysisData(data: OrderAnalysisData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getPreviousSnapshot(snapshots: Record<string, OrderSnapshot>, currentDate: string): OrderSnapshot | null {
  const dates = Object.keys(snapshots).sort();
  const currentIndex = dates.indexOf(currentDate);
  if (currentIndex <= 0) return null;
  return snapshots[dates[currentIndex - 1]];
}

export function normalizeDocId(doc: string): string {
  if (!doc) return '';
  // Remove leading zeros, non-alphanumeric characters, and trim/lowercase
  return String(doc)
    .trim()
    .toLowerCase()
    .replace(/^0+/, '')               // Remove leading zeros
    .replace(/[^a-z0-9]/g, '');       // Remove anything that isn't a letter or number
}

export function calculateDisappearedOrders(dayOrders: Pedido[], masterOrders: Pedido[]): Pedido[] {
  const masterDocs = new Set(masterOrders.map(p => normalizeDocId(p.documento)));
  return dayOrders.filter(p => !masterDocs.has(normalizeDocId(p.documento)) && !p.documento.startsWith('OR'));
}

export function getDaysInMonth(yearMonth: string): Date[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const days: Date[] = [];
  while (date.getMonth() === month - 1) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}
