import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { IBrandRepository } from '../../../domain/repositories/IBrandRepository';
import { GetKpiTrackingReportUseCase } from './GetKpiTrackingReportUseCase';
import { GetSkuSalesReportUseCase } from './GetSkuSalesReportUseCase';
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
import { KpiSummaryMetric } from './GetKpiTrackingReportUseCase';
import { SkuSalesRow, SkuSalesWeekColumn, SkuSalesReportResponse } from './GetSkuSalesReportUseCase';

export interface NotationReportInput {
  year?: number;
  quarter?: number;
  cycleType?: 'ALL' | 'EVEN' | 'ODD';
  selectedWeek?: number | 'all';
  ouKode?: string;
  ouKodeIn?: string[];
  districtId?: string;
  brandId?: string | 'all';
  statusRekap?: string;
  token?: string;
}

export interface NotationDataPoint {
  periodKey: string | number;
  label: string;
  cycle?: 'EVEN' | 'ODD';
  isCurrent?: boolean;
  isPast?: boolean;
  isFuture?: boolean;
  hasData?: boolean;
  isEffective?: boolean;
  startDate?: string;
  endDate?: string;
  sk: number;       // Stok Kurang (Outlet)
  sl: number;       // Stok Laku (Outlet)
  oos: number;      // Out Of Stock (Outlet)
  sd: number;       // Stok Diam (Outlet)
  tl: number;       // Tidak Laku (Outlet)
  bpj: number;      // Belum Pernah Jual (Outlet)
  sb: number;       // Stok Baru (Outlet)
  avgStock: number; // Rata-rata Kuantitas Stok (Pack/Outlet/Brand)
  avgBuy: number;   // Rata-rata Kuantitas Pembelian (Pack/Outlet/Brand)
  totalCalls: number;
  brandCount?: number;
  totalStockPack?: number;
  totalBuyPack?: number;
}

export interface BrandNotationAbsoluteItem {
  urutan: number;
  brandId: string;
  kodeBrand: string;
  namaBrand: string;
  kategori?: string;
  callmade: number;        // Denominator kunjungan siap pakai
  bd: number;              // Jumlah toko BD absolut (oos + sk + sl + sd + sb)
  totalStockPack: number;  // Total fisik pack stok di toko saat diaudit
  totalBuyPack: number;    // Total fisik pack pesanan/pembelian toko
  totalVolPack: number;    // Total volume (pack)
  sk: number;              // Toko Stok Kurang
  sl: number;              // Toko Stok Laku
  sd: number;              // Toko Stok Diam
  oos: number;             // Toko Out Of Stock
  sb: number;              // Toko Stok Baru
  tl: number;              // Toko Tidak Laku
  bpj: number;             // Toko Belum Pernah Jual
  avgStockPack: number;    // totalStockPack / callmade
  avgStokPack?: number;    // Alias untuk kompatibilitas matrix table
  avgBuyPack: number;      // totalBuyPack / callmade
  avgBeliPack?: number;    // Alias untuk kompatibilitas matrix table
  bdPercent: number;       // (bd / callmade) * 100%
  skPercent: number;       // (sk / callmade) * 100%
  slPercent: number;       // (sl / callmade) * 100%
  sdPercent: number;       // (sd / callmade) * 100%
  oosPercent: number;      // (oos / callmade) * 100%
  sbPercent: number;       // (sb / callmade) * 100%
  tlPercent: number;       // (tl / callmade) * 100%
  bpjPercent: number;      // (bpj / callmade) * 100%
}

export interface BrandNotationMatrixData {
  callmade: number;
  rows: BrandNotationAbsoluteItem[];
  consolidation: BrandNotationAbsoluteItem;
}

