/**
 * Utility functions for ISO 8601 Quarter and Week mapping.
 * Total 52 weeks in 1 year are divided into 4 quarters of 13 weeks each:
 * - Q1: Weeks 1 - 13
 * - Q2: Weeks 14 - 26
 * - Q3: Weeks 27 - 39
 * - Q4: Weeks 40 - 52 (or 53)
 */

export interface QuarterWeekRange {
  year: number;
  quarter: number;
  startWeek: number;
  endWeek: number;
  startKodeMinggu: number; // e.g. 202640
  endKodeMinggu: number;   // e.g. 202652
  weekList: number[];      // Array of kodeMinggu integers
}

export interface QuarterOption {
  year: number;
  quarter: number;
  label: string;           // e.g. "Kuartal Q4 2026 (W40 - W52)"
  startKodeMinggu: number;
  endKodeMinggu: number;
}

/**
 * Returns the quarter (1..4) for a given ISO week number (1..53)
 */
export function getQuarterFromWeek(weekNumber: number): number {
  if (weekNumber <= 13) return 1;
  if (weekNumber <= 26) return 2;
  if (weekNumber <= 39) return 3;
  return 4;
}

/**
 * Returns week range and week list for a given year and quarter (1..4)
 */
export function getQuarterWeekRange(year: number, quarter: number): QuarterWeekRange {
  const safeQuarter = Math.max(1, Math.min(4, Math.floor(quarter)));
  
  let startWeek = 1;
  let endWeek = 13;

  switch (safeQuarter) {
    case 1:
      startWeek = 1;
      endWeek = 13;
      break;
    case 2:
      startWeek = 14;
      endWeek = 26;
      break;
    case 3:
      startWeek = 27;
      endWeek = 39;
      break;
    case 4:
      startWeek = 40;
      endWeek = 52;
      break;
  }

  const weekList: number[] = [];
  for (let w = startWeek; w <= endWeek; w++) {
    weekList.push(year * 100 + w);
  }

  return {
    year,
    quarter: safeQuarter,
    startWeek,
    endWeek,
    startKodeMinggu: year * 100 + startWeek,
    endKodeMinggu: year * 100 + endWeek,
    weekList,
  };
}

/**
 * Returns a list of available quarter options for dropdowns
 */
export function getAvailableQuarters(currentYear: number = 2026): QuarterOption[] {
  const options: QuarterOption[] = [];
  const years = [currentYear, currentYear - 1];

  for (const yr of years) {
    for (let q = 4; q >= 1; q--) {
      const range = getQuarterWeekRange(yr, q);
      const startWw = String(range.startWeek).padStart(2, '0');
      const endWw = String(range.endWeek).padStart(2, '0');
      options.push({
        year: yr,
        quarter: q,
        label: `Kuartal Q${q} ${yr} (W${startWw} - W${endWw})`,
        startKodeMinggu: range.startKodeMinggu,
        endKodeMinggu: range.endKodeMinggu,
      });
    }
  }

  return options;
}
