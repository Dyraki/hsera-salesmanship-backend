import { prisma } from '../prisma';
import { Brand, BrandProps } from '../../../domain/entities/Brand';
import { IBrandRepository, BrandFilter } from '../../../domain/repositories/IBrandRepository';

export class PrismaBrandRepository implements IBrandRepository {
  private toDomain(raw: any): Brand {
    return new Brand({
      id: raw.id,
      kode: raw.kode,
      nama: raw.nama,
      kategori: raw.kategori,
      urutan: raw.urutan,
      status: raw.status,
      createdAt: raw.createdAt,
      createdBy: raw.createdBy,
      updatedAt: raw.updatedAt,
      updatedBy: raw.updatedBy,
    });
  }

  async findAll(filter?: BrandFilter): Promise<Brand[]> {
    const where: any = {};
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.kategori) {
      where.kategori = filter.kategori;
    }

    const rows = await prisma.mstBrand.findMany({
      where,
      orderBy: [{ urutan: 'asc' }, { kode: 'asc' }],
    });

    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Brand | null> {
    const raw = await prisma.mstBrand.findUnique({
      where: { id },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findByKode(kode: string): Promise<Brand | null> {
    const raw = await prisma.mstBrand.findUnique({
      where: { kode },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async create(data: Omit<BrandProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<Brand> {
    const raw = await prisma.mstBrand.create({
      data: {
        kode: data.kode,
        nama: data.nama,
        kategori: data.kategori,
        urutan: data.urutan || 1,
        status: data.status || 'AKTIF',
        createdBy: data.createdBy,
      },
    });
    return this.toDomain(raw);
  }

  async update(id: string, data: Partial<BrandProps>): Promise<Brand> {
    const updateData: any = {};
    if (data.kode !== undefined) updateData.kode = data.kode;
    if (data.nama !== undefined) updateData.nama = data.nama;
    if (data.kategori !== undefined) updateData.kategori = data.kategori;
    if (data.urutan !== undefined) updateData.urutan = data.urutan;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

    const raw = await prisma.mstBrand.update({
      where: { id },
      data: updateData,
    });
    return this.toDomain(raw);
  }

  async updateOrder(orders: { id: string; urutan: number }[]): Promise<void> {
    await prisma.$transaction(
      orders.map((o) =>
        prisma.mstBrand.update({
          where: { id: o.id },
          data: { urutan: o.urutan },
        })
      )
    );
  }

  async delete(id: string): Promise<void> {
    await prisma.mstBrand.delete({
      where: { id },
    });
  }
}
