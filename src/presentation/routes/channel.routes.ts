import { Router } from 'express';
import { ChannelController } from '../controllers/ChannelController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';

const router = Router();

router.use(AuthMiddleware);

router.get('/', ChannelController.getAll);

export default router;
