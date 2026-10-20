export interface DistrictProps {
  id: string;
  ouKode: string;
  kode: string;
  karyawanId: string;
  status: string;
  createdAt: Date;
  createdBy?: string | null;
  updatedAt: Date;
  updatedBy?: string | null;
  karyawanName?: string | null; // hydrated from auth backend
}

export class District {
  constructor(public readonly props: DistrictProps) {}

  get id(): string { return this.props.id; }
  get ouKode(): string { return this.props.ouKode; }
  get kode(): string { return this.props.kode; }
  get karyawanId(): string { return this.props.karyawanId; }
  get status(): string { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get createdBy(): string | null | undefined { return this.props.createdBy; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get updatedBy(): string | null | undefined { return this.props.updatedBy; }
  get karyawanName(): string | null | undefined { return this.props.karyawanName; }

  isActive(): boolean {
    return this.props.status === 'AKTIF';
  }
}
