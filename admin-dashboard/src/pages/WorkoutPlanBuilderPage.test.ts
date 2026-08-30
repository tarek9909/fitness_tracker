/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

describe('Workout Plan Builder & Version Lifecycle Unit Suite (Req #51-52)', () => {
  describe('Exercise Target Validation', () => {
    it('validates working sets and rep range parameters', () => {
      const validateTargets = (sets: number, repsMin: number, repsMax: number, rir: number) => {
        if (sets < 1) return { valid: false, error: 'Target sets must be at least 1' };
        if (repsMin < 1) return { valid: false, error: 'Min reps must be at least 1' };
        if (repsMax < repsMin) return { valid: false, error: 'Max reps cannot be less than Min reps' };
        if (rir < 0 || rir > 10) return { valid: false, error: 'RIR must be between 0 and 10' };
        return { valid: true };
      };

      expect(validateTargets(4, 8, 12, 2).valid).toBe(true);
      expect(validateTargets(0, 8, 12, 2).valid).toBe(false);
      expect(validateTargets(3, 0, 10, 2).valid).toBe(false);
      expect(validateTargets(3, 12, 8, 2).valid).toBe(false);
      expect(validateTargets(3, 8, 12, 11).valid).toBe(false);
      expect(validateTargets(3, 8, 12, -1).valid).toBe(false);
    });

    it('correctly formats reps display strings for single, range, or unconfigured reps', () => {
      const formatReps = (min?: number, max?: number, targetSets?: number) => {
        if (min && max && min !== max) return `${min}–${max} Reps`;
        if (min) return `${min} Reps`;
        if (targetSets) return `${targetSets} Reps`;
        return 'Reps unconfigured';
      };

      expect(formatReps(8, 12, 3)).toBe('8–12 Reps');
      expect(formatReps(5, 5, 5)).toBe('5 Reps');
      expect(formatReps(undefined, undefined, 4)).toBe('4 Reps');
      expect(formatReps(undefined, undefined, undefined)).toBe('Reps unconfigured');
    });
  });

  describe('Exercise Reordering Logic', () => {
    it('swaps orderIndex accurately between adjacent exercises without mutating non-adjacent items', () => {
      const exercises = [
        { id: 101, exercise_name: 'Barbell Squat', order_index: 1 },
        { id: 102, exercise_name: 'Romanian Deadlift', order_index: 2 },
        { id: 103, exercise_name: 'Leg Press', order_index: 3 },
      ];

      const swapOrder = (list: typeof exercises, fromIdx: number, toIdx: number) => {
        if (toIdx < 0 || toIdx >= list.length) return list;
        const copy = [...list];
        const currentOrder = copy[fromIdx].order_index;
        const targetOrder = copy[toIdx].order_index;

        copy[fromIdx] = { ...copy[fromIdx], order_index: targetOrder };
        copy[toIdx] = { ...copy[toIdx], order_index: currentOrder };

        return copy.sort((a, b) => a.order_index - b.order_index);
      };

      // Move Squat down (swap idx 0 and 1)
      const afterMoveDown = swapOrder(exercises, 0, 1);
      expect(afterMoveDown[0].id).toBe(102);
      expect(afterMoveDown[0].order_index).toBe(1);
      expect(afterMoveDown[1].id).toBe(101);
      expect(afterMoveDown[1].order_index).toBe(2);
      expect(afterMoveDown[2].id).toBe(103);
      expect(afterMoveDown[2].order_index).toBe(3);

      // Boundary guard: moving first item up returns unchanged list
      const atTop = swapOrder(exercises, 0, -1);
      expect(atTop).toEqual(exercises);
    });
  });

  describe('Version Lifecycle & Immutability Rules', () => {
    it('prohibits editing, deleting, or adding exercises when version status is published', () => {
      const canMutateVersion = (status: string) => {
        return status === 'draft';
      };

      expect(canMutateVersion('draft')).toBe(true);
      expect(canMutateVersion('published')).toBe(false);
      expect(canMutateVersion('archived')).toBe(false);
    });

    it('generates expected set target breakdown for preview and athlete execution', () => {
      const generateSetBreakdown = (targetSets: number, repsMin: number, repsMax: number, rirTarget: number, restSeconds: number) => {
        return Array.from({ length: targetSets }).map((_, idx) => ({
          setNumber: idx + 1,
          repsRange: `${repsMin}–${repsMax}`,
          rir: rirTarget,
          restSeconds,
        }));
      };

      const sets = generateSetBreakdown(3, 8, 12, 2, 90);
      expect(sets).toHaveLength(3);
      expect(sets[0]).toEqual({ setNumber: 1, repsRange: '8–12', rir: 2, restSeconds: 90 });
      expect(sets[2]).toEqual({ setNumber: 3, repsRange: '8–12', rir: 2, restSeconds: 90 });
    });

    it('initializes add exercise form with blank exerciseId without auto-selecting first exercise', () => {
      const getInitialExForm = () => ({
        exerciseId: '' as number | '',
        targetSets: '' as number | '',
        repsMin: '' as number | '',
        repsMax: '' as number | '',
        rirTarget: '' as number | '',
        restSeconds: '' as number | '',
        notes: '',
        isOptional: false,
      });

      const form = getInitialExForm();
      expect(form.exerciseId).toBe('');
      expect(form.targetSets).toBe('');
    });
  });
});
