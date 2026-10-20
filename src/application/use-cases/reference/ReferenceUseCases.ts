import { authBackendService } from '../../../infrastructure/services/AuthBackendServiceClient';

export class GetReferenceDataUseCase {
  async getSalesmen(token?: string) {
    return await authBackendService.getKaryawanList(token);
  }

  async getOperationUnits(token?: string) {
    return await authBackendService.getOperationUnits(token);
  }
}
