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
  async append(event: FleetEvent): Promise<void> {
    await this.appendMany([event]);
  }

  async appendMany(events: FleetEvent[]): Promise<void> {
    if (events.length === 0) return;
    const values: unknown[] = [];
    const placeholders = events.map((e, i) => {
      const base = i * 8;
      values.push(
        e.id,
        e.vehicleId,
        e.ts,
        e.type,
        e.severity,
        e.source,
        e.value ?? null,
        JSON.stringify(e.meta ?? {}),
      );
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8})`;
    });
    await getPool().query(
      `INSERT INTO fleet.events
         (id, vehicle_id, ts, type, severity, source, value, meta)
       VALUES ${placeholders.join(',')}
       ON CONFLICT (id) DO NOTHING`,
      values,
    );
  }

  async listEvents(filters: EventListFilters = {}): Promise<FleetEvent[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.vehicleId) {
      conditions.push(`vehicle_id = $${idx++}`);
      params.push(filters.vehicleId);
    }
    if (filters.type) {
      conditions.push(`type = $${idx++}`);
      params.push(filters.type);
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
    vehicleId: row['vehicle_id'] as string,
    ts: row['ts'] as Date,
    type: row['type'] as EventType,
    severity: row['severity'] as EventSeverity,
    source: row['source'] as EventSource,
    value: row['value'] as number | undefined,
    meta: row['meta'] as Record<string, unknown> | undefined,
  };
}
