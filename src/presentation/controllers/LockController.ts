import { Request, Response, NextFunction } from 'express';
import { PrismaKunciMingguRepository } from '../../infrastructure/database/repositories/PrismaKunciMingguRepository';
import {
  GetLockStatusUseCase,
  GetAllLocksUseCase,
  ToggleLockWeekUseCase,
} from '../../application/use-cases/lock/LockUseCases';

const lockRepo = new PrismaKunciMingguRepository();
const getLockStatusUC = new GetLockStatusUseCase(lockRepo);
const getAllLocksUC = new GetAllLocksUseCase(lockRepo);
const toggleLockUC = new ToggleLockWeekUseCase(lockRepo);

export class LockController {
  static async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { kodeMinggu } = req.params;
      const status = await getLockStatusUC.execute(Number(kodeMinggu));
      res.json({
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const locks = await getAllLocksUC.execute();
      res.json({
        success: true,
        data: locks.map((l) => l.props),
      });
    } catch (err) {
      next(err);
    }
  }

  static async toggleLock(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { kodeMinggu, status, catatan } = req.body;

      const updated = await toggleLockUC.execute({
        kodeMinggu: Number(kodeMinggu),
        status,
        catatan,
        userId: user.userId,
      });

      res.json({
        success: true,
        message: `Minggu ${kodeMinggu} berhasil di-${status === 'AKTIF' ? 'kunci' : 'buka'}.`,
        data: updated.props,
      });
    } catch (err) {
      next(err);
    }
  }
}
