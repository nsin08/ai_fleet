import type {
  AlertRepositoryPort,
  AlertListFilters,
  AckAlertCommand,
} from '@ai-fleet/domain';
import type { Alert, AlertStatus } from '@ai-fleet/domain';
import type { EventType, EventSeverity } from '@ai-fleet/domain';
import { getPool } from './pool.js';

export class PgAlertRepository implements AlertRepositoryPort {
  async createAlert(alert: Alert): Promise<Alert> {
    const { rows } = await getPool().query(
      `INSERT INTO fleet.alerts
         (id, vehicle_id, ts, event_type, severity, message,
          status, related_event_ids, assigned_to, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        alert.id,
        alert.vehicleId,
        alert.ts,
        alert.eventType,
        alert.severity,
        alert.message,
        alert.status,
        JSON.stringify(alert.relatedEventIds ?? []),
        alert.assignedTo ?? null,
        JSON.stringify(alert.meta ?? {}),
      ],
    );
    return mapAlertRow(rows[0]);
  }

  async ackAlert(cmd: AckAlertCommand): Promise<Alert> {
    const { rows } = await getPool().query(
      `UPDATE fleet.alerts
       SET status = 'acknowledged', assigned_to = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [cmd.alertId, cmd.acknowledgedBy],
    );
    if (!rows[0]) throw new Error(`Alert ${cmd.alertId} not found`);
    return mapAlertRow(rows[0]);
  }

  async closeAlert(alertId: string, resolution?: string): Promise<Alert> {
    const { rows } = await getPool().query(
      `UPDATE fleet.alerts
       SET status = 'closed',
           meta = meta || jsonb_build_object('resolution', $2::text),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [alertId, resolution ?? null],
    );
    if (!rows[0]) throw new Error(`Alert ${alertId} not found`);
    return mapAlertRow(rows[0]);
  }

  async listAlerts(filters: AlertListFilters = {}): Promise<Alert[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.vehicleId) {
      conditions.push(`vehicle_id = $${idx++}`);
      params.push(filters.vehicleId);
    }
    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.severity) {
      conditions.push(`severity = $${idx++}`);
      params.push(filters.severity);
    }
    if (filters.from) {
      conditions.push(`ts >= $${idx++}`);
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`ts <= $${idx++}`);
      params.push(filters.to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const { rows } = await getPool().query(
      `SELECT * FROM fleet.alerts ${where} ORDER BY ts DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );
    return rows.map(mapAlertRow);
  }

  async findById(alertId: string): Promise<Alert | null> {
    const { rows } = await getPool().query(
      `SELECT * FROM fleet.alerts WHERE id = $1`,
      [alertId],
    );
    return rows[0] ? mapAlertRow(rows[0]) : null;
  }

  async countOpenByVehicle(vehicleId: string): Promise<number> {
    const { rows } = await getPool().query(
      `SELECT COUNT(*) AS cnt FROM fleet.alerts
       WHERE vehicle_id = $1 AND status IN ('open','acknowledged')`,
      [vehicleId],
    );
    return parseInt(rows[0]['cnt'] as string, 10);
  }
}

function mapAlertRow(row: Record<string, unknown>): Alert {
  return {
    id: row['id'] as string,
    vehicleId: row['vehicle_id'] as string,
    ts: row['ts'] as Date,
    eventType: row['event_type'] as EventType,
    severity: row['severity'] as EventSeverity,
    message: row['message'] as string,
    status: row['status'] as AlertStatus,
    relatedEventIds: row['related_event_ids'] as string[] | undefined,
    assignedTo: row['assigned_to'] as string | undefined,
    meta: row['meta'] as Record<string, unknown> | undefined,
  };
}
