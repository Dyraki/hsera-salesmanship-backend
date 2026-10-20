import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { District, DistrictProps } from '../../../domain/entities/District';
import { AppError } from '../../../domain/errors/AppError';

export interface UpdateDistrictDTO {
  ouKode?: string;
  kode?: string;
  karyawanId?: string;
  status?: string;
  updatedBy?: string;
}

export class UpdateDistrictUseCase {
  constructor(private districtRepo: IDistrictRepository) {}

  async execute(id: string, dto: UpdateDistrictDTO): Promise<District> {
    const existing = await this.districtRepo.findById(id);
    if (!existing) {
      throw AppError.notFound('District tidak ditemukan.');
    }

    const targetOu = dto.ouKode ? dto.ouKode.trim().toUpperCase() : existing.ouKode;
    const targetKode = dto.kode ? dto.kode.trim().toUpperCase() : existing.kode;

    if (targetOu !== existing.ouKode || targetKode !== existing.kode) {
      const duplicate = await this.districtRepo.findByOuAndKode(targetOu, targetKode);
      if (duplicate && duplicate.id !== id) {
        throw AppError.conflict(`District dengan kode '${targetKode}' sudah ada di OU '${targetOu}'.`);
      }
    }

    return await this.districtRepo.update(id, {
      ouKode: targetOu,
      kode: targetKode,
      karyawanId: dto.karyawanId !== undefined ? dto.karyawanId : existing.karyawanId,
      status: dto.status !== undefined ? dto.status : existing.status,
      updatedBy: dto.updatedBy,
    });
  }
}
