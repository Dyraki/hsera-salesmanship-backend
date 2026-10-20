import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../domain/errors/AppError';

/**
 * ACL Levels:
 * 1 = View / Read
 * 2 = Create
 * 3 = Update
 * 4 = Delete / Full Control
 */
export const AclMiddleware = (menuId: string, requiredLevel = 1) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      throw AppError.unauthorized('Sesi tidak ditemukan.');
    }

    // Super Admin has unrestricted access to all menus and levels
    if (user.scope.isSuperAdmin) {
      return next();
    }

    const permission = user.permissions.find((p) => p.menuId === menuId);

    if (!permission || !permission.enable) {
      throw AppError.forbidden('Anda tidak memiliki akses ke fitur ini.');
    }

    if (permission.level < requiredLevel) {
      throw AppError.forbidden(`Hak akses tidak mencukupi (Level ${requiredLevel} diperlukan).`);
    }

    next();
  };
};
