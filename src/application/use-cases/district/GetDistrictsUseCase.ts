import { IDistrictRepository, DistrictFilter } from '../../../domain/repositories/IDistrictRepository';
import { District } from '../../../domain/entities/District';
import { authBackendService } from '../../../infrastructure/services/AuthBackendServiceClient';

export class GetDistrictsUseCase {
  constructor(private districtRepo: IDistrictRepository) {}

  async execute(filter?: DistrictFilter, token?: string): Promise<District[]> {
    const districts = await this.districtRepo.findAll(filter);

    // Enrich with salesman names from auth backend
    const karyawanList = await authBackendService.getKaryawanList(token);
    const karyawanMap = new Map(karyawanList.map((k) => [k.id, k.namaLengkap]));

    return districts.map((d) => {
      const name = karyawanMap.get(d.karyawanId) || d.karyawanId;
      return new District({
        ...d.props,
        karyawanName: name,
      });
    });
  }
}
