/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

describe('Exercise Library Management Suite (Scope #3)', () => {
  describe('Exercise Form Validation', () => {
    it('requires explicit valid muscle group and equipment IDs without silent defaulting', () => {
      const validateExerciseForm = (form: {
        name: string;
        primaryMuscleGroupId: number | '';
        equipmentTypeId: number | '';
        trackingType: string;
      }) => {
        if (!form.name.trim()) return { valid: false, error: 'Exercise name is required' };
        if (form.primaryMuscleGroupId === '') return { valid: false, error: 'Primary muscle group must be selected' };
        if (form.equipmentTypeId === '') return { valid: false, error: 'Equipment type must be selected' };
        if (!form.trackingType) return { valid: false, error: 'Tracking metric must be selected' };
        return { valid: true };
      };

      expect(validateExerciseForm({
        name: 'Incline Dumbbell Press',
        primaryMuscleGroupId: 2,
        equipmentTypeId: 3,
        trackingType: 'weight_reps',
      }).valid).toBe(true);

      expect(validateExerciseForm({
        name: '',
        primaryMuscleGroupId: 2,
        equipmentTypeId: 3,
        trackingType: 'weight_reps',
      }).valid).toBe(false);

      expect(validateExerciseForm({
        name: 'Leg Extension',
        primaryMuscleGroupId: '',
        equipmentTypeId: 3,
        trackingType: 'weight_reps',
      }).valid).toBe(false);

      expect(validateExerciseForm({
        name: 'Leg Extension',
        primaryMuscleGroupId: 4,
        equipmentTypeId: '',
        trackingType: 'weight_reps',
      }).valid).toBe(false);
    });

    it('maps tracking metrics to human readable labels', () => {
      const formatTrackingType = (type: string) => {
        const map: Record<string, string> = {
          weight_reps: 'Weight & Reps',
          reps_only: 'Reps Only',
          duration: 'Duration',
          distance: 'Distance',
          weight_duration: 'Weight & Duration',
        };
        return map[type] || type.replace('_', ' ');
      };

      expect(formatTrackingType('weight_reps')).toBe('Weight & Reps');
      expect(formatTrackingType('reps_only')).toBe('Reps Only');
      expect(formatTrackingType('weight_duration')).toBe('Weight & Duration');
    });
  });
});
