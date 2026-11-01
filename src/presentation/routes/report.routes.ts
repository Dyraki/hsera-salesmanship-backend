import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { AclMiddleware } from '../middlewares/AclMiddleware';
import { SYSTEM_MENU_IDS } from '../../domain/constants/MenuConstants';

const router = Router();

router.use(AuthMiddleware);

router.get(
  '/weekly-district',
  AclMiddleware(SYSTEM_MENU_IDS.REPORT_WEEKLY_DISTRICT, 1),
  ReportController.getWeeklyDistrictReport
);

router.get(
  '/available-weeks',
  AclMiddleware(SYSTEM_MENU_IDS.REPORT_WEEKLY_DISTRICT, 1),
  ReportController.getAvailableWeeks
);

router.get(
  '/sku-sales',
  AclMiddleware(SYSTEM_MENU_IDS.REPORT_SKU, 1),
  ReportController.getSkuSalesReport
);

export default router;
