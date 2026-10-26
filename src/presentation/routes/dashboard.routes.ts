import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { AclMiddleware } from '../middlewares/AclMiddleware';
import { SYSTEM_MENU_IDS } from '../../domain/constants/MenuConstants';

const router = Router();

router.use(AuthMiddleware);

router.get(
  '/',
  AclMiddleware(SYSTEM_MENU_IDS.DASHBOARD, 1),
  DashboardController.getDashboard
);

router.get(
  '/area-office',
  AclMiddleware(SYSTEM_MENU_IDS.DASHBOARD, 1),
  DashboardController.getDashboard
);

export default router;

