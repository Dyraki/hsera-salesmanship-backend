import ExcelJS from 'exceljs';
import { IBrandRepository } from '../../../domain/repositories/IBrandRepository';
import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { formatDateOnly } from '../../../infrastructure/utils/dateIsoUtils';

export interface GenerateTemplateParams {
  districtId?: string;
  date?: string;
}

export class GenerateCallsheetTemplateUseCase {
  constructor(
    private brandRepo: IBrandRepository,
    private districtRepo: IDistrictRepository
  ) {}

  async execute(params: GenerateTemplateParams): Promise<{ buffer: Buffer; filename: string }> {
    const brands = await this.brandRepo.findAll({ status: 'AKTIF' });
    // Sort brands by urutan ASC
    brands.sort((a, b) => a.urutan - b.urutan);

    let districtKode = 'D-01';
    let districtOu = '';
    if (params.districtId) {
      const dist = await this.districtRepo.findById(params.districtId);
      if (dist) {
        districtKode = dist.kode;
        districtOu = dist.ouKode;
      }
    }

    const tglKunjungan = params.date && params.date.trim() ? params.date.trim() : formatDateOnly(new Date());

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HSERA Salesmanship System';
    workbook.created = new Date();

    // -------------------------------------------------------------
    // SHEET 1: REKAP CALLSHEET
    // -------------------------------------------------------------
    const ws = workbook.addWorksheet('Rekap Callsheet', {
      views: [{ showGridLines: true }],
    });

    // Setup column widths
    ws.columns = [
      { width: 6 },   // A: No
      { width: 14 },  // B: Kode SKU
      { width: 36 },  // C: Nama Brand
      { width: 10 },  // D: SK
      { width: 10 },  // E: SL
      { width: 10 },  // F: SD
      { width: 10 },  // G: OOS
      { width: 10 },  // H: SB
      { width: 10 },  // I: TL
      { width: 14 },  // J: BPJ (Auto)
      { width: 14 },  // K: BD (Auto)
      { width: 12 },  // L: Stock
      { width: 12 },  // M: Buy
      { width: 12 },  // N: Face Up
    ];

    // Colors
    const primaryDark = '1E293B'; // Slate 800
    const primaryBlue = '2563EB'; // Blue 600
    const softAmber = 'FEF3C7';   // Amber 100
    const textAmber = '92400E';   // Amber 800
    const softPurple = 'F3E8FF';  // Purple 100
    const textPurple = '6B21A8';  // Purple 800
    const softEmerald = 'ECFDF5'; // Emerald 50
    const textEmerald = '065F46'; // Emerald 800
    const lightGray = 'F8FAFC';   // Slate 50

    // Title Row
    ws.mergeCells('A1:N1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'FORMULIR IMPORT DATA CALLSHEET HARIAN SALESMAN (RIS)';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: primaryDark },
    };
    ws.getRow(1).height = 32;

    // Header Metadata Box (Rows 3-10)
    const headerMetadata: Array<[string, any, string, string?]> = [
      ['Kode District', districtKode, 'B3', 'Wajib diisi sesuai kode district terdaftar (contoh: D-01)'],
      ['Unit Operasi (OU)', districtOu, 'B4', 'Opsional / otomatis'],
      ['Tanggal Kunjungan', tglKunjungan, 'B5', 'Format: YYYY-MM-DD (contoh: 2026-10-30), bukan hari Minggu'],
      ['Jenis Rekap', 'NORMAL', 'B6', 'Pilih: NORMAL atau TIDAK_ADA_KUNJUNGAN'],
      ['Jumlah Kunjungan', 40, 'B7', 'Total outlet dikunjungi hari ini (angka)'],
      ['Total EC', 35, 'B8', 'Total Effective Call outlet (angka)'],
      ['BD Outlet', 38, 'B9', 'Total Buying Dealer outlet (angka)'],
      ['Catatan', '', 'B10', 'Catatan tambahan (opsional)'],
    ];

    headerMetadata.forEach(([label, defVal, cellCoord], idx) => {
      const rowNum = 3 + idx;
      const lblCell = ws.getCell(`A${rowNum}`);
      const valCell = ws.getCell(cellCoord);

      lblCell.value = label;
      lblCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF334155' } };
      lblCell.alignment = { vertical: 'middle', horizontal: 'left' };
      lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      lblCell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      valCell.value = defVal;
      valCell.font = { name: 'Arial', size: 10, bold: label === 'Kode District' || label === 'Tanggal Kunjungan' };
      valCell.alignment = { vertical: 'middle', horizontal: 'left' };
      valCell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      ws.getRow(rowNum).height = 20;
    });

    // Data Validation for Jenis Rekap
    ws.getCell('B6').dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"NORMAL,TIDAK_ADA_KUNJUNGAN"'],
    };

