/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

describe('Food Database Management Suite (Scope #2)', () => {
  describe('Food Validation Rules', () => {
    it('validates food name, reference unit, serving amount, and non-negative calories', () => {
      const validateFood = (form: {
        name: string;
        measurementUnitId: number | '';
        defaultServingAmount: number | '';
        calories: number | '';
      }) => {
        if (!form.name.trim()) return { valid: false, error: 'Name is required' };
        if (form.measurementUnitId === '') return { valid: false, error: 'Measurement unit is required' };
        if (form.defaultServingAmount === '' || Number(form.defaultServingAmount) <= 0) {
          return { valid: false, error: 'Serving amount must be positive' };
        }
        if (form.calories === '' || Number(form.calories) < 0) {
          return { valid: false, error: 'Calories must be non-negative' };
        }
        return { valid: true };
      };

      expect(validateFood({ name: 'Rolled Oats', measurementUnitId: 1, defaultServingAmount: 100, calories: 389 }).valid).toBe(true);
      expect(validateFood({ name: '', measurementUnitId: 1, defaultServingAmount: 100, calories: 389 }).valid).toBe(false);
      expect(validateFood({ name: 'Oats', measurementUnitId: '', defaultServingAmount: 100, calories: 389 }).valid).toBe(false);
      expect(validateFood({ name: 'Oats', measurementUnitId: 1, defaultServingAmount: 0, calories: 389 }).valid).toBe(false);
      expect(validateFood({ name: 'Oats', measurementUnitId: 1, defaultServingAmount: 100, calories: -5 }).valid).toBe(false);
    });

    it('formats serving string with unit code correctly or returns Not configured without 100g fallback', () => {
      const formatServing = (amount?: number | null, unitCode?: string | null) => {
        if (amount != null && unitCode) return `${amount} ${unitCode}`;
        if (amount != null) return `${amount}`;
        return 'Not configured';
      };

      expect(formatServing(100, 'g')).toBe('100 g');
      expect(formatServing(240, 'ml')).toBe('240 ml');
      expect(formatServing(1, 'scoop')).toBe('1 scoop');
      expect(formatServing(null, null)).toBe('Not configured');
    });
  });

  describe('Archive Filter Logic', () => {
    it('filters active vs archived food items accurately', () => {
      const foodItems = [
        { id: 1, name: 'Egg Whites', is_archived: 0 },
        { id: 2, name: 'Whey Isolate', is_archived: 1 },
        { id: 3, name: 'Almonds', is_archived: false },
      ];

      const activeFoods = foodItems.filter(f => !f.is_archived || f.is_archived === 0);
      const archivedFoods = foodItems.filter(f => f.is_archived === 1 || f.is_archived === true);

      expect(activeFoods).toHaveLength(2);
      expect(archivedFoods).toHaveLength(1);
      expect(archivedFoods[0].id).toBe(2);
    });
  });
});
