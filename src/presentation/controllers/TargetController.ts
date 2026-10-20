import { Request, Response, NextFunction } from 'express';
import { PrismaTargetRepository } from '../../infrastructure/database/repositories/PrismaTargetRepository';
import {
  GetTargetsUseCase,
  SaveTargetUseCase,
  DeleteTargetUseCase,
} from '../../application/use-cases/target/TargetUseCases';

const targetRepo = new PrismaTargetRepository();
const getTargetsUC = new GetTargetsUseCase(targetRepo);
const saveTargetUC = new SaveTargetUseCase(targetRepo);
const deleteTargetUC = new DeleteTargetUseCase(targetRepo);

export class TargetController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { districtId, jenisTarget, status } = req.query;
      const targets = await getTargetsUC.execute({
        districtId: districtId ? String(districtId) : undefined,
        jenisTarget: jenisTarget ? (String(jenisTarget) as any) : undefined,
        status: status ? String(status) : undefined,
      });

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
      const target = await saveTargetUC.execute({
        id: req.body.id,
        jenisTarget: req.body.jenisTarget,
        districtId: req.body.districtId,
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
      const { id } = req.params;
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