export interface NotationReportResponse {
  header: {
    year: number;
    quarter: number;
    cycleType: 'ALL' | 'EVEN' | 'ODD';
    selectedWeek: number | 'all';
    ouKode?: string;
    districtId?: string;
    brandId?: string;
    brandNama?: string;
    currentWeekNumber: number;
    prevCycleWeekNumber: number;
  };
  summary: {
    kunjungan: KpiSummaryMetric;
    ec: KpiSummaryMetric;
    bd: KpiSummaryMetric;
    volume: KpiSummaryMetric;
  };
  notationTrend: NotationDataPoint[];
  brandMatrix: BrandNotationMatrixData;
  skuMatrix: {
    weeks: SkuSalesWeekColumn[];
    skuRows: SkuSalesRow[];
    summaryRow: SkuSalesReportResponse['summaryRow'];
    prevCycleWeekNumber: number;
    currentWeekNumber: number;
  };
}

const HARI_LABELS: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

export class GetNotationReportUseCase {
  constructor(
    private readonly kpiReportUC: GetKpiTrackingReportUseCase,
    private readonly skuReportUC: GetSkuSalesReportUseCase,
    private readonly districtRepo: IDistrictRepository,
    private readonly brandRepo: IBrandRepository
  ) {}

  async execute(input: NotationReportInput): Promise<NotationReportResponse> {
    const today = new Date();
    const currentIso = getIsoWeekInfo(today);

    const year = input.year || currentIso.isoYear;
    const quarter = input.quarter || getQuarterFromWeek(currentIso.isoWeek);
    const quarterRange = getQuarterWeekRange(year, quarter);
    const cycleType = input.cycleType || 'ALL';

    // 1. Filter weeks in quarter according to cycle
    const filteredWeekNumbers = quarterRange.weekList.filter((km) => {
      const wNum = km % 100;
      if (cycleType === 'EVEN') return wNum % 2 === 0;
      if (cycleType === 'ODD') return wNum % 2 !== 0;
      return true; // ALL
    });

    // 2. Fetch KPI Summary & SKU Matrix concurrently
    const [kpiReport, skuReport, allBrands] = await Promise.all([
      this.kpiReportUC.execute({
        year,
        quarter,
        cycleType,
        selectedWeek: input.selectedWeek,
        ouKode: input.ouKode,
        ouKodeIn: input.ouKodeIn,
        districtId: input.districtId,
        statusRekap: input.statusRekap,
        token: input.token,
      }),
      this.skuReportUC.execute({
        year,
        quarter,
        cycleType,
        ouKode: input.ouKode,
        ouKodeIn: input.ouKodeIn,
        districtId: input.districtId,
        statusRekap: input.statusRekap,
        token: input.token,
      }),
      this.brandRepo.findAll({ status: 'AKTIF' }),
    ]);

    // 3. Filter SKU rows if a specific brand is selected
    let selectedBrandNama = 'Semua Brand';
    let filteredSkuRows = skuReport.skuRows;

    if (input.brandId && input.brandId !== 'all') {
      const matchedBrand = allBrands.find((b) => b.id === input.brandId);
      if (matchedBrand) {
        selectedBrandNama = matchedBrand.nama;
        filteredSkuRows = skuReport.skuRows.filter((row) => row.brandId === input.brandId);
      }
    }

    // Recompute summary row if filtered by brand
    let summaryRow = skuReport.summaryRow;
    if (input.brandId && input.brandId !== 'all') {
      const totalByWeek: Record<number, number> = {};
      let grandTotalQuarter = 0;
      let grandWtdCurrent = 0;
      let grandWtdPrev = 0;

      skuReport.weeks.forEach((w) => {
        totalByWeek[w.kodeMinggu] = 0;
      });

      filteredSkuRows.forEach((row) => {
        skuReport.weeks.forEach((w) => {
          totalByWeek[w.kodeMinggu] += row.volumesByWeek[w.kodeMinggu] || 0;
        });
        grandTotalQuarter += row.totalQuarter;
        grandWtdCurrent += row.wtdCurrentVolume;
        grandWtdPrev += row.wtdPrevVolume;
      });

      const grandDeltaPack = grandWtdCurrent - grandWtdPrev;
      const grandGrowthWtdPercent =
        grandWtdPrev > 0 ? Math.round(((grandWtdCurrent - grandWtdPrev) / grandWtdPrev) * 1000) / 10 : null;
      const weekCount = skuReport.weeks.length || 1;
      const grandAvgWeekly = Math.round((grandTotalQuarter / weekCount) * 10) / 10;
      const grandAvgDaily = Math.round((grandAvgWeekly / 6) * 10) / 10;

      summaryRow = {
        totalByWeek,
        grandTotalQuarter,
        grandAvgWeekly,
        grandAvgDaily,
        grandWtdCurrent,
        grandWtdPrev,
        grandGrowthWtdPercent,
        grandDeltaPack,
      };
    }

    const activeBrands = allBrands
      .filter((b) => {
        if (input.brandId && input.brandId !== 'all') {
          return b.id === input.brandId;
        }
        return true;
      })
      .sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0));

    const activeBrandIds = activeBrands.map((b) => b.id);
    const validBrandIds = activeBrandIds.length > 0 ? activeBrandIds : ['00000000-0000-0000-0000-000000000000'];
    const effectiveBrandCount = Math.max(1, activeBrands.length);

    // 4. Build SQL Query for 4 Notation Charts
    const conditions: Prisma.Sql[] = [
      Prisma.sql`r.status = 'AKTIF'`,
      Prisma.sql`r.kode_minggu IN (${Prisma.join(filteredWeekNumbers.length > 0 ? filteredWeekNumbers : [0])})`,
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

    const brandFilterSql =
      input.brandId && input.brandId !== 'all'
        ? Prisma.sql`AND n.brand_id = ${input.brandId}::uuid`
        : Prisma.sql`AND n.brand_id IN (${Prisma.join(validBrandIds.map((id) => Prisma.sql`${id}::uuid`))})`;

    const isSingleWeek = input.selectedWeek && input.selectedWeek !== 'all';
    const targetSingleKodeMinggu = isSingleWeek ? Number(input.selectedWeek) : null;

    let notationTrend: NotationDataPoint[] = [];

    if (isSingleWeek && targetSingleKodeMinggu) {
      // Breakdown by day (1..6) for the single selected week
      const singleWeekConditions = [
        ...conditions,
        Prisma.sql`r.kode_minggu = ${targetSingleKodeMinggu}`,
      ];
      const singleWhereSql = Prisma.sql`WHERE ${Prisma.join(singleWeekConditions, ' AND ')}`;

      interface DayNotationRaw {
        hariKunjungan: number;
        sk: number;
        sl: number;
        oos: number;
        sd: number;
        tl: number;
        bpj: number;
        sb: number;
        stockQty: number;
        buyQty: number;
        totalCalls: number;
        outletCount: number;
      }

      const rawDays = await prisma.$queryRaw<DayNotationRaw[]>(Prisma.sql`
        WITH rekap_agg AS (
          SELECT 
            r.hari_kunjungan as "hariKunjungan",
            COALESCE(SUM(r.jumlah_kunjungan), 0)::float as "totalCalls",
            COUNT(DISTINCT r.id)::float as "outletCount"
          FROM trx_rekap_harian r
          ${singleWhereSql}
          GROUP BY r.hari_kunjungan
        ),
        nilai_agg AS (
          SELECT 
            r.hari_kunjungan as "hariKunjungan",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('SK', 'Sk', 'sk') THEN n.nilai ELSE 0 END), 0)::float as "sk",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('SL', 'Sl', 'sl') THEN n.nilai ELSE 0 END), 0)::float as "sl",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('OOS', 'Oos', 'oos') THEN n.nilai ELSE 0 END), 0)::float as "oos",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('SD', 'Sd', 'sd') THEN n.nilai ELSE 0 END), 0)::float as "sd",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('TL', 'Tl', 'tl') THEN n.nilai ELSE 0 END), 0)::float as "tl",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('BPJ', 'Bpj', 'bpj') THEN n.nilai ELSE 0 END), 0)::float as "bpj",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('SB', 'Sb', 'sb') THEN n.nilai ELSE 0 END), 0)::float as "sb",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('STOCK', 'Stock', 'stock') THEN n.nilai ELSE 0 END), 0)::float as "stockQty",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('BUY', 'Buy', 'buy') THEN n.nilai ELSE 0 END), 0)::float as "buyQty"
          FROM trx_rekap_harian r
          JOIN trx_rekap_harian_nilai n ON n.rekap_id = r.id ${brandFilterSql}
          JOIN mst_notasi notasi ON notasi.id = n.notasi_id
          ${singleWhereSql}
          GROUP BY r.hari_kunjungan
        )
        SELECT 
          ra."hariKunjungan",
          ra."totalCalls",
          ra."outletCount",
          COALESCE(na."sk", 0)::float as "sk",
          COALESCE(na."sl", 0)::float as "sl",
          COALESCE(na."oos", 0)::float as "oos",
          COALESCE(na."sd", 0)::float as "sd",
          COALESCE(na."tl", 0)::float as "tl",
          COALESCE(na."bpj", 0)::float as "bpj",
          COALESCE(na."sb", 0)::float as "sb",
          COALESCE(na."stockQty", 0)::float as "stockQty",
          COALESCE(na."buyQty", 0)::float as "buyQty"
        FROM rekap_agg ra
        LEFT JOIN nilai_agg na ON na."hariKunjungan" = ra."hariKunjungan"
        ORDER BY ra."hariKunjungan" ASC;
      `);

      const dayMap = new Map<number, DayNotationRaw>();
      rawDays.forEach((d) => dayMap.set(d.hariKunjungan, d));

      for (let day = 1; day <= 6; day++) {
        const d = dayMap.get(day);
        const calls = d ? d.totalCalls : 0;
        const sk = Math.round(d ? d.sk : 0);
        const sl = Math.round(d ? d.sl : 0);
        const oos = Math.round(d ? d.oos : 0);
        const sd = Math.round(d ? d.sd : 0);
        const tl = Math.round(d ? d.tl : 0);
        const bpj = Math.round(d ? d.bpj : 0);
        const sb = Math.round(d ? d.sb : 0);
        // Stock dan Buy dibagi Callmade dan jumlah brand aktif (Rata-rata per brand per kunjungan)
        const avgStock = d && calls > 0 ? Math.round((d.stockQty / (calls * effectiveBrandCount)) * 10) / 10 : 0;
        const avgBuy = d && calls > 0 ? Math.round((d.buyQty / (calls * effectiveBrandCount)) * 10) / 10 : 0;

        const isPastDay =
          targetSingleKodeMinggu < currentIso.kodeMinggu ||
          (targetSingleKodeMinggu === currentIso.kodeMinggu && day < currentIso.hariKunjungan);
        const isCurrentDay =
          targetSingleKodeMinggu === currentIso.kodeMinggu && day === currentIso.hariKunjungan;
        const isFutureDay =
          targetSingleKodeMinggu > currentIso.kodeMinggu ||
          (targetSingleKodeMinggu === currentIso.kodeMinggu && day > currentIso.hariKunjungan);
        const hasDataDay = calls > 0;

        notationTrend.push({
          periodKey: day,
          label: HARI_LABELS[day] || `Hari ${day}`,
          isCurrent: isCurrentDay,
          isPast: isPastDay,
          isFuture: isFutureDay,
          hasData: hasDataDay,
          isEffective: !isFutureDay,
          sk,
          sl,
          oos,
          sd,
          tl,
          bpj,
          sb,
          avgStock,
          avgBuy,
          totalCalls: calls,
          brandCount: effectiveBrandCount,
          totalStockPack: Math.round(d ? d.stockQty : 0),
          totalBuyPack: Math.round(d ? d.buyQty : 0),
        });
      }
    } else {
      // Aggregate by week across the quarter
      const whereSql = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

      interface WeekNotationRaw {
        kodeMinggu: number;
        sk: number;
        sl: number;
        oos: number;
        sd: number;
        tl: number;
        bpj: number;
        sb: number;
        stockQty: number;
        buyQty: number;
        totalCalls: number;
        activeDays: number;
      }

      const rawWeeks = await prisma.$queryRaw<WeekNotationRaw[]>(Prisma.sql`
        WITH rekap_agg AS (
          SELECT 
            r.kode_minggu as "kodeMinggu",
            COALESCE(SUM(r.jumlah_kunjungan), 0)::float as "totalCalls",
            COUNT(DISTINCT r.tgl_kunjungan)::float as "activeDays"
          FROM trx_rekap_harian r
          ${whereSql}
          GROUP BY r.kode_minggu
        ),
        nilai_agg AS (
          SELECT 
            r.kode_minggu as "kodeMinggu",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('SK', 'Sk', 'sk') THEN n.nilai ELSE 0 END), 0)::float as "sk",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('SL', 'Sl', 'sl') THEN n.nilai ELSE 0 END), 0)::float as "sl",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('OOS', 'Oos', 'oos') THEN n.nilai ELSE 0 END), 0)::float as "oos",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('SD', 'Sd', 'sd') THEN n.nilai ELSE 0 END), 0)::float as "sd",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('TL', 'Tl', 'tl') THEN n.nilai ELSE 0 END), 0)::float as "tl",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('BPJ', 'Bpj', 'bpj') THEN n.nilai ELSE 0 END), 0)::float as "bpj",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('SB', 'Sb', 'sb') THEN n.nilai ELSE 0 END), 0)::float as "sb",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('STOCK', 'Stock', 'stock') THEN n.nilai ELSE 0 END), 0)::float as "stockQty",
            COALESCE(SUM(CASE WHEN notasi.kode IN ('BUY', 'Buy', 'buy') THEN n.nilai ELSE 0 END), 0)::float as "buyQty"
          FROM trx_rekap_harian r
          JOIN trx_rekap_harian_nilai n ON n.rekap_id = r.id ${brandFilterSql}
          JOIN mst_notasi notasi ON notasi.id = n.notasi_id
          ${whereSql}
          GROUP BY r.kode_minggu
        )
        SELECT 
          ra."kodeMinggu",
          ra."totalCalls",
          ra."activeDays",
          COALESCE(na."sk", 0)::float as "sk",
          COALESCE(na."sl", 0)::float as "sl",
          COALESCE(na."oos", 0)::float as "oos",
          COALESCE(na."sd", 0)::float as "sd",
          COALESCE(na."tl", 0)::float as "tl",
          COALESCE(na."bpj", 0)::float as "bpj",
          COALESCE(na."sb", 0)::float as "sb",
          COALESCE(na."stockQty", 0)::float as "stockQty",
          COALESCE(na."buyQty", 0)::float as "buyQty"
        FROM rekap_agg ra
        LEFT JOIN nilai_agg na ON na."kodeMinggu" = ra."kodeMinggu"
        ORDER BY ra."kodeMinggu" ASC;
      `);

      const weekMap = new Map<number, WeekNotationRaw>();
      rawWeeks.forEach((w) => weekMap.set(w.kodeMinggu, w));

      notationTrend = filteredWeekNumbers.map((km) => {
        const wNum = km % 100;
        const wRange = getDateRangeForKodeMinggu(km);
        const w = weekMap.get(km);
        const calls = w ? w.totalCalls : 0;
        const sk = Math.round(w ? w.sk : 0);
        const sl = Math.round(w ? w.sl : 0);
        const oos = Math.round(w ? w.oos : 0);
        const sd = Math.round(w ? w.sd : 0);
        const tl = Math.round(w ? w.tl : 0);
        const bpj = Math.round(w ? w.bpj : 0);
        const sb = Math.round(w ? w.sb : 0);

        // Stock dan Buy dibagi Callmade dan jumlah brand aktif (Rata-rata per brand per kunjungan)
        const avgStock = w && calls > 0 ? Math.round((w.stockQty / (calls * effectiveBrandCount)) * 10) / 10 : 0;
        const avgBuy = w && calls > 0 ? Math.round((w.buyQty / (calls * effectiveBrandCount)) * 10) / 10 : 0;

        const isPastWeek = km < currentIso.kodeMinggu;
        const isCurrentWeek = km === currentIso.kodeMinggu;
        const isFutureWeek = km > currentIso.kodeMinggu;
        const hasDataWeek = w !== undefined && (w.totalCalls > 0 || w.activeDays > 0);
        const isEffectiveWeek = km <= currentIso.kodeMinggu;

        return {
          periodKey: km,
          label: `W${String(wNum).padStart(2, '0')}`,
          cycle: wNum % 2 === 0 ? 'EVEN' : 'ODD',
          isCurrent: isCurrentWeek,
          isPast: isPastWeek,
          isFuture: isFutureWeek,
          hasData: hasDataWeek,
          isEffective: isEffectiveWeek,
          startDate: formatDateOnly(wRange.startDate),
          endDate: formatDateOnly(wRange.endDate),
          sk,
          sl,
          oos,
          sd,
          tl,
          bpj,
          sb,
          avgStock,
          avgBuy,
          totalCalls: calls,
          brandCount: effectiveBrandCount,
          totalStockPack: Math.round(w ? w.stockQty : 0),
          totalBuyPack: Math.round(w ? w.buyQty : 0),
        };
      });
    }

    // 5. Build Brand Notation Matrix (Absolute Values & Callmade Divider)
    const targetWeeksForBrandMatrix =
      isSingleWeek && targetSingleKodeMinggu
        ? [targetSingleKodeMinggu]
        : filteredWeekNumbers;

    const brandMatrixConditions: Prisma.Sql[] = [
      Prisma.sql`r.status = 'AKTIF'`,
      Prisma.sql`r.kode_minggu IN (${Prisma.join(targetWeeksForBrandMatrix)})`,
    ];

    if (input.districtId && input.districtId !== 'all') {
      brandMatrixConditions.push(Prisma.sql`r.district_id = ${input.districtId}::uuid`);
    } else if (input.ouKode && input.ouKode !== 'all') {
      brandMatrixConditions.push(Prisma.sql`r.ou_kode = ${input.ouKode}`);
    } else if (input.ouKodeIn && input.ouKodeIn.length > 0) {
      brandMatrixConditions.push(Prisma.sql`r.ou_kode IN (${Prisma.join(input.ouKodeIn)})`);
    }

    if (input.statusRekap) {
      brandMatrixConditions.push(Prisma.sql`r.status_rekap = ${input.statusRekap}`);
    }

    const brandMatrixWhereSql = Prisma.sql`WHERE ${Prisma.join(brandMatrixConditions, ' AND ')}`;

    interface RawTotalCalls {
      totalCalls: number;
    }

    const rawCalls = await prisma.$queryRaw<RawTotalCalls[]>(Prisma.sql`
      SELECT COALESCE(SUM(r.jumlah_kunjungan), 0)::float as "totalCalls"
      FROM trx_rekap_harian r
      ${brandMatrixWhereSql}
    `);
    const totalCalls = Math.round(rawCalls[0]?.totalCalls || 0);
    const callmadeDiv = Math.max(1, totalCalls);

    interface RawBrandNotation {
      brandId: string;
      sk: number;
      sl: number;
      oos: number;
      sd: number;
      tl: number;
      bpj: number;
      sb: number;
      stockQty: number;
      buyQty: number;
    }

    const rawBrandNotations = await prisma.$queryRaw<RawBrandNotation[]>(Prisma.sql`
      SELECT 
        n.brand_id as "brandId",
        COALESCE(SUM(CASE WHEN notasi.kode IN ('SK', 'Sk', 'sk') THEN n.nilai ELSE 0 END), 0)::float as "sk",
        COALESCE(SUM(CASE WHEN notasi.kode IN ('SL', 'Sl', 'sl') THEN n.nilai ELSE 0 END), 0)::float as "sl",
        COALESCE(SUM(CASE WHEN notasi.kode IN ('OOS', 'Oos', 'oos') THEN n.nilai ELSE 0 END), 0)::float as "oos",
        COALESCE(SUM(CASE WHEN notasi.kode IN ('SD', 'Sd', 'sd') THEN n.nilai ELSE 0 END), 0)::float as "sd",
        COALESCE(SUM(CASE WHEN notasi.kode IN ('TL', 'Tl', 'tl') THEN n.nilai ELSE 0 END), 0)::float as "tl",
        COALESCE(SUM(CASE WHEN notasi.kode IN ('BPJ', 'Bpj', 'bpj') THEN n.nilai ELSE 0 END), 0)::float as "bpj",
        COALESCE(SUM(CASE WHEN notasi.kode IN ('SB', 'Sb', 'sb') THEN n.nilai ELSE 0 END), 0)::float as "sb",
        COALESCE(SUM(CASE WHEN notasi.kode IN ('STOCK', 'Stock', 'stock') THEN n.nilai ELSE 0 END), 0)::float as "stockQty",
        COALESCE(SUM(CASE WHEN notasi.kode IN ('BUY', 'Buy', 'buy') THEN n.nilai ELSE 0 END), 0)::float as "buyQty"
      FROM trx_rekap_harian_nilai n
      JOIN trx_rekap_harian r ON r.id = n.rekap_id
      JOIN mst_notasi notasi ON notasi.id = n.notasi_id
      ${brandMatrixWhereSql}
      GROUP BY n.brand_id
    `);

    const brandMap = new Map<string, RawBrandNotation>();
    rawBrandNotations.forEach((item) => brandMap.set(item.brandId, item));

    let sumBd = 0;
    let sumStock = 0;
    let sumBuy = 0;
    let sumVol = 0;
    let sumSk = 0;
    let sumSl = 0;
    let sumSd = 0;
    let sumOos = 0;
    let sumSb = 0;
    let sumTl = 0;
    let sumBpj = 0;

    let grandBdSum = 0;
    let grandStockSum = 0;
    let grandBuySum = 0;
    let grandSkSum = 0;
    let grandSlSum = 0;
    let grandSdSum = 0;
    let grandOosSum = 0;
    let grandSbSum = 0;
    let grandTlSum = 0;
    let grandBpjSum = 0;

    const brandRows: BrandNotationAbsoluteItem[] = activeBrands.map((b, idx) => {
      const data = brandMap.get(b.id) || {
        brandId: b.id,
        sk: 0,
        sl: 0,
        oos: 0,
        sd: 0,
        tl: 0,
        bpj: 0,
        sb: 0,
        stockQty: 0,
        buyQty: 0,
      };

      const sk = Math.round(data.sk);
      const sl = Math.round(data.sl);
      const sd = Math.round(data.sd);
      const oos = Math.round(data.oos);
      const sb = Math.round(data.sb);
      const tl = Math.round(data.tl);
      const bpj = Math.round(data.bpj);
      const bd = oos + sk + sl + sd + sb;
      const totalStockPack = Math.round(data.stockQty);
      const totalBuyPack = Math.round(data.buyQty);
      const totalVolPack = totalBuyPack;

      const avgStockPack = totalCalls > 0 ? Math.round((totalStockPack / callmadeDiv) * 10) / 10 : 0;
      const avgBuyPack = totalCalls > 0 ? Math.round((totalBuyPack / callmadeDiv) * 10) / 10 : 0;
      const bdPercent = totalCalls > 0 ? Math.min(100, Math.round((bd / callmadeDiv) * 1000) / 10) : 0;
      const skPercent = totalCalls > 0 ? Math.min(100, Math.round((sk / callmadeDiv) * 1000) / 10) : 0;
      const slPercent = totalCalls > 0 ? Math.min(100, Math.round((sl / callmadeDiv) * 1000) / 10) : 0;
      const sdPercent = totalCalls > 0 ? Math.min(100, Math.round((sd / callmadeDiv) * 1000) / 10) : 0;
      const oosPercent = totalCalls > 0 ? Math.min(100, Math.round((oos / callmadeDiv) * 1000) / 10) : 0;
      const sbPercent = totalCalls > 0 ? Math.min(100, Math.round((sb / callmadeDiv) * 1000) / 10) : 0;
      const tlPercent = totalCalls > 0 ? Math.min(100, Math.round((tl / callmadeDiv) * 1000) / 10) : 0;
      const bpjPercent = totalCalls > 0 ? Math.min(100, Math.round((bpj / callmadeDiv) * 1000) / 10) : 0;

      sumBd += bd;
      sumStock += totalStockPack;
      sumBuy += totalBuyPack;
      sumVol += totalVolPack;
      sumSk += sk;
      sumSl += sl;
      sumSd += sd;
      sumOos += oos;
      sumSb += sb;
      sumTl += tl;
      sumBpj += bpj;

      grandBdSum += bdPercent;
      grandStockSum += avgStockPack;
      grandBuySum += avgBuyPack;
      grandSkSum += skPercent;
      grandSlSum += slPercent;
      grandSdSum += sdPercent;
      grandOosSum += oosPercent;
      grandSbSum += sbPercent;
      grandTlSum += tlPercent;
      grandBpjSum += bpjPercent;

      return {
        urutan: b.urutan ?? idx + 1,
        brandId: b.id,
        kodeBrand: b.kode,
        namaBrand: b.nama,
        kategori: b.kategori,
        callmade: totalCalls,
        bd,
        totalStockPack,
        totalBuyPack,
        totalVolPack,
        sk,
        sl,
        sd,
        oos,
        sb,
        tl,
        bpj,
        avgStockPack,
        avgStokPack: avgStockPack,
        avgBuyPack,
        avgBeliPack: avgBuyPack,
        bdPercent,
        skPercent,
        slPercent,
        sdPercent,
        oosPercent,
        sbPercent,
        tlPercent,
        bpjPercent,
      };
    });

    const brandCount = Math.max(1, brandRows.length);
    const consolidation: BrandNotationAbsoluteItem = {
      urutan: 0,
      brandId: 'ALL',
      kodeBrand: 'ALL',
      namaBrand: `KONSOLIDASI ${brandCount} BRAND INTI`,
      kategori: 'ALL',
      callmade: totalCalls,
      bd: sumBd,
      totalStockPack: sumStock,
      totalBuyPack: sumBuy,
      totalVolPack: sumVol,
      sk: sumSk,
      sl: sumSl,
      sd: sumSd,
      oos: sumOos,
      sb: sumSb,
      tl: sumTl,
      bpj: sumBpj,
      avgStockPack: Math.round((grandStockSum / brandCount) * 10) / 10,
      avgStokPack: Math.round((grandStockSum / brandCount) * 10) / 10,
      avgBuyPack: Math.round((grandBuySum / brandCount) * 10) / 10,
      avgBeliPack: Math.round((grandBuySum / brandCount) * 10) / 10,
      bdPercent: Math.round((grandBdSum / brandCount) * 10) / 10,
      skPercent: Math.round((grandSkSum / brandCount) * 10) / 10,
      slPercent: Math.round((grandSlSum / brandCount) * 10) / 10,
      sdPercent: Math.round((grandSdSum / brandCount) * 10) / 10,
      oosPercent: Math.round((grandOosSum / brandCount) * 10) / 10,
      sbPercent: Math.round((grandSbSum / brandCount) * 10) / 10,
      tlPercent: Math.round((grandTlSum / brandCount) * 10) / 10,
      bpjPercent: Math.round((grandBpjSum / brandCount) * 10) / 10,
    };

    return {
      header: {
        year,
        quarter,
        cycleType,
        selectedWeek: input.selectedWeek || 'all',
        ouKode: input.ouKode,
        districtId: input.districtId,
        brandId: input.brandId,
        brandNama: selectedBrandNama,
        currentWeekNumber: skuReport.header.currentWeekNumber,
        prevCycleWeekNumber: skuReport.header.prevCycleWeekNumber,
      },
      summary: kpiReport.summary,
      notationTrend,
      brandMatrix: {
        callmade: totalCalls,
        rows: brandRows,
        consolidation,
      },
      skuMatrix: {
        weeks: skuReport.weeks,
        skuRows: filteredSkuRows,
        summaryRow,
        prevCycleWeekNumber: skuReport.header.prevCycleWeekNumber,
        currentWeekNumber: skuReport.header.currentWeekNumber,
      },
    };
  }
}
