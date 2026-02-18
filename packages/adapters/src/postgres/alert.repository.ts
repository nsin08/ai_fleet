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
         (id, vehicle_id, vehicle_reg_no, driver_id, trip_id, scenario_run_id,
          alert_type, severity, status, title, description, evidence,
          related_event_ids, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        alert.id,
        alert.vehicleId,
        alert.vehicleRegNo,
        alert.driverId ?? null,
        alert.tripId ?? null,
        alert.scenarioRunId ?? null,
        alert.alertType,
        alert.severity,
        alert.status,
        alert.title,
        alert.description,
        JSON.stringify(alert.evidence ?? {}),
        alert.relatedEventIds ?? [],
        alert.note ?? null,
      ],
    );
    return mapAlertRow(rows[0]);
  }

  async ackAlert(cmd: AckAlertCommand): Promise<Alert> {
    const { rows } = await getPool().query(
      `UPDATE fleet.alerts
       SET status = 'ACK', acknowledged_by = $2, acknowledged_ts = NOW(), updated_at = NOW(), updated_ts = NOW()
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
       SET status = 'CLOSED', closed_ts = NOW(), note = COALESCE($2, note),
           updated_at = NOW(), updated_ts = NOW()
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
      const s = filters.status.toUpperCase();
      params.push(s === 'ACKNOWLEDGED' ? 'ACK' : s);
    }
    if (filters.severity) {
      conditions.push(`severity = $${idx++}`);
      params.push(filters.severity);
    }
    if (filters.from) {
      conditions.push(`created_ts >= $${idx++}`);
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`created_ts <= $${idx++}`);
      params.push(filters.to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const { rows } = await getPool().query(
      `SELECT * FROM fleet.alerts ${where} ORDER BY created_ts DESC LIMIT $${idx++} OFFSET $${idx++}`,
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
       WHERE vehicle_id = $1 AND status IN ('OPEN','ACK')`,
      [vehicleId],
    );
    return parseInt(rows[0]['cnt'] as string, 10);
  }
}

function mapAlertRow(row: Record<string, unknown>): Alert {
  return {
    id: row['id'] as string,
    createdTs: row['created_ts'] as Date,
    updatedTs: row['updated_ts'] as Date,
    closedTs: row['closed_ts'] as Date | undefined,
    vehicleId: row['vehicle_id'] as string,
    vehicleRegNo: row['vehicle_reg_no'] as string,
    driverId: row['driver_id'] as string | undefined,
    tripId: row['trip_id'] as string | undefined,
    scenarioRunId: row['scenario_run_id'] as string | undefined,
    alertType: row['alert_type'] as EventType,
    severity: row['severity'] as EventSeverity,
    status: row['status'] as AlertStatus,
    title: row['title'] as string,
    description: row['description'] as string,
    evidence: (row['evidence'] as Record<string, unknown>) ?? {},
    relatedEventIds: (row['related_event_ids'] as string[]) ?? [],
    acknowledgedBy: row['acknowledged_by'] as string | undefined,
    acknowledgedTs: row['acknowledged_ts'] as Date | undefined,
    note: row['note'] as string | undefined,
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
  };
}
