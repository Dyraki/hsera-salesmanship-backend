export interface KunciMingguProps {
  kodeMinggu: number; // YYYYWW
  status: string; // 'AKTIF' = LOCKED, 'NONAKTIF' = UNLOCKED
  catatan?: string | null;
  createdAt: Date;
  createdBy?: string | null;
  updatedAt: Date;
  updatedBy?: string | null;
}

export class KunciMinggu {
  constructor(public readonly props: KunciMingguProps) {}

  get kodeMinggu(): number { return this.props.kodeMinggu; }
  get status(): string { return this.props.status; }
  get catatan(): string | null | undefined { return this.props.catatan; }
  get createdAt(): Date { return this.props.createdAt; }
  get createdBy(): string | null | undefined { return this.props.createdBy; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get updatedBy(): string | null | undefined { return this.props.updatedBy; }

  isLocked(): boolean {
    return this.props.status === 'AKTIF';
  }
}
