import { IDistrictRepository } from '../../../domain/repositories/IDistrictRepository';
import { District } from '../../../domain/entities/District';
import { AppError } from '../../../domain/errors/AppError';
import { authBackendService } from '../../../infrastructure/services/AuthBackendServiceClient';

export class GetDistrictByIdUseCase {
  constructor(private districtRepo: IDistrictRepository) {}

  async execute(id: string, token?: string): Promise<District> {
    const district = await this.districtRepo.findById(id);
    if (!district) {
      throw AppError.notFound('District tidak ditemukan.');
    }

    const karyawanList = await authBackendService.getKaryawanList(token);
    const karyawan = karyawanList.find((k) => k.id === district.karyawanId);

    return new District({
      ...district.props,
      karyawanName: karyawan?.namaLengkap || district.karyawanId,
    });
  }
}
