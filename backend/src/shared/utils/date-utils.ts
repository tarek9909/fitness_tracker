/**
 * Date and timezone helper functions
 */

export function getUserLocalDate(timezone: string = 'UTC', date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // Returns YYYY-MM-DD
  } catch (error) {
    return date.toISOString().split('T')[0];
  }
}

export interface UserLocalDateTime {
  date: string;
  time: string;
  weekday: number;
}

export function getUserLocalDateTime(timezone: string = 'UTC', date: Date = new Date()): UserLocalDateTime {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const localDate = `${values.year}-${values.month}-${values.day}`;
    const localTime = `${values.hour}:${values.minute}:${values.second}`;
    return { date: localDate, time: localTime, weekday: getWeekdayNumber(localDate) };
  } catch {
    const localDate = date.toISOString().slice(0, 10);
    return { date: localDate, time: date.toISOString().slice(11, 19), weekday: getWeekdayNumber(localDate) };
  }
}

export function getWeekdayNumber(dateStr: string): number {
  // Returns 1 for Monday, 2 for Tuesday, ..., 7 for Sunday (ISO week)
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0 is Sunday, 1 is Monday...
  return day === 0 ? 7 : day;
}

export function formatDateToIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d;
  return d.toISOString();
}
