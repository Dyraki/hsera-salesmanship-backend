import { IRekapHarianRepository } from '../../../domain/repositories/IRekapHarianRepository';
import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { IBrandRepository } from '../../../domain/repositories/IBrandRepository';
import { ITargetRepository } from '../../../domain/repositories/ITargetRepository';
import { IKunciMingguRepository } from '../../../domain/repositories/IKunciMingguRepository';
import { AppError } from '../../../domain/errors/AppError';
import { getIsoWeekInfo, getDateRangeForKodeMinggu, formatDateOnly } from '../../../infrastructure/utils/dateIsoUtils';
import { authBackendService } from '../../../infrastructure/services/AuthBackendServiceClient';

export interface WeeklyDistrictReportInput {
  districtId: string;
  kodeMinggu?: number;
  kategori?: string;
  statusRekap?: string;
  ouKode?: string;
  ouKodeIn?: string[];
  token?: string;
}

export interface BrandMatrixItem {
  urutan: number;
  brandId: string;
  kode: string;
  nama: string;
  kategori: string;
  notasi: {
    skPercent: number;
    slPercent: number;
    sdPercent: number;
    oosPercent: number;
    sbPercent: number;
    tlPercent: number;
    bpjPercent: number;
    bdPercent: number;
  };
  volume: {
    avgStock: number;
    avgBuy: number;
    totalVol: number;
  };
}

export interface WeeklyDistrictNotationAnalysis {
  totalKunjungan: number;
  stockLevel: {
    totalOutlet: number;
    sl: number;
    slPercent: number;
    sk: number;
    skPercent: number;
    oos: number;
    oosPercent: number;
  };
  tradeProgram: {
    sd: number;
    sdPercent: number;
    tl: number;
    tlPercent: number;
  };
  penetration: {
    bd: number;
    bdPercent: number;
    bpj: number;
    bpjPercent: number;
    sb: number;
    sbPercent: number;
  };
}

export interface WeeklyDistrictReportResponse {
  header: {
    kodeMinggu: number;
    kodeMingguDisplay: string;
    startDate: string;
    endDate: string;
    isLocked: boolean;
    lockStatusText: string;
    district: {
      id: string;
      kode: string;
      nama: string;
      ouKode: string;
      karyawanId: string;
      karyawanNama: string;
      lastSync?: string | null;
    };
  };
  kpiSummary: {
    kunjungan: {
      target: number;
      actual: number;
      percent: number;
      gap: number;
    };
    ec: {
      target: number;
      actual: number;
      percentFromTarget: number;
      percentFromKunjungan: number;
      nonTransaksi: number;
    };
    bd: {
      target: number;
      actual: number;
      percentFromTarget: number;
      percentFromKunjungan: number;
    };
    volume: {
      target: number;
      actual: number;
      percentFromTarget: number;
    };
    territoryReachIndex: number;
  };
  dailyTrend: Array<{
    hari: number;
    namaHari: string;
    date: string;
    actual: number;
    target: number;
    percent: number;
    statusRekap: string | null;
  }>;
  notationAnalysis: WeeklyDistrictNotationAnalysis;
  brandMatrix: {
    totalSkuAktif: number;
    totalKunjunganMingguan: number;
    brands: BrandMatrixItem[];
    summaryRow: {
      label: string;
      skPercent: number;
      slPercent: number;
      sdPercent: number;
      oosPercent: number;
      sbPercent: number;
      tlPercent: number;
      bpjPercent: number;
      bdPercent: number;
      avgStock: number;
      avgBuy: number;
      totalVol: number;
    };
  };
}

export class GetWeeklyDistrictReportUseCase {
  constructor(
    private rekapRepo: IRekapHarianRepository,
    private districtRepo: IDistrictRepository,
    private brandRepo: IBrandRepository,
    private targetRepo: ITargetRepository,
    private lockRepo: IKunciMingguRepository
  ) {}

