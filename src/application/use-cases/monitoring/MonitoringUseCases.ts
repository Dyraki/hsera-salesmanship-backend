import { IRekapHarianRepository } from '../../../domain/repositories/IRekapHarianRepository';
import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { IBrandRepository } from '../../../domain/repositories/IBrandRepository';
import { INotasiRepository } from '../../../domain/repositories/INotasiRepository';
import { IKunciMingguRepository } from '../../../domain/repositories/IKunciMingguRepository';
import { ITargetRepository } from '../../../domain/repositories/ITargetRepository';
import { getDateRangeForKodeMinggu, getIsoWeekInfo, formatDateOnly } from '../../../infrastructure/utils/dateIsoUtils';
import { authBackendService } from '../../../infrastructure/services/AuthBackendServiceClient';

export interface DistrictKpiAchievement {
  target: {
    kunjungan: number;
    ec: number;
    bd: number;
    volume: number;
  };
  actual: {
    kunjungan: number;
    ec: number;
    bd: number;
    volume: number;
  };
  percent: {
    kunjungan: number;
    ec: number;
    bd: number;
    volume: number;
    overall: number;
  };
}

export interface WeeklyDistrictMonitoringRow {
  districtId: string;
  districtKode: string;
  ouKode: string;
  karyawanId: string;
  karyawanName: string;
  days: Array<{
    hari: number; // 1..6
    namaHari: string;
    date: string;
    status: 'TERISI' | 'TIDAK_ADA_KUNJUNGAN' | 'KOSONG';
    statusRekap?: 'DRAFT' | 'FINAL' | null;
    rekapId?: string | null;
    jumlahKunjungan: number;
    totalEc: number;
    bdOutlet: number;
    volumeGg?: number | null;
    alasan?: string | null;
  }>;
  totalHariTerisi: number;
  persentaseLengkap: number;
  kpiAchievement: DistrictKpiAchievement;
}

export interface WeeklyMonitoringResponse {
  kodeMinggu: number;
  kodeMingguDisplay: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
  districts: WeeklyDistrictMonitoringRow[];
}

export class GetWeeklyMonitoringUseCase {
  constructor(
    private rekapRepo: IRekapHarianRepository,
    private districtRepo: IDistrictRepository,
    private lockRepo: IKunciMingguRepository,
    private targetRepo: ITargetRepository
  ) {}

