// Brazilian national holidays
const FIXED_HOLIDAYS: Array<[number, number]> = [
  [1, 1],   // Confraternização Universal
  [4, 21],  // Tiradentes
  [5, 1],   // Dia do Trabalho
  [9, 7],   // Independência
  [10, 12], // Nossa Senhora Aparecida
  [11, 2],  // Finados
  [11, 15], // Proclamação da República
  [11, 20], // Consciência Negra
  [12, 25], // Natal
];

// Easter-based moveable holidays (pre-calculated for relevant years)
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getHolidaysForYear(year: number): Set<string> {
  const holidays = new Set<string>();

  // Fixed holidays
  for (const [m, d] of FIXED_HOLIDAYS) {
    holidays.add(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  // Easter-based
  const easter = getEasterDate(year);
  const addDays = (date: Date, days: number): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const carnaval = addDays(easter, -47); // Carnaval (Tuesday)
  const sextaSanta = addDays(easter, -2); // Good Friday
  const corpusChristi = addDays(easter, 60);

  for (const d of [carnaval, sextaSanta, corpusChristi]) {
    holidays.add(d.toISOString().split('T')[0]);
  }

  return holidays;
}

export function isHoliday(date: Date): boolean {
  const key = date.toISOString().split('T')[0];
  return getHolidaysForYear(date.getFullYear()).has(key);
}

export function isBusinessDay(date: Date): boolean {
  const dow = date.getDay();
  return dow !== 0 && dow !== 6 && !isHoliday(date);
}

export function getBusinessDaysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  let count = 0;
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    if (isBusinessDay(date)) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
}

export function getRemainingBusinessDays(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    if (date > today && isBusinessDay(date)) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
}
