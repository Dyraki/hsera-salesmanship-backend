import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { ITargetRepository } from '../../../domain/repositories/ITargetRepository';
import { prisma } from '../../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';
import {
  getQuarterWeekRange,
  getQuarterFromWeek,
} from '../../../infrastructure/utils/quarterUtils';
import {
  getIsoWeekInfo,
  getDateRangeForKodeMinggu,
  formatDateOnly,
} from '../../../infrastructure/utils/dateIsoUtils';
import { Target, JenisTarget } from '../../../domain/entities/Target';

export interface KpiTrackingReportInput {
  year?: number;
  quarter?: number;
  cycleType?: 'ALL' | 'EVEN' | 'ODD';
  selectedWeek?: number | 'all';
  ouKode?: string;
  ouKodeIn?: string[];
  districtId?: string;
  statusRekap?: string;
  token?: string;
}

export interface KpiParameterMetric {
  target: number;
  realisasi: number;
  achievementPercent: number;
  gap: number;
  status: 'ACHIEVED' | 'ON_TRACK' | 'UNDER_TARGET' | 'CRITICAL';
}

export interface KpiWeeklyDataPoint {
  kodeMinggu: number;
  weekNumber: number;
  weekLabel: string;
  cycle: 'EVEN' | 'ODD';
  isCurrent: boolean;
  isSelected: boolean;
  startDate: string;
  endDate: string;
  kunjungan: KpiParameterMetric;
  ec: KpiParameterMetric;
  bd: KpiParameterMetric;
  volume: KpiParameterMetric;
  volumeKarton: KpiParameterMetric;
}

export interface KpiSummaryMetric {
  target: number;
  realisasi: number;
  achievementPercent: number;
  gap: number;
  status: 'ACHIEVED' | 'ON_TRACK' | 'UNDER_TARGET' | 'CRITICAL';
  weeklyAverageReal: number;
  weeklyAverageTarget: number;
  bestWeek: { weekNumber: number; achievement: number };
  worstWeek: { weekNumber: number; achievement: number };
}

export interface KpiTrackingReportResponse {
  header: {
    year: number;
    quarter: number;
    cycleType: 'ALL' | 'EVEN' | 'ODD';
    selectedWeek: number | 'all';
    ouKode?: string;
    districtId?: string;
    districtKode?: string;
    totalWeeksInQuarter: number;
    filteredWeeksCount: number;
    activeDistrictsCount: number;
  };
  summary: {
    kunjungan: KpiSummaryMetric;
    ec: KpiSummaryMetric;
    bd: KpiSummaryMetric;
    volume: KpiSummaryMetric;
  };
  weeks: KpiWeeklyDataPoint[];
}

function resolveDailyTarget(
  allTargets: Target[],
  districtId: string,
  ouKode: string,
  jenisTarget: JenisTarget,
  date: Date,
  hariKunjungan: number
): number | null {
  const matched = allTargets.filter((t) => {
    if (t.jenisTarget !== jenisTarget) return false;
    if (!t.isActive()) return false;

    const targetDari = new Date(t.berlakuDari);
    if (targetDari > date) return false;
    if (t.berlakuSampai) {
      const targetSampai = new Date(t.berlakuSampai);
      if (targetSampai < date) return false;
    }

    const isDistrict = t.districtId === districtId;
    const isOu = !t.districtId && t.ouKode === ouKode;
    const isGlobal = !t.districtId && !t.ouKode;
    if (!isDistrict && !isOu && !isGlobal) return false;

    if (hariKunjungan >= 1 && hariKunjungan <= 5) {
      if (
        t.hariKunjungan !== null &&
        t.hariKunjungan !== undefined &&
        t.hariKunjungan !== 7 &&
        t.hariKunjungan !== hariKunjungan
      ) {
        return false;
      }
    } else if (hariKunjungan === 6) {
      if (t.hariKunjungan !== null && t.hariKunjungan !== undefined && t.hariKunjungan !== 6) {
        return false;
      }
    }
    return true;
  });

  if (matched.length === 0) return null;

  const getRank = (t: Target) => {
    let scopeRank = 1;
    if (t.districtId === districtId) scopeRank = 3;
    else if (t.ouKode === ouKode) scopeRank = 2;

    let dayRank = 1;
    if (t.hariKunjungan === hariKunjungan) dayRank = 3;
    else if (t.hariKunjungan === 7 && hariKunjungan >= 1 && hariKunjungan <= 5) dayRank = 2;

    return scopeRank * 10 + dayRank;
  };

  matched.sort((a, b) => getRank(b) - getRank(a));
  return matched[0].nilai;
}

