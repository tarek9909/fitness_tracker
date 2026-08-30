/**
 * Robust date and time formatting utilities for the Admin Dashboard.
 * Handles null/undefined, SQLite datetime strings ('YYYY-MM-DD HH:MM:SS'),
 * ISO 8601 strings, and prevents UTC day-shift or 'Invalid Date' errors.
 */

/**
 * Determines whether a given year, month, and day represent a valid calendar date,
 * strictly accounting for month lengths and leap-year rules.
 */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  // 30-day months: April (4), June (6), September (9), November (11)
  if ((month === 4 || month === 6 || month === 9 || month === 11) && day > 30) {
    return false;
  }
  // February: 29 days in leap years, 28 days otherwise
  if (month === 2) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const maxDays = isLeapYear ? 29 : 28;
    if (day > maxDays) {
      return false;
    }
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

export function formatDateOnly(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const trimmed = String(dateStr).trim();
  if (!trimmed || trimmed === 'Invalid Date' || trimmed === 'null' || trimmed === 'undefined') {
    return '—';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parts = trimmed.split('-').map(p => Number(p));
    if (!isValidCalendarDate(parts[0], parts[1], parts[2])) {
      return '—';
    }
    return trimmed;
  }
  try {
    let normalized = trimmed;
    if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
      const datePart = normalized.substring(0, 10);
      const parts = datePart.split('-').map(p => Number(p));
      if (!isValidCalendarDate(parts[0], parts[1], parts[2])) {
        return '—';
      }
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(normalized)) {
      normalized = normalized.replace(' ', 'T') + 'Z';
    }
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return '—';
    const formatted = d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    return formatted === 'Invalid Date' ? '—' : formatted;
  } catch {
    return '—';
  }
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const trimmed = String(dateStr).trim();
  if (!trimmed || trimmed === 'Invalid Date' || trimmed === 'null' || trimmed === 'undefined') {
    return '—';
  }
  try {
    let normalized = trimmed;
    if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
      const datePart = normalized.substring(0, 10);
      const parts = datePart.split('-').map(p => Number(p));
      if (!isValidCalendarDate(parts[0], parts[1], parts[2])) {
        return '—';
      }
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(normalized)) {
      normalized = normalized.replace(' ', 'T') + 'Z';
    }
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return '—';
    const formatted = d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return formatted === 'Invalid Date' ? '—' : formatted;
  } catch {
    return '—';
  }
}
