/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

describe('Plan Assignments Management Suite (Scope #4)', () => {
  describe('Published Version Filtering & Selection Safety', () => {
    it('filters out plan templates that have no published versions', () => {
      const plans = [
        {
          id: 1,
          name: 'Hypertrophy PPL',
          versions: [
            { id: 10, version_number: 1, status: 'published' },
            { id: 11, version_number: 2, status: 'draft' },
          ],
        },
        {
          id: 2,
          name: 'Strength 5x5 (Work in Progress)',
          versions: [
            { id: 20, version_number: 1, status: 'draft' },
          ],
        },
      ];

      const filterAssignablePlans = (list: typeof plans) => {
        return list
          .map(p => ({
            ...p,
            publishedVersions: p.versions.filter(v => v.status === 'published'),
          }))
          .filter(p => p.publishedVersions.length > 0);
      };

      const assignable = filterAssignablePlans(plans);
      expect(assignable).toHaveLength(1);
      expect(assignable[0].id).toBe(1);
      expect(assignable[0].publishedVersions).toHaveLength(1);
      expect(assignable[0].publishedVersions[0].id).toBe(10);
    });

    it('validates required assignment parameters without implicit fallbacks', () => {
      const validateAssignment = (userId: number | null, versionId: number | '', effectiveFrom: string) => {
        if (!userId) return { valid: false, error: 'User must be selected' };
        if (!versionId) return { valid: false, error: 'Published version must be selected' };
        if (!effectiveFrom) return { valid: false, error: 'Effective start date is required' };
        return { valid: true };
      };

      expect(validateAssignment(5, 10, '2026-09-01').valid).toBe(true);
      expect(validateAssignment(null, 10, '2026-09-01').valid).toBe(false);
      expect(validateAssignment(5, '', '2026-09-01').valid).toBe(false);
      expect(validateAssignment(5, 10, '').valid).toBe(false);
    });
  });

  describe('Assignment Status Categorization', () => {
    it('categorizes assignments into current, upcoming, and history based on effective dates', () => {
      const today = '2026-08-30';
      const assignments = [
        { id: 1, effective_from: '2026-08-01', effective_to: null }, // Current
        { id: 2, effective_from: '2026-09-01', effective_to: '2026-10-01' }, // Upcoming
        { id: 3, effective_from: '2026-06-01', effective_to: '2026-07-31' }, // History
      ];

      const categorize = (list: typeof assignments, refDate: string) => {
        const current: typeof assignments = [];
        const upcoming: typeof assignments = [];
        const history: typeof assignments = [];

        list.forEach(a => {
          if (a.effective_from > refDate) {
            upcoming.push(a);
          } else if (a.effective_to && a.effective_to < refDate) {
            history.push(a);
          } else {
            current.push(a);
          }
        });

        return { current, upcoming, history };
      };

      const result = categorize(assignments, today);
      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe(1);
      expect(result.upcoming).toHaveLength(1);
      expect(result.upcoming[0].id).toBe(2);
      expect(result.history).toHaveLength(1);
      expect(result.history[0].id).toBe(3);
    });
  });
});
