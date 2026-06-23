import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';
import { hasPermission } from '../config/permissions';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    company_id?: string;
    branch_id?: string;
    first_name: string;
    last_name: string;
  };
}

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  company_id?: string;
  branch_id?: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'default-secret';

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name, company_id, branch_id, is_active')
      .eq('id', decoded.userId)
      .single();

    if (error || !user || !user.is_active) {
      res.status(401).json({ error: 'Invalid or inactive user' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      branch_id: user.branch_id,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
};

export const checkPermission = (module: string, action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (req.user.role === 'super_admin') {
      next();
      return;
    }

    if (!hasPermission(req.user.role, module, action)) {
      res.status(403).json({ error: 'Insufficient permissions for this action' });
      return;
    }

    next();
  };
};
