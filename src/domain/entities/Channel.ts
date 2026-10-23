export interface ChannelProps {
  id: string;
  kode: string;
  nama: string;
  deskripsi?: string | null;
  urutan: number;
  status: string;
  createdAt: Date;
  createdBy?: string | null;
  updatedAt: Date;
  updatedBy?: string | null;
}

export class Channel {
  constructor(public readonly props: ChannelProps) {}

  get id(): string { return this.props.id; }
  get kode(): string { return this.props.kode; }
  get nama(): string { return this.props.nama; }
  get deskripsi(): string | null | undefined { return this.props.deskripsi; }
  get urutan(): number { return this.props.urutan; }
  get status(): string { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  isActive(): boolean {
    return this.props.status === 'AKTIF';
  }
}
