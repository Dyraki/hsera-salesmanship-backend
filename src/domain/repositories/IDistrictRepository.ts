import { District, DistrictProps } from '../entities/District';

export interface DistrictFilter {
  ouKode?: string;
  ouKodeIn?: string[];
  status?: string;
  search?: string;
}

export interface IDistrictRepository {
  findAll(filter?: DistrictFilter): Promise<District[]>;
  findById(id: string): Promise<District | null>;
  findByOuAndKode(ouKode: string, kode: string): Promise<District | null>;
  create(data: Omit<DistrictProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<District>;
  update(id: string, data: Partial<DistrictProps>): Promise<District>;
  delete(id: string): Promise<void>;
}
