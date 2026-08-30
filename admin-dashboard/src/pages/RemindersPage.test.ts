/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

describe('Reminders Rules & Schedule Rendering Suite (No Fake Data)', () => {
  describe('Schedule Display Neutral Rendering', () => {
    const formatSchedule = (r: {
      mode?: string;
      trigger_mode?: string;
      fixed_time?: string | null;
      offset_minutes?: number | null;
      grace_period_minutes?: number | null;
      repeat_interval_minutes?: number | null;
      max_repeats?: number | null;
    }) => {
      const m = r.mode || r.trigger_mode || 'fixed_time';
      if (m === 'fixed_time') {
        return `Fixed: ${r.fixed_time ? r.fixed_time.substring(0, 5) : 'Not configured'}`;
      }
      if (m === 'relative_to_task') {
        const offset = r.offset_minutes != null ? `${r.offset_minutes}m` : 'Not configured';
        const grace = r.grace_period_minutes != null ? ` (Grace: ${r.grace_period_minutes}m)` : '';
        return `Offset: ${offset}${grace}`;
      }
      if (m === 'interval') {
        const interval = r.repeat_interval_minutes != null ? `${r.repeat_interval_minutes}m` : 'Not configured';
        const max = r.max_repeats != null ? ` (Max: ${r.max_repeats}x)` : '';
        return `Every ${interval}${max}`;
      }
      return 'Not configured';
    };

    it('renders actual fixed time or Not configured without fallback to 09:00', () => {
      expect(formatSchedule({ mode: 'fixed_time', fixed_time: '14:30:00' })).toBe('Fixed: 14:30');
      expect(formatSchedule({ mode: 'fixed_time', fixed_time: null })).toBe('Fixed: Not configured');
      expect(formatSchedule({ mode: 'fixed_time' })).toBe('Fixed: Not configured');
    });

    it('renders actual relative offset or Not configured without inventing defaults', () => {
      expect(formatSchedule({ mode: 'relative_to_task', offset_minutes: 30, grace_period_minutes: 15 })).toBe('Offset: 30m (Grace: 15m)');
      expect(formatSchedule({ mode: 'relative_to_task', offset_minutes: null, grace_period_minutes: null })).toBe('Offset: Not configured');
    });

    it('renders actual interval and max repeats without inventing 60m / 1x defaults', () => {
      expect(formatSchedule({ mode: 'interval', repeat_interval_minutes: 45, max_repeats: 3 })).toBe('Every 45m (Max: 3x)');
      expect(formatSchedule({ mode: 'interval', repeat_interval_minutes: null, max_repeats: null })).toBe('Every Not configured');
    });
  });

  describe('Reminder Form Validation by Trigger Mode', () => {
    const validateReminderForm = (form: {
      title: string;
      mode: string;
      fixedTime: string;
      offsetMinutes: number | '';
      repeatIntervalMinutes: number | '';
    }) => {
      if (!form.title.trim()) return { valid: false, error: 'Please enter a reminder title' };
      if (form.mode === 'fixed_time' && !form.fixedTime) {
        return { valid: false, error: 'Please specify a scheduled fixed time' };
      }
      if (form.mode === 'relative_to_task' && (form.offsetMinutes === '' || isNaN(Number(form.offsetMinutes)))) {
        return { valid: false, error: 'Please specify offset minutes for relative task reminder' };
      }
      if (form.mode === 'interval' && (form.repeatIntervalMinutes === '' || Number(form.repeatIntervalMinutes) < 1)) {
        return { valid: false, error: 'Please specify a valid repeat interval (minutes)' };
      }
      return { valid: true };
    };

    it('validates fixed_time mode requires non-empty fixed time', () => {
      expect(validateReminderForm({ title: 'Morning Hydration', mode: 'fixed_time', fixedTime: '08:00', offsetMinutes: '', repeatIntervalMinutes: '' }).valid).toBe(true);
      expect(validateReminderForm({ title: 'Morning Hydration', mode: 'fixed_time', fixedTime: '', offsetMinutes: '', repeatIntervalMinutes: '' }).valid).toBe(false);
    });

    it('validates relative_to_task mode requires explicit offset minutes', () => {
      expect(validateReminderForm({ title: 'Pre Workout', mode: 'relative_to_task', fixedTime: '', offsetMinutes: -30, repeatIntervalMinutes: '' }).valid).toBe(true);
      expect(validateReminderForm({ title: 'Pre Workout', mode: 'relative_to_task', fixedTime: '', offsetMinutes: '', repeatIntervalMinutes: '' }).valid).toBe(false);
    });

    it('validates interval mode requires positive repeat interval', () => {
      expect(validateReminderForm({ title: 'Water Ping', mode: 'interval', fixedTime: '', offsetMinutes: '', repeatIntervalMinutes: 60 }).valid).toBe(true);
      expect(validateReminderForm({ title: 'Water Ping', mode: 'interval', fixedTime: '', offsetMinutes: '', repeatIntervalMinutes: 0 }).valid).toBe(false);
      expect(validateReminderForm({ title: 'Water Ping', mode: 'interval', fixedTime: '', offsetMinutes: '', repeatIntervalMinutes: '' }).valid).toBe(false);
    });
  });
});
