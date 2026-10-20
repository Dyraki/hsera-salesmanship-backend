import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../domain/errors/AppError';

export const ErrorHandlerMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      errors: err.errors || null,
    });
  }

  console.error('Unhandled Server Error:', err);

  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message || 'Internal server error.',
  });
};
