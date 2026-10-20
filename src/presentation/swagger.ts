import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HSERA Salesmanship & Rekap Callsheet API',
      version: '1.0.0',
      description:
        'REST API microservice untuk modul Salesmanship (Teritori Management, Setup Target, Form Callsheet, dan Monitoring Callsheet) yang terintegrasi dengan HSERA Auth Backend.',
      contact: {
        name: 'HSERA Development Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:5003',
        description: 'Local Salesmanship Backend Server',
      },
    ],
    tags: [
      { name: '1. Teritori Management', description: 'Master District & penugasan Salesman per Operation Unit' },
      { name: '2. Setup Target', description: 'Konfigurasi target Kunjungan, BD, EC, FaceUp, Volume' },
      { name: '3. Form Callsheet', description: 'Input matriks harian Callsheet (Brand x Notasi) dengan auto-hitung BD' },
      { name: '4. Monitoring & Laporan', description: 'Monitoring kelengkapan Senin-Sabtu dan Laporan Lebar RIS' },
      { name: '5. Kontrol Kunci Minggu', description: 'Lock / Unlock ISO Week (YYYYWW) untuk proteksi audit' },
      { name: '6. Master Brand & Notasi', description: 'Katalog Brand dan Notasi rumus/satuan' },
      { name: '7. Referensi Auth Backend', description: 'Data referensi Karyawan / Salesman dan Operation Unit' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Gunakan Bearer JWT token yang didapatkan saat login dari HSERA Auth Backend',
        },
      },
      schemas: {
        District: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            ouKode: { type: 'string', example: 'SMG' },
            kode: { type: 'string', example: 'D-01' },
            karyawanId: { type: 'string', example: 'salesman-01' },
            karyawanName: { type: 'string', example: 'Budi Santoso' },
            status: { type: 'string', example: 'AKTIF' },
          },
        },
        Brand: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            kode: { type: 'string', example: 'GG_FILTER' },
            nama: { type: 'string', example: 'GG Filter International' },
            kategori: { type: 'string', example: 'GG' },
            urutan: { type: 'integer', example: 1 },
            status: { type: 'string', example: 'AKTIF' },
          },
        },
        Notasi: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            kode: { type: 'string', example: 'BD' },
            nama: { type: 'string', example: 'Brand Distribution' },
            levelInput: { type: 'string', example: 'TURUNAN' },
            kelompokTampil: { type: 'string', example: 'STATUS' },
            rumus: { type: 'string', example: 'OOS+SK+SL+SD+SB' },
            satuan: { type: 'string', example: 'OUTLET' },
          },
        },
        Target: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            jenisTarget: { type: 'string', enum: ['KUNJUNGAN', 'BD', 'EC', 'FACEUP', 'VOLUME'] },
            districtId: { type: 'string', nullable: true },
            hariKunjungan: { type: 'integer', nullable: true, example: 1 },
            nilai: { type: 'number', example: 40 },
            berlakuDari: { type: 'string', format: 'date', example: '2026-01-01' },
          },
        },
        CallsheetFormSkeleton: {
          type: 'object',
          properties: {
            date: { type: 'string', example: '2026-10-06' },
            hariKunjungan: { type: 'integer', example: 2 },
            namaHari: { type: 'string', example: 'Selasa' },
            kodeMinggu: { type: 'integer', example: 202641 },
            kodeMingguDisplay: { type: 'string', example: '2641' },
            isLocked: { type: 'boolean', example: false },
            isWorkday: { type: 'boolean', example: true },
            targets: {
              type: 'object',
              properties: {
                kunjungan: { type: 'number', example: 40 },
                bd: { type: 'number', example: 20 },
                ec: { type: 'number', example: 30 },
              },
            },
            brands: { type: 'array', items: { $ref: '#/components/schemas/Brand' } },
            notasiList: { type: 'array', items: { $ref: '#/components/schemas/Notasi' } },
            rekap: {
              type: 'object',
              properties: {
                id: { type: 'string', nullable: true },
                jenisRekap: { type: 'string', example: 'NORMAL' },
                jumlahKunjungan: { type: 'number', example: 40 },
                totalEc: { type: 'number', example: 30 },
                volumeGg: { type: 'number', example: 120 },
                matrix: {
                  type: 'object',
                  description: 'BrandId mapping to NotasiKode values',
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/presentation/routes/*.ts', './src/presentation/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
