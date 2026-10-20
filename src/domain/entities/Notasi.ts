export type LevelInput = 'BRAND' | 'HARIAN' | 'TURUNAN' | 'TARGET';
export type KelompokTampil = 'STATUS' | 'KUANTITAS' | 'FACEUP' | 'HARIAN' | null;

export interface NotasiProps {
  id: string;
  kode: string;
  nama: string;
  levelInput: LevelInput;
  kelompokTampil: KelompokTampil;
  rumus?: string | null;
  satuan: string;
  urutan: number;
  status: string;
  createdAt: Date;
  createdBy?: string | null;
  updatedAt: Date;
  updatedBy?: string | null;
}

export class Notasi {
  constructor(public readonly props: NotasiProps) {}

  get id(): string { return this.props.id; }
  get kode(): string { return this.props.kode; }
  get nama(): string { return this.props.nama; }
  get levelInput(): LevelInput { return this.props.levelInput; }
  get kelompokTampil(): KelompokTampil { return this.props.kelompokTampil; }
  get rumus(): string | null | undefined { return this.props.rumus; }
  get satuan(): string { return this.props.satuan; }
  get urutan(): number { return this.props.urutan; }
  get status(): string { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get createdBy(): string | null | undefined { return this.props.createdBy; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get updatedBy(): string | null | undefined { return this.props.updatedBy; }

  isActive(): boolean {
    return this.props.status === 'AKTIF';
  }
}
