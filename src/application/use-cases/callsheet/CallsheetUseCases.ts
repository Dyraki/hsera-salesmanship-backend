import { IRekapHarianRepository, SaveRekapInput } from '../../../domain/repositories/IRekapHarianRepository';
import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { IBrandRepository } from '../../../domain/repositories/IBrandRepository';
import { INotasiRepository } from '../../../domain/repositories/INotasiRepository';
import { ITargetRepository } from '../../../domain/repositories/ITargetRepository';
import { IKunciMingguRepository } from '../../../domain/repositories/IKunciMingguRepository';
import { RekapHarian, JenisRekap, StatusRekap } from '../../../domain/entities/RekapHarian';
import { AppError } from '../../../domain/errors/AppError';
import { getIsoWeekInfo, formatDateOnly } from '../../../infrastructure/utils/dateIsoUtils';
import { authBackendService } from '../../../infrastructure/services/AuthBackendServiceClient';

export interface CallsheetFormResponse {
  date: string;
  hariKunjungan: number;
  namaHari: string;
  kodeMinggu: number;
  kodeMingguDisplay: string;
  isLocked: boolean;
  isWorkday: boolean;
  district: {
    id: string;
    kode: string;
    ouKode: string;
    karyawanId: string;
    karyawanName?: string;
    channels?: Array<{ id: string; kode: string; nama: string }>;
  };
  targets: {
    kunjungan: number;
    bd: number;
    ec: number;
    volume: number;
  };
  brands: Array<{
    id: string;
    kode: string;
    nama: string;
    kategori: string;
    urutan: number;
  }>;
  notasiList: Array<{
    id: string;
    kode: string;
    nama: string;
    levelInput: string;
    kelompokTampil: string | null;
    satuan: string;
    urutan: number;
  }>;
  rekap: {
    id?: string;
    jenisRekap: JenisRekap;
    alasan?: string | null;
    jumlahKunjungan: number;
    totalEc: number;
    bdOutlet: number;
    volumeGg?: number | null;
    statusRekap: StatusRekap;
    catatan?: string | null;
    matrix: Record<string, Record<string, number>>; // [brandId][notasiKode] = nilai
  };
}

export class GetCallsheetFormDataUseCase {
  constructor(
    private rekapRepo: IRekapHarianRepository,
    private districtRepo: IDistrictRepository,
    private brandRepo: IBrandRepository,
    private notasiRepo: INotasiRepository,
    private targetRepo: ITargetRepository,
    private lockRepo: IKunciMingguRepository
  ) {}

