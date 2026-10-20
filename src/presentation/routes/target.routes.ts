import { Router } from 'express';
import { TargetController } from '../controllers/TargetController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { AclMiddleware } from '../middlewares/AclMiddleware';
import { SYSTEM_MENU_IDS } from '../../domain/constants/MenuConstants';

const router = Router();

router.use(AuthMiddleware);

router.get(
  '/',
  AclMiddleware(SYSTEM_MENU_IDS.SETUP_TARGET, 1),
  TargetController.getAll
);

router.post(
  '/',
  AclMiddleware(SYSTEM_MENU_IDS.SETUP_TARGET, 2),
  TargetController.save
);

router.delete(
  '/:id',
  AclMiddleware(SYSTEM_MENU_IDS.SETUP_TARGET, 4),
  TargetController.delete
);

export default router;
