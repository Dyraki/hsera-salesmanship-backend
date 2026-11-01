import { Request, Response, NextFunction } from 'express';
import { PrismaRekapHarianRepository } from '../../infrastructure/database/repositories/PrismaRekapHarianRepository';
import { PrismaDistrictRepository } from '../../infrastructure/database/repositories/PrismaDistrictRepository';
import { PrismaBrandRepository } from '../../infrastructure/database/repositories/PrismaBrandRepository';
import { PrismaTargetRepository } from '../../infrastructure/database/repositories/PrismaTargetRepository';
import { PrismaKunciMingguRepository } from '../../infrastructure/database/repositories/PrismaKunciMingguRepository';
import { GetWeeklyDistrictReportUseCase } from '../../application/use-cases/report/GetWeeklyDistrictReportUseCase';
import { GetAvailableWeeksUseCase } from '../../application/use-cases/report/GetAvailableWeeksUseCase';
import { GetSkuSalesReportUseCase } from '../../application/use-cases/report/GetSkuSalesReportUseCase';
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

const getSkuSalesReportUC = new GetSkuSalesReportUseCase(
  rekapRepo,
  brandRepo,
  districtRepo,
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

      let targetOu: string | undefined = ouKode && ouKode !== 'all' ? String(ouKode) : undefined;
      let ouKodeIn: string[] | undefined = undefined;

      if (!user.scope.isSuperAdmin) {
        const allowedOus = await authBackendService.getOperationUnits(user.token);
        if (allowedOus.length > 0) {
          ouKodeIn = allowedOus.map((u: any) => u.kode);
        }

        if (targetOu) {
          const selectedOu = allowedOus.find((u: any) => u.kode === targetOu);
          if (selectedOu) {
            const descendantKodes = getDescendantKodes(selectedOu.id, allowedOus);
            if (descendantKodes.length > 0) {
              ouKodeIn = [selectedOu.kode, ...descendantKodes];
              targetOu = undefined;
            }
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

      let targetOu: string | undefined = ouKode && ouKode !== 'all' ? String(ouKode) : undefined;
      let ouKodeIn: string[] | undefined = undefined;

      if (!user.scope.isSuperAdmin) {
        const allowedOus = await authBackendService.getOperationUnits(user.token);
        if (allowedOus.length > 0) {
          ouKodeIn = allowedOus.map((u: any) => u.kode);
        }

        if (targetOu) {
          const selectedOu = allowedOus.find((u: any) => u.kode === targetOu);
          if (selectedOu) {
            const descendantKodes = getDescendantKodes(selectedOu.id, allowedOus);
            if (descendantKodes.length > 0) {
              ouKodeIn = [selectedOu.kode, ...descendantKodes];
              targetOu = undefined;
            }
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

  static async getSkuSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { year, quarter, cycleType, ouKode, districtId, statusRekap } = req.query;
      const user = req.user!;

      let targetOu: string | undefined = ouKode && ouKode !== 'all' ? String(ouKode) : undefined;
      let ouKodeIn: string[] | undefined = undefined;

      if (!user.scope.isSuperAdmin) {
        const allowedOus = await authBackendService.getOperationUnits(user.token);
        if (allowedOus.length > 0) {
          ouKodeIn = allowedOus.map((u: any) => u.kode);
        }

        if (targetOu) {
          const selectedOu = allowedOus.find((u: any) => u.kode === targetOu);
          if (selectedOu) {
            const descendantKodes = getDescendantKodes(selectedOu.id, allowedOus);
            if (descendantKodes.length > 0) {
              ouKodeIn = [selectedOu.kode, ...descendantKodes];
              targetOu = undefined;
            }
          }
        }
      }

      const result = await getSkuSalesReportUC.execute({
        year: year ? Number(year) : undefined,
        quarter: quarter ? Number(quarter) : undefined,
        cycleType: cycleType as any,
        ouKode: targetOu,
        ouKodeIn,
        districtId: districtId ? String(districtId) : undefined,
        statusRekap: statusRekap ? String(statusRekap) : undefined,
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
