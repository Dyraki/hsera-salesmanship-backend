import { Router } from 'express';
import districtRoutes from './district.routes';
import brandRoutes from './brand.routes';
import notasiRoutes from './notasi.routes';
import targetRoutes from './target.routes';
import callsheetRoutes from './callsheet.routes';
import lockRoutes from './lock.routes';
import monitoringRoutes from './monitoring.routes';
import referenceRoutes from './reference.routes';
import reportRoutes from './report.routes';

const apiRouter = Router();

apiRouter.use('/districts', districtRoutes);
apiRouter.use('/brands', brandRoutes);
apiRouter.use('/notasi', notasiRoutes);
apiRouter.use('/targets', targetRoutes);
apiRouter.use('/callsheets', callsheetRoutes);
apiRouter.use('/locks', lockRoutes);
apiRouter.use('/monitoring', monitoringRoutes);
apiRouter.use('/references', referenceRoutes);
apiRouter.use('/reports', reportRoutes);

export default apiRouter;
