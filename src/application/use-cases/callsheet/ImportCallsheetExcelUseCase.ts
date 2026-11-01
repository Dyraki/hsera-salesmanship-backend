import ExcelJS from 'exceljs';
import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { IBrandRepository } from '../../../domain/repositories/IBrandRepository';
import { IKunciMingguRepository } from '../../../domain/repositories/IKunciMingguRepository';
import { SaveCallsheetUseCase } from './CallsheetUseCases';
import { AppError } from '../../../domain/errors/AppError';
import { getIsoWeekInfo, formatDateOnly } from '../../../infrastructure/utils/dateIsoUtils';
import { JenisRekap, StatusRekap, RekapHarian } from '../../../domain/entities/RekapHarian';
import { authBackendService } from '../../../infrastructure/services/AuthBackendServiceClient';

export interface ImportCallsheetParams {
  fileBuffer: Buffer;
  userId?: string;
  statusRekap?: StatusRekap;
  token?: string;
}

export interface ImportCallsheetResult {
  rekap?: RekapHarian;
  summary: {
    districtKode: string;
    ouKode?: string;
    tglKunjungan: string;
    hariKunjungan?: number;
    kodeMingguDisplay?: string;
    jumlahKunjungan?: number;
    totalEc?: number;
    bdOutlet?: number;
    volumeGg?: number;
    totalBrandsProcessed: number;
    batchCount?: number;
  };
}

// Helper to extract numeric value from an Excel cell (handles formula results and plain numbers)
function getCellNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'object' && 'result' in val) {
    const num = Number(val.result);
    return isNaN(num) ? 0 : num;
  }
  const str = String(val).replace(/,/g, '').trim();
  if (str === '-' || str === '') return 0;
  const parsed = Number(str);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper to extract text from an Excel cell
function getCellString(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object' && 'richText' in val && Array.isArray(val.richText)) {
    return val.richText.map((t: any) => t.text).join('').trim();
  }
  if (typeof val === 'object' && 'result' in val) {
    return String(val.result || '').trim();
  }
  return String(val).trim();
}

// Helper to normalize date to YYYY-MM-DD
function normalizeDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    return formatDateOnly(val);
  }
  const str = getCellString(val);
  // Matches YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  // Matches DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 2 && parts[2].length === 4) {
      // DD/MM/YYYY -> YYYY-MM-DD
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime())) {
    return formatDateOnly(parsedDate);
  }
  return str;
}

export class ImportCallsheetExcelUseCase {
  constructor(
    private districtRepo: IDistrictRepository,
    private brandRepo: IBrandRepository,
    private lockRepo: IKunciMingguRepository,
    private saveCallsheetUC: SaveCallsheetUseCase
  ) {}

  async execute(params: ImportCallsheetParams): Promise<ImportCallsheetResult> {
    if (!params.fileBuffer || params.fileBuffer.length === 0) {
      throw AppError.badRequest('File Excel kosong atau tidak valid.');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(params.fileBuffer as any);
    } catch {
      throw AppError.badRequest('Format file Excel (.xlsx) rusak atau tidak dikenali.');
    }

    const ws = workbook.getWorksheet('Rekap Callsheet') || workbook.worksheets[0];
    if (!ws) {
      throw AppError.badRequest('Lembar kerja (worksheet) Excel tidak ditemukan.');
    }

    // Check if the uploaded file is Format B (NPPB Buy Volume list: e.g. "Tanggal NPPB Kembali", "Nama Sales", "Brand", "Buy")
    const cellA1 = getCellString(ws.getCell('A1').value).toUpperCase();
    const cellB1 = getCellString(ws.getCell('B1').value).toUpperCase();
    const isNppbBuyFormat = cellA1.includes('TANGGAL') && (cellB1.includes('SALES') || cellB1.includes('NAMA'));

    if (isNppbBuyFormat) {
      return await this.processNppbBuyFormat(ws, params);
    }

    // Otherwise, process as Format A: Standard Callsheet Template
    return await this.processStandardTemplateFormat(ws, params);
  }

