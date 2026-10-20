import { Brand, BrandProps } from '../entities/Brand';

export interface BrandFilter {
  status?: string;
  kategori?: string;
}

export interface IBrandRepository {
  findAll(filter?: BrandFilter): Promise<Brand[]>;
  findById(id: string): Promise<Brand | null>;
  findByKode(kode: string): Promise<Brand | null>;
  create(data: Omit<BrandProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<Brand>;
  update(id: string, data: Partial<BrandProps>): Promise<Brand>;
  updateOrder(orders: { id: string; urutan: number }[]): Promise<void>;
  delete(id: string): Promise<void>;
}
