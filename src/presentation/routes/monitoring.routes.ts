import { Router } from 'express';
import { MonitoringController } from '../controllers/MonitoringController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { AclMiddleware } from '../middlewares/AclMiddleware';
import { SYSTEM_MENU_IDS } from '../../domain/constants/MenuConstants';

const router = Router();

router.use(AuthMiddleware);

router.get(
  '/weekly',
  AclMiddleware(SYSTEM_MENU_IDS.MONITORING_CALLSHEET, 1),
  MonitoringController.getWeeklyMonitoring
);

router.get(
  '/report/wide-ris',
  AclMiddleware(SYSTEM_MENU_IDS.MONITORING_CALLSHEET, 1),
  MonitoringController.getWideRisReport
);

export default router;
