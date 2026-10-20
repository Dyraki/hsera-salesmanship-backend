import { prisma } from '../prisma';
import { Notasi, NotasiProps, LevelInput, KelompokTampil } from '../../../domain/entities/Notasi';
import { INotasiRepository, NotasiFilter } from '../../../domain/repositories/INotasiRepository';

export class PrismaNotasiRepository implements INotasiRepository {
  private toDomain(raw: any): Notasi {
    return new Notasi({
      id: raw.id,
      kode: raw.kode,
      nama: raw.nama,
      levelInput: raw.levelInput as LevelInput,
      kelompokTampil: raw.kelompokTampil as KelompokTampil,
      rumus: raw.rumus,
      satuan: raw.satuan,
      urutan: raw.urutan,
      status: raw.status,
      createdAt: raw.createdAt,
      createdBy: raw.createdBy,
      updatedAt: raw.updatedAt,
      updatedBy: raw.updatedBy,
    });
  }

  async findAll(filter?: NotasiFilter): Promise<Notasi[]> {
    const where: any = {};
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.levelInput) {
      where.levelInput = filter.levelInput;
    }
    if (filter?.kelompokTampil) {
      where.kelompokTampil = filter.kelompokTampil;
    }

    const rows = await prisma.mstNotasi.findMany({
      where,
      orderBy: [{ urutan: 'asc' }, { kode: 'asc' }],
    });

    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Notasi | null> {
    const raw = await prisma.mstNotasi.findUnique({
      where: { id },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findByKode(kode: string): Promise<Notasi | null> {
    const raw = await prisma.mstNotasi.findUnique({
      where: { kode },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async create(data: Omit<NotasiProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<Notasi> {
    const raw = await prisma.mstNotasi.create({
      data: {
        kode: data.kode,
        nama: data.nama,
        levelInput: data.levelInput,
        kelompokTampil: data.kelompokTampil,
        rumus: data.rumus,
        satuan: data.satuan,
        urutan: data.urutan || 1,
        status: data.status || 'AKTIF',
        createdBy: data.createdBy,
      },
    });
    return this.toDomain(raw);
  }

  async update(id: string, data: Partial<NotasiProps>): Promise<Notasi> {
    const updateData: any = {};
    if (data.kode !== undefined) updateData.kode = data.kode;
    if (data.nama !== undefined) updateData.nama = data.nama;
    if (data.levelInput !== undefined) updateData.levelInput = data.levelInput;
    if (data.kelompokTampil !== undefined) updateData.kelompokTampil = data.kelompokTampil;
    if (data.rumus !== undefined) updateData.rumus = data.rumus;
    if (data.satuan !== undefined) updateData.satuan = data.satuan;
    if (data.urutan !== undefined) updateData.urutan = data.urutan;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

    const raw = await prisma.mstNotasi.update({
      where: { id },
      data: updateData,
    });
    return this.toDomain(raw);
  }

  async updateOrder(orders: { id: string; urutan: number }[]): Promise<void> {
    await prisma.$transaction(
      orders.map((o) =>
        prisma.mstNotasi.update({
          where: { id: o.id },
          data: { urutan: o.urutan },
        })
      )
    );
  }

  async delete(id: string): Promise<void> {
    await prisma.mstNotasi.delete({
      where: { id },
    });
  }
}
