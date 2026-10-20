import { Notasi, NotasiProps, LevelInput } from '../entities/Notasi';

export interface NotasiFilter {
  status?: string;
  levelInput?: LevelInput;
  kelompokTampil?: string;
}

export interface INotasiRepository {
  findAll(filter?: NotasiFilter): Promise<Notasi[]>;
  findById(id: string): Promise<Notasi | null>;
  findByKode(kode: string): Promise<Notasi | null>;
  create(data: Omit<NotasiProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<Notasi>;
  update(id: string, data: Partial<NotasiProps>): Promise<Notasi>;
  updateOrder(orders: { id: string; urutan: number }[]): Promise<void>;
  delete(id: string): Promise<void>;
}