  async execute(
    kodeMingguInput?: number,
    ouKode?: string,
    ouKodeIn?: string[],
    token?: string
  ): Promise<WeeklyMonitoringResponse> {
    const currentWeekInfo = getIsoWeekInfo(new Date());
    const kodeMinggu = kodeMingguInput || currentWeekInfo.kodeMinggu;

    const weekRange = getDateRangeForKodeMinggu(kodeMinggu);
    const lock = await this.lockRepo.findByKodeMinggu(kodeMinggu);
    const isLocked = lock ? lock.isLocked() : false;

    // Load districts
    const districts = await this.districtRepo.findAll({
      ouKode,
      ouKodeIn,
      status: 'AKTIF',
    });

    // Load rekap for this week
    const rekapList = await this.rekapRepo.findAll({
      kodeMinggu,
      ouKode,
      ouKodeIn,
    });

    // Enrich salesman names
    const karyawanList = await authBackendService.getKaryawanList(token);
    const karyawanMap = new Map(karyawanList.map((k) => [k.id, k.namaLengkap]));

    // Map rekap by districtId and hariKunjungan (1..6)
    const rekapMap = new Map<string, any>();
    for (const r of rekapList) {
      rekapMap.set(`${r.districtId}_${r.hariKunjungan}`, r);
    }

    // Load active targets for calculation
    const activeTargets = await this.targetRepo.findAll({
      status: 'AKTIF',
    });

    const rows: WeeklyDistrictMonitoringRow[] = districts.map((dist) => {
      let filledDaysCount = 0;

      const dayCells = weekRange.days.map((wDay) => {
        const key = `${dist.id}_${wDay.hari}`;
        const rekap = rekapMap.get(key);

        if (rekap) {
          filledDaysCount++;
          const status = rekap.jenisRekap === 'TIDAK_ADA_KUNJUNGAN' ? 'TIDAK_ADA_KUNJUNGAN' : 'TERISI';
          return {
            hari: wDay.hari,
            namaHari: wDay.namaHari,
            date: wDay.date,
            status: status as any,
            statusRekap: rekap.statusRekap,
            rekapId: rekap.id,
            jumlahKunjungan: rekap.jumlahKunjungan,
            totalEc: rekap.totalEc,
            bdOutlet: rekap.bdOutlet || 0,
            volumeGg: rekap.volumeGg,
            alasan: rekap.alasan,
          };
        } else {
          return {
            hari: wDay.hari,
            namaHari: wDay.namaHari,
            date: wDay.date,
            status: 'KOSONG' as any,
            statusRekap: null,
            rekapId: null,
            jumlahKunjungan: 0,
            totalEc: 0,
            bdOutlet: 0,
            volumeGg: 0,
            alasan: null,
          };
        }
      });

      const persentase = Math.round((filledDaysCount / 6) * 100);

      // Helper to find daily target for a specific KPI & day
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
          (t) => t.districtId === dist.id && t.jenisTarget === jenis && t.hariKunjungan === dayNum && matchDate(t)
        );
        if (dDay) return dDay.nilai;

        // Priority 1b: District-specific + Senin-Jumat (7) jika dayNum adalah 1..5
        if (dayNum >= 1 && dayNum <= 5) {
          const dWeekday = activeTargets.find(
            (t) => t.districtId === dist.id && t.jenisTarget === jenis && t.hariKunjungan === 7 && matchDate(t)
          );
          if (dWeekday) return dWeekday.nilai;
        }

        // Priority 2: District-specific flat (hariKunjungan null/undefined)
        const dFlat = activeTargets.find(
          (t) =>
            t.districtId === dist.id &&
            t.jenisTarget === jenis &&
            (t.hariKunjungan === null || t.hariKunjungan === undefined) &&
            matchDate(t)
        );
        if (dFlat) return dFlat.nilai;

        // Priority 3: Global default + specific dayNum
        const gDay = activeTargets.find(
          (t) => !t.districtId && t.jenisTarget === jenis && t.hariKunjungan === dayNum && matchDate(t)
        );
        if (gDay) return gDay.nilai;

        // Priority 3b: Global default + Senin-Jumat (7) jika dayNum adalah 1..5
        if (dayNum >= 1 && dayNum <= 5) {
          const gWeekday = activeTargets.find(
            (t) => !t.districtId && t.jenisTarget === jenis && t.hariKunjungan === 7 && matchDate(t)
          );
          if (gWeekday) return gWeekday.nilai;
        }

        // Priority 4: Global flat default
        const gFlat = activeTargets.find(
          (t) =>
            !t.districtId &&
            t.jenisTarget === jenis &&
            (t.hariKunjungan === null || t.hariKunjungan === undefined) &&
            matchDate(t)
        );
        if (gFlat) return gFlat.nilai;

        // Fallbacks
        if (jenis === 'KUNJUNGAN') return 40;
        if (jenis === 'EC') return 30;
        if (jenis === 'BD') return 20;
        return 0; // VOLUME default 0 jika belum diset
      };

      // Sum weekly targets across 6 working days
      let targetKunjungan = 0;
      let targetEc = 0;
      let targetBd = 0;
      let targetVolume = 0;

      weekRange.days.forEach((wDay) => {
        targetKunjungan += getMetricTargetForDay('KUNJUNGAN', wDay.date, wDay.hari);
        targetEc += getMetricTargetForDay('EC', wDay.date, wDay.hari);
        targetBd += getMetricTargetForDay('BD', wDay.date, wDay.hari);
        targetVolume += getMetricTargetForDay('VOLUME', wDay.date, wDay.hari);
      });

      // Sum actuals across days
      let actualKunjungan = 0;
      let actualEc = 0;
      let actualBd = 0;
      let actualVolume = 0;

      dayCells.forEach((c) => {
        actualKunjungan += c.jumlahKunjungan || 0;
        actualEc += c.totalEc || 0;
        actualBd += c.bdOutlet || 0;
        actualVolume += Number(c.volumeGg) || 0;
      });

      const percentKunjungan = targetKunjungan > 0 ? Math.round((actualKunjungan / targetKunjungan) * 100) : 0;
      const percentEc = targetEc > 0 ? Math.round((actualEc / targetEc) * 100) : 0;
      const percentBd = targetBd > 0 ? Math.round((actualBd / targetBd) * 100) : 0;
      const percentVolume = targetVolume > 0 ? Math.round((actualVolume / targetVolume) * 100) : 0;

      // Overall Score: Industry standard capped at 1.0 (100%) per active KPI
      const activeKpiRatios: number[] = [];
      if (targetKunjungan > 0) activeKpiRatios.push(Math.min(1.0, actualKunjungan / targetKunjungan));
      if (targetEc > 0) activeKpiRatios.push(Math.min(1.0, actualEc / targetEc));
      if (targetBd > 0) activeKpiRatios.push(Math.min(1.0, actualBd / targetBd));
      if (targetVolume > 0) activeKpiRatios.push(Math.min(1.0, actualVolume / targetVolume));

      const overallPercent =
        activeKpiRatios.length > 0
          ? Math.round((activeKpiRatios.reduce((acc, curr) => acc + curr, 0) / activeKpiRatios.length) * 100)
          : 0;

      const kpiAchievement: DistrictKpiAchievement = {
        target: {
          kunjungan: targetKunjungan,
          ec: targetEc,
          bd: targetBd,
          volume: targetVolume,
        },
        actual: {
          kunjungan: actualKunjungan,
          ec: actualEc,
          bd: actualBd,
          volume: Math.round(actualVolume * 100) / 100,
        },
        percent: {
          kunjungan: percentKunjungan,
          ec: percentEc,
          bd: percentBd,
          volume: percentVolume,
          overall: overallPercent,
        },
      };

      return {
        districtId: dist.id,
        districtKode: dist.kode,
        ouKode: dist.ouKode,
        karyawanId: dist.karyawanId,
        karyawanName: karyawanMap.get(dist.karyawanId) || dist.karyawanId,
        days: dayCells,
        totalHariTerisi: filledDaysCount,
        persentaseLengkap: persentase,
        kpiAchievement,
      };
    });

    const yy = String(Math.floor(kodeMinggu / 100)).slice(-2);
    const ww = String(kodeMinggu % 100).padStart(2, '0');

    return {
      kodeMinggu,
      kodeMingguDisplay: `${yy}${ww}`,
      startDate: formatDateOnly(weekRange.startDate),
      endDate: formatDateOnly(weekRange.endDate),
      isLocked,
      districts: rows,
    };
  }
}

