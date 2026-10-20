import { Request, Response, NextFunction } from 'express';
import { PrismaRekapHarianRepository } from '../../infrastructure/database/repositories/PrismaRekapHarianRepository';
import { PrismaDistrictRepository } from '../../infrastructure/database/repositories/PrismaDistrictRepository';
import { PrismaBrandRepository } from '../../infrastructure/database/repositories/PrismaBrandRepository';
import { PrismaTargetRepository } from '../../infrastructure/database/repositories/PrismaTargetRepository';
import { PrismaKunciMingguRepository } from '../../infrastructure/database/repositories/PrismaKunciMingguRepository';
import { GetWeeklyDistrictReportUseCase } from '../../application/use-cases/report/GetWeeklyDistrictReportUseCase';
import { GetAvailableWeeksUseCase } from '../../application/use-cases/report/GetAvailableWeeksUseCase';
import { authBackendService } from '../../infrastructure/services/AuthBackendServiceClient';

const rekapRepo = new PrismaRekapHarianRepository();
const districtRepo = new PrismaDistrictRepository();
const brandRepo = new PrismaBrandRepository();
const targetRepo = new PrismaTargetRepository();
const lockRepo = new PrismaKunciMingguRepository();

const getWeeklyDistrictReportUC = new GetWeeklyDistrictReportUseCase(
  rekapRepo,
  districtRepo,
  brandRepo,
  targetRepo,
  lockRepo
);

const getAvailableWeeksUC = new GetAvailableWeeksUseCase(rekapRepo);

export class ReportController {
  static async getWeeklyDistrictReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { districtId, kodeMinggu, kategori, statusRekap, ouKode } = req.query;
      const user = req.user!;

      if (!districtId) {
        return res.status(400).json({
          success: false,
          message: 'Parameter districtId wajib diisi.',
        });
      }

      let targetOu: string | undefined = ouKode ? String(ouKode) : undefined;
      let ouKodeIn: string[] | undefined = undefined;

      if (!targetOu && !user.scope.isSuperAdmin) {
        if (user.scope.unitCode) {
          targetOu = user.scope.unitCode;
        } else if (user.scope.allowedUnitIds && user.scope.allowedUnitIds.length > 0) {
          const allowedOus = await authBackendService.getOperationUnits(user.token);
          if (allowedOus.length > 0) {
            ouKodeIn = allowedOus.map((u: any) => u.kode);
          }
        }
      }

      const result = await getWeeklyDistrictReportUC.execute({
        districtId: String(districtId),
        kodeMinggu: kodeMinggu ? Number(kodeMinggu) : undefined,
        kategori: kategori ? String(kategori) : undefined,
        statusRekap: statusRekap ? String(statusRekap) : undefined,
        ouKode: targetOu,
        ouKodeIn,
        token: user.token,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAvailableWeeks(req: Request, res: Response, next: NextFunction) {
    try {
      const { ouKode } = req.query;
      const user = req.user!;

      let targetOu: string | undefined = ouKode ? String(ouKode) : undefined;
      let ouKodeIn: string[] | undefined = undefined;

      if (!targetOu && !user.scope.isSuperAdmin) {
        if (user.scope.unitCode) {
          targetOu = user.scope.unitCode;
        } else if (user.scope.allowedUnitIds && user.scope.allowedUnitIds.length > 0) {
          const allowedOus = await authBackendService.getOperationUnits(user.token);
          if (allowedOus.length > 0) {
            ouKodeIn = allowedOus.map((u: any) => u.kode);
          }
        }
      }

      const result = await getAvailableWeeksUC.execute(targetOu, ouKodeIn);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
