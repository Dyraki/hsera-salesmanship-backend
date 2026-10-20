import { KunciMinggu } from '../entities/KunciMinggu';

export interface IKunciMingguRepository {
  findByKodeMinggu(kodeMinggu: number): Promise<KunciMinggu | null>;
  findAll(): Promise<KunciMinggu[]>;
  setLock(kodeMinggu: number, status: 'AKTIF' | 'NONAKTIF', catatan?: string | null, userId?: string | null): Promise<KunciMinggu>;
}