  // -----------------------------------------------------------------------------------
  // FORMAT A: Template Standar Callsheet Harian (Header Metadata + Matriks 15 Brand)
  // -----------------------------------------------------------------------------------
  private async processStandardTemplateFormat(
    ws: ExcelJS.Worksheet,
    params: ImportCallsheetParams
  ): Promise<ImportCallsheetResult> {
    // 1. Read Header Metadata
    const districtKode = getCellString(ws.getCell('B3').value);
    const ouKode = getCellString(ws.getCell('B4').value);
    const rawTgl = ws.getCell('B5').value;
    const tglKunjungan = normalizeDate(rawTgl);
    const rawJenis = getCellString(ws.getCell('B6').value).toUpperCase();
    const jenisRekap: JenisRekap = rawJenis === 'TIDAK_ADA_KUNJUNGAN' ? 'TIDAK_ADA_KUNJUNGAN' : 'NORMAL';
    const jumlahKunjungan = getCellNumber(ws.getCell('B7').value);
    const totalEc = getCellNumber(ws.getCell('B8').value);
    const bdOutlet = getCellNumber(ws.getCell('B9').value);
    const catatan = getCellString(ws.getCell('B10').value);

    if (!districtKode) {
      throw AppError.badRequest('Kode District (cell B3) pada file Excel wajib diisi.');
    }
    if (!tglKunjungan || !/^\d{4}-\d{2}-\d{2}$/.test(tglKunjungan)) {
      throw AppError.badRequest(
        `Tanggal Kunjungan (cell B5) tidak valid: "${getCellString(rawTgl)}". Gunakan format YYYY-MM-DD (contoh: 2026-10-30).`
      );
    }

    // 2. Validate District
    let district = null;
    if (ouKode) {
      district = await this.districtRepo.findByOuAndKode(ouKode, districtKode);
    }
    if (!district) {
      const allDistricts = await this.districtRepo.findAll({ status: 'AKTIF' });
      district = allDistricts.find(
        (d) => d.kode.toUpperCase() === districtKode.toUpperCase()
      );
    }
    if (!district) {
      throw AppError.notFound(
        `District dengan kode "${districtKode}" tidak ditemukan atau berstatus NONAKTIF di sistem.`
      );
    }

    // 3. Validate Workday & Week Lock
    const dateObj = new Date(tglKunjungan);
    const weekInfo = getIsoWeekInfo(dateObj);

    if (weekInfo.hariKunjungan === 7) {
      throw AppError.badRequest(
        `Tanggal ${tglKunjungan} jatuh pada hari Minggu. Hari Minggu bukan hari kerja salesman. Callsheet tidak dapat di-import.`
      );
    }

    const lock = await this.lockRepo.findByKodeMinggu(weekInfo.kodeMinggu);
    if (lock && lock.isLocked()) {
      throw AppError.badRequest(
        `Minggu ${weekInfo.kodeMingguDisplay} telah dikunci (LOCKED). Callsheet tidak dapat diubah atau di-import.`
      );
    }

    // 4. Read Brand Matrix Rows (Rows 14 onwards)
    const activeBrands = await this.brandRepo.findAll({ status: 'AKTIF' });
    const brandMap = new Map(activeBrands.map((b) => [b.kode.toUpperCase(), b]));

    const matrixItems: Array<{ brandId: string; notasiKode: string; nilai: number }> = [];
    let brandsProcessedCount = 0;

    for (let r = 14; r <= 50; r++) {
      const cellKode = getCellString(ws.getCell(`B${r}`).value).toUpperCase();
      if (!cellKode || cellKode.includes('TOTAL')) {
        break; // End of product matrix
      }

      const brand = brandMap.get(cellKode);
      if (!brand) {
        continue;
      }

      brandsProcessedCount += 1;

      const sk = getCellNumber(ws.getCell(`D${r}`).value);
      const sl = getCellNumber(ws.getCell(`E${r}`).value);
      const sd = getCellNumber(ws.getCell(`F${r}`).value);
      const oos = getCellNumber(ws.getCell(`G${r}`).value);
      const sb = getCellNumber(ws.getCell(`H${r}`).value);
      const tl = getCellNumber(ws.getCell(`I${r}`).value);
      const stock = getCellNumber(ws.getCell(`L${r}`).value);
      const buy = getCellNumber(ws.getCell(`M${r}`).value);
      const faceUp = getCellNumber(ws.getCell(`N${r}`).value);

      matrixItems.push(
        { brandId: brand.id, notasiKode: 'SK', nilai: sk },
        { brandId: brand.id, notasiKode: 'SL', nilai: sl },
        { brandId: brand.id, notasiKode: 'SD', nilai: sd },
        { brandId: brand.id, notasiKode: 'OOS', nilai: oos },
        { brandId: brand.id, notasiKode: 'SB', nilai: sb },
        { brandId: brand.id, notasiKode: 'TL', nilai: tl },
        { brandId: brand.id, notasiKode: 'STOCK', nilai: stock },
        { brandId: brand.id, notasiKode: 'BUY', nilai: buy },
        { brandId: brand.id, notasiKode: 'FACE_UP', nilai: faceUp }
      );
    }

    if (jenisRekap === 'NORMAL' && brandsProcessedCount === 0) {
      throw AppError.badRequest(
        'Tidak ada baris brand/SKU yang berhasil dibaca pada template Excel. Pastikan Kolom B (Kode SKU) tidak kosong.'
      );
    }

    // 5. Execute Save via SaveCallsheetUseCase
    const saved = await this.saveCallsheetUC.execute({
      districtId: district.id,
      tglKunjungan,
      jenisRekap,
      alasan: jenisRekap === 'TIDAK_ADA_KUNJUNGAN' ? (catatan || 'Tidak ada kunjungan') : undefined,
      jumlahKunjungan,
      totalEc,
      bdOutlet,
      statusRekap: params.statusRekap || 'FINAL',
      catatan,
      matrix: matrixItems,
      userId: params.userId,
    });

    return {
      rekap: saved,
      summary: {
        districtKode: district.kode,
        ouKode: district.ouKode,
        tglKunjungan,
        hariKunjungan: weekInfo.hariKunjungan,
        kodeMingguDisplay: weekInfo.kodeMingguDisplay,
        jumlahKunjungan: saved.jumlahKunjungan,
        totalEc: saved.totalEc,
        bdOutlet: saved.bdOutlet,
        volumeGg: Number(saved.volumeGg) || 0,
        totalBrandsProcessed: brandsProcessedCount,
      },
    };
  }

