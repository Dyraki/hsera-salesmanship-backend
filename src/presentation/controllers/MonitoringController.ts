import { Request, Response, NextFunction } from 'express';
import { PrismaRekapHarianRepository } from '../../infrastructure/database/repositories/PrismaRekapHarianRepository';
import { PrismaDistrictRepository } from '../../infrastructure/database/repositories/PrismaDistrictRepository';
import { PrismaBrandRepository } from '../../infrastructure/database/repositories/PrismaBrandRepository';
import { PrismaNotasiRepository } from '../../infrastructure/database/repositories/PrismaNotasiRepository';
import { PrismaKunciMingguRepository } from '../../infrastructure/database/repositories/PrismaKunciMingguRepository';
import { PrismaTargetRepository } from '../../infrastructure/database/repositories/PrismaTargetRepository';
import {
  GetWeeklyMonitoringUseCase,
  GetWideRisReportUseCase,
} from '../../application/use-cases/monitoring/MonitoringUseCases';

const rekapRepo = new PrismaRekapHarianRepository();
const districtRepo = new PrismaDistrictRepository();
const brandRepo = new PrismaBrandRepository();
const notasiRepo = new PrismaNotasiRepository();
const lockRepo = new PrismaKunciMingguRepository();
const targetRepo = new PrismaTargetRepository();

const getWeeklyMonitoringUC = new GetWeeklyMonitoringUseCase(
  rekapRepo,
  districtRepo,
  lockRepo,
  targetRepo
);
const getWideRisReportUC = new GetWideRisReportUseCase(
  rekapRepo,
  districtRepo,
  brandRepo,
  notasiRepo,
  targetRepo
);

export class MonitoringController {
  static async getWeeklyMonitoring(req: Request, res: Response, next: NextFunction) {
    try {
      const { kodeMinggu, ouKode } = req.query;
      const user = req.user!;

      let targetOu: string | undefined = ouKode ? String(ouKode) : undefined;
      let ouKodeIn: string[] | undefined = undefined;

      if (!targetOu && !user.scope.isSuperAdmin && user.scope.allowedUnitIds.length > 0) {
        ouKodeIn = user.scope.allowedUnitIds;
      }

      const result = await getWeeklyMonitoringUC.execute(
        kodeMinggu ? Number(kodeMinggu) : undefined,
        targetOu,
        ouKodeIn,
        user.token
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getWideRisReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { kodeMinggu, startDate, endDate, ouKode, districtId } = req.query;
      const user = req.user!;

      const result = await getWideRisReportUC.execute({
        kodeMinggu: kodeMinggu ? Number(kodeMinggu) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        ouKode: ouKode ? String(ouKode) : undefined,
        districtId: districtId ? String(districtId) : undefined,
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
}
