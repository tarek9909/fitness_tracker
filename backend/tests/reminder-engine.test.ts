import { describe, expect, it } from 'vitest';
import { evaluateReminderRule } from '../src/modules/notifications/reminder-engine.js';

describe('Reminder scheduling engine', () => {
  const base = { id: 7, category: 'water', trigger_mode: 'fixed_time' };

  it('does not dispatch a fixed-time reminder before its local schedule and deduplicates by date', () => {
    expect(evaluateReminderRule({ ...base, fixed_time: '08:00:00' }, {
      localDate: '2026-08-30', localTime: '07:59:59', weekday: 7,
    })).toBeNull();

    const occurrence = evaluateReminderRule({ ...base, fixed_time: '08:00:00' }, {
      localDate: '2026-08-30', localTime: '08:01:00', weekday: 7,
    });
    expect(occurrence?.dedupeKey).toBe('reminder:7:fixed:2026-08-30');
    expect(occurrence?.scheduledAt).toBe('2026-08-30 08:00:00');
  });

  it('honors weekday restrictions and interval repeat limits', () => {
    const rule = {
      ...base,
      trigger_mode: 'interval',
      repeat_interval_minutes: 60,
      max_repeats: 3,
      active_window_start: '08:00:00',
      active_window_end: '12:00:00',
      weekdays: [1, 2, 3, 4, 5],
    };
    expect(evaluateReminderRule(rule, { localDate: '2026-08-30', localTime: '09:00:00', weekday: 7 })).toBeNull();
    expect(evaluateReminderRule(rule, { localDate: '2026-08-31', localTime: '10:01:00', weekday: 1 })?.dedupeKey)
      .toBe('reminder:7:interval:2026-08-31:2');
    expect(evaluateReminderRule(rule, { localDate: '2026-08-31', localTime: '11:01:00', weekday: 1 })).toBeNull();
  });

  it('resolves relative reminders from the associated task and respects grace period', () => {
    const rule = {
      ...base,
      category: 'meal',
      trigger_mode: 'relative_to_task',
      offset_minutes: -15,
      grace_period_minutes: 20,
    };
    const task = { id: 42, task_type: 'meal', scheduled_at: '2026-08-30 12:00:00' };
    expect(evaluateReminderRule(rule, { localDate: '2026-08-30', localTime: '11:44:00', weekday: 7, task })).toBeNull();
    expect(evaluateReminderRule(rule, { localDate: '2026-08-30', localTime: '11:50:00', weekday: 7, task })?.dedupeKey)
      .toBe('reminder:7:relative:2026-08-30:42');
    expect(evaluateReminderRule(rule, { localDate: '2026-08-30', localTime: '12:10:00', weekday: 7, task })).toBeNull();
  });

  it('supports intervals that cross midnight', () => {
    const occurrence = evaluateReminderRule({
      ...base,
      trigger_mode: 'interval',
      repeat_interval_minutes: 60,
      max_repeats: 3,
      active_window_start: '22:00:00',
      active_window_end: '02:00:00',
    }, { localDate: '2026-08-31', localTime: '00:15:00', weekday: 1 });
    expect(occurrence?.scheduledAt).toBe('2026-08-31 00:00:00');
    expect(occurrence?.dedupeKey).toBe('reminder:7:interval:2026-08-31:2');
  });
});
