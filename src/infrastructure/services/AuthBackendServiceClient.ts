import axios from 'axios';

export interface KaryawanRef {
  id: string;
  namaLengkap: string;
  nik?: string;
  jabatan?: string;
  ouKode?: string;
  operationUnitId?: string;
  unitBisnisId?: string;
  email?: string;
}

export interface OperationUnitRef {
  id: string;
  kode: string;
  nama: string;
  kategori?: string;
  type?: string;
  parentId?: string | null;
  parentName?: string | null;
  level?: number;
}

export class AuthBackendServiceClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.AUTH_BACKEND_URL || 'http://localhost:5002';
  }

  async getKaryawanList(token?: string): Promise<KaryawanRef[]> {
    try {
      const headers = token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.get(`${this.baseUrl}/api/karyawan/lookup?limit=500&status=true`, {
          headers,
          timeout: 5000,
        });
      } catch (e: any) {
        if (e.response && (e.response.status === 404 || e.response.status === 403)) {
          res = await axios.get(`${this.baseUrl}/api/karyawan?limit=500`, {
            headers,
            timeout: 5000,
          });
        } else {
          throw e;
        }
      }

      const rawList: any[] = Array.isArray(res.data)
        ? res.data
        : (res.data?.data && Array.isArray(res.data.data) ? res.data.data : []);

      return rawList.map((k) => ({
        id: k.id,
        namaLengkap: k.legalName || k.namaLengkap || k.nama || k.name || '',
        nik: k.nik,
        jabatan: k.jabatan?.nama || k.jabatan || '',
        ouKode: k.operationUnit?.code || k.operationUnit?.kode || k.ouKode,
        operationUnitId: k.operationUnitId || k.operationUnit?.id,
        unitBisnisId: k.operationUnitId || k.operationUnit?.id,
        email: k.email,
      }));
    } catch (err: any) {
      console.warn('AuthBackendServiceClient getKaryawanList error:', err.message);
      return [];
    }
  }

  async getOperationUnits(token?: string): Promise<OperationUnitRef[]> {
    try {
      const headers = token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : {};

      let res;
      try {
        res = await axios.get(`${this.baseUrl}/api/operation-units/my-scope`, {
          headers,
          timeout: 5000,
        });
      } catch (e: any) {
        if (e.response && (e.response.status === 404 || e.response.status === 403)) {
          res = await axios.get(`${this.baseUrl}/api/operation-units?scope=true`, {
            headers,
            timeout: 5000,
          });
        } else {
          throw e;
        }
      }

      const rawList: any[] = Array.isArray(res.data)
        ? res.data
        : (res.data?.data && Array.isArray(res.data.data) ? res.data.data : []);

      return rawList.map((u) => ({
        id: u.id,
        kode: u.code || u.kode,
        nama: u.name || u.nama,
        kategori: u.category || u.kategori,
        type: u.type,
        parentId: u.parentId,
        parentName: u.parentName,
        level: u.level,
      }));
    } catch (err: any) {
      console.warn('AuthBackendServiceClient getOperationUnits error:', err.message);
      return [];
    }
  }
}

export const authBackendService = new AuthBackendServiceClient();
