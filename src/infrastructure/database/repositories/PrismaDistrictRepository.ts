import { prisma } from '../prisma';
import { District, DistrictProps } from '../../../domain/entities/District';
import { IDistrictRepository, DistrictFilter } from '../../../domain/repositories/IDistrictRepository';

export class PrismaDistrictRepository implements IDistrictRepository {
  private toDomain(raw: any): District {
    return new District({
      id: raw.id,
      ouKode: raw.ouKode,
      kode: raw.kode,
      karyawanId: raw.karyawanId,
      status: raw.status,
      createdAt: raw.createdAt,
      createdBy: raw.createdBy,
      updatedAt: raw.updatedAt,
      updatedBy: raw.updatedBy,
    });
  }

  async findAll(filter?: DistrictFilter): Promise<District[]> {
    const where: any = {};

    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.ouKode) {
      where.ouKode = filter.ouKode;
    } else if (filter?.ouKodeIn && filter.ouKodeIn.length > 0) {
      where.ouKode = { in: filter.ouKodeIn };
    }
    if (filter?.search) {
      where.OR = [
        { kode: { contains: filter.search, mode: 'insensitive' } },
        { ouKode: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const rows = await prisma.mstDistrict.findMany({
      where,
      orderBy: [{ ouKode: 'asc' }, { kode: 'asc' }],
    });

    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<District | null> {
    const raw = await prisma.mstDistrict.findUnique({
      where: { id },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findByOuAndKode(ouKode: string, kode: string): Promise<District | null> {
    const raw = await prisma.mstDistrict.findUnique({
      where: {
        ou_kode_kode_unique: { ouKode, kode },
      },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async create(data: Omit<DistrictProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<District> {
    const raw = await prisma.mstDistrict.create({
      data: {
        ouKode: data.ouKode,
        kode: data.kode,
        karyawanId: data.karyawanId,
        status: data.status || 'AKTIF',
        createdBy: data.createdBy,
      },
    });
    return this.toDomain(raw);
  }

  async update(id: string, data: Partial<DistrictProps>): Promise<District> {
    const updateData: any = {};
    if (data.ouKode !== undefined) updateData.ouKode = data.ouKode;
    if (data.kode !== undefined) updateData.kode = data.kode;
    if (data.karyawanId !== undefined) updateData.karyawanId = data.karyawanId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

    const raw = await prisma.mstDistrict.update({
      where: { id },
      data: updateData,
    });
    return this.toDomain(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.mstDistrict.delete({
      where: { id },
    });
  }
}
