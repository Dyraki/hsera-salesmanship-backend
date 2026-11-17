import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../domain/errors/AppError';

/**
 * ACL Levels:
 * 1 = View / Read
 * 2 = Create
 * 3 = Update
 * 4 = Delete / Full Control
 */
export const AclMiddleware = (menuId: string | readonly string[] | string[], requiredLevel = 1) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      throw AppError.unauthorized('Sesi tidak ditemukan.');
    }

    // Super Admin has unrestricted access to all menus and levels
    if (user.scope.isSuperAdmin) {
      return next();
    }

    const targetMenuIds = Array.isArray(menuId) ? (menuId as string[]) : [menuId as string];
    const permission = user.permissions.find(
      (p) => targetMenuIds.includes(p.menuId) && p.enable && p.level >= requiredLevel
    );

    if (!permission) {
      throw AppError.forbidden('Anda tidak memiliki akses ke fitur ini.');
    }

    next();
  };
};
