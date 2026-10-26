import { QuarterOption } from '../../../infrastructure/utils/quarterUtils';

export interface DashboardKpiMetric {
  actual: number;
  target: number;
  percent: number;
}

export interface DashboardKpiSummary {
  kunjungan: DashboardKpiMetric & {
    standardRate: number; // e.g. 90%
    isAchieved: boolean;
  };
  ec: DashboardKpiMetric & {
    conversionRate: number; // e.g. EC / Kunjungan
  };
  bd: DashboardKpiMetric & {
    totalToko: number;
  };
  volume: {
    actualPack: number;
    targetPack: number;
    percent: number;
    equivalentKarton: number; // actualPack / 800
    packPerKarton: number;    // 800
  };
}

export interface DashboardTrendBranch {
  ouKode: string;
  namaCabang: string;
  color: string;
  currentVolume: number;
}

export interface DashboardTrendWeekData {
  kodeMinggu: number;
  weekLabel: string; // e.g. "W-41", "W-42"
  volumes: Record<string, number>; // ouKode -> volume
  totalVolume: number;
}

export interface DashboardTrendSection {
  title: string;
  subtitle: string;
  packPerKarton: number;
  runRateDoD: string;
  weeks: DashboardTrendWeekData[];
  branches: DashboardTrendBranch[];
  insights: {
    highestGrowth: { branch: string; value: string };
    discipline: { branch: string; value: string };
    attention: { branch: string; value: string };
  };
}

export interface DashboardBranchRow {
  kode: string;
  namaCabang: string;
  targetCall: number;
  realCall: number;
  kunjunganPercent: number;
  ecPercent: number;
  bdPercent: number;
  volumePack: number;
  volumeKarton: number;
  status: 'Sangat Baik' | 'Baik' | 'Perlu Pembinaan';
}

export interface DashboardBranchTotal {
  label: string;
  targetCall: number;
  realCall: number;
  kunjunganPercent: number;
  ecPercent: number;
  bdPercent: number;
  volumePack: number;
  volumeKarton: number;
  status: string;
}

export interface DashboardBrandMatrixRow {
  urutan: number;
  kodeBrand: string;
  namaBrand: string;
  kategori?: string;
  bdPercent: number;
  avgStokPack: number;
  avgBeliPack: number;
  totalVolPack: number;
  skPercent: number;
  slPercent: number;
  sdPercent: number;
  oosPercent: number;
  sbPercent: number;
  tlPercent: number;
  bpjPercent: number;
  isOosCritical: boolean;
  isSlLow: boolean;
}


export interface DashboardSalesmanRow {
  karyawanId: string;
  namaSalesman: string;
  districtKode: string;
  penempatanCabang: string;
  kunjunganPercent: number;
  realCall: number;
  targetCall: number;
  realEc?: number;
  targetEc?: number;
  ecPercent: number;
  realBd?: number;
  targetBd?: number;
  bdPercent: number;
  volumePack: number;
  targetVolumePack?: number;
  volumePercent?: number;
  ecConversionRate?: number;
  predikat: 'Top Performer' | 'On Target' | 'Perlu Pembinaan';
  actionRekomendasi: string;
}

export interface AvailableWeekItem {
  kodeMinggu: number;
  label: string;
  isLatest: boolean;
}

export interface DashboardHeaderContext {
  title?: string;
  scopeUnitName: string;
  areaOfficeName: string; // for backward compatibility
  sessionWeek: number;
  sessionWeekDisplay: string;
  sessionQuarter: number;
  sessionQuarterDisplay: string;
  selectedOu: string;
  isRealtime: boolean;
  availableQuarters: QuarterOption[];
  availableWeeks?: AvailableWeekItem[];
}

export interface DashboardDTO {
  headerContext: DashboardHeaderContext;
  kpiSummary: DashboardKpiSummary;
  trendSection: DashboardTrendSection;
  branches: DashboardBranchRow[];
  branchesTotal: DashboardBranchTotal;
  brandMatrix: DashboardBrandMatrixRow[];
  brandMatrixConsolidation: DashboardBrandMatrixRow;
  salesmen: DashboardSalesmanRow[];
}

export type AreaOfficeDashboardDTO = DashboardDTO;

