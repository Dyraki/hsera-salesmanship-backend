import { IDistrictRepository, DistrictFilter } from '../../../domain/repositories/IDistrictRepository';
import { District } from '../../../domain/entities/District';
import { authBackendService } from '../../../infrastructure/services/AuthBackendServiceClient';

export class GetDistrictsUseCase {
  constructor(private districtRepo: IDistrictRepository) {}

  async execute(filter?: DistrictFilter, token?: string): Promise<District[]> {
    const districts = await this.districtRepo.findAll(filter);

    // Enrich with salesman names and NIP from auth backend
    const karyawanList = await authBackendService.getKaryawanList(token);
    const karyawanMap = new Map(karyawanList.map((k) => [k.id, k]));

    return districts.map((d) => {
      const k = karyawanMap.get(d.karyawanId);
      const name = k?.namaLengkap || d.karyawanId;
      const nip = k?.employeeNumber || k?.nik || null;
      return new District({
        ...d.props,
        karyawanName: name,
        karyawanNip: nip,
      });
    });
  }
}
