import { IBrandRepository } from '../../../domain/repositories/IBrandRepository';
import { ITargetRepository } from '../../../domain/repositories/ITargetRepository';
import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { getQuarterWeekRange, getQuarterFromWeek } from '../../../infrastructure/utils/quarterUtils';
import { getIsoWeekInfo, getDateRangeForKodeMinggu, formatDateOnly } from '../../../infrastructure/utils/dateIsoUtils';
import { prisma } from '../../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';

export interface SkuSalesReportInput {
  year?: number;
  quarter?: number;
  cycleType?: 'EVEN' | 'ODD' | 'ALL';
  ouKode?: string;
  ouKodeIn?: string[];
  districtId?: string;
  statusRekap?: string;
  token?: string;
}

export interface SkuSalesWeekColumn {
  kodeMinggu: number;
  weekNumber: number;
  weekLabel: string;
  cycle: 'EVEN' | 'ODD';
  isCurrent: boolean;
  startDate: string;
  endDate: string;
}

export interface SkuSalesRow {
  brandId: string;
  kode: string;
  nama: string;
  urutan: number;
  volumesByWeek: Record<number, number>;
  totalQuarter: number;
  avgWeekly: number;
  avgDaily: number;
  wtdCurrentVolume: number;
  wtdPrevVolume: number;
  growthWtdPercent: number | null;
  deltaPack: number;
}

export interface SkuSalesKpiSummary {
  kunjungan: {
    actual: number;
    target: number;
    achievementPercent: number;
  };
  penjualanWtd: {
    currentWeekNumber: number;
    currentVolume: number;
    cutOffDay: number;
    cutOffDayName: string;
  };
  growthWtd: {
    prevWeekNumber: number;
    prevVolume: number;
    deltaPack: number;
    percent: number | null;
    isPositive: boolean;
  };
  productivity: {
    dropSize: number;
    totalCalls: number;
    totalVolume: number;
  };
  quarterOverview: {
    totalQuarterVolume: number;
    avgVolumePerWeek: number;
    activeSkuCount: number;
  };
}

export interface SkuSalesQuarterChartPoint {
  kodeMinggu: number;
  weekLabel: string;
  weekNumber: number;
  cycle: 'EVEN' | 'ODD';
  isCurrent: boolean;
  isPast: boolean;
  totalVolume: number;
  totalCalls: number;
  targetCalls: number;
}

export interface SkuSalesReportResponse {
  header: {
    year: number;
    quarter: number;
    cycleType: 'EVEN' | 'ODD' | 'ALL';
    ouKode?: string;
    districtId?: string;
    districtKode?: string;
    cutOffDay: number;
    cutOffDayName: string;
    currentWeekNumber: number;
    prevCycleWeekNumber: number;
  };
  weeks: SkuSalesWeekColumn[];
  kpiSummary: SkuSalesKpiSummary;
  chartTrend: SkuSalesQuarterChartPoint[];
  skuRows: SkuSalesRow[];
  summaryRow: {
    totalByWeek: Record<number, number>;
    grandTotalQuarter: number;
    grandAvgWeekly: number;
    grandAvgDaily: number;
    grandWtdCurrent: number;
    grandWtdPrev: number;
    grandGrowthWtdPercent: number | null;
    grandDeltaPack: number;
  };
}

const HARI_NAMES: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

export class GetSkuSalesReportUseCase {
  constructor(
    _unusedRekapRepo: any,
    private readonly brandRepo: IBrandRepository,
    private readonly districtRepo: IDistrictRepository,
    private readonly targetRepo: ITargetRepository
  ) {}

