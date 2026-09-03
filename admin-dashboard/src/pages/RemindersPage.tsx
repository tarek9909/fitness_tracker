import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { parseBoundedInteger } from '../utils/number-utils';
import {
  Bell, Plus, Play, Trash2, Edit2, CheckCircle2,
  Clock, AlertCircle, X
} from 'lucide-react';
import {
  Card,
  Button,
  IconButton,
  Badge,
  Dialog,
  FormField,
  TextInput,
  NumberInput,
  Select,
  EmptyState,
  Skeleton,
  ErrorView,
  AlertBanner,
  Checkbox,
} from '../components/ui';

interface ReminderRule {
  id: number;
  title: string;
  name?: string;
  category: string;
  mode: string;
  trigger_mode?: string;
  fixed_time?: string | null;
  offset_minutes?: number | null;
  grace_period_minutes?: number;
  repeat_interval_minutes?: number | null;
  max_repeats?: number;
  active_window_start?: string | null;
  active_window_end?: string | null;
  is_active: number | boolean;
  message_template?: string | null;
  created_at: string;
}

export const RemindersPage: React.FC = () => {
  const [reminders, setReminders] = useState<ReminderRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingReminder, setEditingReminder] = useState<ReminderRule | null>(null);

  // Form State
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('water');
  const [mode, setMode] = useState<'fixed_time' | 'relative_to_task' | 'interval'>('fixed_time');
  const [fixedTime, setFixedTime] = useState<string>('');
  const [offsetMinutes, setOffsetMinutes] = useState<number | ''>(0);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState<number | ''>(15);
  const [repeatIntervalMinutes, setRepeatIntervalMinutes] = useState<number | ''>('');
  const [maxRepeats, setMaxRepeats] = useState<number | ''>('');
  const [activeWindowStart, setActiveWindowStart] = useState<string>('');
  const [activeWindowEnd, setActiveWindowEnd] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const data = await api.get<ReminderRule[]>('/admin/reminders');
      setReminders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load reminders' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const openCreateModal = () => {
    setEditingReminder(null);
    setTitle('');
    setCategory('water');
    setMode('fixed_time');
    setFixedTime('');
    setOffsetMinutes('');
    setGracePeriodMinutes('');
    setRepeatIntervalMinutes('');
    setMaxRepeats('');
    setActiveWindowStart('');
    setActiveWindowEnd('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (r: ReminderRule) => {
    setEditingReminder(r);
    setTitle(r.title || r.name || '');
    setCategory(r.category || 'water');
    setMode((r.mode || r.trigger_mode || 'fixed_time') as any);
    setFixedTime(r.fixed_time ? r.fixed_time.substring(0, 5) : '');
    setOffsetMinutes(r.offset_minutes ?? '');
    setGracePeriodMinutes(r.grace_period_minutes ?? '');
    setRepeatIntervalMinutes(r.repeat_interval_minutes ?? '');
    setMaxRepeats(r.max_repeats ?? '');
    setActiveWindowStart(r.active_window_start ? r.active_window_start.substring(0, 5) : '');
    setActiveWindowEnd(r.active_window_end ? r.active_window_end.substring(0, 5) : '');
    setIsActive(r.is_active === 1 || r.is_active === true);
    setModalOpen(true);
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a reminder title');
      return;
    }
    if (mode === 'fixed_time' && !fixedTime) {
      alert('Please specify a scheduled fixed time');
      return;
    }
    if (mode === 'relative_to_task' && (offsetMinutes === '' || isNaN(Number(offsetMinutes)))) {
      alert('Please specify offset minutes for relative task reminder');
      return;
    }
    if (mode === 'interval' && (repeatIntervalMinutes === '' || Number(repeatIntervalMinutes) < 1)) {
      alert('Please specify a valid repeat interval (minutes)');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: title.trim(),
        category,
        mode,
        fixedTime: mode === 'fixed_time' && fixedTime ? (fixedTime.length === 5 ? `${fixedTime}:00` : fixedTime) : null,
        offsetMinutes: mode === 'relative_to_task' && offsetMinutes !== '' ? Number(offsetMinutes) : null,
        gracePeriodMinutes: gracePeriodMinutes !== '' ? Number(gracePeriodMinutes) : null,
        repeatIntervalMinutes: mode === 'interval' && repeatIntervalMinutes !== '' ? Number(repeatIntervalMinutes) : null,
        maxRepeats: maxRepeats !== '' ? Number(maxRepeats) : null,
        activeWindowStart: activeWindowStart ? (activeWindowStart.length === 5 ? `${activeWindowStart}:00` : activeWindowStart) : null,
        activeWindowEnd: activeWindowEnd ? (activeWindowEnd.length === 5 ? `${activeWindowEnd}:00` : activeWindowEnd) : null,
        isActive,
      };

      if (editingReminder) {
        await api.put(`/admin/reminders/${editingReminder.id}`, payload);
        setFeedback({ type: 'success', message: 'Reminder rule updated successfully' });
      } else {
        await api.post('/admin/reminders', payload);
        setFeedback({ type: 'success', message: 'Reminder rule created successfully' });
      }

      setModalOpen(false);
      await fetchReminders();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save reminder rule' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: number, currentStatus: boolean | number) => {
    try {
      const nextStatus = !currentStatus;
      await api.patch(`/admin/reminders/${id}/toggle`, { isActive: nextStatus });
      setReminders(prev => prev.map(r => r.id === id ? { ...r, is_active: nextStatus } : r));
      setFeedback({ type: 'success', message: `Reminder ${nextStatus ? 'enabled' : 'disabled'}` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to toggle reminder' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this reminder rule?')) return;
    try {
      await api.delete(`/admin/reminders/${id}`);
      setReminders(prev => prev.filter(r => r.id !== id));
      setFeedback({ type: 'success', message: 'Reminder rule deleted' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete reminder' });
    }
  };

  const handleTriggerRun = async () => {
    try {
      setProcessing(true);
      const res = await api.post<any>('/admin/reminders/process');
      setFeedback({ 
        type: 'success', 
        message: `Evaluated ${res.processedRules || 0} rules, dispatched ${res.dispatchedNotifications || 0} notifications.` 
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to run reminder worker' });
    } finally {
      setProcessing(false);
    }
  };

  const renderScheduleDetails = (r: ReminderRule) => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Bell size={22} color="var(--accent-primary)" />
            <span>Reminder Rules Engine</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Configure and schedule automated nudges, hydration alerts, and workout reminders.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            onClick={handleTriggerRun}
            loading={processing}
            icon={<Play size={14} />}
          >
            Run Worker Now
          </Button>
          <Button
            variant="primary"
            onClick={openCreateModal}
            icon={<Plus size={16} />}
          >
            Create Reminder
          </Button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <AlertBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Reminders Table Card */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '1.5rem' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '1rem' }}>
                <Skeleton width="30%" height="20px" />
                <Skeleton width="15%" height="20px" />
                <Skeleton width="20%" height="20px" />
                <Skeleton width="15%" height="20px" />
              </div>
            ))}
          </div>
        ) : reminders.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <EmptyState
              icon={<Clock size={36} color="var(--text-muted)" />}
              title="No reminder rules configured"
              description="Establish an automated notification schedule for workouts, nutrition, or hydration nudges."
              action={
                <Button variant="primary" size="sm" onClick={openCreateModal} icon={<Plus size={14} />}>
                  Create Reminder
                </Button>
              }
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '0.875rem 1.25rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rule Name</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trigger Mode</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schedule / Details</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '0.875rem 1.25rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r) => {
                  const isAct = Boolean(r.is_active);
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                      <td style={{ padding: '0.875rem 1.25rem', fontWeight: 600 }}>
                        {r.title || r.name}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <Badge variant="info">
                          {r.category.toUpperCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <Badge variant="neutral">
                          {(r.mode || r.trigger_mode || '').replace('_', ' ')}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                        {renderScheduleDetails(r)}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => handleToggle(r.id, isAct)}
                          style={{ padding: 0 }}
                        >
                          <Badge variant={isAct ? 'success' : 'danger'}>
                            {isAct ? 'ACTIVE' : 'DISABLED'}
                          </Badge>
                        </Button>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <IconButton
                            icon={<Edit2 size={14} />}
                            label="Edit rule"
                            size="sm"
                            variant="secondary"
                            onClick={() => openEditModal(r)}
                          />
                          <IconButton
                            icon={<Trash2 size={14} />}
                            label="Delete rule"
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(r.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingReminder ? 'Edit Reminder Rule' : 'Create Reminder Rule'}
        description="Configure rule triggers, offset windows, and repeat intervals."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveReminder} loading={submitting}>
              {editingReminder ? 'Save Changes' : 'Create Rule'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveReminder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Rule Title" required>
            <TextInput
              required
              placeholder="e.g. Afternoon Hydration Nudge"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Category">
              <Select
                options={[
                  { value: 'water', label: 'Water' },
                  { value: 'workout', label: 'Workout' },
                  { value: 'meal', label: 'Meal' },
                  { value: 'weight', label: 'Weight Logging' },
                  { value: 'cardio', label: 'Cardio' },
                  { value: 'system', label: 'System / General' },
                ]}
                value={category}
                onChange={(val) => setCategory(val)}
              />
            </FormField>

            <FormField label="Trigger Mode">
              <Select
                options={[
                  { value: 'fixed_time', label: 'Fixed Time' },
                  { value: 'relative_to_task', label: 'Relative to Task' },
                  { value: 'interval', label: 'Recurring Interval' },
                ]}
                value={mode}
                onChange={(val) => setMode(val as any)}
              />
            </FormField>
          </div>

          {mode === 'fixed_time' && (
            <FormField label="Fixed Schedule Time (HH:MM:SS)" required>
              <TextInput
                type="time"
                step="1"
                required
                value={fixedTime}
                onChange={(e) => setFixedTime(e.target.value)}
              />
            </FormField>
          )}

          {mode === 'relative_to_task' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormField label="Offset Minutes" required>
                <NumberInput
                  value={offsetMinutes}
                  onChange={(val) => setOffsetMinutes(parseBoundedInteger(val, { min: -1440, max: 1440, fallback: 0 }))}
                />
              </FormField>
              <FormField label="Grace Period (Mins)">
                <NumberInput
                  value={gracePeriodMinutes}
                  onChange={(val) => setGracePeriodMinutes(parseBoundedInteger(val, { min: 0, max: 1440, fallback: 0 }))}
                />
              </FormField>
            </div>
          )}

          {mode === 'interval' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormField label="Interval (Mins)" required>
                <NumberInput
                  value={repeatIntervalMinutes}
                  onChange={(val) => setRepeatIntervalMinutes(parseBoundedInteger(val, { min: 1, max: 1440, fallback: 60 }))}
                />
              </FormField>
              <FormField label="Max Repeats">
                <NumberInput
                  value={maxRepeats}
                  onChange={(val) => setMaxRepeats(parseBoundedInteger(val, { min: 1, max: 100, fallback: 1 }))}
                />
              </FormField>
            </div>
          )}

          <div style={{ marginTop: '0.25rem' }}>
            <Checkbox
              id="isActiveToggle"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              label="Enable reminder rule immediately"
            />
          </div>
        </form>
      </Dialog>
    </div>
  );
};
