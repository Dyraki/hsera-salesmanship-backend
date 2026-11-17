import { Router } from 'express';
import { DistrictController } from '../controllers/DistrictController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { AclMiddleware } from '../middlewares/AclMiddleware';
import { SYSTEM_MENU_IDS, SALESMANSHIP_DISTRICT_READ_MENUS } from '../../domain/constants/MenuConstants';

const router = Router();

router.use(AuthMiddleware);

router.get(
  '/',
  AclMiddleware(SALESMANSHIP_DISTRICT_READ_MENUS, 1),
  DistrictController.getAll
);

router.get(
  '/:id',
  AclMiddleware(SALESMANSHIP_DISTRICT_READ_MENUS, 1),
  DistrictController.getById
);

router.post(
  '/',
  AclMiddleware(SYSTEM_MENU_IDS.TERITORY_MANAGEMENT, 2),
  DistrictController.create
);

router.put(
  '/:id',
  AclMiddleware(SYSTEM_MENU_IDS.TERITORY_MANAGEMENT, 3),
  DistrictController.update
);

router.delete(
  '/:id',
  AclMiddleware(SYSTEM_MENU_IDS.TERITORY_MANAGEMENT, 4),
  DistrictController.delete
);

export default router;