    // Instruction banner
    ws.mergeCells('C3:N10');
    const instructionBox = ws.getCell('C3');
    instructionBox.value =
      'PETUNJUK PENGISIAN IMPORT:\n' +
      '1. Pastikan Kode District dan Tanggal Kunjungan sesuai dengan jadwal rekap.\n' +
      '2. Isi klasifikasi status outlet (SK, SL, SD, OOS, SB, TL) untuk setiap SKU.\n' +
      '3. Kolom BPJ dan BD dihitung otomatis oleh formula Excel. Jangan ubah formula tersebut.\n' +
      '4. Total status (SK+SL+SD+OOS+SB+TL+BPJ) per brand harus setara dengan Jumlah Kunjungan.\n' +
      '5. Jangan menghapus atau mengubah Kode SKU (Kolom B) agar data dapat dikenali sistem.';
    instructionBox.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
    instructionBox.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    instructionBox.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    instructionBox.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    // Table Header (Row 12: Category Groups, Row 13: Sub-headers)
    ws.mergeCells('A12:C12');
    ws.getCell('A12').value = 'DATA BRAND FMCG';
    ws.getCell('A12').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A12').alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell('A12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryDark } };

    ws.mergeCells('D12:I12');
    ws.getCell('D12').value = 'KLASIFIKASI STATUS OUTLET (KUNJUNGAN)';
    ws.getCell('D12').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('D12').alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell('D12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } };

    ws.mergeCells('J12:K12');
    ws.getCell('J12').value = 'AUTO HITUNG';
    ws.getCell('J12').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('J12').alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell('J12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '475569' } };

    ws.mergeCells('L12:M12');
    ws.getCell('L12').value = 'KUANTITAS';
    ws.getCell('L12').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('L12').alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell('L12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '047857' } };

    ws.getCell('N12').value = 'DISPLAY';
    ws.getCell('N12').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('N12').alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell('N12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryBlue } };

    // Sub Headers Row 13
    const subHeaders = [
      'No',
      'Kode SKU',
      'Nama Brand / Produk',
      'SK',
      'SL',
      'SD',
      'OOS',
      'SB',
      'TL',
      'BPJ',
      'BD',
      'Stock',
      'Buy',
      'Face Up',
    ];

    const row13 = ws.getRow(13);
    row13.height = 24;
    subHeaders.forEach((sh, idx) => {
      const colLetter = String.fromCharCode(65 + idx);
      const cell = ws.getCell(`${colLetter}13`);
      cell.value = sh;
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    // Populate Brand Rows (Rows 14 onwards)
    brands.forEach((brand, idx) => {
      const rNum = 14 + idx;
      const row = ws.getRow(rNum);
      row.height = 20;

      // Col A: Index
      const cellA = ws.getCell(`A${rNum}`);
      cellA.value = idx + 1;
      cellA.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col B: Kode Brand
      const cellB = ws.getCell(`B${rNum}`);
      cellB.value = brand.kode;
      cellB.alignment = { vertical: 'middle', horizontal: 'left' };
      cellB.font = { name: 'Arial', size: 9, bold: true };

      // Col C: Nama Brand
      const cellC = ws.getCell(`C${rNum}`);
      cellC.value = brand.nama;
      cellC.alignment = { vertical: 'middle', horizontal: 'left' };

      // Col D..I: SK, SL, SD, OOS, SB, TL
      ['D', 'E', 'F', 'G', 'H', 'I'].forEach((col) => {
        const c = ws.getCell(`${col}${rNum}`);
        c.value = 0;
        c.alignment = { vertical: 'middle', horizontal: 'right' };
        c.numFmt = '#,##0';
      });

      // Col J: BPJ (Auto Formula) = MAX(0, $B$7 - (D+E+F+G+H+I))
      const cellJ = ws.getCell(`J${rNum}`);
      cellJ.value = {
        formula: `IF($B$6="NORMAL",MAX(0,$B$7-(D${rNum}+E${rNum}+F${rNum}+G${rNum}+H${rNum}+I${rNum})),0)`,
        result: 0,
      };
      cellJ.alignment = { vertical: 'middle', horizontal: 'right' };
      cellJ.font = { name: 'Arial', size: 9, bold: true, color: { argb: textAmber } };
      cellJ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: softAmber } };
      cellJ.numFmt = '#,##0';

      // Col K: BD (Auto Formula) = D+E+F+G+H
      const cellK = ws.getCell(`K${rNum}`);
      cellK.value = {
        formula: `IF($B$6="NORMAL",D${rNum}+E${rNum}+F${rNum}+G${rNum}+H${rNum},0)`,
        result: 0,
      };
      cellK.alignment = { vertical: 'middle', horizontal: 'right' };
      cellK.font = { name: 'Arial', size: 9, bold: true, color: { argb: textPurple } };
      cellK.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: softPurple } };
      cellK.numFmt = '#,##0';

      // Col L: Stock
      const cellL = ws.getCell(`L${rNum}`);
      cellL.value = 0;
      cellL.alignment = { vertical: 'middle', horizontal: 'right' };
      cellL.numFmt = '#,##0';

      // Col M: Buy
      const cellM = ws.getCell(`M${rNum}`);
      cellM.value = 0;
      cellM.alignment = { vertical: 'middle', horizontal: 'right' };
      cellM.numFmt = '#,##0';
      cellM.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: softEmerald } };
      cellM.font = { name: 'Arial', size: 9, bold: true, color: { argb: textEmerald } };

      // Col N: Face Up
      const cellN = ws.getCell(`N${rNum}`);
      cellN.value = 0;
      cellN.alignment = { vertical: 'middle', horizontal: 'right' };
      cellN.numFmt = '#,##0';

      // Apply borders to row cells
      for (let c = 1; c <= 14; c++) {
        const colLetter = String.fromCharCode(64 + c);
        const cell = ws.getCell(`${colLetter}${rNum}`);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
    });

    // Summary Row
    const totalRowNum = 14 + brands.length;
    const totalRow = ws.getRow(totalRowNum);
    totalRow.height = 24;

    ws.mergeCells(`A${totalRowNum}:C${totalRowNum}`);
    const totLabel = ws.getCell(`A${totalRowNum}`);
    totLabel.value = 'TOTAL KONSOLIDASI';
    totLabel.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    totLabel.alignment = { vertical: 'middle', horizontal: 'center' };
    totLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach((col) => {
      const cell = ws.getCell(`${col}${totalRowNum}`);
      cell.value = { formula: `SUM(${col}14:${col}${totalRowNum - 1})`, result: 0 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.numFmt = '#,##0';
    });

    for (let c = 1; c <= 14; c++) {
      const colLetter = String.fromCharCode(64 + c);
      const cell = ws.getCell(`${colLetter}${totalRowNum}`);
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    }

    // -------------------------------------------------------------
    // SHEET 2: PANDUAN PENGISIAN
    // -------------------------------------------------------------
    const guideWs = workbook.addWorksheet('Panduan Pengisian', {
      views: [{ showGridLines: true }],
    });

    guideWs.columns = [
      { width: 18 }, // A: Kode
      { width: 30 }, // B: Nama
      { width: 50 }, // C: Keterangan
      { width: 25 }, // D: Validasi
    ];

    guideWs.mergeCells('A1:D1');
    const guideTitle = guideWs.getCell('A1');
    guideTitle.value = 'KAMUS NOTASI & ATURAN VALIDASI IMPORT CALLSHEET';
    guideTitle.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    guideTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    guideTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryDark } };
    guideWs.getRow(1).height = 28;

    const notasiGuides = [
      ['SK', 'Stock Kecil', 'Outlet dengan stok 1 - 3 slop', 'Angka integer >= 0'],
      ['SL', 'Stock Lebih', 'Outlet dengan stok > 3 slop', 'Angka integer >= 0'],
      ['SD', 'Stock Display / Etalase', 'Outlet yang mendisplay produk di rak/etalase', 'Angka integer >= 0'],
      ['OOS', 'Out Of Stock', 'Outlet yang kehabisan stok', 'Angka integer >= 0'],
      ['SB', 'Stock Box', 'Outlet yang menyimpan stok dalam kardus/box', 'Angka integer >= 0'],
      ['TL', 'Total Layanan', 'Outlet tutup / tidak dapat dilayani', 'Angka integer >= 0'],
      ['BPJ', 'Brand Penjualan (EC Brand)', 'Outlet yang belum menjual produk ini (dihitung otomatis)', 'Auto: Kunjungan - (Status)'],
      ['BD', 'Brand Distribution', 'Efektivitas sebaran brand (SK+SL+SD+OOS+SB)', 'Auto Sum: SK+SL+SD+OOS+SB'],
      ['Stock', 'Stok Outlet', 'Total fisik bungkus/slop yang ada di outlet', 'Angka integer >= 0'],
      ['Buy', 'Pembelian Outlet', 'Jumlah pack yang dibeli outlet pada hari ini', 'Angka integer >= 0'],
      ['Face Up', 'Face Up Display', 'Jumlah display kemasan yang tampak depan', 'Angka integer >= 0'],
    ];

    // Header row
    guideWs.getRow(3).height = 22;
    ['KODE', 'NAMA NOTASI', 'DEFINISI & PENJELASAN', 'ATURAN VALIDASI'].forEach((h, idx) => {
      const colLetter = String.fromCharCode(65 + idx);
      const c = guideWs.getCell(`${colLetter}3`);
      c.value = h;
      c.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } };
    });

    notasiGuides.forEach(([kd, nm, def, val], idx) => {
      const rNum = 4 + idx;
      guideWs.getRow(rNum).height = 20;

      guideWs.getCell(`A${rNum}`).value = kd;
      guideWs.getCell(`A${rNum}`).font = { name: 'Arial', size: 9, bold: true };
      guideWs.getCell(`B${rNum}`).value = nm;
      guideWs.getCell(`C${rNum}`).value = def;
      guideWs.getCell(`D${rNum}`).value = val;

      for (let c = 1; c <= 4; c++) {
        const colLetter = String.fromCharCode(64 + c);
        guideWs.getCell(`${colLetter}${rNum}`).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
    });

    const uint8Array = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(uint8Array);
    const filename = `Template_Callsheet_${districtKode}_${tglKunjungan}.xlsx`;

    return { buffer, filename };
  }
}