  async execute(districtId: string, dateInput: string, token?: string): Promise<CallsheetFormResponse> {
    const district = await this.districtRepo.findById(districtId);
    if (!district) {
      throw AppError.notFound('District tidak ditemukan.');
    }

    const weekInfo = getIsoWeekInfo(dateInput);
    const dateObj = new Date(dateInput);

    // Check lock
    const lock = await this.lockRepo.findByKodeMinggu(weekInfo.kodeMinggu);
    const isLocked = lock ? lock.isLocked() : false;

    // Load active Brands and Notasi
    const [brands, notasiList] = await Promise.all([
      this.brandRepo.findAll({ status: 'AKTIF' }),
      this.notasiRepo.findAll({ status: 'AKTIF' }),
    ]);

    // Load targets
    const [targetKunjungan, targetBd, targetEc, targetVolume] = await Promise.all([
      this.targetRepo.findActiveTarget(districtId, 'KUNJUNGAN', dateObj, weekInfo.hariKunjungan, district.ouKode),
      this.targetRepo.findActiveTarget(districtId, 'BD', dateObj, weekInfo.hariKunjungan, district.ouKode),
      this.targetRepo.findActiveTarget(districtId, 'EC', dateObj, weekInfo.hariKunjungan, district.ouKode),
      this.targetRepo.findActiveTarget(districtId, 'VOLUME', dateObj, weekInfo.hariKunjungan, district.ouKode),
    ]);

    // Lookup existing rekap harian
    const existing = await this.rekapRepo.findByDateAndDistrict(dateObj, districtId);

    // Build matrix lookup
    const matrix: Record<string, Record<string, number>> = {};
    for (const b of brands) {
      matrix[b.id] = {};
      for (const n of notasiList) {
        matrix[b.id][n.kode] = 0;
      }
    }

    if (existing && existing.nilaiList) {
      for (const item of existing.nilaiList) {
        if (matrix[item.brandId] && item.notasiKode) {
          matrix[item.brandId][item.notasiKode] = item.nilai;
        }
      }
    }

    // Lookup salesman name
    const karyawanList = await authBackendService.getKaryawanList(token);
    const salesman = karyawanList.find((k) => k.id === district.karyawanId);

    return {
      date: dateInput,
      hariKunjungan: weekInfo.hariKunjungan,
      namaHari: weekInfo.namaHari,
      kodeMinggu: weekInfo.kodeMinggu,
      kodeMingguDisplay: weekInfo.kodeMingguDisplay,
      isLocked,
      isWorkday: weekInfo.isWorkday,
      district: {
        id: district.id,
        kode: district.kode,
        ouKode: district.ouKode,
        karyawanId: district.karyawanId,
        karyawanName: salesman?.namaLengkap || district.karyawanId,
        channels: district.channels || [],
      },
      targets: {
        kunjungan: targetKunjungan ? targetKunjungan.nilai : 40,
        bd: targetBd ? targetBd.nilai : 20,
        ec: targetEc ? targetEc.nilai : 30,
        volume: targetVolume ? targetVolume.nilai : (weekInfo.hariKunjungan === 6 ? 70 : 140),
      },
      brands: brands.map((b) => ({
        id: b.id,
        kode: b.kode,
        nama: b.nama,
        kategori: b.kategori,
        urutan: b.urutan,
      })),
      notasiList: notasiList.map((n) => ({
        id: n.id,
        kode: n.kode,
        nama: n.nama,
        levelInput: n.levelInput,
        kelompokTampil: n.kelompokTampil,
        satuan: n.satuan,
        urutan: n.urutan,
      })),
      rekap: {
        id: existing?.id,
        jenisRekap: existing ? existing.jenisRekap : 'NORMAL',
        alasan: existing?.alasan,
        jumlahKunjungan: existing ? existing.jumlahKunjungan : 0,
        totalEc: existing ? existing.totalEc : 0,
        bdOutlet: existing ? existing.bdOutlet : 0,
        volumeGg: existing?.volumeGg,
        statusRekap: existing ? existing.statusRekap : 'DRAFT',
        catatan: existing?.catatan,
        matrix,
      },
    };
  }
}

export interface SaveCallsheetDTO {
  id?: string;
  districtId: string;
  tglKunjungan: string;
  jenisRekap: JenisRekap;
  alasan?: string | null;
  jumlahKunjungan?: number;
  totalEc?: number;
  bdOutlet?: number;
  volumeGg?: number | null;
  statusRekap?: StatusRekap;
  catatan?: string | null;
  // Matrix input: array of items { brandId: string, notasiKode: string, nilai: number }
  matrix?: Array<{
    brandId: string;
    notasiKode: string;
    nilai: number;
  }>;
  userId?: string;
}

export class SaveCallsheetUseCase {
  constructor(
    private rekapRepo: IRekapHarianRepository,
    private districtRepo: IDistrictRepository,
    private brandRepo: IBrandRepository,
    private notasiRepo: INotasiRepository,
    private lockRepo: IKunciMingguRepository
  ) {}

