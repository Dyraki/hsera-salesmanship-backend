import { Router } from 'express';
import { CallsheetController } from '../controllers/CallsheetController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { AclMiddleware } from '../middlewares/AclMiddleware';
import { SYSTEM_MENU_IDS } from '../../domain/constants/MenuConstants';

const router = Router();

router.use(AuthMiddleware);

// Endpoint form skeleton & existing data by date & districtId
router.get(
  '/form',
  AclMiddleware(SYSTEM_MENU_IDS.FORM_CALLSHEET, 1),
  CallsheetController.getFormData
);

router.get(
  '/:id',
  AclMiddleware(SYSTEM_MENU_IDS.FORM_CALLSHEET, 1),
  CallsheetController.getById
);

router.post(
  '/',
  AclMiddleware(SYSTEM_MENU_IDS.FORM_CALLSHEET, 2),
  CallsheetController.save
);

router.delete(
  '/:id',
  AclMiddleware(SYSTEM_MENU_IDS.FORM_CALLSHEET, 4),
  CallsheetController.delete
);

export default router;