function calculateMetric(realisasi: number, target: number): KpiParameterMetric {
  const achievementPercent = target > 0 ? Math.round((realisasi / target) * 1000) / 10 : 0;
  const gap = realisasi - target;
  let status: 'ACHIEVED' | 'ON_TRACK' | 'UNDER_TARGET' | 'CRITICAL' = 'ON_TRACK';

  if (achievementPercent >= 100) status = 'ACHIEVED';
  else if (achievementPercent >= 85) status = 'ON_TRACK';
  else if (achievementPercent >= 70) status = 'UNDER_TARGET';
  else status = 'CRITICAL';

  return {
    target: Math.round(target * 10) / 10,
    realisasi: Math.round(realisasi * 10) / 10,
    achievementPercent,
    gap: Math.round(gap * 10) / 10,
    status,
  };
}

function buildSummaryMetric(
  totalReal: number,
  totalTarget: number,
  weekItems: Array<{ weekNumber: number; real: number; target: number }>
): KpiSummaryMetric {
  const base = calculateMetric(totalReal, totalTarget);
  const weekCount = Math.max(1, weekItems.length);
  const weeklyAverageReal = Math.round((totalReal / weekCount) * 10) / 10;
  const weeklyAverageTarget = Math.round((totalTarget / weekCount) * 10) / 10;

  let bestWeek = { weekNumber: 0, achievement: -Infinity };
  let worstWeek = { weekNumber: 0, achievement: Infinity };

  weekItems.forEach((w) => {
    const ach = w.target > 0 ? Math.round((w.real / w.target) * 1000) / 10 : 0;
    if (ach > bestWeek.achievement) {
      bestWeek = { weekNumber: w.weekNumber, achievement: ach };
    }
    if (ach < worstWeek.achievement) {
      worstWeek = { weekNumber: w.weekNumber, achievement: ach };
    }
  });

  if (bestWeek.achievement === -Infinity) bestWeek = { weekNumber: 0, achievement: 0 };
  if (worstWeek.achievement === Infinity) worstWeek = { weekNumber: 0, achievement: 0 };

  return {
    ...base,
    weeklyAverageReal,
    weeklyAverageTarget,
    bestWeek,
    worstWeek,
  };
}

export class GetKpiTrackingReportUseCase {
  constructor(
    private readonly districtRepo: IDistrictRepository,
    private readonly targetRepo: ITargetRepository
  ) {}

