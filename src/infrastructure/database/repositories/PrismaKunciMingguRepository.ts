import { prisma } from '../prisma';
import { KunciMinggu, KunciMingguProps } from '../../../domain/entities/KunciMinggu';
import { IKunciMingguRepository } from '../../../domain/repositories/IKunciMingguRepository';

export class PrismaKunciMingguRepository implements IKunciMingguRepository {
  private toDomain(raw: any): KunciMinggu {
    return new KunciMinggu({
      kodeMinggu: raw.kodeMinggu,
      status: raw.status,
      catatan: raw.catatan,
      createdAt: raw.createdAt,
      createdBy: raw.createdBy,
      updatedAt: raw.updatedAt,
      updatedBy: raw.updatedBy,
    });
  }

  async findByKodeMinggu(kodeMinggu: number): Promise<KunciMinggu | null> {
    const raw = await prisma.sysKunciMinggu.findUnique({
      where: { kodeMinggu },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findAll(): Promise<KunciMinggu[]> {
    const rows = await prisma.sysKunciMinggu.findMany({
      orderBy: { kodeMinggu: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async setLock(
    kodeMinggu: number,
    status: 'AKTIF' | 'NONAKTIF',
    catatan?: string | null,
    userId?: string | null
  ): Promise<KunciMinggu> {
    const raw = await prisma.sysKunciMinggu.upsert({
      where: { kodeMinggu },
      create: {
        kodeMinggu,
        status,
        catatan,
        createdBy: userId,
      },
      update: {
        status,
        catatan,
        updatedBy: userId,
      },
    });
    return this.toDomain(raw);
  }
}
