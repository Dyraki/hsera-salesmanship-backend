import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { AppError } from '../../../domain/errors/AppError';
import { prisma } from '../../../infrastructure/database/prisma';

export class DeleteDistrictUseCase {
  constructor(private districtRepo: IDistrictRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.districtRepo.findById(id);
    if (!existing) {
      throw AppError.notFound('District tidak ditemukan.');
    }

    // Check if district has callsheet transactions
    const count = await prisma.trxRekapHarian.count({
      where: { districtId: id },
    });
    if (count > 0) {
      throw AppError.badRequest(
        `Tidak dapat menghapus district ${existing.kode} karena sudah memiliki ${count} riwayat transaksi rekap callsheet. Anda dapat mengubah statusnya menjadi NONAKTIF.`
      );
    }

    await this.districtRepo.delete(id);
  }
}
