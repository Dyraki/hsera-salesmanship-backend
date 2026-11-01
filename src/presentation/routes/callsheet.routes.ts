import { Router } from 'express';
import multer from 'multer';
import { CallsheetController } from '../controllers/CallsheetController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { AclMiddleware } from '../middlewares/AclMiddleware';
import { SYSTEM_MENU_IDS } from '../../domain/constants/MenuConstants';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.use(AuthMiddleware);

// Endpoint download template Excel (mengambil 15 master brand aktif secara dinamis)
router.get(
  '/template',
  AclMiddleware(SYSTEM_MENU_IDS.FORM_CALLSHEET, 1),
  CallsheetController.downloadTemplate
);

// Endpoint import data callsheet dari Excel ke Database
router.post(
  '/import',
  AclMiddleware(SYSTEM_MENU_IDS.FORM_CALLSHEET, 2),
  upload.single('file'),
  CallsheetController.importExcel
);

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
