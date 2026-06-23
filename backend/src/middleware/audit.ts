import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { supabase } from '../config/supabase';

export const auditLog = (action: string, entityType?: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);
    const userId = req.user?.id;

    res.json = function (body: any) {
      if (userId && res.statusCode < 400) {
        const entityId = req.params.id || body?.id || body?.data?.id;

        (async () => {
          try {
            await supabase.from('audit_logs').insert({
              user_id: userId,
              action,
              entity_type: entityType,
              entity_id: entityId || null,
              details: {
                method: req.method,
                path: req.path,
                body: sanitizeBody(req.body),
              },
              ip_address: req.ip,
              user_agent: req.get('user-agent') || null,
            });
          } catch (e) {
            console.error('Audit log error:', e);
          }
        })();
      }

      return originalJson(body);
    };

    next();
  };
};

function sanitizeBody(body: any): any {
  if (!body) return {};
  const sanitized = { ...body };
  delete sanitized.password;
  delete sanitized.password_hash;
  delete sanitized.token;
  return sanitized;
}