  async execute(dto: SaveCallsheetDTO): Promise<RekapHarian> {
    if (!dto.districtId || !dto.tglKunjungan) {
      throw AppError.badRequest('districtId dan tglKunjungan wajib diisi.');
    }

    const district = await this.districtRepo.findById(dto.districtId);
    if (!district) {
      throw AppError.notFound('District tidak ditemukan.');
    }

    const dateObj = new Date(dto.tglKunjungan);
    const weekInfo = getIsoWeekInfo(dateObj);

    if (weekInfo.hariKunjungan === 7) {
      throw AppError.badRequest('Hari Minggu bukan hari kerja salesman. Callsheet tidak dapat diisi.');
    }

    // Check week lock
    const lock = await this.lockRepo.findByKodeMinggu(weekInfo.kodeMinggu);
    if (lock && lock.isLocked()) {
      throw AppError.badRequest(
        `Minggu ${weekInfo.kodeMingguDisplay} telah dikunci (LOCKED). Callsheet tidak dapat diubah atau disimpan.`
      );
    }

    const notasiList = await this.notasiRepo.findAll();
    const notasiMap = new Map(notasiList.map((n) => [n.kode, n]));
    const notasiBd = notasiMap.get('BD');

    let jenisRekap = dto.jenisRekap || 'NORMAL';
    let alasan = dto.alasan;
    let jumlahKunjungan = dto.jumlahKunjungan || 0;
    let totalEc = dto.totalEc || 0;
    let bdOutlet = dto.bdOutlet !== undefined ? dto.bdOutlet : 0;
    let volumeGg = dto.volumeGg !== undefined ? dto.volumeGg : null;
    let statusRekap = dto.statusRekap || 'FINAL';

    const preparedNilaiList: Array<{ brandId: string; notasiId: string; nilai: number }> = [];

    if (jenisRekap === 'TIDAK_ADA_KUNJUNGAN') {
      if (!alasan || alasan.trim().length === 0) {
        throw AppError.badRequest('Alasan wajib diisi jika memilih opsi Tidak Ada Kunjungan.');
      }
      jumlahKunjungan = 0;
      totalEc = 0;
      bdOutlet = 0;
      volumeGg = 0;
    } else {
      // Normal: Process Brand x Notasi matrix and auto-calculate BD
      const matrixMap: Record<string, Record<string, number>> = {};

      if (dto.matrix && Array.isArray(dto.matrix)) {
        for (const item of dto.matrix) {
          if (!matrixMap[item.brandId]) {
            matrixMap[item.brandId] = {};
          }
          matrixMap[item.brandId][item.notasiKode] = Number(item.nilai) || 0;
        }
      }

      // Auto-calculate BD = OOS + SK + SL + SD + SB for each brand
      for (const brandId of Object.keys(matrixMap)) {
        const row = matrixMap[brandId];
        const oos = row['OOS'] || 0;
        const sk = row['SK'] || 0;
        const sl = row['SL'] || 0;
        const sd = row['SD'] || 0;
        const sb = row['SB'] || 0;
        const bd = oos + sk + sl + sd + sb;
        row['BD'] = bd; // Force rule: BD auto calculated

        for (const [notasiKode, val] of Object.entries(row)) {
          const notasiObj = notasiMap.get(notasiKode);
          if (notasiObj) {
            preparedNilaiList.push({
              brandId,
              notasiId: notasiObj.id,
              nilai: val,
            });
          }
        }
      }
    }

    const saveInput: SaveRekapInput = {
      districtId: district.id,
      tglKunjungan: dateObj,
      hariKunjungan: weekInfo.hariKunjungan,
      kodeMinggu: weekInfo.kodeMinggu,
      karyawanId: district.karyawanId,
      ouKode: district.ouKode,
      jenisRekap,
      alasan,
      jumlahKunjungan,
      totalEc,
      bdOutlet,
      volumeGg,
      statusRekap,
      catatan: dto.catatan,
      createdBy: dto.userId,
      updatedBy: dto.userId,
      nilaiList: preparedNilaiList,
    };

    return await this.rekapRepo.save(saveInput, dto.id);
  }
}

export class DeleteCallsheetUseCase {
  constructor(
    private rekapRepo: IRekapHarianRepository,
    private lockRepo: IKunciMingguRepository
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.rekapRepo.findById(id);
    if (!existing) {
      throw AppError.notFound('Data Callsheet tidak ditemukan.');
    }

    const lock = await this.lockRepo.findByKodeMinggu(existing.kodeMinggu);
    if (lock && lock.isLocked()) {
      throw AppError.badRequest('Minggu ini telah dikunci (LOCKED). Callsheet tidak dapat dihapus.');
    }

    await this.rekapRepo.delete(id);
  }
}
