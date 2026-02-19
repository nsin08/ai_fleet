import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getPool } from '@ai-fleet/adapters';

export interface AuthContext {
  userId: string;
  displayName: string;
  roles: string[];
  permissions: Set<string>;
}

const FALLBACK_CONTEXT: AuthContext = {
  userId: 'system-admin',
  displayName: 'System Admin',
  roles: ['system'],
  permissions: new Set(['*']),
};

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

function parsePermissionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
}

function hasPermission(permissions: Set<string>, required: string): boolean {
  if (permissions.has('*') || permissions.has(required)) return true;

  const parts = required.split(':');
  for (let idx = parts.length - 1; idx > 0; idx -= 1) {
    const wildcard = `${parts.slice(0, idx).join(':')}:*`;
    if (permissions.has(wildcard)) return true;
  }

  return false;
}

export async function ensureAuthContext(req: Request): Promise<AuthContext> {
  if (req.authContext) return req.authContext;

  const headerUserId = req.header('x-user-id')?.trim();
  if (!headerUserId) {
    req.authContext = FALLBACK_CONTEXT;
    return FALLBACK_CONTEXT;
  }

  const result = await getPool().query(
    `SELECT
       u.id AS "userId",
       u.display_name AS "displayName",
       r.name AS "roleName",
       r.permissions_json AS "permissionsJson"
     FROM fleet.users u
     LEFT JOIN fleet.user_roles ur ON ur.user_id = u.id
     LEFT JOIN fleet.roles r ON r.id = ur.role_id
     WHERE u.id = $1
       AND u.is_active = TRUE`,
    [headerUserId],
  );

  if (result.rows.length === 0) {
    const err = new Error('unknown or inactive user');
    (err as Error & { status?: number }).status = 401;
    throw err;
  }

  const permissions = new Set<string>();
  const roles = new Set<string>();

  for (const row of result.rows) {
    const roleName = typeof row['roleName'] === 'string' ? row['roleName'] : null;
    if (roleName) roles.add(roleName);
    for (const permission of parsePermissionList(row['permissionsJson'])) {
      permissions.add(permission);
    }
  }

  const context: AuthContext = {
    userId: String(result.rows[0]?.['userId'] ?? headerUserId),
    displayName: String(result.rows[0]?.['displayName'] ?? headerUserId),
    roles: [...roles],
    permissions,
  };

  req.authContext = context;
  return context;
}

export function requirePermission(permission: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ensureAuthContext(req);
      if (!hasPermission(context.permissions, permission)) {
        return res.status(403).json({
          error: 'forbidden',
          requiredPermission: permission,
          userId: context.userId,
          roles: context.roles,
        });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export function getActorId(req: Request, fallback = 'system-admin'): string {
  return req.authContext?.userId ?? fallback;
}

