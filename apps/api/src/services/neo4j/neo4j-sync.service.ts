import { getPool } from '@ai-fleet/adapters';
import { isNeo4jAvailable, openSession } from './neo4j.client.js';
import embeddingGenerator from './embedding-generator.js';

const log = {
  info: (msg: string, extra?: any) =>
    console.log(`[neo4j-sync] ${msg}`, extra ? JSON.stringify(extra, null, 2) : ''),
  debug: (msg: string, extra?: any) =>
    console.debug(`[neo4j-sync] ${msg}`, extra ? JSON.stringify(extra, null, 2) : ''),
  warn: (msg: string, extra?: any) =>
    console.warn(`[neo4j-sync] ${msg}`, extra ? JSON.stringify(extra, null, 2) : ''),
};

/**
 * Neo4j Sync Service
 *
 * Bi-directional sync between PostgreSQL (source of truth) and Neo4j (graph queries).
 * - syncAll(): Full sync on app startup (idempotent with MERGE)
 * - syncDelta(): Incremental sync every 5 minutes
 *
 * All operations use Neo4j MERGE to ensure idempotency.
 */
export class Neo4jSyncService {
  private static instance: Neo4jSyncService;

  private constructor() {}

  static getInstance(): Neo4jSyncService {
    if (!Neo4jSyncService.instance) {
      Neo4jSyncService.instance = new Neo4jSyncService();
    }
    return Neo4jSyncService.instance;
  }