export class GetWideRisReportUseCase {
  constructor(
    private rekapRepo: IRekapHarianRepository,
    private districtRepo: IDistrictRepository,
    private brandRepo: IBrandRepository,
    private notasiRepo: INotasiRepository,
    private targetRepo: ITargetRepository
  ) {}

  async execute(params: {
    kodeMinggu?: number;
    startDate?: string;
    endDate?: string;
    ouKode?: string;
    districtId?: string;
    token?: string;
  }) {
    const brands = await this.brandRepo.findAll({ status: 'AKTIF' });
    const notasiList = await this.notasiRepo.findAll({ status: 'AKTIF' });

    let start: Date | undefined;
    let end: Date | undefined;

    if (params.kodeMinggu) {
      const range = getDateRangeForKodeMinggu(params.kodeMinggu);
      start = range.startDate;
      end = range.endDate;
    } else if (params.startDate && params.endDate) {
      start = new Date(params.startDate);
      end = new Date(params.endDate);
    }

    const rekaps = await this.rekapRepo.findAll({
      districtId: params.districtId,
      ouKode: params.ouKode,
      kodeMinggu: params.kodeMinggu,
      startDate: start,
      endDate: end,
    });

    const karyawanList = await authBackendService.getKaryawanList(params.token);
    const karyawanMap = new Map(karyawanList.map((k) => [k.id, k.namaLengkap]));

    // Format output rows
    const rows = rekaps.map((r) => {
      const brandValues: Record<string, Record<string, number>> = {};
      for (const b of brands) {
        brandValues[b.kode] = {};
        for (const n of notasiList) {
          brandValues[b.kode][n.kode] = 0;
        }
      }

      if (r.nilaiList) {
        for (const val of r.nilaiList) {
          if (val.brandKode && val.notasiKode && brandValues[val.brandKode]) {
            brandValues[val.brandKode][val.notasiKode] = val.nilai;
          }
        }
      }

      return {
        id: r.id,
        tglKunjungan: formatDateOnly(r.tglKunjungan),
        hariKunjungan: r.hariKunjungan,
        kodeMinggu: r.kodeMinggu,
        districtKode: r.districtKode,
        ouKode: r.ouKode,
        karyawanId: r.karyawanId,
        karyawanName: karyawanMap.get(r.karyawanId) || r.karyawanId,
        jenisRekap: r.jenisRekap,
        alasan: r.alasan,
        jumlahKunjungan: r.jumlahKunjungan,
        totalEc: r.totalEc,
        volumeGg: r.volumeGg,
        statusRekap: r.statusRekap,
        brandValues,
      };
    });

    return {
      brands: brands.map((b) => ({ id: b.id, kode: b.kode, nama: b.nama, kategori: b.kategori })),
      notasi: notasiList.map((n) => ({ id: n.id, kode: n.kode, nama: n.nama, satuan: n.satuan })),
      totalRows: rows.length,
      rows,
    };
  }
}
