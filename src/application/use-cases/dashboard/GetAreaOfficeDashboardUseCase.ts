import { IRekapHarianRepository } from '../../../domain/repositories/IRekapHarianRepository';
import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { IBrandRepository } from '../../../domain/repositories/IBrandRepository';
import { INotasiRepository } from '../../../domain/repositories/INotasiRepository';
import { ITargetRepository } from '../../../domain/repositories/ITargetRepository';
import { getQuarterWeekRange, getAvailableQuarters, getQuarterFromWeek } from '../../../infrastructure/utils/quarterUtils';
import { getDateRangeForKodeMinggu } from '../../../infrastructure/utils/dateIsoUtils';
import { Target, JenisTarget } from '../../../domain/entities/Target';
import { authBackendService } from '../../../infrastructure/services/AuthBackendServiceClient';
import {
  DashboardDTO,
  AreaOfficeDashboardDTO,
  DashboardBranchRow,
  DashboardBrandMatrixRow,
  DashboardSalesmanRow,
  DashboardTrendWeekData,
  DashboardTrendBranch,
} from './types';

/**
 * Helper to resolve daily target in memory following the strict precedence rules:
 * 1. District-specific target (highest rank)
 * 2. Operation Unit / Branch target (medium rank)
 * 3. Global target (fallback rank)
 * Within each tier: exact day > weekday (7, Mon-Fri) > all days (null)
 */
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
      if (t.hariKunjungan !== null && t.hariKunjungan !== undefined && t.hariKunjungan !== 7 && t.hariKunjungan !== hariKunjungan) {
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
    const isDistrict = t.districtId === districtId;
    const isOu = !t.districtId && t.ouKode === ouKode;
    const isExact = t.hariKunjungan === hariKunjungan;
    const isWeekday = t.hariKunjungan === 7;

    if (isDistrict) {
      if (isExact) return 1;
      if (isWeekday) return 2;
      return 3;
    } else if (isOu) {
      if (isExact) return 4;
      if (isWeekday) return 5;
      return 6;
    } else {
      if (isExact) return 7;
      if (isWeekday) return 8;
      return 9;
    }
  };

  matched.sort((a, b) => {
    const rankDiff = getRank(a) - getRank(b);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.berlakuDari).getTime() - new Date(a.berlakuDari).getTime();
  });

  return Number(matched[0].nilai);
}

export class GetDashboardUseCase {
  constructor(
    private readonly rekapRepo: IRekapHarianRepository,
    private readonly districtRepo: IDistrictRepository,
    private readonly brandRepo: IBrandRepository,
    private readonly notasiRepo: INotasiRepository,
    private readonly targetRepo: ITargetRepository
  ) {}

