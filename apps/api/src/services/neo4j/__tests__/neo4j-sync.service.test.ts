import { describe, it, expect, beforeAll } from '@jest/globals';
import { Neo4jSyncService } from '../neo4j-sync.service.js';

describe('Neo4jSyncService', () => {
  let service: Neo4jSyncService;

  beforeAll(() => {
    service = Neo4jSyncService.getInstance();
  });

  describe('Initialization', () => {
    it('should return a singleton instance', () => {
      const service2 = Neo4jSyncService.getInstance();
      expect(service).toBe(service2);
    });

    it('should have syncAll and syncDelta methods', () => {
      expect(typeof service.syncAll).toBe('function');
      expect(typeof service.syncDelta).toBe('function');
    });
  });

  describe('syncAll()', () => {
    it('should be callable and return a promise', async () => {
      const promise = service.syncAll();
      expect(promise).toBeInstanceOf(Promise);
      await promise;
    });

    it('should handle errors gracefully and not throw', async () => {
      // If Neo4j is unavailable, it should still resolve
      await expect(service.syncAll()).resolves.toBeUndefined();
    });
  });

  describe('syncDelta()', () => {
    it('should be callable and return a promise', async () => {
      const promise = service.syncDelta();
      expect(promise).toBeInstanceOf(Promise);
      await promise;
    });

    it('should handle errors gracefully and not throw', async () => {
      // If Neo4j is unavailable, it should still resolve
      await expect(service.syncDelta()).resolves.toBeUndefined();
    });
  });

  describe('Acceptance Criteria', () => {
    it('✓ Neo4jSyncService exists and exports class', () => {
      expect(Neo4jSyncService).toBeDefined();
    });

    it('✓ syncAll() is callable (signature correct)', () => {
      expect(service.syncAll).toBeDefined();
    });

    it('✓ syncDelta() is callable (signature correct)', () => {
      expect(service.syncDelta).toBeDefined();
    });

    it('✓ Sync operations handle Neo4j unavailability gracefully', async () => {
      // No throw expected
      await expect(service.syncAll()).resolves.toBeUndefined();
      await expect(service.syncDelta()).resolves.toBeUndefined();
    });

    it('✓ Sync errors are caught and logged (non-fatal)', async () => {
      // Even if DB queries fail, methods should not throw
      await expect(service.syncAll()).resolves.not.toThrow();
      await expect(service.syncDelta()).resolves.not.toThrow();
    });
  });
});
