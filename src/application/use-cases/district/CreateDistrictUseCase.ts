import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { District, DistrictProps } from '../../../domain/entities/District';
import { AppError } from '../../../domain/errors/AppError';

export interface CreateDistrictDTO {
  ouKode: string;
  kode: string;
  karyawanId: string;
  status?: string;
  createdBy?: string;
}

export class CreateDistrictUseCase {
  constructor(private districtRepo: IDistrictRepository) {}

  async execute(dto: CreateDistrictDTO): Promise<District> {
    if (!dto.ouKode || !dto.kode || !dto.karyawanId) {
      throw AppError.badRequest('ouKode, kode, dan karyawanId wajib diisi.');
    }

    const cleanKode = dto.kode.trim().toUpperCase();
    const cleanOu = dto.ouKode.trim().toUpperCase();

    // Check uniqueness within OU
    const existing = await this.districtRepo.findByOuAndKode(cleanOu, cleanKode);
    if (existing) {
      throw AppError.conflict(`District dengan kode '${cleanKode}' sudah ada di OU '${cleanOu}'.`);
    }

    return await this.districtRepo.create({
      ouKode: cleanOu,
      kode: cleanKode,
      karyawanId: dto.karyawanId,
      status: dto.status || 'AKTIF',
      createdBy: dto.createdBy,
    });
  }
}
