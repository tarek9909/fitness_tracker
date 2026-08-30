import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { formatDateOnly } from '../utils/date-utils';
import { Users, Search, UserPlus, Shield, Check, X, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

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
      setError(err.message || 'Failed to load users');
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

  const getRoleBadgeStyle = (roleName: string) => {
    switch (roleName?.toLowerCase()) {
      case 'super_admin':
        return { background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' };
      case 'admin':
        return { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' };
      default:
        return { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Users & Clients Directory</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage client profiles, administrative roles, monitoring dossiers, and account credentials.
          </p>
        </div>
        <button onClick={handleOpenCreateModal} className="btn btn-primary">
          <UserPlus size={16} />
          <span>Add New Account</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '350px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            className="select"
            style={{ width: 'auto', minWidth: '130px' }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            aria-label="Filter by Status"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>

          <select
            className="select"
            style={{ width: 'auto', minWidth: '130px' }}
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            aria-label="Filter by Role"
          >
            <option value="">All Roles</option>
            <option value="client">Client</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
            <p>Loading users directory...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <AlertCircle size={32} color="var(--accent-rose)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Failed to Load Users</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
            <button onClick={fetchUsers} className="btn btn-primary">
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <p>{search || statusFilter || roleFilter ? 'No matching users found.' : 'No users registered yet.'}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>User Profile</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Height</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Registered</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <button
                        onClick={() => onSelectUser && onSelectUser(user.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'left',
                          padding: 0,
                        }}
                      >
                        <div style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                          {user.firstName || user.first_name} {user.lastName || user.last_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
                          {user.email}
                        </div>
                      </button>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span
                        className="badge"
                        style={getRoleBadgeStyle(user.roleName || user.role_name || user.role)}
                      >
                        {(user.roleName || user.role_name || user.role || 'client').replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {user.status === 'active' ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>
                      {user.heightCm || user.height_cm ? `${user.heightCm || user.height_cm} cm` : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)' }}>
                      {formatDateOnly(user.createdAt || user.created_at)}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        {onSelectUser && (
                          <button
                            onClick={() => onSelectUser(user.id)}
                            className="btn btn-secondary btn-sm"
                          >
                            Dossier
                          </button>
                        )}
                        <button
                          onClick={() => toggleStatus(user.id, user.status)}
                          className={`btn btn-sm ${user.status === 'active' ? 'btn-danger' : 'btn-secondary'}`}
                        >
                          {user.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span>Page {page} of {totalPages} ({total} total accounts)</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-secondary btn-sm">
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="btn btn-secondary btn-sm">
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add New Account</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>First Name *</label>
                  <input
                    type="text"
                    className="input"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Last Name *</label>
                  <input
                    type="text"
                    className="input"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Email Address *</label>
                <input
                  type="email"
                  className="input"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Password *</label>
                <input
                  type="password"
                  className="input"
                  required
                  placeholder="Min 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Role Assignment</label>
                  <select
                    className="select"
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: Number(e.target.value) })}
                  >
                    <option value={3}>Client (Athlete)</option>
                    <option value={2}>Admin</option>
                    <option value={1}>Super Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Height (cm, optional)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 178"
                    value={formData.heightCm}
                    onChange={(e) => setFormData({ ...formData, heightCm: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
