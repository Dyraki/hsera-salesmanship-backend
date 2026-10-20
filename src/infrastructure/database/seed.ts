import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- SEEDING SALESMANSHIP DATABASE ---');

  // 1. Seed Brands
  const brands = [
    { kode: "HSF12", nama: "HS FILTER 12", kategori: "SKMFF", urutan: 1 },
    { kode: "HSK12", nama: "HS KRETEK 12", kategori: "SKT", urutan: 2 },
    { kode: "HSSO20", nama: "HS SLIM ORIGINAL 20", kategori: "SKMLTLN", urutan: 3 },
    { kode: "HSSM20", nama: "HS SLIM MENTHOL 20", kategori: "SKMLTLN", urutan: 4 },
    { kode: "HSSF20", nama: "HS SLIM FRESH MINT 20", kategori: "SKMLTLN", urutan: 5 },
    { kode: "HSSP20", nama: "HS SLIM PURPLE 20", kategori: "SKMLTLN", urutan: 6 },
    { kode: "HSMO16", nama: "HS MILD ORIGINAL 16", kategori: "SKMLTLN", urutan: 7 },
    { kode: "HSMP16", nama: "HS MILD PURPLE ICE 16", kategori: "SKMLTLN", urutan: 8 },
    { kode: "HSMM16", nama: "HS MILD MANGO ICE 16", kategori: "SKMLTLN", urutan: 9 },
    { kode: "HSMMC16", nama: "HS MILD MATCHA ICE 16", kategori: "SKMLTLN", urutan: 10 },
    { kode: "HSB20", nama: "HS BOLD 20", kategori: "SKMFF", urutan: 11 },
    { kode: "HSB12", nama: "HS BOLD 12", kategori: "SKMFF", urutan: 12 },
    { kode: "SANSK12", nama: "SANS KRETEK 12", kategori: "SKT", urutan: 13 },
    { kode: "HSSAO20", nama: "HS SLIM APPLEMINT ORANGEBOOST 20", kategori: "SKMLTLN", urutan: 14 },
    { kode: "HSKMC20", nama: "HS KRETEK MATCHA 12", kategori: "SKT", urutan: 15 },
  ];

  for (const b of brands) {
    await prisma.mstBrand.upsert({
      where: { kode: b.kode },
      create: b,
      update: { nama: b.nama, kategori: b.kategori, urutan: b.urutan },
    });
  }
  console.log(`✓ Seeded ${brands.length} Brands`);

  // 2. Seed Notasi
  const notasiList = [
    { kode: 'OOS', nama: 'Out Of Stock', levelInput: 'BRAND', kelompokTampil: 'STATUS', satuan: 'OUTLET', urutan: 1 },
    { kode: 'SK', nama: 'Stock Kecil (1-3 slop)', levelInput: 'BRAND', kelompokTampil: 'STATUS', satuan: 'OUTLET', urutan: 2 },
    { kode: 'SL', nama: 'Stock Lebih (> 3 slop)', levelInput: 'BRAND', kelompokTampil: 'STATUS', satuan: 'OUTLET', urutan: 3 },
    { kode: 'SD', nama: 'Stock Display / Etalase', levelInput: 'BRAND', kelompokTampil: 'STATUS', satuan: 'OUTLET', urutan: 4 },
    { kode: 'SB', nama: 'Stock Box', levelInput: 'BRAND', kelompokTampil: 'STATUS', satuan: 'OUTLET', urutan: 5 },
    { kode: 'BD', nama: 'Brand Distribution (OOS+SK+SL+SD+SB)', levelInput: 'TURUNAN', kelompokTampil: 'STATUS', rumus: 'OOS+SK+SL+SD+SB', satuan: 'OUTLET', urutan: 6 },
    { kode: 'TL', nama: 'Total Layanan Kunjungan', levelInput: 'BRAND', kelompokTampil: 'STATUS', satuan: 'OUTLET', urutan: 7 },
    { kode: 'BPJ', nama: 'Brand Penjualan (EC Brand)', levelInput: 'BRAND', kelompokTampil: 'STATUS', satuan: 'OUTLET', urutan: 8 },
    { kode: 'STOCK', nama: 'Stock Outlet (Bks/Slop)', levelInput: 'BRAND', kelompokTampil: 'KUANTITAS', satuan: 'QTY', urutan: 9 },
    { kode: 'BUY', nama: 'Pembelian Outlet (Bks/Slop)', levelInput: 'BRAND', kelompokTampil: 'KUANTITAS', satuan: 'QTY', urutan: 10 },
    { kode: 'FACE_UP', nama: 'Face Up Display', levelInput: 'BRAND', kelompokTampil: 'FACEUP', satuan: 'QTY', urutan: 11 },
    // Harian summary notasi
    { kode: 'TOTAL_KUNJUNGAN', nama: 'Total Kunjungan Harian', levelInput: 'HARIAN', kelompokTampil: 'HARIAN', satuan: 'OUTLET', urutan: 12 },
    { kode: 'TOTAL_EC', nama: 'Total Effective Call Harian', levelInput: 'HARIAN', kelompokTampil: 'HARIAN', satuan: 'OUTLET', urutan: 13 },
    { kode: 'VOLUME_GG', nama: 'Total Volume GG Harian', levelInput: 'HARIAN', kelompokTampil: 'HARIAN', satuan: 'QTY', urutan: 14 },
  ];

  for (const n of notasiList) {
    await prisma.mstNotasi.upsert({
      where: { kode: n.kode },
      create: n,
      update: {
        nama: n.nama,
        levelInput: n.levelInput,
        kelompokTampil: n.kelompokTampil,
        rumus: n.rumus || null,
        satuan: n.satuan,
        urutan: n.urutan,
      },
    });
  }
  console.log(`✓ Seeded ${notasiList.length} Notasi`);

  // 3. Seed Default Master Target
  const defaultTargets = [
    { jenisTarget: 'KUNJUNGAN', nilai: 40, berlakuDari: new Date('2026-01-01') },
    { jenisTarget: 'BD', nilai: 20, berlakuDari: new Date('2026-01-01') },
    { jenisTarget: 'EC', nilai: 30, berlakuDari: new Date('2026-01-01') },
  ];

  for (const t of defaultTargets) {
    const existing = await prisma.mstTarget.findFirst({
      where: {
        jenisTarget: t.jenisTarget,
        districtId: null,
      },
    });
    if (!existing) {
      await prisma.mstTarget.create({
        data: {
          jenisTarget: t.jenisTarget,
          nilai: t.nilai,
          berlakuDari: t.berlakuDari,
          status: 'AKTIF',
        },
      });
    }
  }
  console.log(`✓ Seeded default targets (Kunjungan 40, BD 20, EC 30)`);

  // 4. Sample Districts for Testing
  const sampleDistricts = [
    { ouKode: 'SMG', kode: 'D-01', karyawanId: 'salesman-01' },
    { ouKode: 'SMG', kode: 'D-02', karyawanId: 'salesman-02' },
    { ouKode: 'SLO', kode: 'D-01', karyawanId: 'salesman-03' },
  ];

  for (const d of sampleDistricts) {
    await prisma.mstDistrict.upsert({
      where: {
        ou_kode_kode_unique: { ouKode: d.ouKode, kode: d.kode },
      },
      create: d,
      update: { karyawanId: d.karyawanId },
    });
  }
  console.log(`✓ Seeded sample districts`);

  console.log('--- SEEDING COMPLETED SUCCESSFULLY ---');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
