/**
 * Parses observation text for patterns like "faturamento em DD/MM" or "faturamento em DD/MM/YYYY"
 * Returns the month/year if found, or null.
 */
export function parseFaturamentoFuturo(obs: string): { month: number; year: number } | null {
  if (!obs) return null;
  // Match patterns: "faturamento em DD/MM", "faturamento em DD/MM/YY", "faturamento em DD/MM/YYYY"
  const match = obs.match(/faturamento\s+em\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i);
  if (!match) return null;
  const m = parseInt(match[2], 10);
  let y = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
  if (y < 100) y += 2000;
  return { month: m, year: y };
}

/**
 * Checks if a pedido's faturamento is scheduled for a future month
 */
export function isFaturamentoFuturo(obs: string, currentYearMonth: string): boolean {
  const parsed = parseFaturamentoFuturo(obs);
  if (!parsed) return false;
  const [currentYear, currentMonth] = currentYearMonth.split('-').map(Number);
  return parsed.year > currentYear || (parsed.year === currentYear && parsed.month > currentMonth);
}

/**
 * Checks if obs indicates "à definir" (undefined date)
 */
export function isFaturamentoIndefinido(obs: string): boolean {
  if (!obs) return false;
  return /(?:à|a)\s+definir/i.test(obs);
}
