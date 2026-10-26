import { Request, Response, NextFunction } from 'express';
import { PrismaRekapHarianRepository } from '../../infrastructure/database/repositories/PrismaRekapHarianRepository';
import { PrismaDistrictRepository } from '../../infrastructure/database/repositories/PrismaDistrictRepository';
import { PrismaBrandRepository } from '../../infrastructure/database/repositories/PrismaBrandRepository';
import { PrismaNotasiRepository } from '../../infrastructure/database/repositories/PrismaNotasiRepository';
import { PrismaTargetRepository } from '../../infrastructure/database/repositories/PrismaTargetRepository';
import { GetAreaOfficeDashboardUseCase } from '../../application/use-cases/dashboard/GetAreaOfficeDashboardUseCase';

import { authBackendService } from '../../infrastructure/services/AuthBackendServiceClient';

const rekapRepo = new PrismaRekapHarianRepository();
const districtRepo = new PrismaDistrictRepository();
const brandRepo = new PrismaBrandRepository();
const notasiRepo = new PrismaNotasiRepository();
const targetRepo = new PrismaTargetRepository();

const getAreaOfficeDashboardUC = new GetAreaOfficeDashboardUseCase(
  rekapRepo,
  districtRepo,
  brandRepo,
  notasiRepo,
  targetRepo
);

const dashboardCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 30000; // 30 seconds

export class DashboardController {
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const { tahun, kuartal, kodeMinggu, ouKode } = req.query;
      const user = req.user;

      let allowedUnitCodes: string[] | undefined = undefined;
      if (user && !user.scope.isSuperAdmin) {
        if (user.token) {
          try {
            const scopedUnits = await authBackendService.getOperationUnits(user.token);
            if (scopedUnits && scopedUnits.length > 0) {
              allowedUnitCodes = scopedUnits.map((u) => u.kode).filter(Boolean);
            }
          } catch {
            // fallback
          }
        }

        if (!allowedUnitCodes || allowedUnitCodes.length === 0) {
          if (user.scope.unitCode) {
            allowedUnitCodes = [user.scope.unitCode];
          } else if (user.scope.allowedUnitIds && user.scope.allowedUnitIds.length > 0) {
            allowedUnitCodes = user.scope.allowedUnitIds;
          }
        }
      }

      const cacheKey = `${tahun || '2026'}_${kuartal || '4'}_${kodeMinggu ?? ''}_${ouKode || 'ALL'}_${(allowedUnitCodes || []).join(',')}_${user?.id || 'public'}`;
      const cached = dashboardCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return res.json({
          success: true,
          data: cached.data,
        });
      }

      const result = await getAreaOfficeDashboardUC.execute(
        tahun ? Number(tahun) : undefined,
        kuartal ? Number(kuartal) : undefined,
        kodeMinggu !== undefined && kodeMinggu !== '' ? Number(kodeMinggu) : undefined,
        ouKode ? String(ouKode) : undefined,
        allowedUnitCodes,
        user?.token
      );

      dashboardCache.set(cacheKey, { timestamp: Date.now(), data: result });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAreaOfficeDashboard(req: Request, res: Response, next: NextFunction) {
    return DashboardController.getDashboard(req, res, next);
  }
}

