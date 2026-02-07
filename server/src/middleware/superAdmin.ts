import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

/**
 * Middleware to check if the user is a platform super admin.
 * Must be used after the authenticate middleware.
 */
export function requireSuperAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!req.user.isSuperAdmin) {
    res.status(403).json({ error: 'Super admin access required' });
    return;
  }

  next();
}
