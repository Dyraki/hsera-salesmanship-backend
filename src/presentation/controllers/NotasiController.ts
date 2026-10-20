import { Request, Response, NextFunction } from 'express';
import { PrismaNotasiRepository } from '../../infrastructure/database/repositories/PrismaNotasiRepository';
import {
  GetNotasiUseCase,
  SaveNotasiUseCase,
  ReorderNotasiUseCase,
} from '../../application/use-cases/notasi/NotasiUseCases';

const notasiRepo = new PrismaNotasiRepository();
const getNotasiUC = new GetNotasiUseCase(notasiRepo);
const saveNotasiUC = new SaveNotasiUseCase(notasiRepo);
const reorderNotasiUC = new ReorderNotasiUseCase(notasiRepo);

export class NotasiController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, levelInput, kelompokTampil } = req.query;
      const notasiList = await getNotasiUC.execute({
        status: status ? String(status) : undefined,
        levelInput: levelInput ? (String(levelInput) as any) : undefined,
        kelompokTampil: kelompokTampil ? String(kelompokTampil) : undefined,
      });

      res.json({
        success: true,
        data: notasiList.map((n) => n.props),
      });
    } catch (err) {
      next(err);
    }
  }

  static async save(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const notasi = await saveNotasiUC.execute({
        id: req.body.id,
        kode: req.body.kode,
        nama: req.body.nama,
        levelInput: req.body.levelInput,
        kelompokTampil: req.body.kelompokTampil,
        rumus: req.body.rumus,
        satuan: req.body.satuan,
        urutan: req.body.urutan ? Number(req.body.urutan) : undefined,
        status: req.body.status,
        userId: user.userId,
      });

      res.json({
        success: true,
        message: 'Notasi berhasil disimpan.',
        data: notasi.props,
      });
    } catch (err) {
      next(err);
    }
  }

  static async reorder(req: Request, res: Response, next: NextFunction) {
    try {
      const { orders } = req.body;
      await reorderNotasiUC.execute(orders);
      res.json({
        success: true,
        message: 'Urutan notasi berhasil diperbarui.',
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await notasiRepo.delete(id);
      res.json({
        success: true,
        message: 'Notasi berhasil dihapus.',
      });
    } catch (err) {
      next(err);
    }
  }
}
