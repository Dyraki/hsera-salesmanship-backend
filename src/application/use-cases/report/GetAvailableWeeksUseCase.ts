import { IRekapHarianRepository } from '../../../domain/repositories/IRekapHarianRepository';
import { getIsoWeekInfo, getDateRangeForKodeMinggu, formatDateOnly } from '../../../infrastructure/utils/dateIsoUtils';

export interface AvailableWeekOption {
  kodeMinggu: number;
  kodeMingguDisplay: string;
  startDate: string;
  endDate: string;
  label: string;
  isCurrent: boolean;
}

export class GetAvailableWeeksUseCase {
  constructor(private rekapRepo: IRekapHarianRepository) {}

  async execute(ouKode?: string, ouKodeIn?: string[]): Promise<AvailableWeekOption[]> {
    const currentWeekInfo = getIsoWeekInfo(new Date());
    const distinctWeeks = await this.rekapRepo.getDistinctWeeks(ouKode, ouKodeIn);

    const allWeeksSet = new Set<number>(distinctWeeks);
    allWeeksSet.add(currentWeekInfo.kodeMinggu);

    const sortedWeeks = Array.from(allWeeksSet).sort((a, b) => b - a);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    return sortedWeeks.map((km) => {
      const range = getDateRangeForKodeMinggu(km);
      const startStr = formatDateOnly(range.startDate);
      const endStr = formatDateOnly(range.endDate);

      const sParts = startStr.split('-');
      const eParts = endStr.split('-');
      const sDay = parseInt(sParts[2], 10);
      const eDay = parseInt(eParts[2], 10);
      const sMonth = monthNames[parseInt(sParts[1], 10) - 1];
      const eMonth = monthNames[parseInt(eParts[1], 10) - 1];
      const year = sParts[0];

      const yy = String(Math.floor(km / 100)).slice(-2);
      const ww = String(km % 100).padStart(2, '0');
      const kodeMingguDisplay = `${yy}${ww}`;

      const dateLabel =
        sMonth === eMonth
          ? `${sDay} - ${eDay} ${eMonth} ${year}`
          : `${sDay} ${sMonth} - ${eDay} ${eMonth} ${year}`;

      return {
        kodeMinggu: km,
        kodeMingguDisplay,
        startDate: startStr,
        endDate: endStr,
        label: `${kodeMingguDisplay} - ${dateLabel}`,
        isCurrent: km === currentWeekInfo.kodeMinggu,
      };
    });
  }
}
