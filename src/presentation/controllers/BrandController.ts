import { Request, Response, NextFunction } from 'express';
import { PrismaBrandRepository } from '../../infrastructure/database/repositories/PrismaBrandRepository';
import { GetBrandsUseCase } from '../../application/use-cases/brand/GetBrandsUseCase';
import { SaveBrandUseCase } from '../../application/use-cases/brand/SaveBrandUseCase';
import { ReorderBrandsUseCase } from '../../application/use-cases/brand/ReorderBrandsUseCase';

const brandRepo = new PrismaBrandRepository();
const getBrandsUC = new GetBrandsUseCase(brandRepo);
const saveBrandUC = new SaveBrandUseCase(brandRepo);
const reorderBrandsUC = new ReorderBrandsUseCase(brandRepo);

export class BrandController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, kategori } = req.query;
      const brands = await getBrandsUC.execute({
        status: status ? String(status) : undefined,
        kategori: kategori ? String(kategori) : undefined,
      });

      res.json({
        success: true,
        data: brands.map((b) => b.props),
      });
    } catch (err) {
      next(err);
    }
  }

  static async save(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const brand = await saveBrandUC.execute({
        id: req.body.id,
        kode: req.body.kode,
        nama: req.body.nama,
        kategori: req.body.kategori,
        urutan: req.body.urutan ? Number(req.body.urutan) : undefined,
        status: req.body.status,
        userId: user.userId,
      });

      res.json({
        success: true,
        message: 'Brand berhasil disimpan.',
        data: brand.props,
      });
    } catch (err) {
      next(err);
    }
  }

  static async reorder(req: Request, res: Response, next: NextFunction) {
    try {
      const { orders } = req.body;
      await reorderBrandsUC.execute(orders);
      res.json({
        success: true,
        message: 'Urutan brand berhasil diperbarui.',
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await brandRepo.delete(id);
      res.json({
        success: true,
        message: 'Brand berhasil dihapus.',
      });
    } catch (err) {
      next(err);
    }
  }
}
