import { prisma } from '../prisma';
import { Target, TargetProps, JenisTarget } from '../../../domain/entities/Target';
import { ITargetRepository, TargetFilter } from '../../../domain/repositories/ITargetRepository';

export class PrismaTargetRepository implements ITargetRepository {
  private toDomain(raw: any): Target {
    return new Target({
      id: raw.id,
      jenisTarget: raw.jenisTarget as JenisTarget,
      ouKode: raw.ouKode || raw.district?.ouKode || null,
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
    if (filter?.ouKode) {
      if (filter.includeGlobal) {
        where.OR = [
          { ouKode: filter.ouKode },
          { ouKode: null, districtId: null },
          { district: { ouKode: filter.ouKode } },
        ];
      } else {
        where.OR = [
          { ouKode: filter.ouKode },
          { district: { ouKode: filter.ouKode } },
        ];
      }
    } else if (filter?.ouKodeIn && filter.ouKodeIn.length > 0) {
      if (filter.includeGlobal) {
        where.OR = [
          { ouKode: { in: filter.ouKodeIn } },
          { ouKode: null, districtId: null },
          { district: { ouKode: { in: filter.ouKodeIn } } },
        ];
      } else {
        where.OR = [
          { ouKode: { in: filter.ouKodeIn } },
          { district: { ouKode: { in: filter.ouKodeIn } } },
        ];
      }
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
    hariKunjungan?: number | null,
    ouKodeInput?: string | null
  ): Promise<Target | null> {
    let ouKode = ouKodeInput;
    if (districtId && !ouKode) {
      const dist = await prisma.mstDistrict.findUnique({
        where: { id: districtId },
        select: { ouKode: true },
      });
      if (dist) ouKode = dist.ouKode;
    }

    const where: any = {
      jenisTarget,
      status: 'AKTIF',
      berlakuDari: { lte: date },
      OR: [
        { berlakuSampai: null },
        { berlakuSampai: { gte: date } },
      ],
    };

    const scopeConditions: any[] = [{ ouKode: null, districtId: null }];
    if (ouKode) {
      scopeConditions.push({ ouKode, districtId: null });
    }
    if (districtId) {
      scopeConditions.push({ districtId });
    }
    where.AND = [{ OR: scopeConditions }];

    if (hariKunjungan !== undefined && hariKunjungan !== null) {
      const allowedHari: (number | null)[] = [hariKunjungan, null];
      if (hariKunjungan >= 1 && hariKunjungan <= 5) {
        allowedHari.push(7); // Target Senin - Jumat (7)
      }
      where.AND.push({
        OR: allowedHari.map((h) => ({ hariKunjungan: h })),
      });
    }

    const rows = await prisma.mstTarget.findMany({
      where,
      include: { district: true },
      orderBy: [
        { berlakuDari: 'desc' },
      ],
    });

    if (rows.length === 0) return null;

    const getRank = (r: any) => {
      const isDistrictSpecific = !!r.districtId && r.districtId === districtId;
      const isOuSpecific = !r.districtId && !!r.ouKode && r.ouKode === ouKode;
      const isExactDay = r.hariKunjungan === hariKunjungan;
      const isWeekday = r.hariKunjungan === 7;

      if (isDistrictSpecific) {
        if (isExactDay) return 1;
        if (isWeekday) return 2;
        return 3;
      } else if (isOuSpecific) {
        if (isExactDay) return 4;
        if (isWeekday) return 5;
        return 6;
      } else {
        if (isExactDay) return 7;
        if (isWeekday) return 8;
        return 9;
      }
    };

    rows.sort((a, b) => getRank(a) - getRank(b));
    return this.toDomain(rows[0]);
  }

  async create(data: Omit<TargetProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<Target> {
    const raw = await prisma.mstTarget.create({
      data: {
        jenisTarget: data.jenisTarget,
        ouKode: data.ouKode || null,
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
    if (data.ouKode !== undefined) updateData.ouKode = data.ouKode;
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
