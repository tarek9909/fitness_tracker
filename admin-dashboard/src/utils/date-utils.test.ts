/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { formatDateOnly, formatDateTime, isValidCalendarDate } from './date-utils';

describe('Admin Dashboard Date & Time Utilities Suite', () => {
  describe('isValidCalendarDate', () => {
    it('validates leap years and non-leap years accurately', () => {
      expect(isValidCalendarDate(2024, 2, 29)).toBe(true);  // Standard leap year
      expect(isValidCalendarDate(2000, 2, 29)).toBe(true);  // 400-year leap year
      expect(isValidCalendarDate(2026, 2, 29)).toBe(false); // Non-leap year
      expect(isValidCalendarDate(1900, 2, 29)).toBe(false); // 100-year non-leap year
    });

    it('validates month length boundaries', () => {
      expect(isValidCalendarDate(2026, 2, 28)).toBe(true);
      expect(isValidCalendarDate(2026, 2, 31)).toBe(false);
      expect(isValidCalendarDate(2026, 4, 30)).toBe(true);
      expect(isValidCalendarDate(2026, 4, 31)).toBe(false);
      expect(isValidCalendarDate(2026, 6, 31)).toBe(false);
      expect(isValidCalendarDate(2026, 9, 31)).toBe(false);
      expect(isValidCalendarDate(2026, 11, 31)).toBe(false);
      expect(isValidCalendarDate(2026, 1, 31)).toBe(true);
      expect(isValidCalendarDate(2026, 12, 31)).toBe(true);
    });

    it('rejects out-of-range month and day values', () => {
      expect(isValidCalendarDate(2026, 0, 15)).toBe(false);
      expect(isValidCalendarDate(2026, 13, 15)).toBe(false);
      expect(isValidCalendarDate(2026, 5, 0)).toBe(false);
      expect(isValidCalendarDate(2026, 5, 32)).toBe(false);
    });
  });

  describe('formatDateOnly', () => {
    it('returns "—" for null, undefined, empty, and whitespace strings', () => {
      expect(formatDateOnly(null)).toBe('—');
      expect(formatDateOnly(undefined)).toBe('—');
      expect(formatDateOnly('')).toBe('—');
      expect(formatDateOnly('   ')).toBe('—');
      expect(formatDateOnly('null')).toBe('—');
      expect(formatDateOnly('undefined')).toBe('—');
    });

    it('preserves valid YYYY-MM-DD date-only strings without timezone displacement', () => {
      expect(formatDateOnly('2026-08-30')).toBe('2026-08-30');
      expect(formatDateOnly('2025-01-01')).toBe('2025-01-01');
      expect(formatDateOnly('2024-12-31')).toBe('2024-12-31');
    });

    it('rejects impossible calendar dates and invalid month lengths, returning "—"', () => {
      expect(formatDateOnly('2026-02-31')).toBe('—');
      expect(formatDateOnly('2026-04-31')).toBe('—');
      expect(formatDateOnly('2026-06-31')).toBe('—');
      expect(formatDateOnly('2026-09-31')).toBe('—');
      expect(formatDateOnly('2026-11-31')).toBe('—');
    });

    it('correctly handles leap years for date-only inputs', () => {
      expect(formatDateOnly('2024-02-29')).toBe('2024-02-29'); // Valid leap year
      expect(formatDateOnly('2000-02-29')).toBe('2000-02-29'); // 400-year leap year
      expect(formatDateOnly('2026-02-29')).toBe('—');          // Non-leap year
      expect(formatDateOnly('1900-02-29')).toBe('—');          // Century non-leap year
    });

    it('formats SQLite datetime strings ("YYYY-MM-DD HH:MM:SS") successfully', () => {
      const formatted = formatDateOnly('2026-08-30 14:30:00');
      expect(formatted).not.toBe('—');
      expect(formatted).not.toBe('Invalid Date');
      expect(formatted).toContain('2026');
    });

    it('formats valid ISO 8601 timestamps successfully', () => {
      const formatted = formatDateOnly('2026-08-30T14:30:00.000Z');
      expect(formatted).not.toBe('—');
      expect(formatted).not.toBe('Invalid Date');
      expect(formatted).toContain('2026');
    });

    it('never returns the literal "Invalid Date" for malformed inputs', () => {
      const malformedCases = [
        'Invalid Date',
        'not-a-valid-date',
        '2026-99-99',
        '2026-00-00',
        'abc123xyz',
        '{ badJson: true }',
        'NaN',
      ];
      for (const input of malformedCases) {
        const result = formatDateOnly(input);
        expect(result).not.toBe('Invalid Date');
        expect(result).toBe('—');
      }
    });
  });

  describe('formatDateTime', () => {
    it('returns "—" for null, undefined, empty, and whitespace strings', () => {
      expect(formatDateTime(null)).toBe('—');
      expect(formatDateTime(undefined)).toBe('—');
      expect(formatDateTime('')).toBe('—');
      expect(formatDateTime('   ')).toBe('—');
      expect(formatDateTime('null')).toBe('—');
      expect(formatDateTime('undefined')).toBe('—');
    });

    it('rejects impossible calendar dates in datetime strings, returning "—"', () => {
      expect(formatDateTime('2026-02-31 12:00:00')).toBe('—');
      expect(formatDateTime('2026-02-29 10:00:00')).toBe('—');
      expect(formatDateTime('2026-04-31 15:30:00')).toBe('—');
    });

    it('formats SQLite datetime strings ("YYYY-MM-DD HH:MM:SS") with date and time', () => {
      const formatted = formatDateTime('2026-08-30 14:30:00');
      expect(formatted).not.toBe('—');
      expect(formatted).not.toBe('Invalid Date');
      expect(formatted).toContain('2026');
    });

    it('formats valid ISO 8601 timestamps with date and time', () => {
      const formatted = formatDateTime('2026-08-30T14:30:00.000Z');
      expect(formatted).not.toBe('—');
      expect(formatted).not.toBe('Invalid Date');
      expect(formatted).toContain('2026');
    });

    it('never returns the literal "Invalid Date" for malformed inputs', () => {
      const malformedCases = [
        'Invalid Date',
        'not-a-valid-date',
        '2026-99-99 99:99:99',
        'abc123xyz',
        'NaN',
        'undefined',
      ];
      for (const input of malformedCases) {
        const result = formatDateTime(input);
        expect(result).not.toBe('Invalid Date');
        expect(result).toBe('—');
      }
    });
  });
});
