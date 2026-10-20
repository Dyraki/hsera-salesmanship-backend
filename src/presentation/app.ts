import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import apiRouter from './routes';
import { ErrorHandlerMiddleware } from './middlewares/ErrorHandlerMiddleware';

export function createApp(): Application {
  const app = express();

  // Basic Middlewares
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Swagger API Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'UP',
      service: 'hsera-salesmanship-backend',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount Salesmanship API Routes
  app.use('/api/salesmanship', apiRouter);

  // Global Error Handler
  app.use(ErrorHandlerMiddleware);

  return app;
}
