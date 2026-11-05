import { Request, Response, NextFunction } from 'express';
import { PrismaRekapHarianRepository } from '../../infrastructure/database/repositories/PrismaRekapHarianRepository';
import { PrismaDistrictRepository } from '../../infrastructure/database/repositories/PrismaDistrictRepository';
import { PrismaBrandRepository } from '../../infrastructure/database/repositories/PrismaBrandRepository';
import { PrismaNotasiRepository } from '../../infrastructure/database/repositories/PrismaNotasiRepository';
import { PrismaTargetRepository } from '../../infrastructure/database/repositories/PrismaTargetRepository';
import { PrismaKunciMingguRepository } from '../../infrastructure/database/repositories/PrismaKunciMingguRepository';
import {
  GetCallsheetFormDataUseCase,
  SaveCallsheetUseCase,
  DeleteCallsheetUseCase,
} from '../../application/use-cases/callsheet/CallsheetUseCases';
import { GenerateCallsheetTemplateUseCase } from '../../application/use-cases/callsheet/GenerateCallsheetTemplateUseCase';
import { ImportCallsheetExcelUseCase } from '../../application/use-cases/callsheet/ImportCallsheetExcelUseCase';
import { formatDateOnly } from '../../infrastructure/utils/dateIsoUtils';

const rekapRepo = new PrismaRekapHarianRepository();
const districtRepo = new PrismaDistrictRepository();
const brandRepo = new PrismaBrandRepository();
const notasiRepo = new PrismaNotasiRepository();
const targetRepo = new PrismaTargetRepository();
const lockRepo = new PrismaKunciMingguRepository();

const getFormDataUC = new GetCallsheetFormDataUseCase(
  rekapRepo,
  districtRepo,
  brandRepo,
  notasiRepo,
  targetRepo,
  lockRepo
);
const saveCallsheetUC = new SaveCallsheetUseCase(
  rekapRepo,
  districtRepo,
  brandRepo,
  notasiRepo,
  lockRepo
);
const deleteCallsheetUC = new DeleteCallsheetUseCase(rekapRepo, lockRepo);
const generateTemplateUC = new GenerateCallsheetTemplateUseCase(brandRepo, districtRepo);
const importExcelUC = new ImportCallsheetExcelUseCase(districtRepo, brandRepo, lockRepo, saveCallsheetUC);

export class CallsheetController {
  static async downloadTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { districtId, date } = req.query;
      const { buffer, filename } = await generateTemplateUC.execute({
        districtId: districtId ? String(districtId) : undefined,
        date: date ? String(date) : undefined,
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  static async importExcel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ success: false, message: 'File Excel (.xlsx) wajib diunggah.' });
      }

      const statusRekap = req.body.statusRekap as any;
      const user = req.user;

      const result = await importExcelUC.execute({
        fileBuffer: req.file.buffer,
        userId: user?.userId,
        statusRekap: statusRekap || 'FINAL',
        token: user?.token,
      });

      res.json({
        success: true,
        message: `Data callsheet tanggal ${result.summary.tglKunjungan} untuk District ${result.summary.districtKode} berhasil di-import (${result.summary.totalBrandsProcessed} SKU).`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
  static async getFormData(req: Request, res: Response, next: NextFunction) {
    try {
      const { districtId, date } = req.query;
      const user = req.user!;

      if (!districtId) {
        return res.status(400).json({ success: false, message: 'districtId query parameter wajib diisi.' });
      }

      const dateStr = date ? String(date) : formatDateOnly(new Date());
      const data = await getFormDataUC.execute(String(districtId), dateStr, user.token);

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  static async save(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const saved = await saveCallsheetUC.execute({
        id: req.body.id,
        districtId: req.body.districtId,
        tglKunjungan: req.body.tglKunjungan,
        jenisRekap: req.body.jenisRekap,
        alasan: req.body.alasan,
        jumlahKunjungan: req.body.jumlahKunjungan !== undefined ? Number(req.body.jumlahKunjungan) : undefined,
        totalEc: req.body.totalEc !== undefined ? Number(req.body.totalEc) : undefined,
        bdOutlet: req.body.bdOutlet !== undefined ? Number(req.body.bdOutlet) : undefined,
        totalVolume: req.body.totalVolume !== undefined ? Number(req.body.totalVolume) : (req.body.volumeGg !== undefined ? Number(req.body.volumeGg) : undefined),
        volumeGg: req.body.totalVolume !== undefined ? Number(req.body.totalVolume) : (req.body.volumeGg !== undefined ? Number(req.body.volumeGg) : undefined),
        statusRekap: req.body.statusRekap,
        catatan: req.body.catatan,
        matrix: req.body.matrix,
        userId: user.userId,
      });

      res.json({
        success: true,
        message: 'Data callsheet harian berhasil disimpan.',
        data: saved.props,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const rekap = await rekapRepo.findById(id);
      if (!rekap) {
        return res.status(404).json({ success: false, message: 'Data callsheet tidak ditemukan.' });
      }
      res.json({
        success: true,
        data: rekap.props,
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await deleteCallsheetUC.execute(id);
      res.json({
        success: true,
        message: 'Data callsheet berhasil dihapus.',
      });
    } catch (err) {
      next(err);
    }
  }
}
