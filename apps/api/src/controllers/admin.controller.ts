import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPool } from '@ai-fleet/adapters';
import { requirePermission } from '../middleware/rbac.js';

export const adminRouter = Router();

const listAuditLogsQuerySchema = z.object({
  actorId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/** GET /api/admin/users */
adminRouter.get('/users', requirePermission('admin:users:read'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getPool().query(
      `SELECT
         u.id,
         u.email,
         u.display_name AS "displayName",
         u.is_active AS "isActive",
         COALESCE(
           jsonb_agg(
             DISTINCT jsonb_build_object(
               'id', r.id,
               'name', r.name,
               'permissions', r.permissions_json
             )
           ) FILTER (WHERE r.id IS NOT NULL),
           '[]'::jsonb
         ) AS roles
       FROM fleet.users u
       LEFT JOIN fleet.user_roles ur ON ur.user_id = u.id
       LEFT JOIN fleet.roles r ON r.id = ur.role_id
       GROUP BY u.id, u.email, u.display_name, u.is_active
       ORDER BY u.display_name ASC`,
    );

    return res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    return next(err);
  }
});

/** GET /api/admin/audit-logs */
adminRouter.get('/audit-logs', requirePermission('admin:audit:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listAuditLogsQuerySchema.parse(req.query);
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query.actorId) {
      where.push(`al.actor_id = $${idx++}`);
      params.push(query.actorId);
    }
    if (query.action) {
      where.push(`al.action = $${idx++}`);
      params.push(query.action);
    }
    if (query.entityType) {
      where.push(`al.entity_type = $${idx++}`);
      params.push(query.entityType);
    }
    if (query.from) {
      where.push(`al.ts >= $${idx++}`);
      params.push(new Date(query.from));
    }
    if (query.to) {
      where.push(`al.ts <= $${idx++}`);
      params.push(new Date(query.to));
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const dataSql = `
      SELECT
        al.id,
        al.actor_id AS "actorId",
        u.display_name AS "actorDisplayName",
        al.action,
        al.entity_type AS "entityType",
        al.entity_id AS "entityId",
        al.payload,
        al.ts
      FROM fleet.audit_logs al
      LEFT JOIN fleet.users u ON u.id = al.actor_id
      ${whereSql}
      ORDER BY al.ts DESC
      LIMIT $${idx++}
      OFFSET $${idx++}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM fleet.audit_logs al ${whereSql}`;

    const [rowsResult, totalResult] = await Promise.all([
      getPool().query(dataSql, [...params, query.limit, query.offset]),
      getPool().query(countSql, params),
    ]);

    return res.json({
      data: rowsResult.rows,
      total: totalResult.rows[0]?.['total'] ?? 0,
    });
  } catch (err) {
    return next(err);
  }
});

