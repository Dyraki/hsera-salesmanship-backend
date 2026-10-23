import { prisma } from '../prisma';
import { District, DistrictProps } from '../../../domain/entities/District';
import { IDistrictRepository, DistrictFilter } from '../../../domain/repositories/IDistrictRepository';

export class PrismaDistrictRepository implements IDistrictRepository {
  private toDomain(raw: any): District {
    const channels = raw.channels
      ? raw.channels.map((dc: any) => ({
          id: dc.channel ? dc.channel.id : dc.channelId,
          kode: dc.channel ? dc.channel.kode : '',
          nama: dc.channel ? dc.channel.nama : '',
        }))
      : [];

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
      channels,
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
      include: {
        channels: {
          include: {
            channel: true,
          },
        },
      },
      orderBy: [{ ouKode: 'asc' }, { kode: 'asc' }],
    });

    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<District | null> {
    const raw = await prisma.mstDistrict.findUnique({
      where: { id },
      include: {
        channels: {
          include: {
            channel: true,
          },
        },
      },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findByOuAndKode(ouKode: string, kode: string): Promise<District | null> {
    const raw = await prisma.mstDistrict.findUnique({
      where: {
        ou_kode_kode_unique: { ouKode, kode },
      },
      include: {
        channels: {
          include: {
            channel: true,
          },
        },
      },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async create(data: Omit<DistrictProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<District> {
    const createData: any = {
      ouKode: data.ouKode,
      kode: data.kode,
      karyawanId: data.karyawanId,
      status: data.status || 'AKTIF',
      createdBy: data.createdBy,
    };

    if (data.channelIds && data.channelIds.length > 0) {
      createData.channels = {
        create: data.channelIds.map((cId) => ({
          channelId: cId,
        })),
      };
    }

    const raw = await prisma.mstDistrict.create({
      data: createData,
      include: {
        channels: {
          include: {
            channel: true,
          },
        },
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

    if (data.channelIds !== undefined) {
      await prisma.mstDistrictChannel.deleteMany({
        where: { districtId: id },
      });
      if (data.channelIds.length > 0) {
        await prisma.mstDistrictChannel.createMany({
          data: data.channelIds.map((cId) => ({
            districtId: id,
            channelId: cId,
          })),
        });
      }
    }

    const raw = await prisma.mstDistrict.update({
      where: { id },
      data: updateData,
      include: {
        channels: {
          include: {
            channel: true,
          },
        },
      },
    });
    return this.toDomain(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.mstDistrict.delete({
      where: { id },
    });
  }
}
