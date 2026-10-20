import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import http from 'http';
import axios from 'axios';
import { createApp } from '../src/presentation/app';
import { SYSTEM_MENU_IDS } from '../src/domain/constants/MenuConstants';

const SECRET = 'supersecretkeyframeworkv1coreauth';
const PORT = 5098;
const BASE_URL = `http://localhost:${PORT}`;

let server: http.Server;

// Generate test token for Super Admin
const superAdminToken = jwt.sign(
  {
    sub: 'user-superadmin',
    username: 'superadmin',
    scope: {
      isSuperAdmin: true,
      allowedUnitIds: ['SMG', 'SLO', 'HO'],
    },
    permissions: [],
  },
  SECRET,
  { expiresIn: '1h' }
);

// Staff with REPORT_WEEKLY_DISTRICT permission
const staffWithReportPermissionToken = jwt.sign(
  {
    sub: 'user-staff-report',
    username: 'staff-report',
    scope: {
      isSuperAdmin: false,
      allowedUnitIds: ['SMG', 'SLO', 'HO', 'CAB-TAG'],
    },
    permissions: [
      { menuId: SYSTEM_MENU_IDS.REPORT_WEEKLY_DISTRICT, enable: true, level: 1 },
    ],
  },
  SECRET,
  { expiresIn: '1h' }
);

