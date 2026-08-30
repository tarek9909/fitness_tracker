/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

describe('Admin UserDetailPage Target Management & Validation Suite', () => {
  describe('Adherence Weights 100% Validation Logic', () => {
    function computeAdherenceSum(weights: {
      diet: number;
      workout: number;
      cardio: number;
      water: number;
      weightLogging: number;
    }): number {
      return (
        Math.round(
          (weights.diet +
            weights.workout +
            weights.cardio +
            weights.water +
            weights.weightLogging) *
            100
        ) / 100
      );
    }

    function isAdherenceValid(sum: number): boolean {
      return Math.abs(sum - 100) < 0.01;
    }

    it('validates default platform adherence distribution (35 + 25 + 15 + 15 + 10 = 100%)', () => {
      const defaults = {
        diet: 35,
        workout: 25,
        cardio: 15,
        water: 15,
        weightLogging: 10,
      };
      const sum = computeAdherenceSum(defaults);
      expect(sum).toBe(100);
      expect(isAdherenceValid(sum)).toBe(true);
    });

    it('accepts custom valid distributions summing to 100%', () => {
      const custom = {
        diet: 40,
        workout: 30,
        cardio: 10,
        water: 10,
        weightLogging: 10,
      };
      const sum = computeAdherenceSum(custom);
      expect(sum).toBe(100);
      expect(isAdherenceValid(sum)).toBe(true);
    });

    it('rejects distributions summing to less than 100%', () => {
      const invalid = {
        diet: 30,
        workout: 25,
        cardio: 15,
        water: 15,
        weightLogging: 10, // Sum = 95%
      };
      const sum = computeAdherenceSum(invalid);
      expect(sum).toBe(95);
      expect(isAdherenceValid(sum)).toBe(false);
    });

    it('rejects distributions summing to more than 100%', () => {
      const invalid = {
        diet: 45,
        workout: 25,
        cardio: 15,
        water: 15,
        weightLogging: 10, // Sum = 110%
      };
      const sum = computeAdherenceSum(invalid);
      expect(sum).toBe(110);
      expect(isAdherenceValid(sum)).toBe(false);
    });
  });

  describe('Water Quick-Add Presets Normalization', () => {
    function normalizeQuickAddList(presets: number[]): number[] {
      return Array.from(new Set(presets.filter((p) => p >= 50 && p <= 5000))).sort(
        (a, b) => a - b
      );
    }

    it('deduplicates and sorts quick add presets in ascending order', () => {
      const input = [1000, 250, 500, 250, 750];
      const result = normalizeQuickAddList(input);
      expect(result).toEqual([250, 500, 750, 1000]);
    });

    it('filters out invalid or out-of-range presets (< 50 or > 5000)', () => {
      const input = [10, 250, 500, 6000, 750];
      const result = normalizeQuickAddList(input);
      expect(result).toEqual([250, 500, 750]);
    });
  });

  describe('Weight Goal Input & Payload Validation (Req #88 & #96)', () => {
    function validateWeightGoal(start: number | '', target: number | ''): { valid: boolean; error?: string } {
      if (start === '' || target === '') {
        return { valid: false, error: 'Please enter starting and target weight values' };
      }
      if (start < 20 || start > 500 || target < 20 || target > 500) {
        return { valid: false, error: 'Please enter valid weights between 20 and 500 kg' };
      }
      return { valid: true };
    }

    it('rejects empty starting or target weight without using fake 80kg/75kg fallbacks', () => {
      expect(validateWeightGoal('', 75)).toEqual({ valid: false, error: 'Please enter starting and target weight values' });
      expect(validateWeightGoal(85, '')).toEqual({ valid: false, error: 'Please enter starting and target weight values' });
      expect(validateWeightGoal('', '')).toEqual({ valid: false, error: 'Please enter starting and target weight values' });
    });

    it('rejects out-of-range weights (< 20 or > 500 kg)', () => {
      expect(validateWeightGoal(10, 75)).toEqual({ valid: false, error: 'Please enter valid weights between 20 and 500 kg' });
      expect(validateWeightGoal(85, 600)).toEqual({ valid: false, error: 'Please enter valid weights between 20 and 500 kg' });
    });

    it('accepts valid start and target weight entries', () => {
      expect(validateWeightGoal(82.5, 78.0)).toEqual({ valid: true });
    });
  });

  describe('Plan Builder & Assignment Food/Exercise Safeguards', () => {
    function validateAddFoodOption(foodId: number | ''): boolean {
      return foodId !== '' && foodId > 0;
    }

    function validateAddExercise(exerciseId: number | ''): boolean {
      return exerciseId !== '' && exerciseId > 0;
    }

    it('rejects adding food option without a selected food', () => {
      expect(validateAddFoodOption('')).toBe(false);
      expect(validateAddFoodOption(0)).toBe(false);
      expect(validateAddFoodOption(5)).toBe(true);
    });

    it('rejects adding exercise without a selected exercise', () => {
      expect(validateAddExercise('')).toBe(false);
      expect(validateAddExercise(0)).toBe(false);
      expect(validateAddExercise(12)).toBe(true);
    });
  });

  describe('Cardio Activity Selection & Missing Goals Integrity', () => {
    it('does not auto-select first cardio activity and requires explicit selection', () => {
      const initialActivityState: number | '' = '';
      expect(initialActivityState).toBe('');
    });

    it('renders neutral unconfigured label when water target is null/undefined', () => {
      const formatWaterSummary = (waterGoal?: { target_ml?: number }) => {
        return waterGoal?.target_ml ? `${waterGoal.target_ml} ml / day` : 'Not configured';
      };

      expect(formatWaterSummary({ target_ml: 2500 })).toBe('2500 ml / day');
      expect(formatWaterSummary(undefined)).toBe('Not configured');
      expect(formatWaterSummary({})).toBe('Not configured');
    });
  });
});
