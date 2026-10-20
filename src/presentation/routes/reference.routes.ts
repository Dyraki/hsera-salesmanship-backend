import { Router } from 'express';
import { ReferenceController } from '../controllers/ReferenceController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';

const router = Router();

router.use(AuthMiddleware);

router.get('/salesmen', ReferenceController.getSalesmen);
router.get('/operation-units', ReferenceController.getOperationUnits);

export default router;
