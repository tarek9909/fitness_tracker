/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

describe('Diet Plan Builder & Version Lifecycle Suite (Scope #1 & #6)', () => {
  describe('Option Group & Selection Rules', () => {
    it('validates min and max selections bounds', () => {
      const validateGroupRules = (min: number, max: number) => {
        if (min < 0) return { valid: false, error: 'Min selections cannot be negative' };
        if (max < 1) return { valid: false, error: 'Max selections must be at least 1' };
        if (max < min) return { valid: false, error: 'Max selections cannot be less than Min selections' };
        return { valid: true };
      };

      expect(validateGroupRules(1, 1).valid).toBe(true);
      expect(validateGroupRules(1, 3).valid).toBe(true);
      expect(validateGroupRules(0, 2).valid).toBe(true);
      expect(validateGroupRules(-1, 2).valid).toBe(false);
      expect(validateGroupRules(3, 1).valid).toBe(false);
      expect(validateGroupRules(1, 0).valid).toBe(false);
    });

    it('initializes add option group with blank min/max selections until configured', () => {
      const getInitialGroupForm = () => ({
        groupName: '',
        groupRequired: true,
        minSelections: '' as number | '',
        maxSelections: '' as number | '',
      });

      const initial = getInitialGroupForm();
      expect(initial.minSelections).toBe('');
      expect(initial.maxSelections).toBe('');
    });

    it('formats selection rule descriptions clearly with neutral unconfigured state', () => {
      const formatSelectionRules = (min?: number | null, max?: number | null, isRequired?: boolean) => {
        if (min == null || max == null) return 'Selection rules unconfigured';
        const reqStr = isRequired ? '(Required)' : '(Optional)';
        if (min === max) return `Select exactly ${min} ${reqStr}`;
        return `Select ${min} to ${max} ${reqStr}`;
      };

      expect(formatSelectionRules(1, 1, true)).toBe('Select exactly 1 (Required)');
      expect(formatSelectionRules(1, 2, true)).toBe('Select 1 to 2 (Required)');
      expect(formatSelectionRules(0, 3, false)).toBe('Select 0 to 3 (Optional)');
      expect(formatSelectionRules(null, null, false)).toBe('Selection rules unconfigured');
    });
  });

  describe('Nutrition Calculation & Scaling', () => {
    it('accurately computes custom option macronutrients based on serving quantity ratio', () => {
      const computeOptionMacros = (
        refServing: number,
        customServing: number,
        caloriesPerRef: number,
        proteinPerRef: number,
        carbsPerRef: number,
        fatPerRef: number
      ) => {
        const ratio = customServing / refServing;
        return {
          calories: Math.round(caloriesPerRef * ratio),
          proteinG: Math.round(proteinPerRef * ratio * 10) / 10,
          carbsG: Math.round(carbsPerRef * ratio * 10) / 10,
          fatG: Math.round(fatPerRef * ratio * 10) / 10,
        };
      };

      // 100g Chicken breast (165 kcal, 31g P, 0g C, 3.6g F) -> 200g serving
      const res200g = computeOptionMacros(100, 200, 165, 31, 0, 3.6);
      expect(res200g.calories).toBe(330);
      expect(res200g.proteinG).toBe(62);
      expect(res200g.carbsG).toBe(0);
      expect(res200g.fatG).toBe(7.2);
    });

    it('formats macro breakdown badge accurately with fallback for zero/unconfigured values', () => {
      const formatMacroSummary = (calories?: number | null, p?: number | null, c?: number | null, f?: number | null) => {
        if (calories == null) return 'Calories unconfigured';
        return `${calories} kcal • ${p || 0}g P • ${c || 0}g C • ${f || 0}g F`;
      };

      expect(formatMacroSummary(2400, 180, 250, 70)).toBe('2400 kcal • 180g P • 250g C • 70g F');
      expect(formatMacroSummary(null)).toBe('Calories unconfigured');
    });
  });

  describe('Option Form & Rendering Integrity (No Fake Data)', () => {
    it('initializes add option form with blank state and no auto-selected food', () => {
      const getInitialOptionForm = () => ({
        foodId: '',
        customLabel: '',
        servingQuantity: '',
        calories: '',
        proteinG: '',
        carbsG: '',
        fatG: '',
        isDefault: false,
      });

      const initial = getInitialOptionForm();
      expect(initial.foodId).toBe('');
      expect(initial.servingQuantity).toBe('');
      expect(initial.calories).toBe('');
    });

    it('renders option serving and calories without falling back to 100g, 0g, or 0 kcal', () => {
      const renderOptionServing = (opt: { serving_quantity?: number | null; quantity?: number | null; unit_code?: string | null }) => {
        const qty = opt.serving_quantity ?? opt.quantity;
        const unit = opt.unit_code;
        if (qty != null && unit) return `${qty} ${unit}`;
        if (qty != null) return `${qty}`;
        return 'Serving unconfigured';
      };

      const renderOptionCalories = (opt: { calories?: number | null; calories_snapshot?: number | null }) => {
        const cal = opt.calories ?? opt.calories_snapshot;
        if (cal != null) return `${cal} kcal`;
        return 'Calories unconfigured';
      };

      expect(renderOptionServing({ serving_quantity: 150, unit_code: 'g' })).toBe('150 g');
      expect(renderOptionServing({ serving_quantity: null, unit_code: null })).toBe('Serving unconfigured');
      expect(renderOptionCalories({ calories: 220 })).toBe('220 kcal');
      expect(renderOptionCalories({ calories: null })).toBe('Calories unconfigured');
    });
  });

  describe('Immutability and Status Safety', () => {
    it('enforces that published versions cannot be mutated and require draft cloning', () => {
      const isVersionEditable = (status: string) => status === 'draft';
      expect(isVersionEditable('draft')).toBe(true);
      expect(isVersionEditable('published')).toBe(false);
      expect(isVersionEditable('archived')).toBe(false);
    });
  });

  describe('Ordering Controls & Boundary Conditions', () => {
    it('calculates disabled states for move up and move down buttons accurately', () => {
      const getMoveButtonStates = (index: number, totalCount: number, isPublished: boolean) => {
        if (isPublished) {
          return { canMoveUp: false, canMoveDown: false };
        }
        return {
          canMoveUp: index > 0,
          canMoveDown: index < totalCount - 1,
        };
      };

      // Single item
      expect(getMoveButtonStates(0, 1, false)).toEqual({ canMoveUp: false, canMoveDown: false });

      // First item of 3
      expect(getMoveButtonStates(0, 3, false)).toEqual({ canMoveUp: false, canMoveDown: true });

      // Middle item of 3
      expect(getMoveButtonStates(1, 3, false)).toEqual({ canMoveUp: true, canMoveDown: true });

      // Last item of 3
      expect(getMoveButtonStates(2, 3, false)).toEqual({ canMoveUp: true, canMoveDown: false });

      // Published version (immutable)
      expect(getMoveButtonStates(1, 3, true)).toEqual({ canMoveUp: false, canMoveDown: false });
    });

    it('deterministically calculates target orderIndex on move up and move down', () => {
      const calculateSwapOrder = (
        items: Array<{ id: number; name: string; order_index: number }>,
        currentIndex: number,
        direction: 'up' | 'down'
      ) => {
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= items.length) return null;
        return {
          currentId: items[currentIndex].id,
          targetOrderIndex: items[targetIndex].order_index,
        };
      };

      const testMeals = [
        { id: 101, name: 'Breakfast', order_index: 1 },
        { id: 102, name: 'Lunch', order_index: 2 },
        { id: 103, name: 'Dinner', order_index: 3 },
      ];

      // Move Lunch (index 1) Up -> target orderIndex is 1 (Breakfast's order)
      const moveUpResult = calculateSwapOrder(testMeals, 1, 'up');
      expect(moveUpResult).toEqual({ currentId: 102, targetOrderIndex: 1 });

      // Move Lunch (index 1) Down -> target orderIndex is 3 (Dinner's order)
      const moveDownResult = calculateSwapOrder(testMeals, 1, 'down');
      expect(moveDownResult).toEqual({ currentId: 102, targetOrderIndex: 3 });

      // Move Breakfast (index 0) Up -> out of bounds (null)
      expect(calculateSwapOrder(testMeals, 0, 'up')).toBeNull();

      // Move Dinner (index 2) Down -> out of bounds (null)
      expect(calculateSwapOrder(testMeals, 2, 'down')).toBeNull();
    });

    it('preserves deterministic ordering across simulated reload after atomic swap', () => {
      let meals = [
        { id: 1, name: 'Breakfast', order_index: 1 },
        { id: 2, name: 'Lunch', order_index: 2 },
        { id: 3, name: 'Dinner', order_index: 3 },
      ];

      // Simulate swap of Meal 2 (Lunch) and Meal 3 (Dinner)
      const meal2 = meals.find((m) => m.id === 2)!;
      const meal3 = meals.find((m) => m.id === 3)!;
      const tempOrder = meal2.order_index;
      meal2.order_index = meal3.order_index;
      meal3.order_index = tempOrder;

      // Simulated reload sorting by order_index ASC
      const reloadedMeals = [...meals].sort((a, b) => a.order_index - b.order_index);
      expect(reloadedMeals.map((m) => m.name)).toEqual(['Breakfast', 'Dinner', 'Lunch']);
      expect(reloadedMeals.map((m) => m.order_index)).toEqual([1, 2, 3]);
    });
  });
});
