import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../../domain/errors/AppError';

export interface UserScope {
  isSuperAdmin: boolean;
  unitId?: string;
  unitCode?: string;
  allowedUnitIds: string[];
}

export interface UserPermission {
  menuId: string;
  enable: boolean;
  level: number;
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
  karyawan?: any;
  scope: UserScope;
  permissions: UserPermission[];
  token: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const AuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Token otentikasi tidak ditemukan.');
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'supersecretkeyframeworkv1coreauth';

  try {
    const decoded = jwt.verify(token, secret) as any;

    req.user = {
      userId: decoded.sub || decoded.userId || decoded.id,
      username: decoded.username || '',
      karyawan: decoded.karyawan,
      scope: {
        isSuperAdmin: decoded.scope?.isSuperAdmin === true || decoded.isSuperAdmin === true,
        unitId: decoded.scope?.unitId,
        unitCode: decoded.scope?.unitCode,
        allowedUnitIds: decoded.scope?.allowedUnitIds || [],
      },
      permissions: decoded.permissions || [],
      token,
    };

    next();
  } catch (err: any) {
    throw AppError.unauthorized('Token tidak valid atau telah kadaluarsa.');
  }
};
