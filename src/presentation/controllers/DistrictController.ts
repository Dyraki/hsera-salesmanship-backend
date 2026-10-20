import { authBackendService } from '../../infrastructure/services/AuthBackendServiceClient';
import { Request, Response, NextFunction } from 'express';
import { PrismaDistrictRepository } from '../../infrastructure/database/repositories/PrismaDistrictRepository';
import { GetDistrictsUseCase } from '../../application/use-cases/district/GetDistrictsUseCase';
import { GetDistrictByIdUseCase } from '../../application/use-cases/district/GetDistrictByIdUseCase';
import { CreateDistrictUseCase } from '../../application/use-cases/district/CreateDistrictUseCase';
import { UpdateDistrictUseCase } from '../../application/use-cases/district/UpdateDistrictUseCase';
import { DeleteDistrictUseCase } from '../../application/use-cases/district/DeleteDistrictUseCase';

const districtRepo = new PrismaDistrictRepository();
const getDistrictsUC = new GetDistrictsUseCase(districtRepo);
const getDistrictByIdUC = new GetDistrictByIdUseCase(districtRepo);
const createDistrictUC = new CreateDistrictUseCase(districtRepo);
const updateDistrictUC = new UpdateDistrictUseCase(districtRepo);
const deleteDistrictUC = new DeleteDistrictUseCase(districtRepo);

export class DistrictController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { ouKode, status, search } = req.query;
      const user = req.user!;

      const filter: any = {
        status: status ? String(status) : undefined,
        search: search ? String(search) : undefined,
      };

      if (ouKode) {
        filter.ouKode = String(ouKode);
      } else if (!user.scope.isSuperAdmin) {
        // Scoped to user's permitted unit codes if not super admin
        const allowedOus = await authBackendService.getOperationUnits(user.token);
        filter.ouKodeIn = allowedOus.map((u: any) => u.kode);
      }

      const districts = await getDistrictsUC.execute(filter, user.token);
      res.json({
        success: true,
        data: districts.map((d) => ({
          id: d.id,
          ouKode: d.ouKode,
          kode: d.kode,
          karyawanId: d.karyawanId,
          karyawanName: d.karyawanName,
          status: d.status,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = req.user!;
      const district = await getDistrictByIdUC.execute(id, user.token);
      res.json({
        success: true,
        data: {
          id: district.id,
          ouKode: district.ouKode,
          kode: district.kode,
          karyawanId: district.karyawanId,
          karyawanName: district.karyawanName,
          status: district.status,
          createdAt: district.createdAt,
          updatedAt: district.updatedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const district = await createDistrictUC.execute({
        ouKode: req.body.ouKode,
        kode: req.body.kode,
        karyawanId: req.body.karyawanId,
        status: req.body.status,
        createdBy: user.userId,
      });

      res.status(201).json({
        success: true,
        message: 'District berhasil ditambahkan.',
        data: district.props,
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = req.user!;
      const district = await updateDistrictUC.execute(id, {
        ouKode: req.body.ouKode,
        kode: req.body.kode,
        karyawanId: req.body.karyawanId,
        status: req.body.status,
        updatedBy: user.userId,
      });

      res.json({
        success: true,
        message: 'District berhasil diperbarui.',
        data: district.props,
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await deleteDistrictUC.execute(id);
      res.json({
        success: true,
        message: 'District berhasil dihapus.',
      });
    } catch (err) {
      next(err);
    }
  }
}
