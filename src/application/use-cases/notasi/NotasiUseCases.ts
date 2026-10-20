import { INotasiRepository, NotasiFilter } from '../../../domain/repositories/INotasiRepository';
import { Notasi, LevelInput, KelompokTampil } from '../../../domain/entities/Notasi';
import { AppError } from '../../../domain/errors/AppError';

export class GetNotasiUseCase {
  constructor(private notasiRepo: INotasiRepository) {}

  async execute(filter?: NotasiFilter): Promise<Notasi[]> {
    return await this.notasiRepo.findAll(filter);
  }
}

export interface SaveNotasiDTO {
  id?: string;
  kode: string;
  nama: string;
  levelInput: LevelInput;
  kelompokTampil?: KelompokTampil;
  rumus?: string | null;
  satuan: string;
  urutan?: number;
  status?: string;
  userId?: string;
}

export class SaveNotasiUseCase {
  constructor(private notasiRepo: INotasiRepository) {}

  async execute(dto: SaveNotasiDTO): Promise<Notasi> {
    if (!dto.kode || !dto.nama || !dto.levelInput || !dto.satuan) {
      throw AppError.badRequest('Kode, nama, levelInput, dan satuan notasi wajib diisi.');
    }

    const cleanKode = dto.kode.trim().toUpperCase();

    if (dto.id) {
      const existing = await this.notasiRepo.findById(dto.id);
      if (!existing) {
        throw AppError.notFound('Notasi tidak ditemukan.');
      }
      if (cleanKode !== existing.kode) {
        const dup = await this.notasiRepo.findByKode(cleanKode);
        if (dup && dup.id !== dto.id) {
          throw AppError.conflict(`Notasi dengan kode '${cleanKode}' sudah ada.`);
        }
      }
      return await this.notasiRepo.update(dto.id, {
        kode: cleanKode,
        nama: dto.nama.trim(),
        levelInput: dto.levelInput,
        kelompokTampil: dto.kelompokTampil,
        rumus: dto.rumus,
        satuan: dto.satuan.trim().toUpperCase(),
        urutan: dto.urutan,
        status: dto.status,
        updatedBy: dto.userId,
      });
    } else {
      const dup = await this.notasiRepo.findByKode(cleanKode);
      if (dup) {
        throw AppError.conflict(`Notasi dengan kode '${cleanKode}' sudah ada.`);
      }
      return await this.notasiRepo.create({
        kode: cleanKode,
        nama: dto.nama.trim(),
        levelInput: dto.levelInput,
        kelompokTampil: dto.kelompokTampil || null,
        rumus: dto.rumus,
        satuan: dto.satuan.trim().toUpperCase(),
        urutan: dto.urutan || 1,
        status: dto.status || 'AKTIF',
        createdBy: dto.userId,
      });
    }
  }
}

export class ReorderNotasiUseCase {
  constructor(private notasiRepo: INotasiRepository) {}

  async execute(orders: { id: string; urutan: number }[]): Promise<void> {
    if (!Array.isArray(orders) || orders.length === 0) {
      throw AppError.badRequest('List urutan notasi tidak valid.');
    }
    await this.notasiRepo.updateOrder(orders);
  }
}