  async execute(input: WeeklyDistrictReportInput): Promise<WeeklyDistrictReportResponse> {
    const { districtId, kategori, statusRekap, ouKode, ouKodeIn, token } = input;

    // 1. Validate District
    const district = await this.districtRepo.findById(districtId);
    if (!district) {
      throw AppError.notFound('District tidak ditemukan.');
    }

    if (ouKode && district.ouKode !== ouKode) {
      throw AppError.forbidden('District tidak sesuai dengan Unit Operasi yang diminta.');
    }
    if (ouKodeIn && ouKodeIn.length > 0 && !ouKodeIn.includes(district.ouKode)) {
      throw AppError.forbidden('Akses ke Unit Operasi district ini ditolak.');
    }

    // 2. Resolve Week Information
    const currentWeekInfo = getIsoWeekInfo(new Date());
    const kodeMinggu = input.kodeMinggu || currentWeekInfo.kodeMinggu;
    const weekRange = getDateRangeForKodeMinggu(kodeMinggu);

    const yy = String(Math.floor(kodeMinggu / 100)).slice(-2);
    const ww = String(kodeMinggu % 100).padStart(2, '0');
    const kodeMingguDisplay = `${yy}${ww}`;

    // 3. Resolve Lock Status
    const lock = await this.lockRepo.findByKodeMinggu(kodeMinggu);
    const isLocked = lock ? lock.isLocked() : false;

    // 4. Enrich Salesman Name from Auth Backend
    let karyawanNama = district.karyawanId;
    try {
      const karyawanList = await authBackendService.getKaryawanList(token);
      const matchedKaryawan = karyawanList.find((k) => k.id === district.karyawanId);
      if (matchedKaryawan) {
        karyawanNama = matchedKaryawan.namaLengkap;
      }
    } catch {
      // Graceful fallback to karyawanId
    }

    // 5. Query Active Brands (Dynamic from mst_brand, ordered by urutan ASC)
    const brandFilter: { status: string; kategori?: string } = { status: 'AKTIF' };
    if (kategori && kategori !== 'ALL' && kategori !== 'Semua') {
      brandFilter.kategori = kategori;
    }
    const brands = await this.brandRepo.findAll(brandFilter);

    // 6. Query Rekap Callsheet for this District and Week
    const rekapsRaw = await this.rekapRepo.findByWeek(kodeMinggu, districtId, district.ouKode);
    const rekaps =
      statusRekap === 'FINAL'
        ? rekapsRaw.filter((r) => r.statusRekap === 'FINAL')
        : rekapsRaw;

    const rekapByDay = new Map<number, any>();
    let lastSyncTime: Date | null = null;
    let finalDaysCount = 0;

    rekaps.forEach((r) => {
      rekapByDay.set(r.hariKunjungan, r);
      if (r.statusRekap === 'FINAL') finalDaysCount++;
      if (!lastSyncTime || r.updatedAt > lastSyncTime) {
        lastSyncTime = r.updatedAt;
      }
    });

    const lockStatusText = isLocked
      ? 'Minggu sudah dikunci (FINAL)'
      : finalDaysCount > 0
      ? `Minggu belum dikunci - ${finalDaysCount}/6 hari FINAL`
      : 'Minggu belum dikunci - belum ada lembar FINAL';

    // 7. Calculate Targets
    const activeTargets = await this.targetRepo.findAll({ status: 'AKTIF' });

    const getMetricTargetForDay = (
      jenis: 'KUNJUNGAN' | 'EC' | 'BD' | 'VOLUME',
      dayDateStr: string,
      dayNum: number
    ): number => {
      const checkTime = new Date(`${dayDateStr}T00:00:00Z`).getTime();

      const matchDate = (t: any) => {
        const tStart = new Date(t.berlakuDari).getTime();
        if (tStart > checkTime) return false;
        if (t.berlakuSampai) {
          const tEnd = new Date(t.berlakuSampai).getTime();
          if (tEnd < checkTime) return false;
        }
        return true;
      };

      // Priority 1: District-specific + specific dayNum
      const dDay = activeTargets.find(
        (t) => t.districtId === district.id && t.jenisTarget === jenis && t.hariKunjungan === dayNum && matchDate(t)
      );
      if (dDay) return dDay.nilai;

      // Priority 1b: District-specific + Senin-Jumat (7)
      if (dayNum >= 1 && dayNum <= 5) {
        const dWeekday = activeTargets.find(
          (t) => t.districtId === district.id && t.jenisTarget === jenis && t.hariKunjungan === 7 && matchDate(t)
        );
        if (dWeekday) return dWeekday.nilai;
      }

      // Priority 2: District-specific flat
      const dFlat = activeTargets.find(
        (t) =>
          t.districtId === district.id &&
          t.jenisTarget === jenis &&
          (t.hariKunjungan === null || t.hariKunjungan === undefined) &&
          matchDate(t)
      );
      if (dFlat) return dFlat.nilai;

      // Priority 2a: OU-specific + specific dayNum
      const ouDay = activeTargets.find(
        (t) => !t.districtId && t.ouKode === district.ouKode && t.jenisTarget === jenis && t.hariKunjungan === dayNum && matchDate(t)
      );
      if (ouDay) return ouDay.nilai;

      // Priority 2b: OU-specific + Senin-Jumat (7)
      if (dayNum >= 1 && dayNum <= 5) {
        const ouWeekday = activeTargets.find(
          (t) => !t.districtId && t.ouKode === district.ouKode && t.jenisTarget === jenis && t.hariKunjungan === 7 && matchDate(t)
        );
        if (ouWeekday) return ouWeekday.nilai;
      }

      // Priority 2c: OU-specific flat
      const ouFlat = activeTargets.find(
        (t) =>
          !t.districtId &&
          t.ouKode === district.ouKode &&
          t.jenisTarget === jenis &&
          (t.hariKunjungan === null || t.hariKunjungan === undefined) &&
          matchDate(t)
      );
      if (ouFlat) return ouFlat.nilai;

      // Priority 3: Global default + specific dayNum
      const gDay = activeTargets.find(
        (t) => !t.districtId && !t.ouKode && t.jenisTarget === jenis && t.hariKunjungan === dayNum && matchDate(t)
      );
      if (gDay) return gDay.nilai;

      // Priority 3b: Global default + Senin-Jumat (7)
      if (dayNum >= 1 && dayNum <= 5) {
        const gWeekday = activeTargets.find(
          (t) => !t.districtId && !t.ouKode && t.jenisTarget === jenis && t.hariKunjungan === 7 && matchDate(t)
        );
        if (gWeekday) return gWeekday.nilai;
      }

      // Priority 4: Global flat default
      const gFlat = activeTargets.find(
        (t) =>
          !t.districtId &&
          !t.ouKode &&
          t.jenisTarget === jenis &&
          (t.hariKunjungan === null || t.hariKunjungan === undefined) &&
          matchDate(t)
      );
      if (gFlat) return gFlat.nilai;

      // Fallbacks
      if (jenis === 'KUNJUNGAN') return dayNum === 6 ? 20 : 40;
      if (jenis === 'EC') return 30;
      if (jenis === 'BD') return 20;
      return 0;
    };

    // 8. Build Daily Trend & Weekly Actuals
    const shortDaysMap: Record<number, string> = {
      1: 'Sen',
      2: 'Sel',
      3: 'Rab',
      4: 'Kam',
      5: 'Jum',
      6: 'Sab',
    };

    let targetKunjunganTotal = 0;
    let targetEcTotal = 0;
    let targetBdTotal = 0;
    let targetVolumeTotal = 0;

    let actualKunjunganTotal = 0;
    let actualEcTotal = 0;
    let actualBdTotal = 0;
    let actualVolumeTotal = 0;

    const dailyTrend = weekRange.days.map((wDay) => {
      const r = rekapByDay.get(wDay.hari);
      const targetCm = getMetricTargetForDay('KUNJUNGAN', wDay.date, wDay.hari);
      const actualCm = r ? r.jumlahKunjungan : 0;
      const percent = targetCm > 0 ? Math.round((actualCm / targetCm) * 100) : 0;

      targetKunjunganTotal += targetCm;
      targetEcTotal += getMetricTargetForDay('EC', wDay.date, wDay.hari);
      targetBdTotal += getMetricTargetForDay('BD', wDay.date, wDay.hari);
      targetVolumeTotal += getMetricTargetForDay('VOLUME', wDay.date, wDay.hari);

      if (r) {
        actualKunjunganTotal += r.jumlahKunjungan || 0;
        actualEcTotal += r.totalEc || 0;
        actualBdTotal += r.bdOutlet || 0;
        actualVolumeTotal += Number(r.volumeGg) || 0;
      }

      return {
        hari: wDay.hari,
        namaHari: shortDaysMap[wDay.hari] || wDay.namaHari,
        date: wDay.date,
        actual: actualCm,
        target: targetCm,
        percent,
        statusRekap: r ? r.statusRekap : null,
      };
    });

    // 9. Build KPI Summary
    const percentKunjungan =
      targetKunjunganTotal > 0 ? Math.round((actualKunjunganTotal / targetKunjunganTotal) * 100) : 0;
    const percentEc =
      actualKunjunganTotal > 0
        ? Math.round((actualEcTotal / actualKunjunganTotal) * 1000) / 10
        : 0;
    const percentEcTarget =
      targetEcTotal > 0 ? Math.round((actualEcTotal / targetEcTotal) * 100) : 0;
    const percentBdTarget =
      targetBdTotal > 0 ? Math.round((actualBdTotal / targetBdTotal) * 1000) / 10 : 0;
    const percentBdKunjungan =
      actualKunjunganTotal > 0
        ? Math.round((actualBdTotal / actualKunjunganTotal) * 1000) / 10
        : 0;
    const percentVolume =
      targetVolumeTotal > 0 ? Math.round((actualVolumeTotal / targetVolumeTotal) * 100) : 0;

    const callComplianceRatio =
      targetKunjunganTotal > 0 ? Math.min(1.0, actualKunjunganTotal / targetKunjunganTotal) : 0;
    const bdAvailabilityRatio =
      actualKunjunganTotal > 0 ? Math.min(1.0, actualBdTotal / actualKunjunganTotal) : 0;
    const territoryReachIndex = Math.round(callComplianceRatio * bdAvailabilityRatio * 1000) / 10;

    // 10. Build Brand Matrix (Dynamic based on brands list from mst_brand)
    const totalKunjungan = actualKunjunganTotal;
    const denominator = totalKunjungan > 0 ? totalKunjungan : 1;
    const daysWithDataCount = rekaps.filter((r) => r.jenisRekap === 'NORMAL').length || 1;

    // Aggregate notasi values per brand across the week
    const brandValueSums: Record<string, Record<string, number>> = {};
    for (const b of brands) {
      brandValueSums[b.id] = {
        SK: 0,
        SL: 0,
        SD: 0,
        OOS: 0,
        SB: 0,
        TL: 0,
        BPJ: 0,
        STOCK: 0,
        BUY: 0,
      };
    }

    rekaps.forEach((r) => {
      if (r.nilaiList) {
        r.nilaiList.forEach((item: any) => {
          if (brandValueSums[item.brandId] && item.notasiKode) {
            brandValueSums[item.brandId][item.notasiKode] =
              (brandValueSums[item.brandId][item.notasiKode] || 0) + Number(item.nilai || 0);
          }
        });
      }
    });

    let sumSkPercent = 0;
    let sumSlPercent = 0;
    let sumSdPercent = 0;
    let sumOosPercent = 0;
    let sumSbPercent = 0;
    let sumTlPercent = 0;
    let sumBpjPercent = 0;
    let sumBdPercent = 0;
    let sumAvgStock = 0;
    let sumAvgBuy = 0;
    let sumTotalVol = 0;

    const brandMatrixItems: BrandMatrixItem[] = brands.map((b, idx) => {
      const vals = brandValueSums[b.id];
      const sk = vals.SK || 0;
      const sl = vals.SL || 0;
      const sd = vals.SD || 0;
      const oos = vals.OOS || 0;
      const sb = vals.SB || 0;
      const tl = vals.TL || 0;
      const bpj = vals.BPJ || 0;
      const bd = oos + sk + sl + sd + sb;
      const stock = vals.STOCK || 0;
      const buy = vals.BUY || 0;

      const skPercent = totalKunjungan > 0 ? Math.round((sk / denominator) * 1000) / 10 : 0;
      const slPercent = totalKunjungan > 0 ? Math.round((sl / denominator) * 1000) / 10 : 0;
      const sdPercent = totalKunjungan > 0 ? Math.round((sd / denominator) * 1000) / 10 : 0;
      const oosPercent = totalKunjungan > 0 ? Math.round((oos / denominator) * 1000) / 10 : 0;
      const sbPercent = totalKunjungan > 0 ? Math.round((sb / denominator) * 1000) / 10 : 0;
      const tlPercent = totalKunjungan > 0 ? Math.round((tl / denominator) * 1000) / 10 : 0;
      const bpjPercent = totalKunjungan > 0 ? Math.round((bpj / denominator) * 1000) / 10 : 0;
      const bdPercent = totalKunjungan > 0 ? Math.round((bd / denominator) * 1000) / 10 : 0;

      const avgStock = Math.round((stock / daysWithDataCount) * 10) / 10;
      const avgBuy = Math.round((buy / daysWithDataCount) * 10) / 10;
      const totalVol = Math.round(buy * 10) / 10;

      sumSkPercent += skPercent;
      sumSlPercent += slPercent;
      sumSdPercent += sdPercent;
      sumOosPercent += oosPercent;
      sumSbPercent += sbPercent;
      sumTlPercent += tlPercent;
      sumBpjPercent += bpjPercent;
      sumBdPercent += bdPercent;
      sumAvgStock += avgStock;
      sumAvgBuy += avgBuy;
      sumTotalVol += totalVol;

      return {
        urutan: idx + 1,
        brandId: b.id,
        kode: b.kode,
        nama: b.nama,
        kategori: b.kategori,
        notasi: {
          skPercent,
          slPercent,
          sdPercent,
          oosPercent,
          sbPercent,
          tlPercent,
          bpjPercent,
          bdPercent,
        },
        volume: {
          avgStock,
          avgBuy,
          totalVol,
        },
      };
    });

    const brandCount = brands.length > 0 ? brands.length : 1;

    const summaryRow = {
      label: `RINGKASAN TOTAL MINGGUAN (${totalKunjungan} CALLS)`,
      skPercent: Math.round((sumSkPercent / brandCount) * 10) / 10,
      slPercent: Math.round((sumSlPercent / brandCount) * 10) / 10,
      sdPercent: Math.round((sumSdPercent / brandCount) * 10) / 10,
      oosPercent: Math.round((sumOosPercent / brandCount) * 10) / 10,
      sbPercent: Math.round((sumSbPercent / brandCount) * 10) / 10,
      tlPercent: Math.round((sumTlPercent / brandCount) * 10) / 10,
      bpjPercent: Math.round((sumBpjPercent / brandCount) * 10) / 10,
      bdPercent: Math.round((sumBdPercent / brandCount) * 10) / 10,
      avgStock: Math.round((sumAvgStock / brandCount) * 10) / 10,
      avgBuy: Math.round((sumAvgBuy / brandCount) * 10) / 10,
      totalVol: Math.round(sumTotalVol * 10) / 10,
    };

    // 11. Build Notation Analysis (Stock Level, Trade Program, Penetration)
    // Sourced from anchor brand (primary active brand or brand with highest activity)
    const anchorBrand = brands.length > 0
      ? brands.reduce((prev, curr) => {
          const pVals = brandValueSums[prev.id];
          const cVals = brandValueSums[curr.id];
          const pCount = (pVals?.SL || 0) + (pVals?.SK || 0) + (pVals?.OOS || 0);
          const cCount = (cVals?.SL || 0) + (cVals?.SK || 0) + (cVals?.OOS || 0);
          return cCount > pCount ? curr : prev;
        }, brands[0])
      : null;

    const aVals = anchorBrand ? brandValueSums[anchorBrand.id] : null;
    const sl = aVals ? aVals.SL || 0 : 0;
    const sk = aVals ? aVals.SK || 0 : 0;
    const oos = aVals ? aVals.OOS || 0 : 0;

    // Level stok (outlet)
    const slPercent = totalKunjungan > 0 ? Math.round((sl / denominator) * 1000) / 10 : 0;
    const skPercent = totalKunjungan > 0 ? Math.round((sk / denominator) * 1000) / 10 : 0;
    const oosPercent = totalKunjungan > 0 ? Math.round((oos / denominator) * 1000) / 10 : 0;

    // Trade Program (SD: Stock Display / Ambalan) & Layanan (TL: Toko Lewat)
    // Captured from maximum brand representation or anchor brand
    const sd = brands.reduce((max, b) => Math.max(max, brandValueSums[b.id]?.SD || 0), aVals?.SD || 0);
    const tl = brands.reduce((max, b) => Math.max(max, brandValueSums[b.id]?.TL || 0), aVals?.TL || 0);
    const sdPercent = totalKunjungan > 0 ? Math.round((sd / denominator) * 1000) / 10 : 0;
    const tlPercent = totalKunjungan > 0 ? Math.round((tl / denominator) * 1000) / 10 : 0;

    // Penetrasi & Perilaku Toko (BD, BPJ, SB)
    const bd = actualBdTotal;
    const bdPercent = percentBdKunjungan;
    const bpj = aVals ? aVals.BPJ || 0 : 0;
    const bpjPercent = totalKunjungan > 0 ? Math.round((bpj / denominator) * 1000) / 10 : 0;
    const sb = aVals ? aVals.SB || 0 : 0;
    const sbPercent = totalKunjungan > 0 ? Math.round((sb / denominator) * 1000) / 10 : 0;

    const notationAnalysis: WeeklyDistrictNotationAnalysis = {
      totalKunjungan,
      stockLevel: {
        totalOutlet: totalKunjungan,
        sl,
        slPercent,
        sk,
        skPercent,
        oos,
        oosPercent,
      },
      tradeProgram: {
        sd,
        sdPercent,
        tl,
        tlPercent,
      },
      penetration: {
        bd,
        bdPercent,
        bpj,
        bpjPercent,
        sb,
        sbPercent,
      },
    };

    return {
      header: {
        kodeMinggu,
        kodeMingguDisplay,
        startDate: formatDateOnly(weekRange.startDate),
        endDate: formatDateOnly(weekRange.endDate),
        isLocked,
        lockStatusText,
        district: {
          id: district.id,
          kode: district.kode,
          nama: `${district.kode} - ${district.ouKode}`,
          ouKode: district.ouKode,
          karyawanId: district.karyawanId,
          karyawanNama,
          lastSync: lastSyncTime ? (lastSyncTime as Date).toISOString() : null,
        },
      },
      kpiSummary: {
        kunjungan: {
          target: targetKunjunganTotal,
          actual: actualKunjunganTotal,
          percent: percentKunjungan,
          gap: actualKunjunganTotal - targetKunjunganTotal,
        },
        ec: {
          target: targetEcTotal,
          actual: actualEcTotal,
          percentFromTarget: percentEcTarget,
          percentFromKunjungan: percentEc,
          nonTransaksi: Math.max(0, actualKunjunganTotal - actualEcTotal),
        },
        bd: {
          target: targetBdTotal,
          actual: actualBdTotal,
          percentFromTarget: percentBdTarget,
          percentFromKunjungan: percentBdKunjungan,
        },
        volume: {
          target: targetVolumeTotal,
          actual: Math.round(actualVolumeTotal * 100) / 100,
          percentFromTarget: percentVolume,
        },
        territoryReachIndex,
      },
      dailyTrend,
      notationAnalysis,
      brandMatrix: {
        totalSkuAktif: brands.length,
        totalKunjunganMingguan: totalKunjungan,
        brands: brandMatrixItems,
        summaryRow,
      },
    };
  }
}
