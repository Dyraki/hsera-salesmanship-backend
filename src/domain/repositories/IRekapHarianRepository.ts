import { RekapHarian, RekapHarianProps } from '../entities/RekapHarian';

export interface RekapHarianFilter {
  ouKode?: string;
  ouKodeIn?: string[];
  districtId?: string;
  karyawanId?: string;
  kodeMinggu?: number;
  startDate?: Date;
  endDate?: Date;
  statusRekap?: string;
  status?: string;
}

export interface RekapHarianNilaiInput {
  brandId: string;
  notasiId: string;
  nilai: number;
}

export interface SaveRekapInput {
  districtId: string;
  tglKunjungan: Date;
  hariKunjungan: number;
  kodeMinggu: number;
  karyawanId: string;
  ouKode: string;
  jenisRekap: 'NORMAL' | 'TIDAK_ADA_KUNJUNGAN';
  alasan?: string | null;
  jumlahKunjungan: number;
  totalEc: number;
  bdOutlet?: number;
  volumeGg?: number | null;
  statusRekap: 'DRAFT' | 'FINAL';
  catatan?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  nilaiList?: RekapHarianNilaiInput[];
}

export interface IRekapHarianRepository {
  findAll(filter?: RekapHarianFilter): Promise<RekapHarian[]>;
  findById(id: string): Promise<RekapHarian | null>;
  findByDateAndDistrict(tglKunjungan: Date, districtId: string): Promise<RekapHarian | null>;
  findByWeek(kodeMinggu: number, districtId?: string, ouKode?: string): Promise<RekapHarian[]>;
  getDistinctWeeks(ouKode?: string, ouKodeIn?: string[]): Promise<number[]>;
  save(data: SaveRekapInput, existingId?: string): Promise<RekapHarian>;
  delete(id: string): Promise<void>;
}
