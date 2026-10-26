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
  karyawanNip?: string | null; // hydrated from auth backend (employeeNumber / NIP)
  channels?: Array<{ id: string; kode: string; nama: string }>;
  channelIds?: string[];
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
  get karyawanNip(): string | null | undefined { return this.props.karyawanNip; }
  get channels(): Array<{ id: string; kode: string; nama: string }> { return this.props.channels || []; }

  isActive(): boolean {
    return this.props.status === 'AKTIF';
  }
}
