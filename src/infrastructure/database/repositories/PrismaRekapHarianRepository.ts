import { prisma } from '../prisma';
import { RekapHarian, RekapHarianProps, RekapHarianNilaiProps, JenisRekap, StatusRekap } from '../../../domain/entities/RekapHarian';
import {
  IRekapHarianRepository,
  RekapHarianFilter,
  SaveRekapInput,
} from '../../../domain/repositories/IRekapHarianRepository';

export class PrismaRekapHarianRepository implements IRekapHarianRepository {
  private toDomain(raw: any): RekapHarian {
    const nilaiList: RekapHarianNilaiProps[] = (raw.nilaiList || []).map((n: any) => ({
      id: n.id,
      rekapId: n.rekapId,
      brandId: n.brandId,
      notasiId: n.notasiId,
      nilai: Number(n.nilai),
      brandKode: n.brand?.kode,
      notasiKode: n.notasi?.kode,
    }));

    return new RekapHarian({
      id: raw.id,
      districtId: raw.districtId,
      tglKunjungan: raw.tglKunjungan,
      hariKunjungan: raw.hariKunjungan,
      kodeMinggu: raw.kodeMinggu,
      karyawanId: raw.karyawanId,
      ouKode: raw.ouKode,
      jenisRekap: raw.jenisRekap as JenisRekap,
      alasan: raw.alasan,
      jumlahKunjungan: raw.jumlahKunjungan,
      totalEc: raw.totalEc,
      bdOutlet: raw.bdOutlet || 0,
      volumeGg: raw.volumeGg ? Number(raw.volumeGg) : null,
      statusRekap: raw.statusRekap as StatusRekap,
      status: raw.status,
      catatan: raw.catatan,
      createdAt: raw.createdAt,
      createdBy: raw.createdBy,
      updatedAt: raw.updatedAt,
      updatedBy: raw.updatedBy,
      nilaiList,
      districtKode: raw.district?.kode,
    });
  }

  async findAll(filter?: RekapHarianFilter): Promise<RekapHarian[]> {
    const where: any = {};

    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.statusRekap) {
      where.statusRekap = filter.statusRekap;
    }
    if (filter?.ouKode) {
      where.ouKode = filter.ouKode;
    } else if (filter?.ouKodeIn && filter.ouKodeIn.length > 0) {
      where.ouKode = { in: filter.ouKodeIn };
    }
    if (filter?.districtId) {
      where.districtId = filter.districtId;
    }
    if (filter?.karyawanId) {
      where.karyawanId = filter.karyawanId;
    }
    if (filter?.kodeMinggu) {
      where.kodeMinggu = filter.kodeMinggu;
    } else if (filter?.kodeMingguIn && filter.kodeMingguIn.length > 0) {
      where.kodeMinggu = { in: filter.kodeMingguIn };
    }
    if (filter?.startDate || filter?.endDate) {
      where.tglKunjungan = {};
      if (filter.startDate) where.tglKunjungan.gte = filter.startDate;
      if (filter.endDate) where.tglKunjungan.lte = filter.endDate;
    }

