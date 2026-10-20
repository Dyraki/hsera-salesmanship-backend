import { Request, Response, NextFunction } from 'express';
import { GetReferenceDataUseCase } from '../../application/use-cases/reference/ReferenceUseCases';

const getReferenceUC = new GetReferenceDataUseCase();

export class ReferenceController {
  static async getSalesmen(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const list = await getReferenceUC.getSalesmen(user.token);
      res.json({
        success: true,
        data: list,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getOperationUnits(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const list = await getReferenceUC.getOperationUnits(user.token);
      res.json({
        success: true,
        data: list,
      });
    } catch (err) {
      next(err);
    }
  }
}
