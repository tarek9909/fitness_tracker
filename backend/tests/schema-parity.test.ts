import { describe, it, expect } from 'vitest';
import {
  SCHEMA_DIVERGENCE_MAPPINGS,
  normalizeCanonicalRow,
  translateActivePayload,
} from '../src/database/schema-adapter.js';

describe('MySQL 8.x vs SQLite Schema Parity & Adapter Suite', () => {
  it('defines deterministic bidirectional mappings for workout_sessions', () => {
    const canonicalRow = {
      id: 10,
      workout_date: '2026-08-30',
      workout_name_snapshot: 'Hypertrophy Upper A',
      user_workout_assignment_id: 2,
    };
    const active = normalizeCanonicalRow('workout_sessions', canonicalRow);

    expect(active.session_date).toBe('2026-08-30');
    expect(active.workout_name).toBe('Hypertrophy Upper A');
    expect(active.assignment_id).toBe(2);

    const payload = {
      session_date: '2026-08-30',
      duration_seconds: 3600,
    };
    const canonicalPayload = translateActivePayload('workout_sessions', payload);
    expect(canonicalPayload.workout_date).toBe('2026-08-30');
  });

  it('defines deterministic bidirectional mappings for meal_logs', () => {
    const canonicalRow = {
      id: 1,
      meal_date: '2026-08-30',
      completed_at: '2026-08-30T12:00:00Z',
      actual_calories: 650,
    };
    const active = normalizeCanonicalRow('meal_logs', canonicalRow);

    expect(active.log_date).toBe('2026-08-30');
    expect(active.consumed_at).toBe('2026-08-30T12:00:00Z');
    expect(active.total_calories).toBe(650);

    const payload = {
      log_date: '2026-08-30',
      consumed_at: '2026-08-30T12:00:00Z',
    };
    const canonicalPayload = translateActivePayload('meal_logs', payload);
    expect(canonicalPayload.meal_date).toBe('2026-08-30');
    expect(canonicalPayload.completed_at).toBe('2026-08-30T12:00:00Z');
  });

  it('defines deterministic bidirectional mappings for user_weight_goals and water_entries', () => {
    const weightGoal = normalizeCanonicalRow('user_weight_goals', {
      id: 1,
      starting_weight_kg: 85.5,
    });
    expect(weightGoal.start_weight_kg).toBe(85.5);

    const waterEntry = normalizeCanonicalRow('water_entries', {
      id: 5,
      recorded_at: '2026-08-30 08:00:00',
    });
    expect(waterEntry.logged_at).toBe('2026-08-30 08:00:00');
  });

  it('verifies all registered mappings have non-empty bidirectional definitions', () => {
    const tableKeys = Object.keys(SCHEMA_DIVERGENCE_MAPPINGS);
    expect(tableKeys.length).toBeGreaterThanOrEqual(15);

    for (const key of tableKeys) {
      const mapping = SCHEMA_DIVERGENCE_MAPPINGS[key];
      expect(mapping.tableName).toBe(key);
      expect(Object.keys(mapping.canonicalToActive).length).toBeGreaterThan(0);
      expect(Object.keys(mapping.activeToCanonical).length).toBeGreaterThan(0);
    }
  });
});
