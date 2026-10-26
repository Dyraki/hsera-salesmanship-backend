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
import { authBackendService } from '../../infrastructure/services/AuthBackendServiceClient';

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

function getDescendantKodes(unitId: string, allUnits: any[]): string[] {
  const result: string[] = [];
  const queue = [unitId];
  while (queue.length > 0) {
    const curId = queue.shift()!;
    const children = allUnits.filter((u: any) => u.parentId === curId);
    for (const child of children) {
      if (!result.includes(child.kode)) {
        result.push(child.kode);
        queue.push(child.id);
      }
    }
  }
  return result;
}

export class MonitoringController {
  static async getWeeklyMonitoring(req: Request, res: Response, next: NextFunction) {
    try {
      const { kodeMinggu, ouKode } = req.query;
      const user = req.user!;

      let targetOu: string | undefined = ouKode && ouKode !== 'all' ? String(ouKode) : undefined;
      let ouKodeIn: string[] | undefined = undefined;

      const allowedOus = await authBackendService.getOperationUnits(user.token);

      if (targetOu) {
        const selectedOu = allowedOus.find((u: any) => u.kode === targetOu);
        if (selectedOu) {
          const descendantKodes = getDescendantKodes(selectedOu.id, allowedOus);
          if (descendantKodes.length > 0) {
            ouKodeIn = [selectedOu.kode, ...descendantKodes];
            targetOu = undefined;
          }
        }
      } else if (!user.scope.isSuperAdmin) {
        const userUnits = allowedOus.filter((u: any) =>
          (user.scope.allowedUnitIds && (user.scope.allowedUnitIds.includes(u.id) || user.scope.allowedUnitIds.includes(u.kode))) ||
          user.scope.unitCode === u.kode
        );
        const allDescendants: string[] = [];
        for (const uu of userUnits) {
          if (!allDescendants.includes(uu.kode)) allDescendants.push(uu.kode);
          const desc = getDescendantKodes(uu.id, allowedOus);
          for (const d of desc) {
            if (!allDescendants.includes(d)) allDescendants.push(d);
          }
        }
        if (allDescendants.length > 0) {
          ouKodeIn = allDescendants;
        } else if (allowedOus.length > 0) {
          ouKodeIn = allowedOus.map((u: any) => u.kode);
        }
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

      let targetOu: string | undefined = ouKode && ouKode !== 'all' ? String(ouKode) : undefined;
      let ouKodeIn: string[] | undefined = undefined;

      const allowedOus = await authBackendService.getOperationUnits(user.token);

      if (targetOu) {
        const selectedOu = allowedOus.find((u: any) => u.kode === targetOu);
        if (selectedOu) {
          const descendantKodes = getDescendantKodes(selectedOu.id, allowedOus);
          if (descendantKodes.length > 0) {
            ouKodeIn = [selectedOu.kode, ...descendantKodes];
            targetOu = undefined;
          }
        }
      } else if (!user.scope.isSuperAdmin) {
        const userUnits = allowedOus.filter((u: any) =>
          (user.scope.allowedUnitIds && (user.scope.allowedUnitIds.includes(u.id) || user.scope.allowedUnitIds.includes(u.kode))) ||
          user.scope.unitCode === u.kode
        );
        const allDescendants: string[] = [];
        for (const uu of userUnits) {
          if (!allDescendants.includes(uu.kode)) allDescendants.push(uu.kode);
          const desc = getDescendantKodes(uu.id, allowedOus);
          for (const d of desc) {
            if (!allDescendants.includes(d)) allDescendants.push(d);
          }
        }
        if (allDescendants.length > 0) {
          ouKodeIn = allDescendants;
        } else if (allowedOus.length > 0) {
          ouKodeIn = allowedOus.map((u: any) => u.kode);
        }
      }

      const result = await getWideRisReportUC.execute({
        kodeMinggu: kodeMinggu ? Number(kodeMinggu) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        ouKode: targetOu,
        ouKodeIn,
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
