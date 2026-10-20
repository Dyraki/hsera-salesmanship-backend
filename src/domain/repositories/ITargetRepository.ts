import { Target, TargetProps, JenisTarget } from '../entities/Target';

export interface TargetFilter {
  districtId?: string;
  districtIdIn?: string[];
  jenisTarget?: JenisTarget;
  status?: string;
  hariKunjungan?: number;
  activeAt?: Date;
}

export interface ITargetRepository {
  findAll(filter?: TargetFilter): Promise<Target[]>;
  findById(id: string): Promise<Target | null>;
  findActiveTarget(
    districtId: string | null,
    jenisTarget: JenisTarget,
    date: Date,
    hariKunjungan?: number | null
  ): Promise<Target | null>;
  create(data: Omit<TargetProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<Target>;
  update(id: string, data: Partial<TargetProps>): Promise<Target>;
  delete(id: string): Promise<void>;
}
