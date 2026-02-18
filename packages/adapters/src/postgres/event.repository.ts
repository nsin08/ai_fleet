import type {
  EventRepositoryPort,
  EventListFilters,
} from '@ai-fleet/domain';
import type {
  FleetEvent,
  EventType,
  EventSeverity,
  EventSource,
} from '@ai-fleet/domain';
import { getPool } from './pool.js';

export class PgEventRepository implements EventRepositoryPort {
  async append(event: Omit<FleetEvent, 'createdAt'>): Promise<FleetEvent> {
    const result = await this.appendMany([event]);
    return result[0]!;
  }

  async appendMany(events: Omit<FleetEvent, 'createdAt'>[]): Promise<FleetEvent[]> {
    if (events.length === 0) return [];
    const values: unknown[] = [];
    const placeholders = events.map((e, i) => {
      const base = i * 14;
      values.push(
        e.id,
        e.ts,
        e.vehicleId,
        e.vehicleRegNo,
        e.driverId ?? null,
        e.tripId ?? null,
        e.scenarioRunId ?? null,
        e.sourceMode,
        e.sourceEmitterId ?? null,
        e.source,
        e.eventType,
        e.severity,
        e.message,
        JSON.stringify(e.metadata ?? {}),
      );
      // 14 columns per row
      const cols = Array.from({ length: 14 }, (_, k) => `$${base + k + 1}`);
      return `(${cols.join(',')})`;
    });
    const { rows } = await getPool().query(
      `INSERT INTO fleet.events
         (id, ts, vehicle_id, vehicle_reg_no, driver_id, trip_id, scenario_run_id,
          source_mode, source_emitter_id, source, event_type, severity, message, metadata)
       VALUES ${placeholders.join(',')}
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      values,
    );
    return rows.map(mapEventRow);
  }

  async listEvents(filters: EventListFilters = {}): Promise<FleetEvent[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.vehicleId) {
      conditions.push(`vehicle_id = $${idx++}`);
      params.push(filters.vehicleId);
    }
    if (filters.eventType) {
      conditions.push(`event_type = $${idx++}`);
      params.push(filters.eventType);
    }
    if (filters.severity) {
      conditions.push(`severity = $${idx++}`);
      params.push(filters.severity);
    }
    if (filters.fromTs) {
      conditions.push(`ts >= $${idx++}`);
      params.push(filters.fromTs);
    }
    if (filters.toTs) {
      conditions.push(`ts <= $${idx++}`);
      params.push(filters.toTs);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 200;
    const offset = filters.offset ?? 0;

    const { rows } = await getPool().query(
      `SELECT * FROM fleet.events ${where} ORDER BY ts DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );
    return rows.map(mapEventRow);
  }

  async findById(eventId: string): Promise<FleetEvent | null> {
    const { rows } = await getPool().query(
      `SELECT * FROM fleet.events WHERE id = $1`,
      [eventId],
    );
    return rows[0] ? mapEventRow(rows[0]) : null;
  }
}

function mapEventRow(row: Record<string, unknown>): FleetEvent {
  return {
    id: row['id'] as string,
    ts: row['ts'] as Date,
    vehicleId: row['vehicle_id'] as string,
    vehicleRegNo: row['vehicle_reg_no'] as string,
    driverId: row['driver_id'] as string | undefined,
    tripId: row['trip_id'] as string | undefined,
    scenarioRunId: row['scenario_run_id'] as string | undefined,
    sourceMode: row['source_mode'] as 'replay' | 'live',
    sourceEmitterId: row['source_emitter_id'] as string | undefined,
    source: row['source'] as EventSource,
    eventType: row['event_type'] as EventType,
    severity: row['severity'] as EventSeverity,
    message: row['message'] as string,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    createdAt: row['created_at'] as Date,
  };
}