    const rows = await prisma.trxRekapHarian.findMany({
      where,
      include: {
        district: true,
        nilaiList: {
          include: {
            brand: true,
            notasi: true,
          },
        },
      },
      orderBy: [{ tglKunjungan: 'desc' }, { district: { kode: 'asc' } }],
    });

    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<RekapHarian | null> {
    const raw = await prisma.trxRekapHarian.findUnique({
      where: { id },
      include: {
        district: true,
        nilaiList: {
          include: {
            brand: true,
            notasi: true,
          },
        },
      },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findByDateAndDistrict(tglKunjungan: Date, districtId: string): Promise<RekapHarian | null> {
    const startOfDay = new Date(tglKunjungan);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const raw = await prisma.trxRekapHarian.findFirst({
      where: {
        districtId,
        tglKunjungan: startOfDay,
      },
      include: {
        district: true,
        nilaiList: {
          include: {
            brand: true,
            notasi: true,
          },
        },
      },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findByWeek(kodeMinggu: number, districtId?: string, ouKode?: string): Promise<RekapHarian[]> {
    const where: any = { kodeMinggu };
    if (districtId) where.districtId = districtId;
    if (ouKode) where.ouKode = ouKode;

    const rows = await prisma.trxRekapHarian.findMany({
      where,
      include: {
        district: true,
        nilaiList: {
          include: {
            brand: true,
            notasi: true,
          },
        },
      },
      orderBy: [{ hariKunjungan: 'asc' }],
    });

    return rows.map((r) => this.toDomain(r));
  }

  async save(data: SaveRekapInput, existingId?: string): Promise<RekapHarian> {
    const normalizedDate = new Date(data.tglKunjungan);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    return await prisma.$transaction(async (tx) => {
      let rekapId = existingId;

      if (!rekapId) {
        // Check if there is already an existing record for the same district and date
        const existing = await tx.trxRekapHarian.findFirst({
          where: {
            districtId: data.districtId,
            tglKunjungan: normalizedDate,
          },
        });
        if (existing) {
          rekapId = existing.id;
        }
      }

      let rekapRecord: any;

      if (rekapId) {
        // Update header
        rekapRecord = await tx.trxRekapHarian.update({
          where: { id: rekapId },
          data: {
            districtId: data.districtId,
            tglKunjungan: normalizedDate,
            hariKunjungan: data.hariKunjungan,
            kodeMinggu: data.kodeMinggu,
            karyawanId: data.karyawanId,
            ouKode: data.ouKode,
            jenisRekap: data.jenisRekap,
            alasan: data.alasan,
            jumlahKunjungan: data.jumlahKunjungan,
            totalEc: data.totalEc,
            bdOutlet: data.bdOutlet !== undefined ? data.bdOutlet : 0,
            volumeGg: data.volumeGg,
            statusRekap: data.statusRekap,
            catatan: data.catatan,
            updatedBy: data.updatedBy,
          },
        });

        // Delete existing matrix items to replace cleanly
        await tx.trxRekapHarianNilai.deleteMany({
          where: { rekapId: rekapRecord.id },
        });
      } else {
        // Create header
        rekapRecord = await tx.trxRekapHarian.create({
          data: {
            districtId: data.districtId,
            tglKunjungan: normalizedDate,
            hariKunjungan: data.hariKunjungan,
            kodeMinggu: data.kodeMinggu,
            karyawanId: data.karyawanId,
            ouKode: data.ouKode,
            jenisRekap: data.jenisRekap,
            alasan: data.alasan,
            jumlahKunjungan: data.jumlahKunjungan,
            totalEc: data.totalEc,
            bdOutlet: data.bdOutlet !== undefined ? data.bdOutlet : 0,
            volumeGg: data.volumeGg,
            statusRekap: data.statusRekap,
            catatan: data.catatan,
            createdBy: data.createdBy,
          },
        });
      }

      // Insert new matrix items if provided
      if (data.nilaiList && data.nilaiList.length > 0) {
        await tx.trxRekapHarianNilai.createMany({
          data: data.nilaiList.map((n) => ({
            rekapId: rekapRecord.id,
            brandId: n.brandId,
            notasiId: n.notasiId,
            nilai: n.nilai,
            createdBy: data.createdBy || data.updatedBy,
          })),
        });
      }

      // Fetch the full record with includes
      const full = await tx.trxRekapHarian.findUnique({
        where: { id: rekapRecord.id },
        include: {
          district: true,
          nilaiList: {
            include: {
              brand: true,
              notasi: true,
            },
          },
        },
      });

      return this.toDomain(full!);
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.trxRekapHarian.delete({
      where: { id },
    });
  }

  async getDistinctWeeks(ouKode?: string, ouKodeIn?: string[]): Promise<number[]> {
    const where: any = { status: 'AKTIF' };
    if (ouKode) {
      where.ouKode = ouKode;
    } else if (ouKodeIn && ouKodeIn.length > 0) {
      where.ouKode = { in: ouKodeIn };
    }

    const rows = await prisma.trxRekapHarian.findMany({
      where,
      select: { kodeMinggu: true },
      distinct: ['kodeMinggu'],
      orderBy: { kodeMinggu: 'desc' },
    });

    return rows.map((r) => r.kodeMinggu);
  }

  async getWeeklyVolumes(kodeMingguIn: number[], ouKode?: string, ouKodeIn?: string[]): Promise<Array<{ kodeMinggu: number; ouKode: string; volumeGg: number }>> {
    const where: any = {
      kodeMinggu: { in: kodeMingguIn },
      status: 'AKTIF',
    };
    if (ouKode) {
      where.ouKode = ouKode;
    } else if (ouKodeIn && ouKodeIn.length > 0) {
      where.ouKode = { in: ouKodeIn };
    }

    const rows = await prisma.trxRekapHarian.findMany({
      where,
      select: {
        kodeMinggu: true,
        ouKode: true,
        volumeGg: true,
      },
    });

    return rows.map((r) => ({
      kodeMinggu: r.kodeMinggu,
      ouKode: r.ouKode,
      volumeGg: r.volumeGg ? Number(r.volumeGg) : 0,
    }));
  }
}
