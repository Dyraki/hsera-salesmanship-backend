import { Router } from 'express';
import { NotasiController } from '../controllers/NotasiController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { AclMiddleware } from '../middlewares/AclMiddleware';
import { SYSTEM_MENU_IDS } from '../../domain/constants/MenuConstants';

const router = Router();

router.use(AuthMiddleware);

router.get(
  '/',
  AclMiddleware(SYSTEM_MENU_IDS.TERITORY_MANAGEMENT, 1),
  NotasiController.getAll
);

router.post(
  '/',
  AclMiddleware(SYSTEM_MENU_IDS.TERITORY_MANAGEMENT, 2),
  NotasiController.save
);

router.put(
  '/reorder',
  AclMiddleware(SYSTEM_MENU_IDS.TERITORY_MANAGEMENT, 3),
  NotasiController.reorder
);

router.delete(
  '/:id',
  AclMiddleware(SYSTEM_MENU_IDS.TERITORY_MANAGEMENT, 4),
  NotasiController.delete
);

export default router;
