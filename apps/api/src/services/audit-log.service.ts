import { getPool } from '@ai-fleet/adapters';

export interface AuditLogInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}

/** Best-effort audit logging. Operational actions should not fail if audit insert fails. */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO fleet.audit_logs
         (actor_id, action, entity_type, entity_id, payload)
       VALUES
         ($1, $2, $3, $4, $5::jsonb)`,
      [
        input.actorId ?? null,
        input.action,
        input.entityType,
        input.entityId ?? null,
        JSON.stringify(input.payload ?? {}),
      ],
    );
  } catch (err) {
    // Preserve primary workflow even if audit logging fails.
    console.error('[audit-log] failed to write audit entry', err);
  }
}

