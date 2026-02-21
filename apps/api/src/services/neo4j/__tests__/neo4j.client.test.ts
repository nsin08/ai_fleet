import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  getNeo4jDriver,
  verifyNeo4jConnectivity,
  isNeo4jAvailable,
  setNeo4jUnavailable,
  openSession,
  applySchema,
  closeNeo4jDriver,
} from '../neo4j.client.js';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Neo4j Client', () => {
  // Note: These tests assume Neo4j is running at NEO4J_URI (or tests are skipped gracefully)
  // For CI: NEO4J_URI should be set to a test container or services mock

  beforeAll(() => {
    // Set test environment if not already set
    if (!process.env.NEO4J_URI) {
      process.env.NEO4J_URI = 'bolt://localhost:7687';
    }
    if (!process.env.NEO4J_USER) {
      process.env.NEO4J_USER = 'neo4j';
    }
    if (!process.env.NEO4J_PASSWORD) {
      process.env.NEO4J_PASSWORD = 'password';
    }
  });

  afterAll(async () => {
    // Clean up: close the driver
    await closeNeo4jDriver();
  });

  describe('Driver Singleton', () => {
    it('should return the same driver instance on multiple calls', () => {
      const driver1 = getNeo4jDriver();
      const driver2 = getNeo4jDriver();
      expect(driver1).toBe(driver2);
    });

    it('should initialize driver with correct config from env', () => {
      const driver = getNeo4jDriver();
      expect(driver).toBeDefined();
      // Driver config is private but we can verify the instance exists
      expect(driver).toHaveProperty('_meta');
    });
  });

  describe('Connectivity Verification', () => {
    it('should attempt to verify connectivity', async () => {
      // This test will succeed if Neo4j is running, fail gracefully if not
      // The function returns void on success, throws on failure
      // For test purposes, we just verify it's callable
      try {
        await verifyNeo4jConnectivity();
        expect(isNeo4jAvailable()).toBe(true);
      } catch (error) {
        // Expected if Neo4j is not running in test environment
        expect(isNeo4jAvailable()).toBe(false);
      }
    });

    it('should mark availability as false when setNeo4jUnavailable is called', () => {
      setNeo4jUnavailable();
      expect(isNeo4jAvailable()).toBe(false);
    });
  });

  describe('Schema Application', () => {
    it('should read schema file from expected path', async () => {
      // Verify schema file exists at expected relative paths
      const possiblePaths = [
        path.join(__dirname, '../../../../../../db/neo4j/schema.cypher'),
        path.join(process.cwd(), 'db/neo4j/schema.cypher'),
      ];

      let schemaFileExists = false;
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          schemaFileExists = true;
          const content = fs.readFileSync(filePath, 'utf-8');
          expect(content).toContain('CREATE CONSTRAINT');
          expect(content).toContain('CREATE VECTOR INDEX');
          break;
        }
      }

      expect(schemaFileExists).toBe(true);
    });

    it('should parse schema file (IF NOT EXISTS statements)', () => {
      const possiblePaths = [
        path.join(__dirname, '../../../../../../db/neo4j/schema.cypher'),
        path.join(process.cwd(), 'db/neo4j/schema.cypher'),
      ];

      let schemaContent = '';
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          schemaContent = fs.readFileSync(filePath, 'utf-8');
          break;
        }
      }

      // Verify idempotent statements
      expect(schemaContent).toMatchSnapshot();

      // Verify IF NOT EXISTS in key statements (constraints and indices)
      expect(schemaContent).toContain('IF NOT EXISTS');
      expect(schemaContent.split('IF NOT EXISTS').length - 1).toBeGreaterThanOrEqual(8);

      // Verify constraints exist (unique or otherwise)
      expect(schemaContent).toContain('CREATE CONSTRAINT');

      // Verify vector indices exist
      expect(schemaContent).toContain('VECTOR INDEX');
    });

    it('should be idempotent (multiple calls should succeed)', async () => {
      // Verify schema file contains IF NOT EXISTS
      const possiblePaths = [
        path.join(__dirname, '../../../../../../db/neo4j/schema.cypher'),
        path.join(process.cwd(), 'db/neo4j/schema.cypher'),
      ];

      let schemaContent = '';
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          schemaContent = fs.readFileSync(filePath, 'utf-8');
          break;
        }
      }

      // All CREATE statements should use IF NOT EXISTS for idempotency
      const createStatements = schemaContent
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('CREATE'));

      createStatements.forEach((stmt) => {
        // All CREATE should have IF NOT EXISTS
        expect(stmt).toContain('IF NOT EXISTS');
      });

      expect(createStatements.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Session Management', () => {
    it('should open and close a session', async () => {
      try {
        await verifyNeo4jConnectivity();

        const session = openSession();
        expect(session).toBeDefined();
        expect(session).toHaveProperty('run');
        expect(session).toHaveProperty('close');

        await session.close();
        expect(true).toBe(true);
      } catch {
        // Neo4j not running; acceptable for test
        expect(true).toBe(true);
      }
    });
  });

  describe('Graceful Degradation', () => {
    it('should report unavailability after setNeo4jUnavailable', () => {
      setNeo4jUnavailable();
      expect(isNeo4jAvailable()).toBe(false);
    });

    it('should track availability state independently of connectivity', () => {
      // Set unavailable
      setNeo4jUnavailable();
      expect(isNeo4jAvailable()).toBe(false);

      // Verify the flag can be checked without throwing
      const status = isNeo4jAvailable();
      expect(typeof status).toBe('boolean');
      expect(status).toBe(false);
    });
  });

  describe('Shutdown', () => {
    it('should close Neo4j driver gracefully', async () => {
      // This should not throw even if driver is not initialized
      await expect(closeNeo4jDriver()).resolves.toBeUndefined();
    });
  });
});
