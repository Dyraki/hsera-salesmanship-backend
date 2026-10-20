import { prisma } from '../prisma';
import { Target, TargetProps, JenisTarget } from '../../../domain/entities/Target';
import { ITargetRepository, TargetFilter } from '../../../domain/repositories/ITargetRepository';

export class PrismaTargetRepository implements ITargetRepository {
  private toDomain(raw: any): Target {
    return new Target({
      id: raw.id,
      jenisTarget: raw.jenisTarget as JenisTarget,
      districtId: raw.districtId,
      hariKunjungan: raw.hariKunjungan,
      nilai: Number(raw.nilai),
      berlakuDari: raw.berlakuDari,
      berlakuSampai: raw.berlakuSampai,
      status: raw.status,
      createdAt: raw.createdAt,
      createdBy: raw.createdBy,
      updatedAt: raw.updatedAt,
      updatedBy: raw.updatedBy,
      districtKode: raw.district?.kode,
    });
  }

  async findAll(filter?: TargetFilter): Promise<Target[]> {
    const where: any = {};

    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.jenisTarget) {
      where.jenisTarget = filter.jenisTarget;
    }
    if (filter?.districtId !== undefined) {
      where.districtId = filter.districtId;
    } else if (filter?.districtIdIn && filter.districtIdIn.length > 0) {
      where.districtId = { in: filter.districtIdIn };
    }
    if (filter?.hariKunjungan !== undefined) {
      where.hariKunjungan = filter.hariKunjungan;
    }
    if (filter?.activeAt) {
      where.berlakuDari = { lte: filter.activeAt };
      where.OR = [
        { berlakuSampai: null },
        { berlakuSampai: { gte: filter.activeAt } },
      ];
    }

    const rows = await prisma.mstTarget.findMany({
      where,
      include: {
        district: true,
      },
      orderBy: [{ berlakuDari: 'desc' }, { jenisTarget: 'asc' }],
    });

    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Target | null> {
    const raw = await prisma.mstTarget.findUnique({
      where: { id },
      include: { district: true },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findActiveTarget(
    districtId: string | null,
    jenisTarget: JenisTarget,
    date: Date,
    hariKunjungan?: number | null
  ): Promise<Target | null> {
    const where: any = {
      jenisTarget,
      status: 'AKTIF',
      berlakuDari: { lte: date },
      OR: [
        { berlakuSampai: null },
        { berlakuSampai: { gte: date } },
      ],
    };

    if (districtId) {
      where.OR = [
        { districtId: districtId },
        { districtId: null },
      ];
    } else {
      where.districtId = null;
    }

    if (hariKunjungan !== undefined && hariKunjungan !== null) {
      const allowedHari: (number | null)[] = [hariKunjungan, null];
      if (hariKunjungan >= 1 && hariKunjungan <= 5) {
        allowedHari.push(7); // Target Senin - Jumat (7) juga berlaku untuk hari 1..5
      }
      where.AND = [
        {
          OR: allowedHari.map((h) => ({ hariKunjungan: h })),
        },
      ];
    }

    const rows = await prisma.mstTarget.findMany({
      where,
      include: { district: true },
      orderBy: [
        { districtId: 'desc' }, // specific district first
        { berlakuDari: 'desc' },
      ],
    });

    if (rows.length === 0) return null;

    if (hariKunjungan !== undefined && hariKunjungan !== null) {
      const getRank = (r: any) => {
        const isDistrictSpecific = !!r.districtId;
        const isExactDay = r.hariKunjungan === hariKunjungan;
        const isWeekday = r.hariKunjungan === 7;
        if (isDistrictSpecific) {
          if (isExactDay) return 1;
          if (isWeekday) return 2;
          return 3;
        } else {
          if (isExactDay) return 4;
          if (isWeekday) return 5;
          return 6;
        }
      };
      rows.sort((a, b) => getRank(a) - getRank(b));
    }

    return this.toDomain(rows[0]);
  }

  async create(data: Omit<TargetProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<Target> {
    const raw = await prisma.mstTarget.create({
      data: {
        jenisTarget: data.jenisTarget,
        districtId: data.districtId || null,
        hariKunjungan: data.hariKunjungan || null,
        nilai: data.nilai,
        berlakuDari: data.berlakuDari,
        berlakuSampai: data.berlakuSampai || null,
        status: data.status || 'AKTIF',
        createdBy: data.createdBy,
      },
      include: { district: true },
    });
    return this.toDomain(raw);
  }

  async update(id: string, data: Partial<TargetProps>): Promise<Target> {
    const updateData: any = {};
    if (data.jenisTarget !== undefined) updateData.jenisTarget = data.jenisTarget;
    if (data.districtId !== undefined) updateData.districtId = data.districtId;
    if (data.hariKunjungan !== undefined) updateData.hariKunjungan = data.hariKunjungan;
    if (data.nilai !== undefined) updateData.nilai = data.nilai;
    if (data.berlakuDari !== undefined) updateData.berlakuDari = data.berlakuDari;
    if (data.berlakuSampai !== undefined) updateData.berlakuSampai = data.berlakuSampai;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

    const raw = await prisma.mstTarget.update({
      where: { id },
      data: updateData,
      include: { district: true },
    });
    return this.toDomain(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.mstTarget.delete({
      where: { id },
    });
  }
}
