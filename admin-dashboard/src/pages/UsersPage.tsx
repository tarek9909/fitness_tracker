import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { formatDateOnly } from '../utils/date-utils';
import { Users, UserPlus, Shield, UserCheck, ChevronRight } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  SearchInput,
  Select,
  Dialog,
  FormField,
  TextInput,
  NumberInput,
  Pagination,
  EmptyState,
  ErrorView,
  Skeleton,
} from '../components/ui';

interface UsersPageProps {
  onSelectUser?: (userId: number) => void;
}

export const UsersPage: React.FC<UsersPageProps> = ({ onSelectUser }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    roleId: 3,
    heightCm: '' as number | '',
    timezone: 'UTC',
  });

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.append('search', search.trim());
      if (statusFilter) q.append('status', statusFilter);
      if (roleFilter) q.append('role', roleFilter);
      q.append('page', String(page));
      q.append('limit', '20');

      const res = await api.get<any>(`/admin/users?${q.toString()}`);
      setUsers(Array.isArray(res) ? res : res?.data || res?.users || []);
      if (res?.pagination) {
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages || 1);
      } else {
        setTotal(Array.isArray(res) ? res.length : 0);
        setTotalPages(1);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load users directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, statusFilter, roleFilter, page]);

  const handleOpenCreateModal = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      roleId: 3,
      heightCm: '',
      timezone: 'UTC',
    });
    setShowModal(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.password.trim()) {
      alert('Please fill all required account fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        roleId: Number(formData.roleId),
        timezone: formData.timezone || 'UTC',
      };
      if (formData.heightCm !== '') {
        payload.heightCm = Number(formData.heightCm);
      }

      await api.post('/admin/users', payload);
      setShowModal(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to create user account');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (userId: number, currentStatus: string) => {
    const action = currentStatus === 'active' ? 'disable' : 'enable';
    try {
      await api.post(`/admin/users/${userId}/${action}`);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const getRoleBadgeVariant = (roleName: string): 'info' | 'neutral' | 'success' => {
    switch (roleName?.toLowerCase()) {
      case 'super_admin':
        return 'info';
      case 'admin':
        return 'info';
      default:
        return 'neutral';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Users & Clients Directory</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Manage client profiles, administrative roles, monitoring dossiers, and credentials.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenCreateModal} icon={<UserPlus size={16} />}>
          Add New Account
        </Button>
      </div>

      {/* Filter Bar */}
      <Card style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ minWidth: '240px', flex: 1, maxWidth: '360px' }}>
          <SearchInput
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '150px' }}>
            <Select
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'active', label: 'Active' },
                { value: 'disabled', label: 'Disabled' },
              ]}
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1); }}
              placeholder="Status"
              ariaLabel="Filter by status"
            />
          </div>

          <div style={{ minWidth: '150px' }}>
            <Select
              options={[
                { value: '', label: 'All Roles' },
                { value: 'client', label: 'Client (Athlete)' },
                { value: 'admin', label: 'Admin' },
                { value: 'super_admin', label: 'Super Admin' },
              ]}
              value={roleFilter}
              onChange={(val) => { setRoleFilter(val); setPage(1); }}
              placeholder="Role"
              ariaLabel="Filter by role"
            />
          </div>
        </div>
      </Card>

      {/* Users Table / Grid Card */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '1.5rem' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '1rem' }}>
                <Skeleton width="30%" height="20px" />
                <Skeleton width="15%" height="20px" />
                <Skeleton width="15%" height="20px" />
                <Skeleton width="20%" height="20px" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: '2rem' }}>
            <ErrorView message={error} onRetry={fetchUsers} />
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <EmptyState
              icon={<Users size={36} color="var(--text-muted)" />}
              title={search || statusFilter || roleFilter ? 'No matching users found' : 'No users registered yet'}
              description="Adjust your search filters or add a new athlete account to get started."
              action={
                <Button variant="primary" size="sm" onClick={handleOpenCreateModal} icon={<UserPlus size={14} />}>
                  Add Account
                </Button>
              }
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '0.875rem 1.25rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Profile</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Height</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registered</th>
                  <th style={{ padding: '0.875rem 1.25rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background var(--transition-fast)',
                    }}
                    className="table-row-hover"
                  >
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => onSelectUser && onSelectUser(user.id)}
                        style={{
                          textAlign: 'left',
                          display: 'block',
                          textDecoration: 'none',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {user.firstName || user.first_name} {user.lastName || user.last_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {user.email}
                        </div>
                      </Button>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <Badge variant={getRoleBadgeVariant(user.roleName || user.role_name || user.role)}>
                        {(user.roleName || user.role_name || user.role || 'client').replace('_', ' ').toUpperCase()}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <Badge variant={user.status === 'active' ? 'success' : 'danger'}>
                        {user.status === 'active' ? 'ACTIVE' : 'DISABLED'}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>
                      {user.heightCm || user.height_cm ? `${user.heightCm || user.height_cm} cm` : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      {formatDateOnly(user.createdAt || user.created_at)}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        {onSelectUser && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onSelectUser(user.id)}
                          >
                            Dossier
                          </Button>
                        )}
                        <Button
                          variant={user.status === 'active' ? 'danger' : 'secondary'}
                          size="sm"
                          onClick={() => toggleStatus(user.id, user.status)}
                        >
                          {user.status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div style={{ padding: '0.5rem 1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </Card>

      {/* Create User Dialog */}
      <Dialog
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add New Account"
        description="Register a new athlete or administrator account in the platform."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateUser} loading={submitting}>
              Create Account
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="First Name" required>
              <TextInput
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="e.g. Alex"
              />
            </FormField>
            <FormField label="Last Name" required>
              <TextInput
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="e.g. Mercer"
              />
            </FormField>
          </div>

          <FormField label="Email Address" required>
            <TextInput
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="athlete@domain.com"
            />
          </FormField>

          <FormField label="Password" required helperText="Minimum 8 characters with at least one number and uppercase letter">
            <TextInput
              type="password"
              required
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Role Assignment">
              <Select
                options={[
                  { value: 3, label: 'Client (Athlete)' },
                  { value: 2, label: 'Admin' },
                  { value: 1, label: 'Super Admin' },
                ]}
                value={formData.roleId}
                onChange={(val) => setFormData({ ...formData, roleId: Number(val) })}
              />
            </FormField>
            <FormField label="Height (cm, optional)">
              <NumberInput
                placeholder="e.g. 178"
                value={formData.heightCm}
                onChange={(val) => setFormData({ ...formData, heightCm: val })}
                min={50}
                max={280}
              />
            </FormField>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
