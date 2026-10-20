import { Router } from 'express';
import { LockController } from '../controllers/LockController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { AclMiddleware } from '../middlewares/AclMiddleware';
import { SYSTEM_MENU_IDS } from '../../domain/constants/MenuConstants';

const router = Router();

router.use(AuthMiddleware);

router.get(
  '/',
  AclMiddleware(SYSTEM_MENU_IDS.MONITORING_CALLSHEET, 1),
  LockController.getAll
);

router.get(
  '/:kodeMinggu',
  AclMiddleware(SYSTEM_MENU_IDS.MONITORING_CALLSHEET, 1),
  LockController.getStatus
);

router.post(
  '/toggle',
  AclMiddleware(SYSTEM_MENU_IDS.MONITORING_CALLSHEET, 3), // Level 3/4 needed to lock/unlock
  LockController.toggleLock
);

export default router;
