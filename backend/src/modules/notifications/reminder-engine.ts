export interface ReminderRule {
  id: number;
  category?: string | null;
  rule_scope?: string | null;
  user_id?: number | null;
  diet_meal_id?: number | null;
  workout_plan_day_id?: number | null;
  trigger_mode?: string | null;
  fixed_time?: string | null;
  offset_minutes?: number | null;
  repeat_interval_minutes?: number | null;
  max_repeats?: number | null;
  active_window_start?: string | null;
  active_window_end?: string | null;
  grace_period_minutes?: number | null;
  weekdays?: number[];
}

export interface ReminderTask {
  id: number;
  task_type: string;
  scheduled_at?: string | null;
  diet_meal_id?: number | null;
  workout_plan_day_id?: number | null;
}

export interface ReminderEvaluationContext {
  localDate: string;
  localTime: string;
  weekday: number;
  task?: ReminderTask | null;
  weekdays?: number[];
}

export interface ReminderOccurrence {
  dedupeKey: string;
  scheduledAt: string;
  occurrence: string;
}

function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatClock(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const minutes = (normalized % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:00`;
}

function isWithinWindow(current: number, start: number | null, end: number | null): boolean {
  if (start === null && end === null) return true;
  const from = start ?? 0;
  const to = end ?? 1439;
  if (from === to) return true;
  if (from < to) return current >= from && current <= to;
  return current >= from || current <= to;
}

function taskTime(task: ReminderTask | null | undefined): number | null {
  if (!task?.scheduled_at) return null;
  const value = String(task.scheduled_at);
  return parseClock(value.includes(' ') ? value.slice(value.lastIndexOf(' ') + 1) : value);
}

export function localTimeToMinutes(value: string): number {
  const parsed = parseClock(value);
  return parsed ?? 0;
}

export function isReminderApplicableToTask(rule: ReminderRule, task: ReminderTask | null | undefined): boolean {
  const category = rule.category === 'diet' ? 'meal' : rule.category;
  if (rule.rule_scope === 'meal' && rule.diet_meal_id && task?.diet_meal_id !== rule.diet_meal_id) return false;
  if (rule.rule_scope === 'workout_day' && rule.workout_plan_day_id && task?.workout_plan_day_id !== rule.workout_plan_day_id) return false;
  if (category && category !== 'system' && category !== 'general' && category !== 'meal' && category !== 'diet') {
    if (task && task.task_type !== category) return false;
  }
  return true;
}

export function evaluateReminderRule(
  rule: ReminderRule,
  context: ReminderEvaluationContext,
): ReminderOccurrence | null {
  if (rule.weekdays?.length && !rule.weekdays.includes(context.weekday)) return null;
  if (!isReminderApplicableToTask(rule, context.task)) return null;

  const now = localTimeToMinutes(context.localTime);
  const mode = rule.trigger_mode || 'fixed_time';
  const start = parseClock(rule.active_window_start);
  const end = parseClock(rule.active_window_end);

  if (mode === 'fixed_time') {
    const fixed = parseClock(rule.fixed_time);
    if (fixed === null || now < fixed || !isWithinWindow(now, start, end)) return null;
    return {
      dedupeKey: `reminder:${rule.id}:fixed:${context.localDate}`,
      scheduledAt: `${context.localDate} ${formatClock(fixed)}`,
      occurrence: `fixed:${context.localDate}`,
    };
  }

  if (mode === 'relative_to_task') {
    const taskScheduled = taskTime(context.task);
    if (taskScheduled === null) return null;
    const trigger = taskScheduled + (Number(rule.offset_minutes) || 0);
    if (now < trigger || !isWithinWindow(now, start, end)) return null;
    const grace = Number(rule.grace_period_minutes) || 0;
    if (grace > 0 && now > trigger + grace) return null;
    const taskIdentity = context.task?.id ?? context.task?.task_type ?? 'task';
    return {
      dedupeKey: `reminder:${rule.id}:relative:${context.localDate}:${taskIdentity}`,
      scheduledAt: `${context.localDate} ${formatClock(trigger)}`,
      occurrence: `relative:${context.localDate}:${taskIdentity}`,
    };
  }

  if (mode === 'interval') {
    const interval = Number(rule.repeat_interval_minutes);
    if (!Number.isInteger(interval) || interval <= 0) return null;
    const windowStart = start ?? 8 * 60;
    const windowEnd = end ?? 22 * 60;
    if (!isWithinWindow(now, start, end)) return null;
    const overnight = windowStart > windowEnd;
    if ((!overnight && (now < windowStart || now > windowEnd)) || (overnight && now < windowStart && now > windowEnd)) return null;
    const elapsed = overnight && now < windowStart
      ? 1440 - windowStart + now
      : now - windowStart;
    const slot = Math.floor(elapsed / interval);
    const maxRepeats = Math.max(1, Number(rule.max_repeats) || 1);
    if (slot >= maxRepeats) return null;
    const scheduledMinutes = windowStart + slot * interval;
    return {
      dedupeKey: `reminder:${rule.id}:interval:${context.localDate}:${slot}`,
      scheduledAt: `${context.localDate} ${formatClock(scheduledMinutes)}`,
      occurrence: `interval:${context.localDate}:${slot}`,
    };
  }

  return null;
}
