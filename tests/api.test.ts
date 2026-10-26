import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import http from 'http';
import axios from 'axios';
import { createApp } from '../src/presentation/app';
import { SYSTEM_MENU_IDS } from '../src/domain/constants/MenuConstants';

const SECRET = 'supersecretkeyframeworkv1coreauth';
const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}`;

let server: http.Server;

// Generate test token for Super Admin
const superAdminToken = jwt.sign(
  {
    sub: 'user-superadmin',
    username: 'superadmin',
    scope: {
      isSuperAdmin: true,
      allowedUnitIds: ['SMG', 'SLO'],
    },
    permissions: [],
  },
  SECRET,
  { expiresIn: '1h' }
);

// Generate test token for Staff with level 1 (read only)
const staffReadOnlyToken = jwt.sign(
  {
    sub: 'user-staff',
    username: 'staff',
    scope: {
      isSuperAdmin: false,
      allowedUnitIds: ['SMG'],
    },
    permissions: [
      { menuId: SYSTEM_MENU_IDS.TERITORY_MANAGEMENT, enable: true, level: 1 },
      { menuId: SYSTEM_MENU_IDS.FORM_CALLSHEET, enable: true, level: 1 },
    ],
  },
  SECRET,
  { expiresIn: '1h' }
);

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => resolve());
  });

  return () => {
    server.close();
  };
});

describe('Salesmanship API Integration Tests', () => {
  it('GET /health should return UP', async () => {
    const res = await axios.get(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('UP');
    expect(res.data.service).toBe('hsera-salesmanship-backend');
  });

  it('GET /api/salesmanship/districts without auth should return 401', async () => {
    try {
      await axios.get(`${BASE_URL}/api/salesmanship/districts`);
      expect.fail('Should fail with 401');
    } catch (err: any) {
      expect(err.response.status).toBe(401);
    }
  });

  it('GET /api/salesmanship/districts with super admin should return seeded districts', async () => {
    const res = await axios.get(`${BASE_URL}/api/salesmanship/districts`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data)).toBe(true);
    expect(res.data.data.length).toBeGreaterThan(0);
  });

  it('POST /api/salesmanship/districts with read-only staff token should return 403 Forbidden', async () => {
    try {
      await axios.post(
        `${BASE_URL}/api/salesmanship/districts`,
        { ouKode: 'SMG', kode: 'TEST-D', karyawanId: 'karyawan-1' },
        { headers: { Authorization: `Bearer ${staffReadOnlyToken}` } }
      );
      expect.fail('Should fail with 403');
    } catch (err: any) {
      expect(err.response.status).toBe(403);
    }
  });

  it('Form Callsheet flow: get skeleton, submit with auto BD calculation', async () => {
    // 1. Get district
    const distRes = await axios.get(`${BASE_URL}/api/salesmanship/districts`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const districtId = distRes.data.data[0].id;

    // 2. Get callsheet form skeleton for 2026-10-06 (Tuesday)
    const formRes = await axios.get(
      `${BASE_URL}/api/salesmanship/callsheets/form?districtId=${districtId}&date=2026-10-06`,
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
    expect(formRes.status).toBe(200);
    expect(formRes.data.data.hariKunjungan).toBe(2);
    expect(formRes.data.data.namaHari).toBe('Selasa');
    expect(formRes.data.data.brands.length).toBeGreaterThanOrEqual(15);
    expect(formRes.data.data.notasiList.length).toBe(14);
    expect(formRes.data.data.targets.kunjungan).toBe(40);

    const firstBrand = formRes.data.data.brands[0];

    // 3. Submit callsheet with raw stock counts: OOS=2, SK=3, SL=1, SD=4, SB=0
    // Expected BD = 2 + 3 + 1 + 4 + 0 = 10
    const submitRes = await axios.post(
      `${BASE_URL}/api/salesmanship/callsheets`,
      {
        districtId,
        tglKunjungan: '2026-10-06',
        jenisRekap: 'NORMAL',
        jumlahKunjungan: 40,
        totalEc: 30,
        bdOutlet: 35,
        volumeGg: 150.5,
        statusRekap: 'FINAL',
        matrix: [
          { brandId: firstBrand.id, notasiKode: 'OOS', nilai: 2 },
          { brandId: firstBrand.id, notasiKode: 'SK', nilai: 3 },
          { brandId: firstBrand.id, notasiKode: 'SL', nilai: 1 },
          { brandId: firstBrand.id, notasiKode: 'SD', nilai: 4 },
          { brandId: firstBrand.id, notasiKode: 'SB', nilai: 0 },
        ],
      },
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );

    expect(submitRes.status).toBe(200);
    expect(submitRes.data.success).toBe(true);
    const savedRekap = submitRes.data.data;

    // Verify BD was auto calculated to 10
    const bdItem = savedRekap.nilaiList.find(
      (n: any) => n.brandId === firstBrand.id && n.notasiKode === 'BD'
    );
    expect(bdItem).toBeDefined();
    expect(bdItem.nilai).toBe(10);
    expect(savedRekap.bdOutlet).toBe(35);

    // 4. Test Sunday rejection
    try {
      await axios.post(
        `${BASE_URL}/api/salesmanship/callsheets`,
        {
          districtId,
          tglKunjungan: '2026-10-11', // Sunday
          jenisRekap: 'NORMAL',
        },
        { headers: { Authorization: `Bearer ${superAdminToken}` } }
      );
      expect.fail('Should fail on Sunday');
    } catch (err: any) {
      expect(err.response.status).toBe(400);
      expect(err.response.data.message).toContain('Hari Minggu bukan hari kerja salesman');
    }
  });

  it('Lock week test: lock week and assert callsheet modification is prevented', async () => {
    const distRes = await axios.get(`${BASE_URL}/api/salesmanship/districts`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const districtId = distRes.data.data[0].id;

    // 1. Lock week 202641
    const lockRes = await axios.post(
      `${BASE_URL}/api/salesmanship/locks/toggle`,
      { kodeMinggu: 202641, status: 'AKTIF', catatan: 'Locked for payroll audit' },
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
    expect(lockRes.status).toBe(200);
    expect(lockRes.data.data.status).toBe('AKTIF');

    // 2. Attempt to save callsheet for that week -> should be rejected
    try {
      await axios.post(
        `${BASE_URL}/api/salesmanship/callsheets`,
        {
          districtId,
          tglKunjungan: '2026-10-07', // Wednesday week 202641
          jenisRekap: 'NORMAL',
        },
        { headers: { Authorization: `Bearer ${superAdminToken}` } }
      );
      expect.fail('Should reject modification on locked week');
    } catch (err: any) {
      expect(err.response.status).toBe(400);
      expect(err.response.data.message).toContain('telah dikunci (LOCKED)');
    }

    // 3. Unlock week 202641
    const unlockRes = await axios.post(
      `${BASE_URL}/api/salesmanship/locks/toggle`,
      { kodeMinggu: 202641, status: 'NONAKTIF' },
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
    expect(unlockRes.status).toBe(200);
    expect(unlockRes.data.data.status).toBe('NONAKTIF');
  });

  it('GET /api/salesmanship/monitoring/weekly should return 6-day matrix', async () => {
    const res = await axios.get(
      `${BASE_URL}/api/salesmanship/monitoring/weekly?kodeMinggu=202641`,
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.kodeMinggu).toBe(202641);
    expect(Array.isArray(res.data.data.districts)).toBe(true);

    const firstDist = res.data.data.districts[0];
    expect(firstDist.days.length).toBe(6); // Senin .. Sabtu
    expect(firstDist.days[1].hari).toBe(2); // Tuesday
  });

  it('GET /api/salesmanship/monitoring/weekly with ouKode=AREA-TAG should resolve child branches', async () => {
    const res = await axios.get(
      `${BASE_URL}/api/salesmanship/monitoring/weekly?kodeMinggu=202641&ouKode=AREA-TAG`,
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data.districts)).toBe(true);
    // Should include districts from child branches (e.g. CAB-TAG)
    const ous = res.data.data.districts.map((d: any) => d.ouKode);
    expect(ous.some((ou: string) => ou === 'CAB-TAG')).toBe(true);
  });

  it('GET /api/salesmanship/monitoring/report/wide-ris should return pivot matrix', async () => {
    const res = await axios.get(
      `${BASE_URL}/api/salesmanship/monitoring/report/wide-ris?kodeMinggu=202641`,
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.brands.length).toBeGreaterThanOrEqual(15);
    expect(Array.isArray(res.data.data.rows)).toBe(true);
  });
});
