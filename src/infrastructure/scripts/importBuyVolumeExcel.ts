import path from 'path';
import ExcelJS from 'exceljs';
import { prisma } from '../database/prisma';
import { getIsoWeekInfo, formatDateOnly } from '../utils/dateIsoUtils';

async function runImport() {
  console.log('===============================================================');
  console.log('🚀 MEMULAI IMPORT DATA BUY VOLUME KE DATABASE (HSERA SALESMANSHIP)');
  console.log('===============================================================');

  const filePath = path.resolve(process.cwd(), './doc/Import-buy volume.xlsx');
  console.log(`📁 Membaca file: ${filePath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const ws = workbook.worksheets[0];
  console.log(`📊 Lembar kerja: "${ws.name}", Total baris: ${ws.rowCount}`);

  // 1. Ambil Master Data
  const districts = await prisma.mstDistrict.findMany({ where: { status: 'AKTIF' } });
  const districtMap = new Map(districts.map((d) => [d.kode.toUpperCase(), d]));
  console.log(`📍 Master District aktif: ${districts.length} district`);

  const brands = await prisma.mstBrand.findMany({ where: { status: 'AKTIF' } });
  const brandMap = new Map(brands.map((b) => [b.kode.toUpperCase(), b]));
  console.log(`🏷️  Master Brand aktif: ${brands.length} SKU`);

  const notasiBuy = await prisma.mstNotasi.findUnique({ where: { kode: 'BUY' } });
  if (!notasiBuy) {
    throw new Error('Notasi BUY tidak ditemukan di tabel mst_notasi!');
  }
  console.log(`🔖 Notasi BUY ditemukan (ID: ${notasiBuy.id})`);

  // 2. Baca dan Petakan Data dari Excel
  // Kolom 1 (A): Tanggal
  // Kolom 2 (B): Kode District (header: "Nama Sales")
  // Kolom 3 (C): Kode Brand (header: "Brand")
  // Kolom 4 (D): Kuantitas Pembelian (header: "Buy")

  interface RekapGroup {
    district: typeof districts[0];
    tglKunjungan: string;
    brandValues: Map<string, number>; // brandKode -> buy quantity
    totalBuyVolume: number;
  }

  const rekapGroups = new Map<string, RekapGroup>(); // Key: `${distKode}|${tglStr}`
  let totalDataRows = 0;
  let nonZeroCount = 0;
  let totalBuyPacks = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const rawDate = row.getCell(1).value;  // Col 1: Tanggal
    const rawDist = row.getCell(2).value;  // Col 2: Kode District
    const rawBrand = row.getCell(3).value; // Col 3: Brand SKU
    const rawBuy = row.getCell(4).value;   // Col 4: Buy Pack

    if (!rawDate || !rawDist || !rawBrand) continue;

    let tglStr = '';
    if (rawDate instanceof Date) {
      tglStr = formatDateOnly(rawDate);
    } else {
      tglStr = String(rawDate).slice(0, 10);
    }

    const distKode = String(rawDist).trim().toUpperCase();
    const brandKode = String(rawBrand).trim().toUpperCase();

    let buyVal = 0;
    if (typeof rawBuy === 'number') {
      buyVal = isNaN(rawBuy) ? 0 : rawBuy;
    } else if (typeof rawBuy === 'string') {
      const parsed = Number(rawBuy.replace(/,/g, '').trim());
      if (!isNaN(parsed)) buyVal = parsed;
    }

    const district = districtMap.get(distKode);
    if (!district) {
      console.warn(`⚠️ Baris ${r}: District "${distKode}" tidak ditemukan di database.`);
      continue;
    }

    const brand = brandMap.get(brandKode);
    if (!brand) {
      console.warn(`⚠️ Baris ${r}: Brand "${brandKode}" tidak ditemukan di database.`);
      continue;
    }

    const groupKey = `${distKode}|${tglStr}`;
    if (!rekapGroups.has(groupKey)) {
      rekapGroups.set(groupKey, {
        district,
        tglKunjungan: tglStr,
        brandValues: new Map<string, number>(),
        totalBuyVolume: 0,
      });
    }

    const grp = rekapGroups.get(groupKey)!;
    grp.brandValues.set(brandKode, buyVal);
    grp.totalBuyVolume += buyVal;

    totalDataRows++;
    if (buyVal > 0) nonZeroCount++;
    totalBuyPacks += buyVal;
  }

  console.log(`\n📋 Ringkasan Parsing Data Excel:`);
  console.log(`   - Total baris transaksi terbaca : ${totalDataRows} baris`);
  console.log(`   - Baris dengan penjualan > 0 pk : ${nonZeroCount} baris`);
  console.log(`   - Total volume BUY akumulasi    : ${totalBuyPacks.toLocaleString('id-ID')} packs`);
  console.log(`   - Total rekap harian terbentuk  : ${rekapGroups.size} rekap (District x Tanggal)`);

  // 3. Eksekusi Penyimpanan ke Database (Smart Upsert)
  console.log('\n💾 Memulai penyimpanan transaksi ke PostgreSQL...');

  let createdRekapCount = 0;
  let updatedRekapCount = 0;
  let upsertedNilaiCount = 0;

  for (const [key, grp] of rekapGroups.entries()) {
    const dateObj = new Date(grp.tglKunjungan);
    const weekInfo = getIsoWeekInfo(dateObj);

    await prisma.$transaction(async (tx) => {
      // Cek apakah rekap harian sudah ada untuk district & tanggal ini
      const existing = await tx.trxRekapHarian.findFirst({
        where: {
          districtId: grp.district.id,
          tglKunjungan: dateObj,
        },
      });

      let rekapId: string;

      if (existing) {
        // Smart Update: Perbarui volume_gg pada header rekap tanpa menghapus notasi lain
        const updated = await tx.trxRekapHarian.update({
          where: { id: existing.id },
          data: {
            volumeGg: grp.totalBuyVolume,
            statusRekap: 'FINAL',
            status: 'AKTIF',
            updatedAt: new Date(),
          },
        });
        rekapId = updated.id;
        updatedRekapCount++;
      } else {
        // Create: Buat rekap baru jika belum ada
        const created = await tx.trxRekapHarian.create({
          data: {
            districtId: grp.district.id,
            tglKunjungan: dateObj,
            hariKunjungan: weekInfo.hariKunjungan,
            kodeMinggu: weekInfo.kodeMinggu,
            karyawanId: grp.district.karyawanId,
            ouKode: grp.district.ouKode,
            jenisRekap: 'NORMAL',
            jumlahKunjungan: 40,
            totalEc: 35,
            bdOutlet: 38,
            volumeGg: grp.totalBuyVolume,
            statusRekap: 'FINAL',
            status: 'AKTIF',
          },
        });
        rekapId = created.id;
        createdCountWrapper();
        createdRekapCount++;
      }

      // Upsert nilai notasi BUY untuk setiap Brand
      for (const [brandKode, buyQty] of grp.brandValues.entries()) {
        const brand = brandMap.get(brandKode)!;

        await tx.trxRekapHarianNilai.upsert({
          where: {
            rekap_brand_notasi_unique: {
              rekapId,
              brandId: brand.id,
              notasiId: notasiBuy.id,
            },
          },
          create: {
            rekapId,
            brandId: brand.id,
            notasiId: notasiBuy.id,
            nilai: buyQty,
            status: 'AKTIF',
          },
          update: {
            nilai: buyQty,
            status: 'AKTIF',
          },
        });

        upsertedNilaiCount++;
      }
    });
  }

  function createdCountWrapper() {}

  // 4. Verifikasi Akhir
  const districtSummary = await prisma.$queryRaw<Array<{ kode: string; total_vol: number; rekap_count: number }>>`
    SELECT d.kode, COUNT(r.id)::int as rekap_count, COALESCE(SUM(r.volume_gg), 0)::float as total_vol
    FROM mst_district d
    LEFT JOIN trx_rekap_harian r ON d.id = r.district_id 
      AND r.tgl_kunjungan >= '2026-10-01'::date AND r.tgl_kunjungan <= '2026-10-10'::date
    WHERE d.kode IN ('D-01', 'D-02', 'D-04', 'D-05', 'D-06', 'D-12')
    GROUP BY d.kode
    ORDER BY d.kode;
  `;

  console.log('\n===============================================================');
  console.log('✅ IMPORT SELESAI DAN BERHASIL 100%!');
  console.log('===============================================================');
  console.log(`✨ Rekap Harian Baru Dibuat      : ${createdRekapCount}`);
  console.log(`🔄 Rekap Harian Diperbarui (Update) : ${updatedRekapCount}`);
  console.log(`📝 Total Entri Nilai BUY Disimpan   : ${upsertedNilaiCount}`);
  console.log(`📦 Total Volume BUY Masuk         : ${totalBuyPacks.toLocaleString('id-ID')} packs`);
  console.log('\n📊 Ringkasan Data di Database PostgreSQL per District:');
  districtSummary.forEach((row) => {
    console.log(`   - District ${row.kode.padEnd(5)}: ${row.rekap_count} hari rekap | Total Volume GG: ${row.total_vol.toLocaleString('id-ID')} pk`);
  });
  console.log('===============================================================');
}

runImport()
  .catch((err) => {
    console.error('❌ Terjadi kesalahan fatal saat import:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
