import { IKunciMingguRepository } from '../../../domain/repositories/IKunciMingguRepository';
import { KunciMinggu } from '../../../domain/entities/KunciMinggu';
import { AppError } from '../../../domain/errors/AppError';

export class GetLockStatusUseCase {
  constructor(private lockRepo: IKunciMingguRepository) {}

  async execute(kodeMinggu: number): Promise<{ kodeMinggu: number; isLocked: boolean; lockInfo: KunciMinggu | null }> {
    const lock = await this.lockRepo.findByKodeMinggu(kodeMinggu);
    return {
      kodeMinggu,
      isLocked: lock ? lock.isLocked() : false,
      lockInfo: lock,
    };
  }
}

export class GetAllLocksUseCase {
  constructor(private lockRepo: IKunciMingguRepository) {}

  async execute(): Promise<KunciMinggu[]> {
    return await this.lockRepo.findAll();
  }
}

export interface ToggleLockDTO {
  kodeMinggu: number;
  status: 'AKTIF' | 'NONAKTIF';
  catatan?: string | null;
  userId?: string | null;
}

export class ToggleLockWeekUseCase {
  constructor(private lockRepo: IKunciMingguRepository) {}

  async execute(dto: ToggleLockDTO): Promise<KunciMinggu> {
    if (!dto.kodeMinggu || !dto.status) {
      throw AppError.badRequest('kodeMinggu dan status wajib diisi.');
    }
    return await this.lockRepo.setLock(dto.kodeMinggu, dto.status, dto.catatan, dto.userId);
  }
}
