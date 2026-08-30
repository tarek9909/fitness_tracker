import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { formatDateTime } from '../utils/date-utils';
import { parsePositiveInteger } from '../utils/number-utils';
import { 
  Send, Plus, Eye, 
  CheckCircle2, AlertCircle, RefreshCw, X 
} from 'lucide-react';

interface NotificationItem {
  id: number;
  user_id: number;
  first_name?: string;
  last_name?: string;
  user_email?: string;
  category: string;
  notification_type: string;
  title: string;
  message: string;
  deep_link?: string | null;
  status: string;
  delivery_count?: number;
  created_at: string;
}

interface NotificationDetail extends NotificationItem {
  deliveries: {
    id: number;
    channel: string;
    status: string;
    attempt_count: number;
    sent_at: string | null;
    delivered_at: string | null;
    last_error: string | null;
  }[];
}

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [inspectModalOpen, setInspectModalOpen] = useState<boolean>(false);
  const [inspectDetail, setInspectDetail] = useState<NotificationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  const [composeModalOpen, setComposeModalOpen] = useState<boolean>(false);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [composeCategory, setComposeCategory] = useState<string>('system');
  const [composeType, setComposeType] = useState<'reminder' | 'system' | 'adherence' | 'alert'>('system');
  const [composeTitle, setComposeTitle] = useState<string>('');
  const [composeMessage, setComposeMessage] = useState<string>('');
  const [composeDeepLink, setComposeDeepLink] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (categoryFilter) params.set('category', categoryFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get<any>(`/admin/notifications?${params.toString()}`);
      setNotifications(res.notifications || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load notifications' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [page, categoryFilter, statusFilter]);

  const handleInspect = async (id: number) => {
    try {
      setLoadingDetail(true);
      setInspectModalOpen(true);
      const detail = await api.get<NotificationDetail>(`/admin/notifications/${id}`);
      setInspectDetail(detail);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load notification details' });
      setInspectModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTitle.trim() || !composeMessage.trim()) return;

    try {
      setSending(true);
      const payload: any = {
        category: composeCategory,
        notificationType: composeType,
        title: composeTitle,
        message: composeMessage,
        deepLink: composeDeepLink.trim() || null,
      };
      if (targetUserId.trim()) {
        const parsedUserId = parsePositiveInteger(targetUserId);
        if (!parsedUserId) {
          setFeedback({ type: 'error', message: 'Target User ID must be a valid positive integer' });
          setSending(false);
          return;
        }
        payload.userId = parsedUserId;
      }

      const res = await api.post<any>('/admin/notifications', payload);
      setFeedback({ type: 'success', message: res.message || 'Notification dispatched successfully' });
      setComposeModalOpen(false);
      setComposeTitle('');
      setComposeMessage('');
      setComposeDeepLink('');
      setTargetUserId('');
      await fetchNotifications();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to dispatch notification' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Send size={24} color="var(--accent-primary, #3b82f6)" />
            Notifications & Dispatch Center
          </h1>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '14px', marginTop: '4px' }}>
            Monitor in-app notifications, inspect delivery logs, and dispatch messages to users.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setComposeModalOpen(true)}
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
            Dispatch Message
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

      {/* Filter Row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'var(--bg-secondary, #1e293b)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            color: '#fff',
            fontSize: '13px',
          }}
        >
          <option value="">All Categories</option>
          <option value="workout">Workout</option>
          <option value="meal">Meal</option>
          <option value="water">Water</option>
          <option value="cardio">Cardio</option>
          <option value="weight">Weight</option>
          <option value="progress">Progress</option>
          <option value="system">System</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'var(--bg-secondary, #1e293b)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            color: '#fff',
            fontSize: '13px',
          }}
        >
          <option value="">All Statuses</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-secondary, #1e293b)',
        borderRadius: '12px',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
            <p>Loading notification logs...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
            <p style={{ fontSize: '16px', fontWeight: 600 }}>No notifications found</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary, #94a3b8)' }}>Recipient</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary, #94a3b8)' }}>Title</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary, #94a3b8)' }}>Category</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary, #94a3b8)' }}>Type</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary, #94a3b8)' }}>Status</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary, #94a3b8)' }}>Deliveries</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary, #94a3b8)' }}>Sent At</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary, #94a3b8)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map(n => (
                <tr key={n.id} style={{ borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.04))' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {n.first_name} {n.last_name || ''}
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', fontWeight: 400 }}>{n.user_email}</div>
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: '240px' }}>
                    <div style={{ fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.message}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--accent-primary, #3b82f6)',
                    }}>
                      {n.category}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{n.notification_type}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      background: n.status === 'read' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: n.status === 'read' ? '#4ade80' : '#f59e0b',
                    }}>
                      {n.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
                      {n.delivery_count || 0} channels
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary, #94a3b8)', fontSize: '12px' }}>
                    {formatDateTime(n.created_at)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleInspect(n.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: 'none',
                        color: 'var(--accent-primary, #3b82f6)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Eye size={13} /> Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Inspect Modal */}
      {inspectModalOpen && (
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
            maxWidth: '600px',
            width: '100%',
            padding: '24px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Notification & Delivery Details</h2>
              <button onClick={() => setInspectModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {loadingDetail || !inspectDetail ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
                <RefreshCw size={24} className="spin" />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>{inspectDetail.title}</h3>
                  <p style={{ color: 'var(--text-secondary, #94a3b8)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                    {inspectDetail.message}
                  </p>
                </div>

                <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                  <div><strong>Recipient:</strong> {inspectDetail.first_name} {inspectDetail.last_name}</div>
                  <div><strong>Email:</strong> {inspectDetail.user_email}</div>
                  <div><strong>Category:</strong> {inspectDetail.category}</div>
                  <div><strong>Status:</strong> {inspectDetail.status}</div>
                  {inspectDetail.deep_link && <div style={{ gridColumn: 'span 2' }}><strong>Deep Link:</strong> {inspectDetail.deep_link}</div>}
                </div>

                <h4 style={{ fontSize: '14px', fontWeight: 700, marginTop: '8px' }}>Delivery Logs</h4>
                {inspectDetail.deliveries.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '13px' }}>No external delivery records found.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                        <th style={{ padding: '8px', color: 'var(--text-secondary, #94a3b8)' }}>Channel</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary, #94a3b8)' }}>Status</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary, #94a3b8)' }}>Attempts</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary, #94a3b8)' }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspectDetail.deliveries.map(d => (
                        <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.04))' }}>
                          <td style={{ padding: '8px', textTransform: 'uppercase', fontWeight: 600 }}>{d.channel}</td>
                          <td style={{ padding: '8px', color: d.status === 'sent' || d.status === 'delivered' ? '#4ade80' : '#f87171' }}>{d.status}</td>
                          <td style={{ padding: '8px' }}>{d.attempt_count}</td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary, #94a3b8)' }}>
                            {d.delivered_at || d.sent_at || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {composeModalOpen && (
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
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Dispatch Notification</h2>
              <button onClick={() => setComposeModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Target User ID (Leave blank to Broadcast to All Active Users)
                </label>
                <input
                  type="number"
                  value={targetUserId}
                  onChange={e => setTargetUserId(e.target.value)}
                  placeholder="e.g. 2 (or leave empty for broadcast)"
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
                    value={composeCategory}
                    onChange={e => setComposeCategory(e.target.value)}
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
                    <option value="system">System</option>
                    <option value="workout">Workout</option>
                    <option value="meal">Meal</option>
                    <option value="water">Water</option>
                    <option value="cardio">Cardio</option>
                    <option value="progress">Progress</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Type</label>
                  <select
                    value={composeType}
                    onChange={e => setComposeType(e.target.value as any)}
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
                    <option value="system">System Message</option>
                    <option value="reminder">Reminder</option>
                    <option value="adherence">Adherence Nudge</option>
                    <option value="alert">Critical Alert</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Notification Title</label>
                <input
                  type="text"
                  value={composeTitle}
                  onChange={e => setComposeTitle(e.target.value)}
                  placeholder="e.g. Schedule Update"
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

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Message Body</label>
                <textarea
                  value={composeMessage}
                  onChange={e => setComposeMessage(e.target.value)}
                  placeholder="Enter message content for recipient(s)..."
                  required
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                    color: '#fff',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Deep Link Route (Optional)</label>
                <input
                  type="text"
                  value={composeDeepLink}
                  onChange={e => setComposeDeepLink(e.target.value)}
                  placeholder="e.g. /workout or /water"
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setComposeModalOpen(false)}
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
                  disabled={sending}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: 'var(--accent-primary, #3b82f6)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: sending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {sending ? 'Dispatching...' : 'Send Notification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
