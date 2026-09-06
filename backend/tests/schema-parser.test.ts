import { describe, it, expect } from 'vitest';
import path from 'path';
import { parseSqlTables, auditSchemaDiscrepancies } from '../src/scripts/audit-mysql-schema.js';

describe('Runtime SQL Schema Parser & MySQL Audit Suite', () => {
  it('parseSqlTables accurately parses canonical fitness_tracker.db dump', () => {
    const canonicalPath = path.resolve(process.cwd(), '../fitness_tracker.db');
    const audit = auditSchemaDiscrepancies(canonicalPath);

    expect(audit.canonicalTableCount).toBe(55);
    expect(audit.canonicalTables).toContain('users');
    expect(audit.canonicalTables).toContain('roles');
    expect(audit.canonicalTables).toContain('workout_sessions');
    expect(audit.canonicalTables).toContain('workout_sets');
    expect(audit.canonicalTables).toContain('meal_logs');
    expect(audit.canonicalTables).toContain('user_passkeys');
  });

  it('parseSqlTables accurately parses active SQLite schema.ts', () => {
    const audit = auditSchemaDiscrepancies();

    expect(audit.activeTableCount).toBe(55);
    expect(audit.activeTables).toContain('worker_locks');
    expect(audit.activeTables).toContain('user_passkeys');
    expect(audit.tablesOnlyInActive.length).toBe(0);
  });

  it('auditSchemaDiscrepancies dynamically evaluates canonical vs active schema consistency', () => {
    const audit = auditSchemaDiscrepancies();

    // Verify dynamic invariant calculation
    const expectedHarmonized =
      audit.tablesOnlyInCanonical.length === 0 &&
      audit.tablesOnlyInActive.length === 0 &&
      audit.columnDiscrepancies.length === 0;

    expect(audit.isHarmonized).toBe(expectedHarmonized);
    expect(audit.isHarmonized).toBe(true);
    expect(audit.columnDiscrepancies.length).toBe(0);
    expect(audit.tablesOnlyInCanonical.length).toBe(0);
    expect(audit.tablesOnlyInActive.length).toBe(0);
    expect(audit.canonicalTableCount).toBe(55);
    expect(audit.activeTableCount).toBe(55);
  });

  it('runMySQLIntegrationTests successfully passes SCHEMA_AUDIT stage and either completes or fails closed at CONNECTION stage', async () => {
    const { runMySQLIntegrationTests } = await import('./mysql-integration.js');
    const result = await runMySQLIntegrationTests();

    expect(result.report).toBeDefined();
    expect(result.report?.isHarmonized).toBe(true);
    expect(result.report?.columnDiscrepancies.length).toBe(0);
    expect(['CONNECTION', 'COMPLETED']).toContain(result.stage);
    if (result.stage === 'CONNECTION') {
      expect(result.success).toBe(false);
    } else {
      expect(result.success).toBe(true);
    }
  });
});
