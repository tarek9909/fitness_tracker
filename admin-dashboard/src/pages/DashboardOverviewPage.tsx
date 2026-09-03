import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Users, Dumbbell, Activity, CheckCircle2, RefreshCw, AlertCircle, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Card, Button, Badge, Skeleton, ErrorView } from '../components/ui';

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
      subValue: overview?.totalUsers !== undefined ? `of ${overview.totalUsers} registered` : 'Active platform clients',
      icon: Users,
      color: 'var(--accent-primary)',
      badgeVariant: 'success' as const,
      badge: overview?.activeUsers ? `${overview.activeUsers} currently active` : 'No active users',
    },
    {
      title: 'Completed Workouts',
      value: overview?.completedWorkouts !== undefined ? overview.completedWorkouts : '—',
      subValue: 'Total completed sessions',
      icon: Dumbbell,
      color: 'var(--accent-cyan)',
      badgeVariant: 'info' as const,
      badge: 'Aggregated volume',
    },
    {
      title: 'Published Workout Plans',
      value: overview?.activeWorkoutPlans !== undefined ? overview.activeWorkoutPlans : '—',
      subValue: 'Versioned immutable templates',
      icon: CheckCircle2,
      color: 'var(--accent-violet)',
      badgeVariant: 'neutral' as const,
      badge: 'Immutable templates',
    },
    {
      title: 'Platform Adherence',
      value: overview?.platformAdherencePct == null ? '—' : `${overview.platformAdherencePct}%`,
      subValue: `Trailing ${overview?.adherenceWindowDays || 30} days window`,
      icon: Activity,
      color: 'var(--accent-amber)',
      badgeVariant: 'warning' as const,
      badge: overview?.evaluatedTasks ? `${overview.evaluatedTasks} tasks scored` : 'No task data',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header Banner */}
      <div style={{
        padding: '2rem 2.25rem',
        borderRadius: 'var(--radius-xl)',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(56, 189, 248, 0.04) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--accent-primary)',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '0.5rem',
          }}>
            <ShieldCheck size={14} />
            <span>Platform State: Operational & Healthy</span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Fitness Platform Command Center
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem', maxWidth: '650px', lineHeight: 1.5 }}>
            Central operations for authoring workout and nutrition protocols, managing client assignments, and auditing compliance in real-time.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            onClick={() => onNavigate('workout-plans')}
            icon={<Dumbbell size={15} />}
          >
            Create Workout Plan
          </Button>
          <Button
            variant="secondary"
            onClick={() => onNavigate('diet-plans')}
          >
            Configure Diet
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} style={{ padding: '1.5rem', height: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Skeleton width="50%" height="16px" />
              <Skeleton width="40%" height="32px" />
              <Skeleton width="70%" height="14px" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorView
          title="Failed to Load Dashboard Metrics"
          message={error}
          onRetry={fetchStats}
        />
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
                <Card key={i} hover style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {stat.title}
                    </span>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: `color-mix(in srgb, ${stat.color} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${stat.color} 25%, transparent)`,
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
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {stat.subValue}
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Badge variant={stat.badgeVariant}>
                      {stat.badge}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Quick Action Navigation Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            <Card style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Client Management</h3>
                <ArrowUpRight size={16} color="var(--text-muted)" />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                View client registration roster, audit compliance, update individual water/cardio targets, and adjust adherence weights.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto', paddingTop: '0.75rem' }}>
                <Button variant="secondary" size="sm" onClick={() => onNavigate('users')}>
                  Users Directory
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onNavigate('assignments')}>
                  Plan Assignments
                </Button>
              </div>
            </Card>

            <Card style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Protocol Libraries</h3>
                <ArrowUpRight size={16} color="var(--text-muted)" />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Maintain resistance exercise database and nutritional food item catalog with validated measurements and tracking metrics.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto', paddingTop: '0.75rem' }}>
                <Button variant="secondary" size="sm" onClick={() => onNavigate('exercises')}>
                  Exercise Library
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onNavigate('foods')}>
                  Food Database
                </Button>
              </div>
            </Card>

            <Card style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Reminders & Dispatch</h3>
                <ArrowUpRight size={16} color="var(--text-muted)" />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Configure automated push reminder intervals and dispatch ad-hoc announcements with deep links to client devices.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto', paddingTop: '0.75rem' }}>
                <Button variant="secondary" size="sm" onClick={() => onNavigate('reminders')}>
                  Reminder Rules
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onNavigate('notifications')}>
                  Push Dispatch
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
