import { Router } from 'express';
import { BrandController } from '../controllers/BrandController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { AclMiddleware } from '../middlewares/AclMiddleware';
import { SYSTEM_MENU_IDS, SALESMANSHIP_DISTRICT_READ_MENUS } from '../../domain/constants/MenuConstants';

const router = Router();

router.use(AuthMiddleware);

router.get(
  '/',
  AclMiddleware(SALESMANSHIP_DISTRICT_READ_MENUS, 1),
  BrandController.getAll
);

router.post(
  '/',
  AclMiddleware(SYSTEM_MENU_IDS.TERITORY_MANAGEMENT, 2),
  BrandController.save
);

router.put(
  '/reorder',
  AclMiddleware(SYSTEM_MENU_IDS.TERITORY_MANAGEMENT, 3),
  BrandController.reorder
);

router.delete(
  '/:id',
  AclMiddleware(SYSTEM_MENU_IDS.TERITORY_MANAGEMENT, 4),
  BrandController.delete
);

export default router;
