export interface BrandProps {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  urutan: number;
  status: string;
  createdAt: Date;
  createdBy?: string | null;
  updatedAt: Date;
  updatedBy?: string | null;
}

export class Brand {
  constructor(public readonly props: BrandProps) {}

  get id(): string { return this.props.id; }
  get kode(): string { return this.props.kode; }
  get nama(): string { return this.props.nama; }
  get kategori(): string { return this.props.kategori; }
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
