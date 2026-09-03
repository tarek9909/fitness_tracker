import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { formatDateTime } from '../utils/date-utils';
import { parsePositiveInteger } from '../utils/number-utils';
import {
  Send, Plus, Eye,
  CheckCircle2, AlertCircle, X
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Select,
  Dialog,
  FormField,
  TextInput,
  TextArea,
  Pagination,
  EmptyState,
  Skeleton,
  ErrorView,
  AlertBanner,
} from '../components/ui';

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
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (categoryFilter) params.set('category', categoryFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get<any>(`/admin/notifications?${params.toString()}`);
      setNotifications(res.notifications || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
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

  const totalPages = Math.ceil(total / 20) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Send size={22} color="var(--accent-primary)" />
            <span>Notifications & Dispatch Center</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Monitor in-app notifications, inspect delivery logs, and dispatch messages to users.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setComposeModalOpen(true)}
          icon={<Plus size={16} />}
        >
          Dispatch Message
        </Button>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <AlertBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Filter Row */}
      <Card style={{ padding: '0.875rem 1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '160px' }}>
          <Select
            options={[
              { value: '', label: 'All Categories' },
              { value: 'workout', label: 'Workout' },
              { value: 'meal', label: 'Meal' },
              { value: 'water', label: 'Water' },
              { value: 'cardio', label: 'Cardio' },
              { value: 'weight', label: 'Weight' },
              { value: 'progress', label: 'Progress' },
              { value: 'system', label: 'System' },
            ]}
            value={categoryFilter}
            onChange={(val) => { setCategoryFilter(val); setPage(1); }}
            placeholder="Category"
          />
        </div>

        <div style={{ minWidth: '160px' }}>
          <Select
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'unread', label: 'Unread' },
              { value: 'read', label: 'Read' },
              { value: 'dismissed', label: 'Dismissed' },
            ]}
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setPage(1); }}
            placeholder="Status"
          />
        </div>
      </Card>

      {/* Notifications Table Card */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '1.5rem' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '1rem' }}>
                <Skeleton width="25%" height="20px" />
                <Skeleton width="30%" height="20px" />
                <Skeleton width="15%" height="20px" />
                <Skeleton width="15%" height="20px" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: '2rem' }}>
            <ErrorView message={error} onRetry={fetchNotifications} />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <EmptyState
              icon={<Send size={36} color="var(--text-muted)" />}
              title="No notifications found"
              description="Adjust your filters or dispatch an announcement to athlete devices."
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '0.875rem 1.25rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recipient</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deliveries</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sent At</th>
                  <th style={{ padding: '0.875rem 1.25rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                    <td style={{ padding: '0.875rem 1.25rem', fontWeight: 600 }}>
                      {n.first_name} {n.last_name || ''}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{n.user_email}</div>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', maxWidth: '240px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.message}</div>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <Badge variant="info">
                        {n.category.toUpperCase()}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{n.notification_type}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <Badge variant={n.status === 'read' ? 'success' : 'warning'}>
                        {n.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-sm)' }}>
                        {n.delivery_count || 0} channels
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      {formatDateTime(n.created_at)}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleInspect(n.id)}
                        icon={<Eye size={13} />}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{ padding: '0.5rem 1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </Card>

      {/* Inspect Modal Dialog */}
      <Dialog
        isOpen={inspectModalOpen}
        onClose={() => setInspectModalOpen(false)}
        title="Notification & Delivery Details"
        description="Inspect broadcast payload, client recipient, and channel delivery receipts."
        footer={
          <Button variant="secondary" onClick={() => setInspectModalOpen(false)}>
            Close
          </Button>
        }
      >
        {loadingDetail || !inspectDetail ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <Skeleton width="60%" height="24px" style={{ margin: '0 auto 1rem' }} />
            <Skeleton width="100%" height="60px" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{inspectDetail.title}</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.5 }}>
                {inspectDetail.message}
              </p>
            </div>

            <div style={{ padding: '0.875rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-md)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', fontSize: '0.8125rem' }}>
              <div><strong style={{ color: 'var(--text-secondary)' }}>Recipient:</strong> {inspectDetail.first_name} {inspectDetail.last_name}</div>
              <div><strong style={{ color: 'var(--text-secondary)' }}>Email:</strong> {inspectDetail.user_email}</div>
              <div><strong style={{ color: 'var(--text-secondary)' }}>Category:</strong> {inspectDetail.category}</div>
              <div><strong style={{ color: 'var(--text-secondary)' }}>Status:</strong> {inspectDetail.status}</div>
              {inspectDetail.deep_link && <div style={{ gridColumn: 'span 2' }}><strong style={{ color: 'var(--text-secondary)' }}>Deep Link:</strong> {inspectDetail.deep_link}</div>}
            </div>

            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginTop: '0.5rem' }}>Channel Delivery Receipts</h4>
            {inspectDetail.deliveries.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No external delivery records found.</p>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <th style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>Channel</th>
                      <th style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>Status</th>
                      <th style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>Attempts</th>
                      <th style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectDetail.deliveries.map((d) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.5rem 0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>{d.channel}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <Badge variant={d.status === 'sent' || d.status === 'delivered' ? 'success' : 'danger'}>
                            {d.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{d.attempt_count}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>
                          {d.delivered_at || d.sent_at || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Compose Modal Dialog */}
      <Dialog
        isOpen={composeModalOpen}
        onClose={() => setComposeModalOpen(false)}
        title="Dispatch Notification"
        description="Broadcast an announcement or target an individual athlete profile."
        footer={
          <>
            <Button variant="secondary" onClick={() => setComposeModalOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSendNotification} loading={sending}>
              Send Notification
            </Button>
          </>
        }
      >
        <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Target User ID (Leave blank to Broadcast to All Active Users)">
            <TextInput
              type="number"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="e.g. 2 (or leave empty for broadcast)"
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Category">
              <Select
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'workout', label: 'Workout' },
                  { value: 'meal', label: 'Meal' },
                  { value: 'water', label: 'Water' },
                  { value: 'cardio', label: 'Cardio' },
                  { value: 'progress', label: 'Progress' },
                ]}
                value={composeCategory}
                onChange={(val) => setComposeCategory(val)}
              />
            </FormField>

            <FormField label="Type">
              <Select
                options={[
                  { value: 'system', label: 'System Message' },
                  { value: 'reminder', label: 'Reminder' },
                  { value: 'adherence', label: 'Adherence Nudge' },
                  { value: 'alert', label: 'Critical Alert' },
                ]}
                value={composeType}
                onChange={(val) => setComposeType(val as any)}
              />
            </FormField>
          </div>

          <FormField label="Notification Title" required>
            <TextInput
              required
              value={composeTitle}
              onChange={(e) => setComposeTitle(e.target.value)}
              placeholder="e.g. Protocol Schedule Update"
            />
          </FormField>

          <FormField label="Message Body" required>
            <TextArea
              required
              rows={3}
              value={composeMessage}
              onChange={(e) => setComposeMessage(e.target.value)}
              placeholder="Enter message content for recipient(s)..."
            />
          </FormField>

          <FormField label="Deep Link Route (Optional)">
            <TextInput
              value={composeDeepLink}
              onChange={(e) => setComposeDeepLink(e.target.value)}
              placeholder="e.g. /workout or /water"
            />
          </FormField>
        </form>
      </Dialog>
    </div>
  );
};