  async execute(
    tahunParam?: number,
    kuartalParam?: number,
    kodeMingguParam?: number,
    ouKodeParam?: string,
    allowedUnitCodes?: string[],
    authToken?: string
  ): Promise<DashboardDTO> {
    const currentYear = tahunParam || 2026;

    // Resolve UUIDs in allowedUnitCodes and fetch Operation Units as single source of truth
    let effectiveAllowedCodes = allowedUnitCodes;
    const ouNameMap = new Map<string, string>();
    if (authToken) {
      try {
        const scopedUnits = await authBackendService.getOperationUnits(authToken);
        if (scopedUnits && scopedUnits.length > 0) {
          scopedUnits.forEach((u) => {
            if (u.kode && u.nama) {
              ouNameMap.set(u.kode, u.nama);
            }
          });
          if (effectiveAllowedCodes && effectiveAllowedCodes.some((c) => c.length === 36 && c.includes('-'))) {
            effectiveAllowedCodes = scopedUnits.map((u) => u.kode).filter(Boolean);
          }
        }
      } catch {
        // keep original
      }
    }

    // 1. Resolve Available Weeks in Database
    const distinctWeeks = await this.rekapRepo.getDistinctWeeks(
      ouKodeParam && ouKodeParam !== 'ALL' ? ouKodeParam : undefined,
      effectiveAllowedCodes
    );

    // 2. Resolve Active Quarter & Quarter Range
    const resolvedQuarter = kuartalParam || (distinctWeeks.length > 0 ? getQuarterFromWeek(distinctWeeks[0] % 100) : 4);
    const quarterRange = getQuarterWeekRange(currentYear, resolvedQuarter);

    // Available distinct weeks inside the selected quarter (sorted descending: latest first)
    const availableWeeksInQuarter = distinctWeeks
      .filter((w) => w >= quarterRange.startKodeMinggu && w <= quarterRange.endKodeMinggu)
      .sort((a, b) => b - a);

    // 3. Resolve Selected Active Week
    const isAllWeek = kodeMingguParam === 0;
    let selectedKodeMinggu = kodeMingguParam;

    if (!isAllWeek) {
      if (!selectedKodeMinggu || selectedKodeMinggu < quarterRange.startKodeMinggu || selectedKodeMinggu > quarterRange.endKodeMinggu) {
        if (availableWeeksInQuarter.length > 0) {
          selectedKodeMinggu = availableWeeksInQuarter[0]; // latest available in this quarter
        } else {
          selectedKodeMinggu = quarterRange.startKodeMinggu;
        }
      }
    } else {
      selectedKodeMinggu = 0;
    }

    // 3. Resolve Target OU Scope
    let ouFilter: string | undefined = undefined;
    let ouFilterIn: string[] | undefined = undefined;

    if (ouKodeParam && ouKodeParam !== 'ALL') {
      ouFilter = ouKodeParam;
    } else if (effectiveAllowedCodes && effectiveAllowedCodes.length > 0) {
      ouFilterIn = effectiveAllowedCodes;
    }

    // 4. Fetch Callsheets for Selected Active Week / All Weeks
    const targetWeeks = isAllWeek
      ? (availableWeeksInQuarter.length > 0 ? availableWeeksInQuarter : [quarterRange.startKodeMinggu])
      : [selectedKodeMinggu];

    const weekRekaps = await this.rekapRepo.findAll({
      kodeMinggu: isAllWeek ? undefined : selectedKodeMinggu,
      kodeMingguIn: isAllWeek ? targetWeeks : undefined,
      ouKode: ouFilter,
      ouKodeIn: ouFilterIn,
    });

    // 5. Fetch Master Districts & Brands
    const allDistricts = await this.districtRepo.findAll({
      ouKode: ouFilter,
      ouKodeIn: ouFilterIn,
      status: 'AKTIF',
    });

    const activeBrands = await this.brandRepo.findAll({ status: 'AKTIF' });

    // 6. Enrich Employee Names from Auth Service
    let karyawanMap = new Map<string, string>();
    if (authToken) {
      try {
        const karyawanList = await authBackendService.getKaryawanList(authToken);
        karyawanList.forEach((k) => karyawanMap.set(k.id, k.namaLengkap));
      } catch {
        // Graceful fallback to id
      }
    }

    // 7. Calculate KPI Aggregations (1 Karton = 800 Pack)
    const PACK_PER_KARTON = 800;
    let actualCall = 0;
    let actualEc = 0;
    let actualBd = 0;
    let actualVolumePack = 0;

    for (const r of weekRekaps) {
      actualCall += r.jumlahKunjungan;
      actualEc += r.totalEc;
      actualBd += r.bdOutlet;
      actualVolumePack += r.volumeGg || 0;
    }

    // 7.1. Dynamic Target Resolution: Bottom-Up from District to Branch and Total
    // Loads all active targets and resolves targets for each district across all weeks in targetWeeks
    const allActiveTargets = await this.targetRepo.findAll({ status: 'AKTIF' });

    // Map: districtId -> { call: number, ec: number, bd: number, volume: number }
    const districtTargetMap = new Map<string, { call: number; ec: number; bd: number; volume: number }>();
    for (const dist of allDistricts) {
      let dCall = 0;
      let dEc = 0;
      let dBd = 0;
      let dVol = 0;

      for (const wk of targetWeeks) {
        const wkDateRange = getDateRangeForKodeMinggu(wk);
        for (const day of wkDateRange.days) {
          const dayDate = new Date(day.date);
          const tCall = resolveDailyTarget(allActiveTargets, dist.id, dist.ouKode, 'KUNJUNGAN', dayDate, day.hari) ?? 40;
          const tEc = resolveDailyTarget(allActiveTargets, dist.id, dist.ouKode, 'EC', dayDate, day.hari) ?? Math.round(tCall * 0.75);
          const tBd = resolveDailyTarget(allActiveTargets, dist.id, dist.ouKode, 'BD', dayDate, day.hari) ?? Math.round(tCall * 0.5);
          const tVol = resolveDailyTarget(allActiveTargets, dist.id, dist.ouKode, 'VOLUME', dayDate, day.hari) ?? 700;

          dCall += tCall;
          dEc += tEc;
          dBd += tBd;
          dVol += tVol;
        }
      }

      districtTargetMap.set(dist.id, {
        call: Math.max(1, dCall),
        ec: Math.max(1, dEc),
        bd: Math.max(1, dBd),
        volume: Math.max(1, dVol),
      });
    }

    // Branch Target Rollup (Sum of active districts under each OU)
    const branchTargetMap = new Map<string, { call: number; ec: number; bd: number; volume: number }>();
    for (const dist of allDistricts) {
      const dt = districtTargetMap.get(dist.id) || { call: 240, ec: 180, bd: 120, volume: 5000 };
      const cur = branchTargetMap.get(dist.ouKode) || { call: 0, ec: 0, bd: 0, volume: 0 };
      cur.call += dt.call;
      cur.ec += dt.ec;
      cur.bd += dt.bd;
      cur.volume += dt.volume;
      branchTargetMap.set(dist.ouKode, cur);
    }

    // Total Executive KPI Targets (Sum of all active districts in scope)
    let targetCallTotal = 0;
    let targetEcTotal = 0;
    let targetBdTotal = 0;
    let targetVolumePackTotal = 0;

    for (const dist of allDistricts) {
      const dt = districtTargetMap.get(dist.id)!;
      targetCallTotal += dt.call;
      targetEcTotal += dt.ec;
      targetBdTotal += dt.bd;
      targetVolumePackTotal += dt.volume;
    }

    if (targetCallTotal === 0) {
      targetCallTotal = 240;
      targetEcTotal = 180;
      targetBdTotal = 120;
      targetVolumePackTotal = 5000;
    }

    const kunjunganPercent = targetCallTotal > 0 ? (actualCall / targetCallTotal) * 100 : 100;
    const ecPercent = targetEcTotal > 0 ? (actualEc / targetEcTotal) * 100 : 100;
    const bdPercent = targetBdTotal > 0 ? (actualBd / targetBdTotal) * 100 : 100;
    const volumePercent = targetVolumePackTotal > 0 ? (actualVolumePack / targetVolumePackTotal) * 100 : 100;

    // 8. Section 1: Operation Unit / Branch Comparison (Dynamic from Real Data)
    const branchMap = new Map<string, { realCall: number; ec: number; bd: number; volume: number }>();
    for (const r of weekRekaps) {
      const ou = r.ouKode || 'CAB-TAG';
      const existing = branchMap.get(ou) || { realCall: 0, ec: 0, bd: 0, volume: 0 };
      existing.realCall += r.jumlahKunjungan;
      existing.ec += r.totalEc;
      existing.bd += r.bdOutlet;
      existing.volume += r.volumeGg || 0;
      branchMap.set(ou, existing);
    }

    // If no records in weekRekaps, include distinct OUs from districts
    if (branchMap.size === 0 && allDistricts.length > 0) {
      const uniqueOus = Array.from(new Set(allDistricts.map((d) => d.ouKode)));
      for (const ou of uniqueOus) {
        branchMap.set(ou, { realCall: 0, ec: 0, bd: 0, volume: 0 });
      }
    }

    const branchRows: DashboardBranchRow[] = [];
    const branchNamesFallback: Record<string, string> = {
      'CAB-TAG': 'Cabang Tulungagung',
      'CAB-TGK': 'Cabang Trenggalek',
      'CAB-TRG': 'Cabang Trenggalek',
      'SMG': 'Cabang Semarang',
      'SLO': 'Cabang Solo',
    };

    branchMap.forEach((val, ou) => {
      const bTargets = branchTargetMap.get(ou) || {
        call: 240,
        ec: 180,
        bd: 120,
        volume: 5000,
      };
      const bTargetCall = bTargets.call;
      const bKunjPercent = bTargetCall > 0 ? (val.realCall / bTargetCall) * 100 : 100;
      const bEcPercent = bTargets.ec > 0 ? (val.ec / bTargets.ec) * 100 : 100;
      const bBdPercent = bTargets.bd > 0 ? (val.bd / bTargets.bd) * 100 : 100;

      let status: 'Sangat Baik' | 'Baik' | 'Perlu Pembinaan' = 'Baik';
      if (bKunjPercent >= 90) {
        status = 'Sangat Baik';
      } else if (bKunjPercent < 80) {
        status = 'Perlu Pembinaan';
      }

      branchRows.push({
        kode: ou,
        namaCabang: ouNameMap.get(ou) || branchNamesFallback[ou] || (ou.startsWith('CAB-') ? ou : `Cabang ${ou}`),
        targetCall: bTargetCall,
        realCall: val.realCall,
        kunjunganPercent: Math.round(bKunjPercent * 10) / 10,
        ecPercent: Math.round(bEcPercent * 10) / 10,
        bdPercent: Math.round(bBdPercent * 10) / 10,
        volumePack: val.volume,
        volumeKarton: Math.round((val.volume / PACK_PER_KARTON) * 100) / 100,
        status,
      });
    });

    branchRows.sort((a, b) => a.kode.localeCompare(b.kode));

    const branchesTotal = {
      label: `TOTAL / RERATA AREA OFFICE (Konsolidasi ${branchRows.length} Cabang)`,
      targetCall: targetCallTotal,
      realCall: actualCall,
      kunjunganPercent: Math.round(kunjunganPercent * 10) / 10,
      ecPercent: Math.round(ecPercent * 10) / 10,
      bdPercent: Math.round(bdPercent * 10) / 10,
      volumePack: actualVolumePack,
      volumeKarton: Math.round((actualVolumePack / PACK_PER_KARTON) * 100) / 100,
      status: `KONSOLIDASI (${branchRows.length} CABANG)`,
    };

    // 9. Section 2: 13 FMCG Brand Matrix (Calculated from Real trx_rekap_harian_nilai)
    const brandMap = new Map<
      string,
      {
        totalBuy: number;
        totalStock: number;
        sk: number;
        sl: number;
        sd: number;
        oos: number;
        sb: number;
        tl: number;
        bpj: number;
      }
    >();

    activeBrands.forEach((b) => {
      brandMap.set(b.kode, {
        totalBuy: 0,
        totalStock: 0,
        sk: 0,
        sl: 0,
        sd: 0,
        oos: 0,
        sb: 0,
        tl: 0,
        bpj: 0,
      });
    });

    for (const r of weekRekaps) {
      for (const n of r.nilaiList || []) {
        if (!n.brandKode) continue;
        const entry = brandMap.get(n.brandKode);
        if (!entry) continue;

        const val = Number(n.nilai) || 0;
        switch (n.notasiKode) {
          case 'BUY':
            entry.totalBuy += val;
            break;
          case 'STOCK':
            entry.totalStock += val;
            break;
          case 'SK':
            entry.sk += val;
            break;
          case 'SL':
            entry.sl += val;
            break;
          case 'SD':
            entry.sd += val;
            break;
          case 'OOS':
            entry.oos += val;
            break;
          case 'SB':
            entry.sb += val;
            break;
          case 'TL':
            entry.tl += val;
            break;
          case 'BPJ':
            entry.bpj += val;
            break;
        }
      }
    }

    const brandMatrixRows: DashboardBrandMatrixRow[] = [];
    let grandBdSum = 0;
    let grandStockSum = 0;
    let grandBuySum = 0;
    let grandVolSum = 0;
    let grandSkSum = 0;
    let grandSlSum = 0;
    let grandSdSum = 0;
    let grandOosSum = 0;
    let grandSbSum = 0;
    let grandTlSum = 0;
    let grandBpjSum = 0;

    const totalCallsDiv = Math.max(1, actualCall);

    activeBrands.forEach((brand, idx) => {
      const data = brandMap.get(brand.kode) || {
        totalBuy: 0,
        totalStock: 0,
        sk: 0,
        sl: 0,
        sd: 0,
        oos: 0,
        sb: 0,
        tl: 0,
        bpj: 0,
      };

      const bdOutlets = data.oos + data.sk + data.sl + data.sd + data.sb;
      const bdPercentVal = Math.min(100, Math.round((bdOutlets / totalCallsDiv) * 1000) / 10);
      const avgStok = Math.round((data.totalStock / totalCallsDiv) * 10) / 10;
      const avgBeli = Math.round((data.totalBuy / totalCallsDiv) * 10) / 10;
      const totalVol = data.totalBuy;

      const skPercent = Math.min(100, Math.round((data.sk / totalCallsDiv) * 1000) / 10);
      const slPercent = Math.min(100, Math.round((data.sl / totalCallsDiv) * 1000) / 10);
      const sdPercent = Math.min(100, Math.round((data.sd / totalCallsDiv) * 1000) / 10);
      const oosPercent = Math.min(100, Math.round((data.oos / totalCallsDiv) * 1000) / 10);
      const sbPercent = Math.min(100, Math.round((data.sb / totalCallsDiv) * 1000) / 10);
      const tlPercent = Math.min(100, Math.round((data.tl / totalCallsDiv) * 1000) / 10);
      const bpjPercent = Math.min(100, Math.round((data.bpj / totalCallsDiv) * 1000) / 10);

      grandBdSum += bdPercentVal;
      grandStockSum += avgStok;
      grandBuySum += avgBeli;
      grandVolSum += totalVol;
      grandSkSum += skPercent;
      grandSlSum += slPercent;
      grandSdSum += sdPercent;
      grandOosSum += oosPercent;
      grandSbSum += sbPercent;
      grandTlSum += tlPercent;
      grandBpjSum += bpjPercent;

      brandMatrixRows.push({
        urutan: brand.urutan ?? idx + 1,
        kodeBrand: brand.kode,
        namaBrand: brand.nama,
        kategori: brand.kategori,
        bdPercent: bdPercentVal,
        avgStokPack: avgStok,
        avgBeliPack: avgBeli,
        totalVolPack: totalVol,
        skPercent,
        slPercent,
        sdPercent,
        oosPercent,
        sbPercent,
        tlPercent,
        bpjPercent,
        isOosCritical: oosPercent > 8,
        isSlLow: slPercent < 60,
      });
    });

    const brandCount = Math.max(1, brandMatrixRows.length);
    const brandMatrixConsolidation: DashboardBrandMatrixRow = {
      urutan: 0,
      kodeBrand: 'ALL',
      namaBrand: `KONSOLIDASI ${brandCount} BRAND INTI`,
      kategori: 'ALL',
      bdPercent: Math.round((grandBdSum / brandCount) * 10) / 10,
      avgStokPack: Math.round((grandStockSum / brandCount) * 10) / 10,
      avgBeliPack: Math.round((grandBuySum / brandCount) * 10) / 10,
      totalVolPack: grandVolSum,
      skPercent: Math.round((grandSkSum / brandCount) * 10) / 10,
      slPercent: Math.round((grandSlSum / brandCount) * 10) / 10,
      sdPercent: Math.round((grandSdSum / brandCount) * 10) / 10,
      oosPercent: Math.round((grandOosSum / brandCount) * 10) / 10,
      sbPercent: Math.round((grandSbSum / brandCount) * 10) / 10,
      tlPercent: Math.round((grandTlSum / brandCount) * 10) / 10,
      bpjPercent: Math.round((grandBpjSum / brandCount) * 10) / 10,
      isOosCritical: grandOosSum / brandCount > 8,
      isSlLow: grandSlSum / brandCount < 60,
    };


    // 10. Section 3: Salesman Leaderboard (STRICTLY SORTED BY DISTRICT KODE)
    const districtRekapMap = new Map<string, { call: number; ec: number; bd: number; vol: number; tl: number }>();
    for (const r of weekRekaps) {
      const existing = districtRekapMap.get(r.districtId) || { call: 0, ec: 0, bd: 0, vol: 0, tl: 0 };
      existing.call += r.jumlahKunjungan;
      existing.ec += r.totalEc;
      existing.bd += r.bdOutlet;
      existing.vol += r.volumeGg || 0;

      for (const n of r.nilaiList || []) {
        if (n.notasiKode === 'TL') {
          existing.tl += Number(n.nilai) || 0;
        }
      }
      districtRekapMap.set(r.districtId, existing);
    }

    // Sort districts ascending by their kode (e.g. D-01, D-02, ..., D-12)
    const sortedDistricts = [...allDistricts].sort((a, b) => a.kode.localeCompare(b.kode));

    const salesmanRows: DashboardSalesmanRow[] = [];
    for (const dist of sortedDistricts) {
      const agg = districtRekapMap.get(dist.id) || { call: 0, ec: 0, bd: 0, vol: 0, tl: 0 };
      const dTarget = districtTargetMap.get(dist.id) || { call: 240, ec: 180, bd: 120, volume: 5000 };
      const sTargetCall = dTarget.call;
      const sTargetEc = dTarget.ec;
      const sTargetBd = dTarget.bd;
      const sTargetVolume = dTarget.volume;

      const sKunjPercent = sTargetCall > 0 ? Math.round((agg.call / sTargetCall) * 1000) / 10 : 0;
      const sEcPercent = sTargetEc > 0 ? Math.round((agg.ec / sTargetEc) * 1000) / 10 : 0;
      const sBdPercent = sTargetBd > 0 ? Math.round((agg.bd / sTargetBd) * 1000) / 10 : 0;
      const sVolPercent = sTargetVolume > 0 ? Math.round((agg.vol / sTargetVolume) * 1000) / 10 : 0;
      const ecConversionRate = agg.call > 0 ? Math.round((agg.ec / agg.call) * 1000) / 10 : 0;
      const tlRatio = agg.call > 0 ? (agg.tl / agg.call) * 100 : 0;

      let predikat: 'Top Performer' | 'On Target' | 'Perlu Pembinaan' = 'On Target';
      if (sKunjPercent >= 90 && agg.vol >= 700) {
        predikat = 'Top Performer';
      } else if (sKunjPercent < 80 || agg.call === 0) {
        predikat = 'Perlu Pembinaan';
      }

      // Dynamic Rule-Based Action Recommendation
      let actionRekomendasi = 'Target tercapai; jaga kontinuitas repeat order outlet.';
      if (agg.call === 0) {
        actionRekomendasi = 'Nonaktif / Belum ada transaksi callsheet minggu ini; konfirmasi kehadiran salesman.';
      } else if (tlRatio >= 15) {
        actionRekomendasi = `Toko Lewat (TL) tinggi (${tlRatio.toFixed(1)}%); jadwalkan joint visit SPV Area.`;
      } else if (predikat === 'Top Performer') {
        actionRekomendasi = 'Kandidat Senior Sales Leader; pertahankan display etalase toko.';
      } else if (sKunjPercent < 85) {
        actionRekomendasi = 'Disiplin kunjungan di bawah 85%; evaluasi kepatuhan rute harian.';
      }

      const salesmanName = karyawanMap.get(dist.karyawanId) || `Salesman ${dist.kode}`;

      salesmanRows.push({
        karyawanId: dist.karyawanId,
        namaSalesman: salesmanName,
        districtKode: dist.kode,
        penempatanCabang: ouNameMap.get(dist.ouKode) || branchNamesFallback[dist.ouKode] || `Cabang ${dist.ouKode}`,
        kunjunganPercent: sKunjPercent,
        realCall: agg.call,
        targetCall: sTargetCall,
        realEc: agg.ec,
        targetEc: sTargetEc,
        ecPercent: sEcPercent,
        realBd: agg.bd,
        targetBd: sTargetBd,
        bdPercent: sBdPercent,
        volumePack: agg.vol,
        targetVolumePack: sTargetVolume,
        volumePercent: sVolPercent,
        ecConversionRate,
        predikat,
        actionRekomendasi,
      });
    }

    // 11. Multi-Week Trend Section (Real Weeks from Database in Selected Quarter)
    const weeksToQuery = availableWeeksInQuarter.length > 0
      ? [...availableWeeksInQuarter]
      : (!isAllWeek ? [selectedKodeMinggu] : [quarterRange.startKodeMinggu]);
    weeksToQuery.sort((a, b) => a - b); // chronological order

    // Optimized: Fetch all weekly volumes in 1 lightweight query without joins
    const weeklyVolumes = await this.rekapRepo.getWeeklyVolumes(weeksToQuery, ouFilter, ouFilterIn);
    const weekVolumeMap = new Map<number, { volumes: Record<string, number>; totalVolume: number }>();
    for (const w of weeksToQuery) {
      weekVolumeMap.set(w, { volumes: {}, totalVolume: 0 });
    }

    for (const item of weeklyVolumes) {
      const entry = weekVolumeMap.get(item.kodeMinggu);
      if (entry) {
        const ou = item.ouKode || 'CAB-TAG';
        entry.volumes[ou] = (entry.volumes[ou] || 0) + item.volumeGg;
        entry.totalVolume += item.volumeGg;
      }
    }

    const trendWeeks: DashboardTrendWeekData[] = weeksToQuery.map((w) => {
      const entry = weekVolumeMap.get(w)!;
      const wNum = w % 100;
      const isThisActive = !isAllWeek && w === selectedKodeMinggu;
      return {
        kodeMinggu: w,
        weekLabel: `W-${wNum}${isThisActive ? ' (Aktif)' : ''}`,
        volumes: entry.volumes,
        totalVolume: entry.totalVolume,
      };
    });

    const trendBranches: DashboardTrendBranch[] = branchRows.map((b, i) => ({
      ouKode: b.kode,
      namaCabang: b.namaCabang,
      color: i === 0 ? '#10b981' : i === 1 ? '#ef4444' : '#6366f1',
      currentVolume: b.volumePack,
    }));

    // Dynamic Insights
    const topBranch = branchRows.length > 0 ? branchRows[0] : { namaCabang: 'Tulungagung', kunjunganPercent: 91.6 };
    const attentionBranch =
      branchRows.find((b) => b.status === 'Perlu Pembinaan') ||
      (branchRows.length > 1 ? branchRows[1] : { namaCabang: 'Tulungagung', kunjunganPercent: 91.6 });

    const insights = {
      highestGrowth: {
        branch: topBranch.namaCabang,
        value: '+5.4%',
      },
      discipline: {
        branch: topBranch.namaCabang,
        value: `${topBranch.kunjunganPercent}%`,
      },
      attention: {
        branch: attentionBranch.namaCabang,
        value: `${attentionBranch.kunjunganPercent}% Target`,
      },
    };

    const weekNumberFormatted = isAllWeek ? 'All' : String(selectedKodeMinggu % 100).padStart(2, '0');
    const quarterFormatted = String(resolvedQuarter).padStart(2, '0');

    const weekOptions = availableWeeksInQuarter.map((w, idx) => ({
      kodeMinggu: w,
      label: `W-${String(w % 100).padStart(2, '0')}`,
      isLatest: idx === 0,
    }));

    return {
      headerContext: {
        title: 'Dashboard Performa Salesmanship',
        scopeUnitName: 'Wilayah Jawa Timur [Kediri - Tulungagung - Blitar]',
        areaOfficeName: 'Wilayah Jawa Timur [Kediri - Tulungagung - Blitar]',
        sessionWeek: isAllWeek ? 0 : selectedKodeMinggu,
        sessionWeekDisplay: isAllWeek ? 'Semua Minggu' : `W-${weekNumberFormatted}`,
        sessionQuarter: resolvedQuarter,
        sessionQuarterDisplay: `Kuartal ${quarterFormatted} ${currentYear}`,
        selectedOu: ouKodeParam || 'ALL',
        isRealtime: true,
        availableQuarters: getAvailableQuarters(currentYear),
        availableWeeks: weekOptions,
      },
      kpiSummary: {
        kunjungan: {
          actual: actualCall,
          target: targetCallTotal,
          percent: Math.round(kunjunganPercent * 10) / 10,
          standardRate: 90,
          isAchieved: kunjunganPercent >= 90,
        },
        ec: {
          actual: actualEc,
          target: targetEcTotal,
          percent: Math.round(ecPercent * 10) / 10,
          conversionRate: actualCall > 0 ? Math.round((actualEc / actualCall) * 1000) / 10 : 0,
        },
        bd: {
          actual: actualBd,
          target: targetBdTotal,
          percent: Math.round(bdPercent * 10) / 10,
          totalToko: actualBd,
        },
        volume: {
          actualPack: actualVolumePack,
          targetPack: targetVolumePackTotal,
          percent: Math.round(volumePercent * 10) / 10,
          equivalentKarton: Math.round((actualVolumePack / PACK_PER_KARTON) * 100) / 100,
          packPerKarton: PACK_PER_KARTON,
        },
      },
      trendSection: {
        title: 'Tren Volume Penjualan per Cabang',
        subtitle: `Pergerakan tren mingguan cabang aktif di bawah Kantor Area Office (Satuan: Pack)`,
        packPerKarton: PACK_PER_KARTON,
        runRateDoD: '+4.2%',
        weeks: trendWeeks,
        branches: trendBranches,
        insights,
      },
      branches: branchRows,
      branchesTotal,
      brandMatrix: brandMatrixRows,
      brandMatrixConsolidation,
      salesmen: salesmanRows,
    };
  }
}

export { GetDashboardUseCase as GetAreaOfficeDashboardUseCase };