// Staff without REPORT_WEEKLY_DISTRICT permission
const staffNoPermissionToken = jwt.sign(
  {
    sub: 'user-staff-no-perm',
    username: 'staff-no-perm',
    scope: {
      isSuperAdmin: false,
      allowedUnitIds: ['SMG'],
    },
    permissions: [
      { menuId: SYSTEM_MENU_IDS.TERITORY_MANAGEMENT, enable: true, level: 1 },
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

describe('Weekly District Report API Tests', () => {
  it('GET /api/salesmanship/reports/available-weeks without auth should return 401', async () => {
    try {
      await axios.get(`${BASE_URL}/api/salesmanship/reports/available-weeks`);
      expect.fail('Should fail with 401');
    } catch (err: any) {
      expect(err.response.status).toBe(401);
    }
  });

  it('GET /api/salesmanship/reports/available-weeks with super admin should return list of weeks', async () => {
    const res = await axios.get(`${BASE_URL}/api/salesmanship/reports/available-weeks`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data)).toBe(true);
    expect(res.data.data.length).toBeGreaterThan(0);

    const first = res.data.data[0];
    expect(first).toHaveProperty('kodeMinggu');
    expect(first).toHaveProperty('kodeMingguDisplay');
    expect(first).toHaveProperty('startDate');
    expect(first).toHaveProperty('endDate');
    expect(first).toHaveProperty('label');
    expect(first).toHaveProperty('isCurrent');
  });

  it('GET /api/salesmanship/reports/weekly-district without districtId should return 400', async () => {
    try {
      await axios.get(`${BASE_URL}/api/salesmanship/reports/weekly-district`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      expect.fail('Should fail with 400');
    } catch (err: any) {
      expect(err.response.status).toBe(400);
      expect(err.response.data.message).toContain('districtId');
    }
  });

  it('GET /api/salesmanship/reports/weekly-district without permission should return 403', async () => {
    try {
      await axios.get(`${BASE_URL}/api/salesmanship/reports/weekly-district?districtId=dummy-id`, {
        headers: { Authorization: `Bearer ${staffNoPermissionToken}` },
      });
      expect.fail('Should fail with 403');
    } catch (err: any) {
      expect(err.response.status).toBe(403);
    }
  });

  it('GET /api/salesmanship/reports/weekly-district should return complete report structure', async () => {
    // 1. Get a seeded district
    const distRes = await axios.get(`${BASE_URL}/api/salesmanship/districts`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    expect(distRes.data.data.length).toBeGreaterThan(0);
    const district = distRes.data.data[0];

    // 2. Fetch report with staff who has permission
    const reportRes = await axios.get(
      `${BASE_URL}/api/salesmanship/reports/weekly-district?districtId=${district.id}`,
      { headers: { Authorization: `Bearer ${staffWithReportPermissionToken}` } }
    );

    expect(reportRes.status).toBe(200);
    expect(reportRes.data.success).toBe(true);

    const data = reportRes.data.data;

    // Header validations
    expect(data).toHaveProperty('header');
    expect(data.header.district.id).toBe(district.id);
    expect(data.header).toHaveProperty('kodeMinggu');
    expect(data.header).toHaveProperty('kodeMingguDisplay');
    expect(data.header).toHaveProperty('lockStatusText');

    // KPI Summary validations
    expect(data).toHaveProperty('kpiSummary');
    expect(data.kpiSummary).toHaveProperty('kunjungan');
    expect(data.kpiSummary).toHaveProperty('ec');
    expect(data.kpiSummary).toHaveProperty('bd');
    expect(data.kpiSummary).toHaveProperty('volume');
    expect(data.kpiSummary).toHaveProperty('territoryReachIndex');

    // Daily Trend validations
    expect(data).toHaveProperty('dailyTrend');
    expect(Array.isArray(data.dailyTrend)).toBe(true);
    expect(data.dailyTrend.length).toBe(6); // Senin s/d Sabtu
    expect(data.dailyTrend[0].namaHari).toBe('Sen');

    // Notation Analysis validations
    expect(data).toHaveProperty('notationAnalysis');
    expect(data.notationAnalysis).toHaveProperty('stockLevel');
    expect(data.notationAnalysis.stockLevel).toHaveProperty('slPercent');
    expect(data.notationAnalysis.stockLevel).toHaveProperty('skPercent');
    expect(data.notationAnalysis.stockLevel).toHaveProperty('oosPercent');
    expect(data.notationAnalysis).toHaveProperty('tradeProgram');
    expect(data.notationAnalysis.tradeProgram).toHaveProperty('sd');
    expect(data.notationAnalysis.tradeProgram).toHaveProperty('sdPercent');
    expect(data.notationAnalysis.tradeProgram).toHaveProperty('tl');
    expect(data.notationAnalysis.tradeProgram).toHaveProperty('tlPercent');
    expect(data.notationAnalysis).toHaveProperty('penetration');
    expect(data.notationAnalysis.penetration).toHaveProperty('bd');
    expect(data.notationAnalysis.penetration).toHaveProperty('bdPercent');
    expect(data.notationAnalysis.penetration).toHaveProperty('bpj');
    expect(data.notationAnalysis.penetration).toHaveProperty('sb');

    // Brand Matrix validations (Dynamic from mst_brand)
    expect(data).toHaveProperty('brandMatrix');
    expect(data.brandMatrix).toHaveProperty('totalSkuAktif');
    expect(data.brandMatrix).toHaveProperty('brands');
    expect(Array.isArray(data.brandMatrix.brands)).toBe(true);
    expect(data.brandMatrix.totalSkuAktif).toBe(data.brandMatrix.brands.length);

    if (data.brandMatrix.brands.length > 0) {
      const b0 = data.brandMatrix.brands[0];
      expect(b0).toHaveProperty('urutan');
      expect(b0).toHaveProperty('kode');
      expect(b0).toHaveProperty('nama');
      expect(b0).toHaveProperty('kategori');
      expect(b0).toHaveProperty('notasi');
      expect(b0.notasi).toHaveProperty('slPercent');
      expect(b0.notasi).toHaveProperty('bdPercent');
      expect(b0).toHaveProperty('volume');
      expect(b0.volume).toHaveProperty('avgStock');
      expect(b0.volume).toHaveProperty('avgBuy');
      expect(b0.volume).toHaveProperty('totalVol');
    }

    // Summary Row validations
    expect(data.brandMatrix).toHaveProperty('summaryRow');
    expect(data.brandMatrix.summaryRow).toHaveProperty('label');
    expect(data.brandMatrix.summaryRow).toHaveProperty('slPercent');
    expect(data.brandMatrix.summaryRow).toHaveProperty('bdPercent');
  });
});
