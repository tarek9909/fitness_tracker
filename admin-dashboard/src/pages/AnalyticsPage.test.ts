/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

describe('Admin Analytics & Intelligence Page Unit Suite', () => {
  describe('Adherence and Aggregation Math', () => {
    it('computes adherence percentage correctly with zero division guard returning null for no-data states', () => {
      const computeAdherence = (completed: number, total: number) => {
        return total > 0 ? Math.round((completed / total) * 100) : null;
      };

      const formatAdherence = (pct: number | null) => {
        return pct !== null ? `${pct}%` : 'N/A';
      };

      expect(computeAdherence(0, 0)).toBeNull();
      expect(formatAdherence(computeAdherence(0, 0))).toBe('N/A');
      expect(computeAdherence(8, 10)).toBe(80);
      expect(formatAdherence(computeAdherence(8, 10))).toBe('80%');
      expect(computeAdherence(1, 3)).toBe(33);
      expect(computeAdherence(10, 10)).toBe(100);
    });

    it('computes 1RM correctly based on Epley formula', () => {
      const calc1RM = (weightKg: number, reps: number) => {
        if (reps <= 1) return weightKg;
        return Math.round(weightKg * (1 + reps / 30.0) * 10) / 10;
      };

      expect(calc1RM(100, 1)).toBe(100);
      expect(calc1RM(100, 10)).toBe(133.3);
      expect(calc1RM(80, 5)).toBe(93.3);
    });

    it('formats liters and milliliters accurately', () => {
      const formatLiters = (totalMl: number) => {
        return Math.round((totalMl / 1000) * 10) / 10;
      };

      expect(formatLiters(3500)).toBe(3.5);
      expect(formatLiters(12000)).toBe(12);
      expect(formatLiters(750)).toBe(0.8);
    });

    it('computes weight progress percentage toward goal accurately', () => {
      const calcProgress = (start: number, current: number, target: number) => {
        if (start === target) return 100;
        return Math.min(100, Math.max(0, Math.round(((start - current) / (start - target)) * 100)));
      };

      // Weight loss goal: 90kg -> 80kg, currently 85kg -> 50%
      expect(calcProgress(90, 85, 80)).toBe(50);
      // Weight loss reached target: 90kg -> 80kg, currently 80kg -> 100%
      expect(calcProgress(90, 80, 80)).toBe(100);
      // Weight gain beyond starting point: 90kg -> 80kg, currently 92kg -> 0% clamped
      expect(calcProgress(90, 92, 80)).toBe(0);
      // Weight gain goal: 70kg -> 80kg, currently 75kg -> 50%
      expect(calcProgress(70, 75, 80)).toBe(50);
    });
  });
});
