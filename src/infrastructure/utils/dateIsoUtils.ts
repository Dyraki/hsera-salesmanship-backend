/**
 * Helper utilities for ISO 8601 week calculation, day of week, and workdays (Senin-Sabtu)
 */

export interface WeekInfo {
  isoYear: number;
  isoWeek: number;
  kodeMinggu: number; // e.g. 202641
  kodeMingguDisplay: string; // e.g. "2641"
  hariKunjungan: number; // 1 (Senin) .. 7 (Minggu)
  isWorkday: boolean; // 1..6 = true, 7 = false
  namaHari: string;
}

export const NAMA_HARI = [
  '',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];

/**
 * Returns ISO week info for a given Date
 */
export function getIsoWeekInfo(dateInput: Date | string): WeekInfo {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput.getTime());
  
  // Set to midnight UTC
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  
  // ISO day: 1 = Monday, ..., 7 = Sunday
  const dayNr = (target.getUTCDay() + 6) % 7 + 1;
  
  // Set to Thursday in current week to decide ISO year
  target.setUTCDate(target.getUTCDate() - dayNr + 4);
  const isoYear = target.getUTCFullYear();
  
  // First day of that year
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  
  const weekDiff = Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
  const isoWeek = 1 + weekDiff;
  
  const kodeMinggu = isoYear * 100 + isoWeek;
  const yy = String(isoYear).slice(-2);
  const ww = String(isoWeek).padStart(2, '0');
  const kodeMingguDisplay = `${yy}${ww}`;
  
  return {
    isoYear,
    isoWeek,
    kodeMinggu,
    kodeMingguDisplay,
    hariKunjungan: dayNr,
    isWorkday: dayNr >= 1 && dayNr <= 6,
    namaHari: NAMA_HARI[dayNr] || '',
  };
}

/**
 * Returns Monday (start) and Saturday/Sunday dates for a given kodeMinggu (YYYYWW)
 */
export function getDateRangeForKodeMinggu(kodeMinggu: number): {
  startDate: Date; // Monday
  endDate: Date; // Saturday
  fullEndDate: Date; // Sunday
  days: { hari: number; namaHari: string; date: string }[];
} {
  const isoYear = Math.floor(kodeMinggu / 100);
  const isoWeek = kodeMinggu % 100;
  
  // Jan 4th is always in week 1
  const simple = new Date(Date.UTC(isoYear, 0, 4));
  const day = (simple.getUTCDay() + 6) % 7; // Monday = 0
  const mondayWeek1 = new Date(simple.getTime());
  mondayWeek1.setUTCDate(simple.getUTCDate() - day);
  
  const monday = new Date(mondayWeek1.getTime());
  monday.setUTCDate(mondayWeek1.getUTCDate() + (isoWeek - 1) * 7);
  
  const saturday = new Date(monday.getTime());
  saturday.setUTCDate(monday.getUTCDate() + 5);
  
  const sunday = new Date(monday.getTime());
  sunday.setUTCDate(monday.getUTCDate() + 6);
  
  const days: { hari: number; namaHari: string; date: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const cur = new Date(monday.getTime());
    cur.setUTCDate(monday.getUTCDate() + i);
    const dateStr = cur.toISOString().split('T')[0];
    days.push({
      hari: i + 1,
      namaHari: NAMA_HARI[i + 1],
      date: dateStr,
    });
  }
  
  return {
    startDate: monday,
    endDate: saturday,
    fullEndDate: sunday,
    days,
  };
}

/**
 * Format Date to YYYY-MM-DD string
 */
export function formatDateOnly(date: Date): string {
  return date.toISOString().split('T')[0];
}