  /**
   * Full sync on app startup: upserts all drivers, vehicles, depots, alerts, work orders
   * Creates all relationship types (DRIVES, LOCATED_IN, AFFECTS, ASSIGNED_TO, COMPLETED)
   * Idempotent: can be called multiple times safely
   */
  async syncAll(): Promise<void> {
    if (!isNeo4jAvailable()) {
      log.warn('[syncAll] Neo4j unavailable, skipping full sync');
      return;
    }

    try {
      log.info('[syncAll] Starting full sync...');

      const session = openSession();
      try {
        // 1. Sync nodes in batches
        await this.syncDriverNodes(session);
        await this.syncVehicleNodes(session);
        await this.syncDepotNodes(session);
        await this.syncAlertNodes(session);
        await this.syncWorkOrderNodes(session);
        await this.syncTripNodes(session);

        // 2. Sync relationships
        await this.syncDrivesRelationships(session);
        await this.syncLocatedInRelationships(session);
        await this.syncAffectsRelationships(session);
        await this.syncAssignedToRelationships(session);
        await this.syncCompletedRelationships(session);

        log.info('[syncAll] Full sync completed successfully');
      } finally {
        await session.close();
      }

      // Trigger embedding generation after successful sync (non-blocking, non-fatal)
      await embeddingGenerator.generateAll();
    } catch (error) {
      log.warn('[syncAll] Sync failed (non-fatal)', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Do not throw; allow API to continue
    }
  }

  /**
   * Delta sync every 5 minutes: upserts newly inserted/updated rows
   * Uses a watermark (last sync timestamp) to detect changes
   */
  async syncDelta(): Promise<void> {
    if (!isNeo4jAvailable()) {
      log.warn('[syncDelta] Neo4j unavailable, skipping delta sync');
      return;
    }

    try {
      log.debug('[syncDelta] Starting delta sync...');

      const session = openSession();
      try {
        // TODO: Implement watermark tracking (select max(updated_at) from each table)
        // For now, perform full sync (will be optimized in W10)
        await this.syncDriverNodes(session);
        await this.syncVehicleNodes(session);
        await this.syncAlertNodes(session);
        await this.syncWorkOrderNodes(session);

        log.debug('[syncDelta] Delta sync completed');
      } finally {
        await session.close();
      }

      // Trigger embedding generation after delta sync (non-blocking, non-fatal)
      await embeddingGenerator.generateAll();
    } catch (error) {
      log.warn('[syncDelta] Delta sync failed (non-fatal)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ── Node Sync Methods ──────────────────────────────────────────────────────

  private async syncDriverNodes(session: any): Promise<void> {
    const pool = getPool();
    const batch: Array<{ id: string; name: string; performanceScore: number; status: string; riskLevel: string }> = [];
    const BATCH_SIZE = 500;

    try {
      const result = await pool.query(
        `SELECT id, name, performance_score, status, risk_level, updated_at FROM drivers ORDER BY id`
      );

      for (const row of result.rows) {
        batch.push({
          id: String(row['id']),
          name: String(row['name'] || ''),
          performanceScore: Number(row['performance_score']) || 0,
          status: String(row['status'] || 'active'),
          riskLevel: String(row['risk_level'] || 'normal'),
        });

        if (batch.length >= BATCH_SIZE) {
          await this.upsertDriverBatch(session, batch);
          batch.length = 0;
        }
      }

      if (batch.length > 0) {
        await this.upsertDriverBatch(session, batch);
      }

      log.debug(`[syncDriverNodes] Synced ${result.rows.length} drivers`);
    } catch (error) {
      log.warn('[syncDriverNodes] Failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async upsertDriverBatch(
    session: any,
    batch: Array<{ id: string; name: string; performanceScore: number; status: string; riskLevel: string }>
  ): Promise<void> {
    for (const driver of batch) {
      await session.run(
        `MERGE (d:Driver {id: $id})
         SET d.name = $name,
             d.score = $performanceScore,
             d.status = $status,
             d.risk = $riskLevel,
             d.updatedAt = timestamp()`,
        {
          id: driver.id,
          name: driver.name,
          performanceScore: driver.performanceScore,
          status: driver.status,
          riskLevel: driver.riskLevel,
        }
      );
    }
  }

  private async syncVehicleNodes(session: any): Promise<void> {
    const pool = getPool();
    try {
      const result = await pool.query(
        `SELECT id, registration_no, vehicle_type, status, depot_id, updated_at FROM vehicles ORDER BY id`
      );

      for (const row of result.rows) {
        await session.run(
          `MERGE (v:Vehicle {id: $id})
           SET v.registrationNo = $registrationNo,
               v.type = $vehicleType,
               v.status = $status,
               v.depotId = $depotId,
               v.updatedAt = timestamp()`,
          {
            id: String(row['id']),
            registrationNo: String(row['registration_no'] || ''),
            vehicleType: String(row['vehicle_type'] || ''),
            status: String(row['status'] || 'available'),
            depotId: String(row['depot_id'] || ''),
          }
        );
      }

      log.debug(`[syncVehicleNodes] Synced ${result.rows.length} vehicles`);
    } catch (error) {
      log.warn('[syncVehicleNodes] Failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async syncDepotNodes(session: any): Promise<void> {
    const pool = getPool();
    try {
      const result = await pool.query(`SELECT id, name FROM depots ORDER BY id`);

      for (const row of result.rows) {
        await session.run(
          `MERGE (d:Depot {id: $id})
           SET d.name = $name`,
          {
            id: String(row['id']),
            name: String(row['name'] || ''),
          }
        );
      }

      log.debug(`[syncDepotNodes] Synced ${result.rows.length} depots`);
    } catch (error) {
      log.warn('[syncDepotNodes] Failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async syncAlertNodes(session: any): Promise<void> {
    const pool = getPool();
    try {
      const result = await pool.query(
        `SELECT id, vehicle_id, event_type, severity, status FROM alerts ORDER BY id`
      );

      for (const row of result.rows) {
        await session.run(
          `MERGE (a:Alert {id: $id})
           SET a.vehicleId = $vehicleId,
               a.eventType = $eventType,
               a.severity = $severity,
               a.status = $status,
               a.createdAt = timestamp()`,
          {
            id: String(row['id']),
            vehicleId: String(row['vehicle_id'] || ''),
            eventType: String(row['event_type'] || ''),
            severity: String(row['severity'] || 'info'),
            status: String(row['status'] || 'open'),
          }
        );
      }

      log.debug(`[syncAlertNodes] Synced ${result.rows.length} alerts`);
    } catch (error) {
      log.warn('[syncAlertNodes] Failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async syncWorkOrderNodes(session: any): Promise<void> {
    const pool = getPool();
    try {
      const result = await pool.query(
        `SELECT id, vehicle_id, work_type, status, created_at FROM maintenance_work_orders ORDER BY id`
      );

      for (const row of result.rows) {
        await session.run(
          `MERGE (w:WorkOrder {id: $id})
           SET w.vehicleId = $vehicleId,
               w.workType = $workType,
               w.status = $status,
               w.createdAt = $createdAt`,
          {
            id: String(row['id']),
            vehicleId: String(row['vehicle_id'] || ''),
            workType: String(row['work_type'] || ''),
            status: String(row['status'] || 'pending'),
            createdAt: String(row['created_at'] || ''),
          }
        );
      }

      log.debug(`[syncWorkOrderNodes] Synced ${result.rows.length} work orders`);
    } catch (error) {
      log.warn('[syncWorkOrderNodes] Failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async syncTripNodes(session: any): Promise<void> {
    const pool = getPool();
    try {
      const result = await pool.query(
        `SELECT id, driver_id, vehicle_id, start_time, end_time FROM trips ORDER BY id`
      );

      for (const row of result.rows) {
        await session.run(
          `MERGE (t:Trip {id: $id})
           SET t.driverId = $driverId,
               t.vehicleId = $vehicleId,
               t.startTime = $startTime,
               t.endTime = $endTime`,
          {
            id: String(row['id']),
            driverId: String(row['driver_id'] || ''),
            vehicleId: String(row['vehicle_id'] || ''),
            startTime: String(row['start_time'] || ''),
            endTime: String(row['end_time'] || ''),
          }
        );
      }

      log.debug(`[syncTripNodes] Synced ${result.rows.length} trips`);
    } catch (error) {
      log.warn('[syncTripNodes] Failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ── Relationship Sync Methods ──────────────────────────────────────────────

  private async syncDrivesRelationships(session: any): Promise<void> {
    try {
      // (Driver)-[:DRIVES]->(Vehicle) from vehicle_latest_state.driver_id
      await session.run(
        `MATCH (d:Driver), (v:Vehicle)
         WHERE v.driverId = d.id
         MERGE (d)-[:DRIVES]->(v)`
      );

      log.debug('[syncDrivesRelationships] Synced DRIVES relationships');
    } catch (error) {
      log.warn('[syncDrivesRelationships] Failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async syncLocatedInRelationships(session: any): Promise<void> {
    try {
      // (Vehicle)-[:LOCATED_IN]->(Depot) from vehicles.depot_id
      await session.run(
        `MATCH (v:Vehicle), (d:Depot)
         WHERE v.depotId = d.id
         MERGE (v)-[:LOCATED_IN]->(d)`
      );

      log.debug('[syncLocatedInRelationships] Synced LOCATED_IN relationships');
    } catch (error) {
      log.warn('[syncLocatedInRelationships] Failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async syncAffectsRelationships(session: any): Promise<void> {
    try {
      // (Alert)-[:AFFECTS]->(Vehicle) from alerts.vehicle_id
      await session.run(
        `MATCH (a:Alert), (v:Vehicle)
         WHERE a.vehicleId = v.id
         MERGE (a)-[:AFFECTS]->(v)`
      );

      log.debug('[syncAffectsRelationships] Synced AFFECTS relationships');
    } catch (error) {
      log.warn('[syncAffectsRelationships] Failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async syncAssignedToRelationships(session: any): Promise<void> {
    try {
      // (WorkOrder)-[:ASSIGNED_TO]->(Vehicle) from maintenance_work_orders.vehicle_id
      await session.run(
        `MATCH (w:WorkOrder), (v:Vehicle)
         WHERE w.vehicleId = v.id
         MERGE (w)-[:ASSIGNED_TO]->(v)`
      );

      log.debug('[syncAssignedToRelationships] Synced ASSIGNED_TO relationships');
    } catch (error) {
      log.warn('[syncAssignedToRelationships] Failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async syncCompletedRelationships(session: any): Promise<void> {
    try {
      // (Driver)-[:COMPLETED]->(Trip) from trips.driver_id
      await session.run(
        `MATCH (d:Driver), (t:Trip)
         WHERE t.driverId = d.id
         MERGE (d)-[:COMPLETED]->(t)`
      );

      log.debug('[syncCompletedRelationships] Synced COMPLETED relationships');
    } catch (error) {
      log.warn('[syncCompletedRelationships] Failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export default Neo4jSyncService.getInstance();
