export type JenisTarget = 'KUNJUNGAN' | 'BD' | 'EC' | 'FACEUP' | 'VOLUME';

export interface TargetProps {
  id: string;
  jenisTarget: JenisTarget;
  ouKode?: string | null;
  districtId?: string | null;
  hariKunjungan?: number | null; // 1..6
  nilai: number;
  berlakuDari: Date;
  berlakuSampai?: Date | null;
  status: string;
  createdAt: Date;
  createdBy?: string | null;
  updatedAt: Date;
  updatedBy?: string | null;
  districtKode?: string | null;
}

export class Target {
  constructor(public readonly props: TargetProps) {}

  get id(): string { return this.props.id; }
  get jenisTarget(): JenisTarget { return this.props.jenisTarget; }
  get ouKode(): string | null | undefined { return this.props.ouKode; }
  get districtId(): string | null | undefined { return this.props.districtId; }
  get hariKunjungan(): number | null | undefined { return this.props.hariKunjungan; }
  get nilai(): number { return this.props.nilai; }
  get berlakuDari(): Date { return this.props.berlakuDari; }
  get berlakuSampai(): Date | null | undefined { return this.props.berlakuSampai; }
  get status(): string { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get createdBy(): string | null | undefined { return this.props.createdBy; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get updatedBy(): string | null | undefined { return this.props.updatedBy; }
  get districtKode(): string | null | undefined { return this.props.districtKode; }

  isActive(): boolean {
    return this.props.status === 'AKTIF';
  }
}
