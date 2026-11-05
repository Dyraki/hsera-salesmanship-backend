export type JenisRekap = 'NORMAL' | 'TIDAK_ADA_KUNJUNGAN';
export type StatusRekap = 'DRAFT' | 'FINAL';

export interface RekapHarianNilaiProps {
  id?: string;
  rekapId?: string;
  brandId: string;
  notasiId: string;
  nilai: number;
  brandKode?: string;
  notasiKode?: string;
}

export interface RekapHarianProps {
  id: string;
  districtId: string;
  tglKunjungan: Date;
  hariKunjungan: number; // 1..6
  kodeMinggu: number; // YYYYWW
  karyawanId: string;
  ouKode: string;
  jenisRekap: JenisRekap;
  alasan?: string | null;
  jumlahKunjungan: number;
  totalEc: number;
  bdOutlet?: number;
  totalVolume?: number | null;
  volumeGg?: number | null;
  statusRekap: StatusRekap;
  status: string;
  catatan?: string | null;
  createdAt: Date;
  createdBy?: string | null;
  updatedAt: Date;
  updatedBy?: string | null;
  nilaiList?: RekapHarianNilaiProps[];
  districtKode?: string;
  karyawanName?: string;
}

export class RekapHarian {
  constructor(public readonly props: RekapHarianProps) {}

  get id(): string { return this.props.id; }
  get districtId(): string { return this.props.districtId; }
  get tglKunjungan(): Date { return this.props.tglKunjungan; }
  get hariKunjungan(): number { return this.props.hariKunjungan; }
  get kodeMinggu(): number { return this.props.kodeMinggu; }
  get karyawanId(): string { return this.props.karyawanId; }
  get ouKode(): string { return this.props.ouKode; }
  get jenisRekap(): JenisRekap { return this.props.jenisRekap; }
  get alasan(): string | null | undefined { return this.props.alasan; }
  get jumlahKunjungan(): number { return this.props.jumlahKunjungan; }
  get totalEc(): number { return this.props.totalEc; }
  get bdOutlet(): number { return this.props.bdOutlet || 0; }
  get totalVolume(): number | null | undefined { return this.props.totalVolume ?? this.props.volumeGg; }
  get volumeGg(): number | null | undefined { return this.props.totalVolume ?? this.props.volumeGg; }
  get statusRekap(): StatusRekap { return this.props.statusRekap; }
  get status(): string { return this.props.status; }
  get catatan(): string | null | undefined { return this.props.catatan; }
  get createdAt(): Date { return this.props.createdAt; }
  get createdBy(): string | null | undefined { return this.props.createdBy; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get updatedBy(): string | null | undefined { return this.props.updatedBy; }
  get nilaiList(): RekapHarianNilaiProps[] | undefined { return this.props.nilaiList; }
  get districtKode(): string | undefined { return this.props.districtKode; }
  get karyawanName(): string | undefined { return this.props.karyawanName; }

  isActive(): boolean {
    return this.props.status === 'AKTIF';
  }

  isFinal(): boolean {
    return this.props.statusRekap === 'FINAL';
  }
}
