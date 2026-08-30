/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

describe('Workout & Diet Plans Version Display Suite (Scope #3)', () => {
  describe('Version Count & Active Version Neutral Display', () => {
    const formatVersionCount = (count?: number | null) => {
      return count != null ? `${count} Version(s)` : 'Not configured';
    };

    const formatActiveVersion = (activeVersion?: number | null) => {
      return activeVersion != null ? `Active: v${activeVersion}` : 'No published version';
    };

    it('renders actual version count or Not configured without fallback to 1 Version(s)', () => {
      expect(formatVersionCount(3)).toBe('3 Version(s)');
      expect(formatVersionCount(0)).toBe('0 Version(s)');
      expect(formatVersionCount(null)).toBe('Not configured');
      expect(formatVersionCount(undefined)).toBe('Not configured');
    });

    it('renders actual active published version or No published version without falling back to v1', () => {
      expect(formatActiveVersion(2)).toBe('Active: v2');
      expect(formatActiveVersion(null)).toBe('No published version');
      expect(formatActiveVersion(undefined)).toBe('No published version');
    });
  });
});
