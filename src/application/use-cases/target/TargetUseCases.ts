import { ITargetRepository, TargetFilter } from '../../../domain/repositories/ITargetRepository';
import { Target, JenisTarget } from '../../../domain/entities/Target';
import { AppError } from '../../../domain/errors/AppError';

export class GetTargetsUseCase {
  constructor(private targetRepo: ITargetRepository) {}

  async execute(filter?: TargetFilter): Promise<Target[]> {
    return await this.targetRepo.findAll(filter);
  }
}

export interface SaveTargetDTO {
  id?: string;
  jenisTarget: JenisTarget;
  ouKode?: string | null;
  districtId?: string | null;
  hariKunjungan?: number | null;
  nilai: number;
  berlakuDari: string | Date;
  berlakuSampai?: string | Date | null;
  status?: string;
  userId?: string;
}

export class SaveTargetUseCase {
  constructor(private targetRepo: ITargetRepository) {}

  async execute(dto: SaveTargetDTO): Promise<Target> {
    if (!dto.jenisTarget || dto.nilai === undefined || dto.nilai === null || !dto.berlakuDari) {
      throw AppError.badRequest('jenisTarget, nilai, dan berlakuDari wajib diisi.');
    }

    if (dto.nilai < 0) {
      throw AppError.badRequest('Nilai target tidak boleh negatif.');
    }

    const tglDari = new Date(dto.berlakuDari);
    const tglSampai = dto.berlakuSampai ? new Date(dto.berlakuSampai) : null;

    if (tglSampai && tglSampai < tglDari) {
      throw AppError.badRequest('berlakuSampai tidak boleh lebih awal dari berlakuDari.');
    }

    if (dto.hariKunjungan !== undefined && dto.hariKunjungan !== null) {
      if (dto.hariKunjungan < 1 || dto.hariKunjungan > 7) {
        throw AppError.badRequest('hariKunjungan harus antara 1 (Senin) sampai 7 (Senin - Jumat / Sabtu).');
      }
    }

    if (dto.id) {
      const existing = await this.targetRepo.findById(dto.id);
      if (!existing) {
        throw AppError.notFound('Target tidak ditemukan.');
      }
      return await this.targetRepo.update(dto.id, {
        jenisTarget: dto.jenisTarget,
        ouKode: dto.ouKode !== undefined ? dto.ouKode : existing.ouKode,
        districtId: dto.districtId !== undefined ? dto.districtId : existing.districtId,
        hariKunjungan: dto.hariKunjungan !== undefined ? dto.hariKunjungan : existing.hariKunjungan,
        nilai: Number(dto.nilai),
        berlakuDari: tglDari,
        berlakuSampai: tglSampai,
        status: dto.status !== undefined ? dto.status : existing.status,
        updatedBy: dto.userId,
      });
    } else {
      return await this.targetRepo.create({
        jenisTarget: dto.jenisTarget,
        ouKode: dto.ouKode || null,
        districtId: dto.districtId || null,
        hariKunjungan: dto.hariKunjungan || null,
        nilai: Number(dto.nilai),
        berlakuDari: tglDari,
        berlakuSampai: tglSampai,
        status: dto.status || 'AKTIF',
        createdBy: dto.userId,
      });
    }
  }
}

export class DeleteTargetUseCase {
  constructor(private targetRepo: ITargetRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.targetRepo.findById(id);
    if (!existing) {
      throw AppError.notFound('Target tidak ditemukan.');
    }
    await this.targetRepo.delete(id);
  }
}
