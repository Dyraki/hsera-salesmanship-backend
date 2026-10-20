import { IBrandRepository } from '../../../domain/repositories/IBrandRepository';
import { Brand } from '../../../domain/entities/Brand';
import { AppError } from '../../../domain/errors/AppError';

export interface SaveBrandDTO {
  id?: string;
  kode: string;
  nama: string;
  kategori: string;
  urutan?: number;
  status?: string;
  userId?: string;
}

export class SaveBrandUseCase {
  constructor(private brandRepo: IBrandRepository) {}

  async execute(dto: SaveBrandDTO): Promise<Brand> {
    if (!dto.kode || !dto.nama || !dto.kategori) {
      throw AppError.badRequest('Kode, nama, dan kategori brand wajib diisi.');
    }

    const cleanKode = dto.kode.trim().toUpperCase();

    if (dto.id) {
      const existing = await this.brandRepo.findById(dto.id);
      if (!existing) {
        throw AppError.notFound('Brand tidak ditemukan.');
      }
      if (cleanKode !== existing.kode) {
        const dup = await this.brandRepo.findByKode(cleanKode);
        if (dup && dup.id !== dto.id) {
          throw AppError.conflict(`Brand dengan kode '${cleanKode}' sudah ada.`);
        }
      }
      return await this.brandRepo.update(dto.id, {
        kode: cleanKode,
        nama: dto.nama.trim(),
        kategori: dto.kategori.trim().toUpperCase(),
        urutan: dto.urutan,
        status: dto.status,
        updatedBy: dto.userId,
      });
    } else {
      const dup = await this.brandRepo.findByKode(cleanKode);
      if (dup) {
        throw AppError.conflict(`Brand dengan kode '${cleanKode}' sudah ada.`);
      }
      return await this.brandRepo.create({
        kode: cleanKode,
        nama: dto.nama.trim(),
        kategori: dto.kategori.trim().toUpperCase(),
        urutan: dto.urutan || 1,
        status: dto.status || 'AKTIF',
        createdBy: dto.userId,
      });
    }
  }
}