  async execute(input: KpiTrackingReportInput): Promise<KpiTrackingReportResponse> {
    const today = new Date();
    const currentIso = getIsoWeekInfo(today);

    const year = input.year || currentIso.isoYear;
    const quarter = input.quarter || getQuarterFromWeek(currentIso.isoWeek);
    const quarterRange = getQuarterWeekRange(year, quarter);

    const cycleType = input.cycleType || 'ALL';

    // Filter weeks by cycle
    const filteredWeekNumbers = quarterRange.weekList.filter((km) => {
      const wNum = km % 100;
      if (cycleType === 'EVEN') return wNum % 2 === 0;
      if (cycleType === 'ODD') return wNum % 2 !== 0;
      return true; // ALL
    });

    // 1. Fetch Targeted Districts
    let targetDistricts = await this.districtRepo.findAll({
      ouKode: input.ouKode && input.ouKode !== 'all' ? input.ouKode : undefined,
      ouKodeIn: input.ouKodeIn && input.ouKodeIn.length > 0 ? input.ouKodeIn : undefined,
      status: 'AKTIF',
    });

    let selectedDistrictKode: string | undefined;
    if (input.districtId && input.districtId !== 'all') {
      const specific = targetDistricts.find((d) => d.id === input.districtId);
      if (specific) {
        targetDistricts = [specific];
        selectedDistrictKode = specific.kode;
      }
    }

    // 2. Load Active Targets for Resolution
    const allActiveTargets = await this.targetRepo.findAll({ status: 'AKTIF' });

    // 3. Query PostgreSQL Realisasi Aggregated per Week
    const conditions: Prisma.Sql[] = [
      Prisma.sql`r.status = 'AKTIF'`,
      Prisma.sql`r.kode_minggu IN (${Prisma.join(quarterRange.weekList)})`,
    ];

    if (input.districtId && input.districtId !== 'all') {
      conditions.push(Prisma.sql`r.district_id = ${input.districtId}::uuid`);
    } else if (input.ouKode && input.ouKode !== 'all') {
      conditions.push(Prisma.sql`r.ou_kode = ${input.ouKode}`);
    } else if (input.ouKodeIn && input.ouKodeIn.length > 0) {
      conditions.push(Prisma.sql`r.ou_kode IN (${Prisma.join(input.ouKodeIn)})`);
    }

    if (input.statusRekap) {
      conditions.push(Prisma.sql`r.status_rekap = ${input.statusRekap}`);
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    interface WeekAggRow {
      kode_minggu: number;
      actual_call: number;
      actual_ec: number;
      actual_bd: number;
      actual_volume: number;
    }

    const rawAggs = await prisma.$queryRaw<WeekAggRow[]>`
      SELECT
        r.kode_minggu,
        COALESCE(SUM(r.jumlah_kunjungan), 0)::int as actual_call,
        COALESCE(SUM(r.total_ec), 0)::int as actual_ec,
        COALESCE(SUM(r.bd_outlet), 0)::int as actual_bd,
        COALESCE(SUM(r.total_volume), 0)::float as actual_volume
      FROM trx_rekap_harian r
      ${whereClause}
      GROUP BY r.kode_minggu;
    `;

    const realMap = new Map<number, WeekAggRow>();
    rawAggs.forEach((r) => realMap.set(r.kode_minggu, r));

    // 4. Calculate Weekly Data Points & Targets
    let grandRealKunjungan = 0;
    let grandTargetKunjungan = 0;
    let grandRealEc = 0;
    let grandTargetEc = 0;
    let grandRealBd = 0;
    let grandTargetBd = 0;
    let grandRealVol = 0;
    let grandTargetVol = 0;

    const kunjunganWeeks: Array<{ weekNumber: number; real: number; target: number }> = [];
    const ecWeeks: Array<{ weekNumber: number; real: number; target: number }> = [];
    const bdWeeks: Array<{ weekNumber: number; real: number; target: number }> = [];
    const volWeeks: Array<{ weekNumber: number; real: number; target: number }> = [];

    const selectedWeekVal = input.selectedWeek || 'all';

    const weeks: KpiWeeklyDataPoint[] = filteredWeekNumbers.map((km) => {
      const wNum = km % 100;
      const dateRange = getDateRangeForKodeMinggu(km);

      // Bottom-up target calculation across workdays (Senin-Sabtu) for included districts
      let weekTargetCall = 0;
      let weekTargetEc = 0;
      let weekTargetBd = 0;
      let weekTargetVol = 0;

      for (const day of dateRange.days) {
        const dayDate = new Date(day.date);
        for (const dist of targetDistricts) {
          const tCall = resolveDailyTarget(allActiveTargets, dist.id, dist.ouKode, 'KUNJUNGAN', dayDate, day.hari) ?? 40;
          const tEc = resolveDailyTarget(allActiveTargets, dist.id, dist.ouKode, 'EC', dayDate, day.hari) ?? Math.round(tCall * 0.75);
          const tBd = resolveDailyTarget(allActiveTargets, dist.id, dist.ouKode, 'BD', dayDate, day.hari) ?? Math.round(tCall * 0.5);
          const tVol = resolveDailyTarget(allActiveTargets, dist.id, dist.ouKode, 'VOLUME', dayDate, day.hari) ?? 700;

          weekTargetCall += tCall;
          weekTargetEc += tEc;
          weekTargetBd += tBd;
          weekTargetVol += tVol;
        }
      }

      const real = realMap.get(km) || {
        kode_minggu: km,
        actual_call: 0,
        actual_ec: 0,
        actual_bd: 0,
        actual_volume: 0,
      };

      const kunjMetric = calculateMetric(real.actual_call, weekTargetCall);
      const ecMetric = calculateMetric(real.actual_ec, weekTargetEc);
      const bdMetric = calculateMetric(real.actual_bd, weekTargetBd);
      const volMetric = calculateMetric(real.actual_volume, weekTargetVol);
      const volKartonMetric = calculateMetric(real.actual_volume / 800, weekTargetVol / 800);

      // Akumulasi grand totals
      grandRealKunjungan += real.actual_call;
      grandTargetKunjungan += weekTargetCall;
      grandRealEc += real.actual_ec;
      grandTargetEc += weekTargetEc;
      grandRealBd += real.actual_bd;
      grandTargetBd += weekTargetBd;
      grandRealVol += real.actual_volume;
      grandTargetVol += weekTargetVol;

      kunjunganWeeks.push({ weekNumber: wNum, real: real.actual_call, target: weekTargetCall });
      ecWeeks.push({ weekNumber: wNum, real: real.actual_ec, target: weekTargetEc });
      bdWeeks.push({ weekNumber: wNum, real: real.actual_bd, target: weekTargetBd });
      volWeeks.push({ weekNumber: wNum, real: real.actual_volume, target: weekTargetVol });

      const isSelected = selectedWeekVal === 'all' || selectedWeekVal === km || selectedWeekVal === wNum;

      return {
        kodeMinggu: km,
        weekNumber: wNum,
        weekLabel: `W${String(wNum).padStart(2, '0')}`,
        cycle: wNum % 2 === 0 ? 'EVEN' : 'ODD',
        isCurrent: km === currentIso.kodeMinggu,
        isSelected,
        startDate: formatDateOnly(dateRange.startDate),
        endDate: formatDateOnly(dateRange.endDate),
        kunjungan: kunjMetric,
        ec: ecMetric,
        bd: bdMetric,
        volume: volMetric,
        volumeKarton: volKartonMetric,
      };
    });

    // 5. Build Summary Metrics
    const summary = {
      kunjungan: buildSummaryMetric(grandRealKunjungan, grandTargetKunjungan, kunjunganWeeks),
      ec: buildSummaryMetric(grandRealEc, grandTargetEc, ecWeeks),
      bd: buildSummaryMetric(grandRealBd, grandTargetBd, bdWeeks),
      volume: buildSummaryMetric(grandRealVol, grandTargetVol, volWeeks),
    };

    return {
      header: {
        year,
        quarter,
        cycleType,
        selectedWeek: selectedWeekVal,
        ouKode: input.ouKode,
        districtId: input.districtId,
        districtKode: selectedDistrictKode,
        totalWeeksInQuarter: quarterRange.weekList.length,
        filteredWeeksCount: filteredWeekNumbers.length,
        activeDistrictsCount: targetDistricts.length,
      },
      summary,
      weeks,
    };
  }
}
