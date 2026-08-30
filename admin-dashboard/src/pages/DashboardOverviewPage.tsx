import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Users, Dumbbell, Activity, CheckCircle2, TrendingUp, Sparkles, Clock, RefreshCw, AlertCircle } from 'lucide-react';

export const DashboardOverviewPage: React.FC<{ onNavigate: (tab: any) => void }> = ({ onNavigate }) => {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/admin/analytics/overview');
      setOverview(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load platform analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const stats = [
    {
      title: 'Active Users',
      value: overview?.activeUsers !== undefined ? overview.activeUsers : '—',
      subValue: overview?.totalUsers !== undefined ? `of ${overview.totalUsers} registered` : 'Active users in platform',
      icon: Users,
      color: 'var(--accent-primary)',
      badge: overview?.activeUsers ? 'Currently active' : 'No active users',
    },
    {
      title: 'Completed Workouts',
      value: overview?.completedWorkouts !== undefined ? overview.completedWorkouts : '—',
      subValue: 'Total logged sessions',
      icon: Dumbbell,
      color: 'var(--accent-cyan)',
      badge: 'Active volume',
    },
    {
      title: 'Published Workout Plans',
      value: overview?.activeWorkoutPlans !== undefined ? overview.activeWorkoutPlans : '—',
      subValue: 'Immutable plan templates',
      icon: CheckCircle2,
      color: 'var(--accent-violet)',
      badge: 'Versioned',
    },
    {
      title: 'Platform Adherence',
      value: overview?.platformAdherencePct == null ? '—' : `${overview.platformAdherencePct}%`,
      subValue: `Last ${overview?.adherenceWindowDays || 30} days`,
      icon: Activity,
      color: 'var(--accent-amber)',
      badge: overview?.evaluatedTasks ? `${overview.evaluatedTasks} tasks` : 'No task data',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Banner */}
      <div style={{
        padding: '2rem',
        borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            <Sparkles size={14} />
            <span>Platform Status: Authoritative & Operational</span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Fitness Platform Command Center
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem', maxWidth: '650px' }}>
            Manage workout and diet plan configurations, assign versioned protocols to clients, and monitor adherence in real-time.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => onNavigate('workout-plans')} className="btn btn-primary">
            <Dumbbell size={16} />
            <span>Create Workout Plan</span>
          </button>
          <button onClick={() => onNavigate('diet-plans')} className="btn btn-secondary">
            <span>Configure Diet</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
          <p>Loading command center metrics...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={32} color="var(--accent-rose)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Failed to Load Dashboard Metrics</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={fetchStats} className="btn btn-primary">
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      ) : (
        <>
          {/* KPI Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem',
          }}>
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{stat.title}</span>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: `color-mix(in srgb, ${stat.color} 15%, transparent)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Icon size={18} color={stat.color} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {stat.subValue}
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{stat.badge}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Action Navigation Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Client Management</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                View client registration roster, audit compliance, update individual water/cardio targets, and adjust adherence weights.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                <button onClick={() => onNavigate('users')} className="btn btn-secondary btn-sm">
                  <span>Users Directory</span>
                </button>
                <button onClick={() => onNavigate('assignments')} className="btn btn-secondary btn-sm">
                  <span>Plan Assignments</span>
                </button>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Protocol Libraries</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Maintain resistance exercise database and nutritional food item catalog with validated measurements and tracking metrics.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                <button onClick={() => onNavigate('exercises')} className="btn btn-secondary btn-sm">
                  <span>Exercise Library</span>
                </button>
                <button onClick={() => onNavigate('foods')} className="btn btn-secondary btn-sm">
                  <span>Food Database</span>
                </button>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Reminders & Dispatch</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Configure automated push reminder intervals and dispatch ad-hoc announcements with deep links to client devices.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                <button onClick={() => onNavigate('reminders')} className="btn btn-secondary btn-sm">
                  <span>Reminder Rules</span>
                </button>
                <button onClick={() => onNavigate('notifications')} className="btn btn-secondary btn-sm">
                  <span>Push Dispatch</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
