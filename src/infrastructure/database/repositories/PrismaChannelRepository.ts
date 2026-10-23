import { prisma } from '../prisma';
import { Channel } from '../../../domain/entities/Channel';
import { IChannelRepository, ChannelFilter } from '../../../domain/repositories/IChannelRepository';

export class PrismaChannelRepository implements IChannelRepository {
  private toDomain(raw: any): Channel {
    return new Channel({
      id: raw.id,
      kode: raw.kode,
      nama: raw.nama,
      deskripsi: raw.deskripsi,
      urutan: raw.urutan,
      status: raw.status,
      createdAt: raw.createdAt,
      createdBy: raw.createdBy,
      updatedAt: raw.updatedAt,
      updatedBy: raw.updatedBy,
    });
  }

  async findAll(filter?: ChannelFilter): Promise<Channel[]> {
    const where: any = {};
    if (filter?.status) {
      where.status = filter.status;
    }

    const rows = await prisma.mstChannel.findMany({
      where,
      orderBy: { urutan: 'asc' },
    });

    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Channel | null> {
    const raw = await prisma.mstChannel.findUnique({
      where: { id },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findByKode(kode: string): Promise<Channel | null> {
    const raw = await prisma.mstChannel.findUnique({
      where: { kode },
    });
    return raw ? this.toDomain(raw) : null;
  }
}