  // -----------------------------------------------------------------------------------
  // FORMAT B: Rekap Data Buy Volume Massal (NPPB: Tanggal, Nama Sales, Brand, Buy)
  // -----------------------------------------------------------------------------------
  private async processNppbBuyFormat(
    ws: ExcelJS.Worksheet,
    params: ImportCallsheetParams
  ): Promise<ImportCallsheetResult> {
    const allDistricts = await this.districtRepo.findAll({ status: 'AKTIF' });
    const allBrands = await this.brandRepo.findAll({ status: 'AKTIF' });
    const brandMap = new Map(allBrands.map((b) => [b.kode.toUpperCase(), b]));

    // Fetch employee directory
    let karyawanList: any[] = [];
    try {
      karyawanList = await authBackendService.getKaryawanList(params.token);
    } catch {
      karyawanList = [];
    }

    const employeeMap = new Map<string, string>(); // employeeId -> district
    const districtByEmpId = new Map(allDistricts.map((d) => [d.karyawanId, d]));

    // Helper to find district by salesman name
    const findDistrictBySalesName = (salesName: string) => {
      const cleanName = salesName.toUpperCase().replace(/\s+/g, ' ').trim();
      // 1. Direct match in karyawanList
      for (const k of karyawanList) {
        const kName = (k.namaLengkap || '').toUpperCase().replace(/\s+/g, ' ').trim();
        if (kName === cleanName || kName.includes(cleanName) || cleanName.includes(kName)) {
          const dist = districtByEmpId.get(k.id);
          if (dist) return dist;
        }
      }
      // 2. Direct match in districts by code
      const distByCode = allDistricts.find(
        (d) => d.kode.toUpperCase() === cleanName || cleanName.includes(d.kode.toUpperCase())
      );
      if (distByCode) return distByCode;

      return null;
    };

    // Group rows by key: `districtId|tglKunjungan`
    interface BatchGroup {
      district: any;
      tglKunjungan: string;
      items: Array<{ brandId: string; notasiKode: string; nilai: number }>;
      totalBuy: number;
    }
    const groups = new Map<string, BatchGroup>();

    let totalRowsProcessed = 0;
    for (let r = 2; r <= ws.rowCount; r++) {
      const rawDate = ws.getCell(`A${r}`).value;
      const salesName = getCellString(ws.getCell(`B${r}`).value);
      const brandCode = getCellString(ws.getCell(`C${r}`).value).toUpperCase();
      const buyQty = getCellNumber(ws.getCell(`D${r}`).value);

      if (!rawDate || !salesName || !brandCode) continue;

      const tglStr = normalizeDate(rawDate);
      if (!tglStr) continue;

      const brand = brandMap.get(brandCode);
      if (!brand) continue;

      const district = findDistrictBySalesName(salesName);
      if (!district) continue;

      const groupKey = `${district.id}|${tglStr}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          district,
          tglKunjungan: tglStr,
          items: [],
          totalBuy: 0,
        });
      }

      const g = groups.get(groupKey)!;
      g.items.push({
        brandId: brand.id,
        notasiKode: 'BUY',
        nilai: buyQty,
      });
      g.totalBuy += buyQty;
      totalRowsProcessed += 1;
    }

    if (groups.size === 0) {
      throw AppError.badRequest(
        'Tidak ada baris data NPPB Buy yang cocok dengan nama salesman dan master district aktif.'
      );
    }

    // Save each group
    let lastSaved: RekapHarian | undefined;
    for (const [, g] of groups.entries()) {
      lastSaved = await this.saveCallsheetUC.execute({
        districtId: g.district.id,
        tglKunjungan: g.tglKunjungan,
        jenisRekap: 'NORMAL',
        volumeGg: g.totalBuy,
        statusRekap: params.statusRekap || 'FINAL',
        matrix: g.items,
        userId: params.userId,
      });
    }

    const firstGroup = Array.from(groups.values())[0];
    return {
      rekap: lastSaved,
      summary: {
        districtKode: `${groups.size} District`,
        tglKunjungan: firstGroup.tglKunjungan,
        totalBrandsProcessed: totalRowsProcessed,
        batchCount: groups.size,
      },
    };
  }
}
