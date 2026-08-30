import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { parseBoundedInteger } from '../utils/number-utils';
import { 
  Bell, Plus, Play, Trash2, Edit2, CheckCircle2, 
  Clock, AlertCircle, RefreshCw, X 
} from 'lucide-react';

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

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={24} color="var(--accent-primary, #3b82f6)" />
            Reminder Rules Engine
          </h1>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '14px', marginTop: '4px' }}>
            Configure and schedule automated nudges, hydration alerts, and workout reminders.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleTriggerRun}
            disabled={processing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--accent-primary, #3b82f6)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: processing ? 'not-allowed' : 'pointer',
            }}
          >
            {processing ? <RefreshCw size={15} className="spin" /> : <Play size={15} />}
            Run Worker Now
          </button>
          <button
            onClick={openCreateModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'var(--accent-primary, #3b82f6)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            Create Reminder
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          background: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${feedback.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: feedback.type === 'success' ? '#4ade80' : '#f87171',
          fontSize: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Reminders Table */}
      <div style={{
        background: 'var(--bg-secondary, #1e293b)',
        borderRadius: '12px',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
            <p>Loading reminder rules...</p>
          </div>
        ) : reminders.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
            <Clock size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p style={{ fontSize: '16px', fontWeight: 600 }}>No reminder rules configured</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Click "Create Reminder" to establish an automated notification schedule.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Rule Name</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Category</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Trigger Mode</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Schedule / Details</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map(r => {
                const isAct = Boolean(r.is_active);
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.05))' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                      {r.title || r.name}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: 'var(--accent-primary, #3b82f6)',
                      }}>
                        {r.category}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#e2e8f0',
                      }}>
                        {r.mode || r.trigger_mode}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary, #94a3b8)', fontSize: '13px' }}>
                      {(r.mode || r.trigger_mode) === 'fixed_time' && (
                        <span>Fixed: {r.fixed_time ? r.fixed_time.substring(0, 5) : 'Not configured'}</span>
                      )}
                      {(r.mode || r.trigger_mode) === 'relative_to_task' && (
                        <span>
                          Offset: {r.offset_minutes != null ? `${r.offset_minutes}m` : 'Not configured'}
                          {r.grace_period_minutes != null ? ` (Grace: ${r.grace_period_minutes}m)` : ''}
                        </span>
                      )}
                      {(r.mode || r.trigger_mode) === 'interval' && (
                        <span>
                          Every {r.repeat_interval_minutes != null ? `${r.repeat_interval_minutes}m` : 'Not configured'}
                          {r.max_repeats != null ? ` (Max: ${r.max_repeats}x)` : ''}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => handleToggle(r.id, isAct)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: 'none',
                          background: isAct ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isAct ? '#4ade80' : '#f87171',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isAct ? '#22c55e' : '#ef4444' }} />
                        {isAct ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => openEditModal(r)}
                          style={{
                            padding: '6px',
                            borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: 'none',
                            color: 'var(--text-secondary, #94a3b8)',
                            cursor: 'pointer',
                          }}
                          title="Edit rule"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          style={{
                            padding: '6px',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                          }}
                          title="Delete rule"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '16px',
        }}>
          <div style={{
            background: 'var(--bg-secondary, #1e293b)',
            borderRadius: '16px',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
                {editingReminder ? 'Edit Reminder Rule' : 'Create Reminder Rule'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveReminder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Rule Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Afternoon Hydration Nudge"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                    color: '#fff',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                      color: '#fff',
                      fontSize: '14px',
                    }}
                  >
                    <option value="water">Water</option>
                    <option value="workout">Workout</option>
                    <option value="meal">Meal</option>
                    <option value="weight">Weight Logging</option>
                    <option value="cardio">Cardio</option>
                    <option value="system">System / General</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Trigger Mode</label>
                  <select
                    value={mode}
                    onChange={e => setMode(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                      color: '#fff',
                      fontSize: '14px',
                    }}
                  >
                    <option value="fixed_time">Fixed Time</option>
                    <option value="relative_to_task">Relative to Task</option>
                    <option value="interval">Recurring Interval</option>
                  </select>
                </div>
              </div>

              {mode === 'fixed_time' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Fixed Schedule Time (HH:MM:SS)</label>
                  <input
                    type="time"
                    step="1"
                    value={fixedTime}
                    onChange={e => setFixedTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                      color: '#fff',
                      fontSize: '14px',
                    }}
                  />
                </div>
              )}

              {mode === 'relative_to_task' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Offset Minutes</label>
                    <input
                      type="number"
                      value={offsetMinutes}
                      onChange={e => setOffsetMinutes(parseBoundedInteger(e.target.value, { min: -1440, max: 1440, fallback: 0 }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                        color: '#fff',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Grace Period (Mins)</label>
                    <input
                      type="number"
                      value={gracePeriodMinutes}
                      onChange={e => setGracePeriodMinutes(parseBoundedInteger(e.target.value, { min: 0, max: 1440, fallback: 0 }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                        color: '#fff',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                </div>
              )}

              {mode === 'interval' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Interval (Mins)</label>
                    <input
                      type="number"
                      value={repeatIntervalMinutes}
                      onChange={e => setRepeatIntervalMinutes(parseBoundedInteger(e.target.value, { min: 1, max: 1440, fallback: 60 }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                        color: '#fff',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Max Repeats</label>
                    <input
                      type="number"
                      value={maxRepeats}
                      onChange={e => setMaxRepeats(parseBoundedInteger(e.target.value, { min: 1, max: 100, fallback: 1 }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                        color: '#fff',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="isActiveToggle" style={{ fontSize: '14px', cursor: 'pointer' }}>
                  Enable reminder rule immediately
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-secondary, #94a3b8)',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: 'var(--accent-primary, #3b82f6)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {editingReminder ? 'Save Changes' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
