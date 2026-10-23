import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma';
import { PrismaTargetRepository } from '../../infrastructure/database/repositories/PrismaTargetRepository';
import {
  GetTargetsUseCase,
  SaveTargetUseCase,
  DeleteTargetUseCase,
} from '../../application/use-cases/target/TargetUseCases';
import { TargetFilter } from '../../domain/repositories/ITargetRepository';
import { authBackendService } from '../../infrastructure/services/AuthBackendServiceClient';
import { AppError } from '../../domain/errors/AppError';

const targetRepo = new PrismaTargetRepository();
const getTargetsUC = new GetTargetsUseCase(targetRepo);
const saveTargetUC = new SaveTargetUseCase(targetRepo);
const deleteTargetUC = new DeleteTargetUseCase(targetRepo);

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

export class TargetController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { districtId, jenisTarget, status, ouKode } = req.query;
      const user = req.user!;

      const filter: TargetFilter = {
        districtId: districtId ? String(districtId) : undefined,
        jenisTarget: jenisTarget ? (String(jenisTarget) as any) : undefined,
        status: status ? String(status) : undefined,
      };

      if (user.scope.isSuperAdmin) {
        if (ouKode && ouKode !== 'all') {
          filter.ouKode = String(ouKode);
          filter.includeGlobal = false;
        } else {
          filter.includeGlobal = true;
        }
      } else {
        const allowedOus = await authBackendService.getOperationUnits(user.token);
        const permittedKodes = allowedOus.map((u: any) => u.kode);

        if (ouKode && ouKode !== 'all') {
          const selectedOu = allowedOus.find((u: any) => u.kode === String(ouKode));
          if (selectedOu) {
            const descendants = getDescendantKodes(selectedOu.id, allowedOus);
            filter.ouKodeIn = [selectedOu.kode, ...descendants];
          } else {
            filter.ouKode = String(ouKode);
          }
          filter.includeGlobal = false;
        } else {
          filter.ouKodeIn = permittedKodes;
          filter.includeGlobal = true;
        }
      }

      const targets = await getTargetsUC.execute(filter);

      res.json({
        success: true,
        data: targets.map((t) => ({
          ...t.props,
          districtKode: t.districtKode,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async save(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      let targetOuKode: string | null = req.body.ouKode || null;
      let districtId: string | null = req.body.districtId || null;

      // If districtId is given, resolve its ouKode from mst_district
      if (districtId) {
        const district = await prisma.mstDistrict.findUnique({
          where: { id: districtId },
        });
        if (!district) {
          throw AppError.notFound('District tidak ditemukan.');
        }
        targetOuKode = district.ouKode;
      }

      // ACL verification
      if (!user.scope.isSuperAdmin) {
        if (!targetOuKode) {
          throw AppError.forbidden('Hanya Super Admin yang diizinkan mengatur Target Global (Semua Unit).');
        }

        const allowedOus = await authBackendService.getOperationUnits(user.token);
        const permittedKodes = allowedOus.map((u: any) => u.kode);

        if (!permittedKodes.includes(targetOuKode)) {
          throw AppError.forbidden(`Akses ditolak. Anda tidak memiliki izin untuk Unit Operasi ${targetOuKode}.`);
        }
      }

      const target = await saveTargetUC.execute({
        id: req.body.id,
        jenisTarget: req.body.jenisTarget,
        ouKode: targetOuKode,
        districtId,
        hariKunjungan: req.body.hariKunjungan !== undefined && req.body.hariKunjungan !== null ? Number(req.body.hariKunjungan) : null,
        nilai: Number(req.body.nilai),
        berlakuDari: req.body.berlakuDari,
        berlakuSampai: req.body.berlakuSampai,
        status: req.body.status,
        userId: user.userId,
      });

      res.json({
        success: true,
        message: 'Target berhasil disimpan.',
        data: target.props,
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!user.scope.isSuperAdmin) {
        const existing = await targetRepo.findById(id);
        if (!existing) {
          throw AppError.notFound('Target tidak ditemukan.');
        }
        if (!existing.ouKode) {
          throw AppError.forbidden('Hanya Super Admin yang diizinkan menghapus Target Global.');
        }
        const allowedOus = await authBackendService.getOperationUnits(user.token);
        const permittedKodes = allowedOus.map((u: any) => u.kode);
        if (!permittedKodes.includes(existing.ouKode)) {
          throw AppError.forbidden('Akses ditolak untuk menghapus target unit ini.');
        }
      }

      await deleteTargetUC.execute(id);
      res.json({
        success: true,
        message: 'Target berhasil dihapus.',
      });
    } catch (err) {
      next(err);
    }
  }
}
