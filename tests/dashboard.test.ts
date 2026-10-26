import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import http from 'http';
import axios from 'axios';
import { createApp } from '../src/presentation/app';
import { SYSTEM_MENU_IDS } from '../src/domain/constants/MenuConstants';

const SECRET = process.env.JWT_SECRET || 'supersecretkeyframeworkv1coreauth';
let server: http.Server;
let BASE_URL = '';

// Generate test token for Super Admin
const superAdminToken = jwt.sign(
  {
    sub: 'user-superadmin',
    username: 'superadmin',
    scope: {
      isSuperAdmin: true,
      allowedUnitIds: ['CAB-TAG'],
    },
    permissions: [],
  },
  SECRET,
  { expiresIn: '1h' }
);

// Staff token with DASHBOARD permission (Read level 1)
const staffWithDashboardToken = jwt.sign(
  {
    sub: 'user-staff-dashboard',
    username: 'staff-dashboard',
    scope: {
      isSuperAdmin: false,
      unitCode: 'CAB-TAG',
      allowedUnitIds: ['CAB-TAG'],
    },
    permissions: [
      { menuId: SYSTEM_MENU_IDS.DASHBOARD, enable: true, level: 1 },
    ],
  },
  SECRET,
  { expiresIn: '1h' }
);

// Staff token without DASHBOARD permission
const staffNoDashboardToken = jwt.sign(
  {
    sub: 'user-staff-nodash',
    username: 'staff-nodash',
    scope: {
      isSuperAdmin: false,
      allowedUnitIds: ['CAB-TAG'],
    },
    permissions: [
      { menuId: SYSTEM_MENU_IDS.FORM_CALLSHEET, enable: true, level: 1 },
    ],
  },
  SECRET,
  { expiresIn: '1h' }
);

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      BASE_URL = `http://localhost:${addr.port}`;
      resolve();
    });
  });

  return () => {
    server.close();
  };
});

describe('Area Office Dashboard API Integration Tests', () => {
  it('GET /api/salesmanship/dashboard/area-office without auth should return 401', async () => {
    await expect(axios.get(`${BASE_URL}/api/salesmanship/dashboard/area-office`)).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it('GET /api/salesmanship/dashboard/area-office without dashboard permission should return 403', async () => {
    await expect(
      axios.get(`${BASE_URL}/api/salesmanship/dashboard/area-office`, {
        headers: { Authorization: `Bearer ${staffNoDashboardToken}` },
      })
    ).rejects.toMatchObject({
      response: { status: 403 },
    });
  });

  it('GET /api/salesmanship/dashboard/area-office with super admin should return real data structure', async () => {
    const res = await axios.get(`${BASE_URL}/api/salesmanship/dashboard/area-office?tahun=2026&kuartal=4`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);

    const data = res.data.data;

    // 1. Header Context
    expect(data.headerContext).toBeDefined();
    expect(data.headerContext.sessionQuarter).toBe(4);
    expect(data.headerContext.availableQuarters.length).toBeGreaterThan(0);

    // 2. KPI Summary (1 Karton = 800 Pack)
    expect(data.kpiSummary).toBeDefined();
    expect(data.kpiSummary.volume.packPerKarton).toBe(800);
    expect(data.kpiSummary.volume.equivalentKarton).toBe(
      Math.round((data.kpiSummary.volume.actualPack / 800) * 100) / 100
    );

    // 3. Branches Table
    expect(Array.isArray(data.branches)).toBe(true);
    expect(data.branches.length).toBeGreaterThan(0);
    const tagBranch = data.branches.find((b: any) => b.kode === 'CAB-TAG');
    expect(tagBranch).toBeDefined();
    expect(tagBranch.namaCabang).toContain('Tulungagung');

    // 4. Brand Matrix (15 Real Active Brands from mst_brand)
    expect(Array.isArray(data.brandMatrix)).toBe(true);
    expect(data.brandMatrix.length).toBe(15);
    expect(data.brandMatrix[0].kodeBrand).toBe('HSF12');
    expect(data.brandMatrix[0].kategori).toBe('SKMFF');
    expect(data.brandMatrixConsolidation).toBeDefined();
    expect(data.brandMatrixConsolidation.namaBrand).toBe('KONSOLIDASI 15 BRAND INTI');


    // 5. Salesmen Leaderboard - STRICTLY SORTED BY DISTRICT KODE
    expect(Array.isArray(data.salesmen)).toBe(true);
    expect(data.salesmen.length).toBeGreaterThan(0);

    const districtCodes = data.salesmen.map((s: any) => s.districtKode);
    const sortedDistrictCodes = [...districtCodes].sort((a, b) => a.localeCompare(b));
    expect(districtCodes).toEqual(sortedDistrictCodes);

    // Check that each salesman has predikat and action recommendation
    for (const salesman of data.salesmen) {
      expect(['Top Performer', 'On Target', 'Perlu Pembinaan']).toContain(salesman.predikat);
      expect(typeof salesman.actionRekomendasi).toBe('string');
      expect(salesman.actionRekomendasi.length).toBeGreaterThan(5);
    }

    // 6. Multi-Week Trend Section
    expect(data.trendSection).toBeDefined();
    expect(data.trendSection.packPerKarton).toBe(800);
    expect(Array.isArray(data.trendSection.weeks)).toBe(true);
    expect(Array.isArray(data.trendSection.branches)).toBe(true);
    expect(data.trendSection.insights.highestGrowth).toBeDefined();
  });

  it('GET /api/salesmanship/dashboard/area-office with staff token having permission should succeed', async () => {
    const res = await axios.get(`${BASE_URL}/api/salesmanship/dashboard/area-office`, {
      headers: { Authorization: `Bearer ${staffWithDashboardToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.headerContext.sessionWeek).toBeDefined();
  });

  it('GET /api/salesmanship/dashboard primary root endpoint should succeed with full DashboardDTO', async () => {
    const res = await axios.get(`${BASE_URL}/api/salesmanship/dashboard`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.headerContext.title).toBe('Dashboard Performa Salesmanship');
    expect(res.data.data.kpiSummary.volume.packPerKarton).toBe(800);
    expect(res.data.data.salesmen.length).toBeGreaterThan(0);

    // Verify (Terbaru) is removed from week labels
    for (const w of res.data.data.headerContext.availableWeeks) {
      expect(w.label).not.toContain('(Terbaru)');
    }
  });

  it('GET /api/salesmanship/dashboard with kodeMinggu=0 should evaluate All Week in quarter', async () => {
    const res = await axios.get(`${BASE_URL}/api/salesmanship/dashboard?kodeMinggu=0`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.headerContext.sessionWeek).toBe(0);
    expect(res.data.data.headerContext.sessionWeekDisplay).toBe('Semua Minggu');
    expect(res.data.data.salesmen.length).toBeGreaterThan(0);
    expect(res.data.data.kpiSummary.kunjungan.target).toBeGreaterThan(0);
  });
});