  async execute(input: SkuSalesReportInput): Promise<SkuSalesReportResponse> {
    const today = new Date();
    const currentIso = getIsoWeekInfo(today);

    const year = input.year || currentIso.isoYear;
    const quarter = input.quarter || getQuarterFromWeek(currentIso.isoWeek);
    const quarterRange = getQuarterWeekRange(year, quarter);

    // Default cycle type: if current week in quarter is even -> EVEN, else ODD
    let cycleType = input.cycleType;
    if (!cycleType) {
      cycleType = currentIso.isoWeek % 2 === 0 ? 'EVEN' : 'ODD';
    }

    // Filter weekList based on cycleType
    const filteredWeekNumbers = quarterRange.weekList.filter((km) => {
      const wNum = km % 100;
      if (cycleType === 'EVEN') return wNum % 2 === 0;
      if (cycleType === 'ODD') return wNum % 2 !== 0;
      return true; // ALL
    });

    const weeks: SkuSalesWeekColumn[] = filteredWeekNumbers.map((km) => {
      const wNum = km % 100;
      const range = getDateRangeForKodeMinggu(km);
      return {
        kodeMinggu: km,
        weekNumber: wNum,
        weekLabel: `W${String(wNum).padStart(2, '0')}`,
        cycle: wNum % 2 === 0 ? 'EVEN' : 'ODD',
        isCurrent: km === currentIso.kodeMinggu,
        startDate: formatDateOnly(range.startDate),
        endDate: formatDateOnly(range.endDate),
      };
    });

    // Determine currentWeek and prevCycleWeek
    let currentWeekNumber = currentIso.isoWeek;
    let currentKodeMinggu = currentIso.kodeMinggu;

    const isCurrentInQuarter = filteredWeekNumbers.includes(currentKodeMinggu);
    if (!isCurrentInQuarter) {
      currentKodeMinggu = filteredWeekNumbers[filteredWeekNumbers.length - 1] || quarterRange.endKodeMinggu;
      currentWeekNumber = currentKodeMinggu % 100;
    }

    // Find previous cycle week in filtered list
    const currentWeekIdx = filteredWeekNumbers.indexOf(currentKodeMinggu);
    const prevKodeMinggu = currentWeekIdx > 0 ? filteredWeekNumbers[currentWeekIdx - 1] : null;
    const prevCycleWeekNumber = prevKodeMinggu ? prevKodeMinggu % 100 : 0;

    // Determine Cut-off day (1..6)
    let cutOffDay = 6;
    if (currentKodeMinggu === currentIso.kodeMinggu) {
      cutOffDay = Math.min(6, Math.max(1, currentIso.hariKunjungan));
    }
    const cutOffDayName = `${HARI_NAMES[cutOffDay] || 'Sabtu'} (Hari ke-${cutOffDay})`;

    // Build SQL conditions for instant PostgreSQL aggregation
    const conditions: Prisma.Sql[] = [
      Prisma.sql`notasi.kode = 'BUY'`,
      Prisma.sql`r.status = 'AKTIF'`,
      Prisma.sql`r.kode_minggu IN (${Prisma.join(quarterRange.weekList)})`,
    ];

    const callConditions: Prisma.Sql[] = [
      Prisma.sql`r.status = 'AKTIF'`,
      Prisma.sql`r.kode_minggu IN (${Prisma.join(quarterRange.weekList)})`,
    ];

    if (input.districtId) {
      conditions.push(Prisma.sql`r.district_id = ${input.districtId}::uuid`);
      callConditions.push(Prisma.sql`r.district_id = ${input.districtId}::uuid`);
    } else if (input.ouKode && input.ouKode !== 'all') {
      conditions.push(Prisma.sql`r.ou_kode = ${input.ouKode}`);
      callConditions.push(Prisma.sql`r.ou_kode = ${input.ouKode}`);
    } else if (input.ouKodeIn && input.ouKodeIn.length > 0) {
      conditions.push(Prisma.sql`r.ou_kode IN (${Prisma.join(input.ouKodeIn)})`);
      callConditions.push(Prisma.sql`r.ou_kode IN (${Prisma.join(input.ouKodeIn)})`);
    }

    if (input.statusRekap) {
      conditions.push(Prisma.sql`r.status_rekap = ${input.statusRekap}`);
      callConditions.push(Prisma.sql`r.status_rekap = ${input.statusRekap}`);
    }

    const whereSql = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
    const callWhereSql = Prisma.sql`WHERE ${Prisma.join(callConditions, ' AND ')}`;

    // Parallel fetch: Brands, District info, Active Targets, and fast SQL aggregations
    const [allBrands, allTargets, districtItem, skuAggRows, callAggRows] = await Promise.all([
      this.brandRepo.findAll({ status: 'AKTIF' }),
      this.targetRepo.findAll({ jenisTarget: 'KUNJUNGAN', status: 'AKTIF' }),
      input.districtId ? this.districtRepo.findById(input.districtId) : Promise.resolve(null),
      prisma.$queryRaw<
        Array<{
          kodeMinggu: number;
          brandId: string;
          totalVolume: number;
          wtdVolume: number;
        }>
      >(Prisma.sql`
        SELECT 
          r.kode_minggu as "kodeMinggu",
          n.brand_id as "brandId",
          COALESCE(SUM(n.nilai), 0)::float as "totalVolume",
          COALESCE(SUM(CASE WHEN r.hari_kunjungan <= ${cutOffDay} THEN n.nilai ELSE 0 END), 0)::float as "wtdVolume"
        FROM trx_rekap_harian_nilai n
        JOIN trx_rekap_harian r ON r.id = n.rekap_id
        JOIN mst_notasi notasi ON notasi.id = n.notasi_id
        ${whereSql}
        GROUP BY r.kode_minggu, n.brand_id;
      `),
      prisma.$queryRaw<
        Array<{
          kodeMinggu: number;
          districtId: string;
          ouKode: string;
          totalCalls: number;
          wtdCalls: number;
        }>
      >(Prisma.sql`
        SELECT 
          r.kode_minggu as "kodeMinggu",
          r.district_id as "districtId",
          r.ou_kode as "ouKode",
          COALESCE(SUM(r.jumlah_kunjungan), 0)::int as "totalCalls",
          COALESCE(SUM(CASE WHEN r.hari_kunjungan <= ${cutOffDay} THEN r.jumlah_kunjungan ELSE 0 END), 0)::int as "wtdCalls"
        FROM trx_rekap_harian r
        ${callWhereSql}
        GROUP BY r.kode_minggu, r.district_id, r.ou_kode;
      `),
    ]);

    const districtKode = districtItem ? districtItem.kode : undefined;
    allBrands.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

    // Index aggregated SKU volume rows: map key -> `${kodeMinggu}_${brandId}`
    const skuMap = new Map<string, { totalVolume: number; wtdVolume: number }>();
    skuAggRows.forEach((r) => {
      skuMap.set(`${r.kodeMinggu}_${r.brandId}`, {
        totalVolume: Number(r.totalVolume) || 0,
        wtdVolume: Number(r.wtdVolume) || 0,
      });
    });

    // Compute SKU Rows
    const skuRows: SkuSalesRow[] = [];
    const totalByWeek: Record<number, number> = {};
    filteredWeekNumbers.forEach((km) => (totalByWeek[km] = 0));

    let grandTotalQuarter = 0;
    let grandWtdCurrent = 0;
    let grandWtdPrev = 0;

    allBrands.forEach((brand) => {
      const volumesByWeek: Record<number, number> = {};
      let totalQuarter = 0;
      let wtdCurrentVolume = 0;
      let wtdPrevVolume = 0;

      filteredWeekNumbers.forEach((km) => {
        const item = skuMap.get(`${km}_${brand.id}`);
        const weekVol = item ? item.totalVolume : 0;
        const wtdVol = item ? item.wtdVolume : 0;

        volumesByWeek[km] = weekVol;
        totalQuarter += weekVol;
        totalByWeek[km] = (totalByWeek[km] || 0) + weekVol;

        if (km === currentKodeMinggu) {
          wtdCurrentVolume = wtdVol;
        }
        if (prevKodeMinggu && km === prevKodeMinggu) {
          wtdPrevVolume = wtdVol;
        }
      });

      // Week dengan nilai kosong, 0, atau data tidak tersedia jangan dijadikan pembagi
      const activeWeeksCount = filteredWeekNumbers.filter(
        (km) => (volumesByWeek[km] || 0) > 0
      ).length;
      const avgWeekly = activeWeeksCount > 0
        ? Math.round((totalQuarter / activeWeeksCount) * 10) / 10
        : 0;
      const avgDaily = avgWeekly > 0
        ? Math.round((avgWeekly / 5.5) * 10) / 10
        : 0;

      const currentWeekVol = volumesByWeek[currentKodeMinggu] || 0;
      const prevWeekVol = prevKodeMinggu ? (volumesByWeek[prevKodeMinggu] || 0) : 0;
      const deltaPack = currentWeekVol - prevWeekVol;
      const growthWtdPercent = prevWeekVol > 0
        ? Math.round(((currentWeekVol - prevWeekVol) / prevWeekVol) * 1000) / 10
        : null;

      grandTotalQuarter += totalQuarter;
      grandWtdCurrent += wtdCurrentVolume;
      grandWtdPrev += wtdPrevVolume;

      skuRows.push({
        brandId: brand.id,
        kode: brand.kode,
        nama: brand.nama,
        urutan: brand.urutan,
        volumesByWeek,
        totalQuarter,
        avgWeekly,
        avgDaily,
        wtdCurrentVolume: currentWeekVol,
        wtdPrevVolume: prevWeekVol,
        growthWtdPercent,
        deltaPack,
      });
    });

    const grandCurrentVol = totalByWeek[currentKodeMinggu] || 0;
    const grandPrevVol = prevKodeMinggu ? (totalByWeek[prevKodeMinggu] || 0) : 0;
    const grandDeltaPack = grandCurrentVol - grandPrevVol;
    const grandGrowthWtdPercent = grandPrevVol > 0
      ? Math.round(((grandCurrentVol - grandPrevVol) / grandPrevVol) * 1000) / 10
      : null;

    // Week dengan total 0, kosong, atau data tidak tersedia jangan dijadikan pembagi
    const activeQuarterWeeksCount = filteredWeekNumbers.filter(
      (km) => (totalByWeek[km] || 0) > 0
    ).length;
    const grandAvgWeekly = activeQuarterWeeksCount > 0
      ? Math.round((grandTotalQuarter / activeQuarterWeeksCount) * 10) / 10
      : 0;
    const grandAvgDaily = grandAvgWeekly > 0
      ? Math.round((grandAvgWeekly / 5.5) * 10) / 10
      : 0;

    // Index call aggregations by week
    const callsByWeek = new Map<number, { totalCalls: number; wtdCalls: number; districtCount: number }>();
    callAggRows.forEach((r) => {
      const existing = callsByWeek.get(r.kodeMinggu) || { totalCalls: 0, wtdCalls: 0, districtCount: 0 };
      existing.totalCalls += Number(r.totalCalls) || 0;
      existing.wtdCalls += Number(r.wtdCalls) || 0;
      existing.districtCount += 1;
      callsByWeek.set(r.kodeMinggu, existing);
    });

    // Default daily target per district (from mst_target or default 40)
    const defaultTargetVal = allTargets.length > 0 ? Number(allTargets[0].nilai) || 40 : 40;

    const chartTrend: SkuSalesQuarterChartPoint[] = [];
    let currentWeekActualCalls = 0;
    let currentWeekWtdActualCalls = 0;
    let currentWeekTargetCalls = 0;

    filteredWeekNumbers.forEach((km) => {
      const wNum = km % 100;
      const callData = callsByWeek.get(km) || { totalCalls: 0, wtdCalls: 0, districtCount: 0 };
      const totalVol = totalByWeek[km] || 0;

      // Target calls = active districts in this week * daily target * 6 days
      const activeDistricts = Math.max(1, callData.districtCount);
      const weekTargetCalls = activeDistricts * defaultTargetVal * 6;

      if (km === currentKodeMinggu) {
        currentWeekActualCalls = callData.totalCalls;
        currentWeekWtdActualCalls = callData.wtdCalls;
        currentWeekTargetCalls = activeDistricts * defaultTargetVal * cutOffDay;
      }

      chartTrend.push({
        kodeMinggu: km,
        weekLabel: `W${String(wNum).padStart(2, '0')}`,
        weekNumber: wNum,
        cycle: wNum % 2 === 0 ? 'EVEN' : 'ODD',
        isCurrent: km === currentIso.kodeMinggu,
        isPast: km < currentIso.kodeMinggu,
        totalVolume: totalVol,
        totalCalls: callData.totalCalls,
        targetCalls: weekTargetCalls,
      });
    });

    if (currentWeekTargetCalls === 0) {
      currentWeekTargetCalls = defaultTargetVal * cutOffDay;
    }

    const callAchievement = currentWeekTargetCalls > 0
      ? Math.round((currentWeekWtdActualCalls / currentWeekTargetCalls) * 1000) / 10
      : 0;

    const dropSize = currentWeekWtdActualCalls > 0
      ? Math.round((grandWtdCurrent / currentWeekWtdActualCalls) * 10) / 10
      : 0;

    const kpiSummary: SkuSalesKpiSummary = {
      kunjungan: {
        actual: currentWeekWtdActualCalls,
        target: currentWeekTargetCalls,
        achievementPercent: callAchievement,
      },
      penjualanWtd: {
        currentWeekNumber,
        currentVolume: grandWtdCurrent,
        cutOffDay,
        cutOffDayName,
      },
      growthWtd: {
        prevWeekNumber: prevCycleWeekNumber,
        prevVolume: grandPrevVol,
        deltaPack: grandDeltaPack,
        percent: grandGrowthWtdPercent,
        isPositive: grandDeltaPack >= 0,
      },
      productivity: {
        dropSize,
        totalCalls: currentWeekWtdActualCalls,
        totalVolume: grandWtdCurrent,
      },
      quarterOverview: {
        totalQuarterVolume: grandTotalQuarter,
        avgVolumePerWeek: grandAvgWeekly,
        activeSkuCount: allBrands.length,
      },
    };

    return {
      header: {
        year,
        quarter,
        cycleType,
        ouKode: input.ouKode,
        districtId: input.districtId,
        districtKode,
        cutOffDay,
        cutOffDayName,
        currentWeekNumber,
        prevCycleWeekNumber,
      },
      weeks,
      kpiSummary,
      chartTrend,
      skuRows,
      summaryRow: {
        totalByWeek,
        grandTotalQuarter,
        grandAvgWeekly,
        grandAvgDaily,
        grandWtdCurrent,
        grandWtdPrev,
        grandGrowthWtdPercent,
        grandDeltaPack,
      },
    };
  }
}
