import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { formatDateTime, formatDateOnly } from '../utils/date-utils';
import {
  ShieldCheck, RefreshCw, Eye, X, Terminal, Users, Dumbbell,
  Droplets, HeartPulse, Scale, Utensils, TrendingUp, Calendar,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight, Activity, Filter, Award,
  Flame, Zap, BarChart3, Clock, AlertCircle
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'athlete' | 'audit'>('overview');
  const [timeframeDays, setTimeframeDays] = useState<number>(30);

  // Platform Overview State
  const [overview, setOverview] = useState<any | null>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Athletes List State
  const [athletes, setAthletes] = useState<any[]>([]);
  const [athletePage, setAthletePage] = useState<number>(1);
  const [athleteTotalPages, setAthleteTotalPages] = useState<number>(1);
  const [athleteTotal, setAthleteTotal] = useState<number>(0);
  const [loadingAthletes, setLoadingAthletes] = useState<boolean>(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<any | null>(null);
  const [loadingUserAnalytics, setLoadingUserAnalytics] = useState<boolean>(false);
  const [userAnalyticsError, setUserAnalyticsError] = useState<string | null>(null);

  // Audit Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditTotalPages, setAuditTotalPages] = useState<number>(1);
  const [auditTotal, setAuditTotal] = useState<number>(0);

  const fetchOverview = async (days = timeframeDays) => {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const data = await api.get(`/admin/analytics/overview?days=${days}`);
      setOverview(data);
    } catch (err: any) {
      setOverviewError(err.message || 'Failed to load platform analytics');
    } finally {
      setLoadingOverview(false);
    }
  };

  const fetchAthletes = async (p = athletePage) => {
    setLoadingAthletes(true);
    try {
      const data = await api.get<any>(`/admin/analytics/users?page=${p}&limit=50`);
      const rows = Array.isArray(data) ? data : (data?.data || []);
      setAthletes(rows);
      if (data?.pagination) {
        setAthleteTotal(data.pagination.total);
        setAthleteTotalPages(data.pagination.totalPages || 1);
      } else {
        setAthleteTotal(rows.length);
        setAthleteTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to fetch athletes summary:', err);
    } finally {
      setLoadingAthletes(false);
    }
  };

  const fetchUserAnalytics = async (userId: number, days = timeframeDays) => {
    setLoadingUserAnalytics(true);
    setUserAnalyticsError(null);
    try {
      const data = await api.get(`/admin/analytics/users/${userId}?days=${days}`);
      setUserAnalytics(data);
    } catch (err: any) {
      setUserAnalyticsError(err.message || 'Failed to load athlete analytics');
    } finally {
      setLoadingUserAnalytics(false);
    }
  };

  const fetchLogs = async (p = auditPage) => {
    setLoadingLogs(true);
    try {
      const res = await api.get<any>(`/admin/audit-logs?page=${p}&limit=25`);
      setLogs(Array.isArray(res) ? res : res?.data || []);
      if (res?.pagination) {
        setAuditTotal(res.pagination.total);
        setAuditTotalPages(res.pagination.totalPages || 1);
      } else {
        setAuditTotal(Array.isArray(res) ? res.length : 0);
        setAuditTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchOverview(timeframeDays);
    fetchLogs(1);
  }, []);

  useEffect(() => {
    fetchAthletes(athletePage);
  }, [athletePage]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchLogs(auditPage);
    }
  }, [auditPage, activeTab]);

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchOverview(timeframeDays);
    } else if (activeTab === 'athlete' && selectedUserId) {
      fetchUserAnalytics(selectedUserId, timeframeDays);
    }
  }, [timeframeDays]);

  useEffect(() => {
    if (activeTab === 'athlete' && selectedUserId) {
      fetchUserAnalytics(selectedUserId, timeframeDays);
    }
  }, [selectedUserId, activeTab]);

  const handleInspectLog = async (id: number) => {
    try {
      const detail = await api.get(`/admin/audit-logs/${id}`);
      setSelectedLog(detail);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={26} color="var(--accent-primary, #3b82f6)" />
            Fitness Analytics & Intelligence Center
          </h1>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.875rem', marginTop: '4px' }}>
            Authoritative platform-wide KPIs, adherence tracking, workout progression, and athlete performance metrics.
          </p>
        </div>

        {/* Global Controls: Timeframe Selector & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'inline-flex', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {[
              { label: '7D', value: 7 },
              { label: '30D', value: 30 },
              { label: '90D', value: 90 },
              { label: '1Y', value: 365 },
            ].map(tf => (
              <button
                key={tf.value}
                onClick={() => setTimeframeDays(tf.value)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: timeframeDays === tf.value ? 'var(--accent-primary, #3b82f6)' : 'transparent',
                  color: timeframeDays === tf.value ? '#fff' : 'var(--text-secondary, #94a3b8)',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (activeTab === 'overview') fetchOverview();
              else if (activeTab === 'athlete' && selectedUserId) fetchUserAnalytics(selectedUserId);
              else fetchLogs();
            }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={loadingOverview || loadingUserAnalytics || loadingLogs ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'overview' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            color: activeTab === 'overview' ? 'var(--accent-primary, #3b82f6)' : 'var(--text-secondary, #94a3b8)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <Activity size={16} /> Platform Overview & Trends
        </button>

        <button
          onClick={() => setActiveTab('athlete')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'athlete' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
            color: activeTab === 'athlete' ? '#c084fc' : 'var(--text-secondary, #94a3b8)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <Users size={16} /> Athlete Deep-Dive ({athleteTotal || athletes.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'audit' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
            color: activeTab === 'audit' ? '#4ade80' : 'var(--text-secondary, #94a3b8)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <ShieldCheck size={16} /> Audit Trail ({logs.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PLATFORM OVERVIEW & TRENDS */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loadingOverview ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
              <RefreshCw size={32} className="spin" style={{ marginBottom: '16px' }} />
              <p>Computing platform analytics & aggregates across {timeframeDays} days...</p>
            </div>
          ) : overviewError ? (
            <div style={{ padding: '24px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} />
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Failed to Load Analytics</h3>
              </div>
              <p style={{ marginTop: '6px', fontSize: '13px' }}>{overviewError}</p>
            </div>
          ) : overview ? (
            <>
              {/* Primary KPI Ribbon */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {/* Active Athletes */}
                <div style={{ background: 'var(--bg-secondary, #1e293b)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: '#38bdf8' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Athletes (Active/Total)</span>
                    <Users size={18} />
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc' }}>
                    {overview.activeUsers} <span style={{ fontSize: '14px', color: 'var(--text-secondary, #94a3b8)', fontWeight: 500 }}>/ {overview.totalUsers}</span>
                  </p>
                  <p style={{ fontSize: '12px', color: '#38bdf8', marginTop: '4px' }}>
                    {overview.totalUsers > 0 ? Math.round((overview.activeUsers / overview.totalUsers) * 100) : 0}% active status
                  </p>
                </div>

                {/* Workouts Performed */}
                <div style={{ background: 'var(--bg-secondary, #1e293b)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: '#60a5fa' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Completed Workouts</span>
                    <Dumbbell size={18} />
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc' }}>
                    {overview.completedWorkouts}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
                    {overview.activeWorkoutPlans} active workout plans
                  </p>
                </div>

                {/* Overall Platform Adherence */}
                <div style={{ background: 'var(--bg-secondary, #1e293b)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: '#4ade80' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Platform Adherence</span>
                    <TrendingUp size={18} />
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: (overview.platformAdherencePct || 0) >= 80 ? '#4ade80' : '#f59e0b' }}>
                    {overview.platformAdherencePct !== null ? `${overview.platformAdherencePct}%` : 'N/A'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
                    {overview.completedTasks} completed / {overview.evaluatedTasks} tasks
                  </p>
                </div>

                {/* Hydration Logged */}
                <div style={{ background: 'var(--bg-secondary, #1e293b)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: '#38bdf8' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Water Tracked</span>
                    <Droplets size={18} />
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc' }}>
                    {overview.totalWaterLiters} <span style={{ fontSize: '14px', color: 'var(--text-secondary, #94a3b8)' }}>Liters</span>
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
                    Past {timeframeDays} days intake
                  </p>
                </div>

                {/* Cardio Duration & Distance */}
                <div style={{ background: 'var(--bg-secondary, #1e293b)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: '#f43f5e' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Cardio Logged</span>
                    <HeartPulse size={18} />
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc' }}>
                    {overview.totalCardioMinutes} <span style={{ fontSize: '14px', color: 'var(--text-secondary, #94a3b8)' }}>mins</span>
                  </p>
                  <p style={{ fontSize: '12px', color: '#f43f5e', marginTop: '4px' }}>
                    {overview.totalCardioDistanceKm} km • {overview.totalCardioSessions} sessions
                  </p>
                </div>
              </div>

              {/* Adherence by Module Category */}
              <div style={{
                background: 'var(--bg-secondary, #1e293b)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={18} color="var(--accent-primary, #3b82f6)" /> Adherence Distribution by Discipline ({timeframeDays}-Day Window)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  {Object.entries(overview.adherenceBreakdown || {}).map(([key, stat]: [string, any]) => {
                    const colors: Record<string, string> = {
                      workout: '#38bdf8',
                      diet: '#4ade80',
                      cardio: '#f43f5e',
                      water: '#60a5fa',
                      weight: '#fbbf24',
                    };
                    const color = colors[key] || '#a855f7';

                    return (
                      <div key={key} style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '10px', border: `1px solid ${color}33` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textTransform: 'capitalize', fontWeight: 600, fontSize: '13px', color }}>
                          <span>{key} Tasks</span>
                          <span>{stat.ratePct}%</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                          <div style={{ width: `${stat.ratePct}%`, height: '100%', background: color }} />
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '8px' }}>
                          {stat.completed} completed of {stat.total} scheduled
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Two Column: Daily Trends Table + Live Activity Stream */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                {/* Daily Trends */}
                <div style={{
                  background: 'var(--bg-secondary, #1e293b)',
                  borderRadius: '16px',
                  padding: '24px',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} color="var(--accent-primary, #3b82f6)" /> Daily Timeline Activity ({overview.dailyTrends?.length || 0} active days)
                  </h3>

                  {(!overview.dailyTrends || overview.dailyTrends.length === 0) ? (
                    <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                      No daily logs recorded in this timeframe window.
                    </p>
                  ) : (
                    <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary, #94a3b8)' }}>
                            <th style={{ padding: '8px' }}>Date</th>
                            <th style={{ padding: '8px' }}>Adherence</th>
                            <th style={{ padding: '8px' }}>Workouts</th>
                            <th style={{ padding: '8px' }}>Water</th>
                            <th style={{ padding: '8px' }}>Cardio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.dailyTrends.map((dt: any) => (
                            <tr key={dt.date} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                              <td style={{ padding: '8px', fontWeight: 600 }}>{dt.date}</td>
                              <td style={{ padding: '8px' }}>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: dt.adherencePct >= 80 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                  color: dt.adherencePct >= 80 ? '#4ade80' : '#f59e0b',
                                }}>
                                  {dt.adherencePct}% ({dt.completedTasks}/{dt.totalTasks})
                                </span>
                              </td>
                              <td style={{ padding: '8px' }}>{dt.workoutsCompleted > 0 ? `🏋️ ${dt.workoutsCompleted}` : '—'}</td>
                              <td style={{ padding: '8px' }}>{dt.waterMl > 0 ? `${dt.waterMl} ml` : '—'}</td>
                              <td style={{ padding: '8px' }}>{dt.cardioMinutes > 0 ? `${dt.cardioMinutes}m` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Live Recent Activity Stream */}
                <div style={{
                  background: 'var(--bg-secondary, #1e293b)',
                  borderRadius: '16px',
                  padding: '24px',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={18} color="#fbbf24" /> Live Platform Activity Feed
                  </h3>

                  {(!overview.recentActivity || overview.recentActivity.length === 0) ? (
                    <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                      No recent platform activities recorded yet.
                    </p>
                  ) : (
                    <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {overview.recentActivity.map((act: any, idx: number) => {
                        const icons: Record<string, any> = {
                          workout: <Dumbbell size={15} color="#38bdf8" />,
                          cardio: <HeartPulse size={15} color="#f43f5e" />,
                          weight: <Scale size={15} color="#fbbf24" />,
                        };

                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              background: 'rgba(0, 0, 0, 0.2)',
                              fontSize: '12px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {icons[act.type] || <Activity size={15} color="#3b82f6" />}
                              <div>
                                <p style={{ fontWeight: 600, color: '#f8fafc' }}>
                                  {act.first_name} {act.last_name || ''} • <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>{act.title}</span>
                                </p>
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
                                  {act.session_date}
                                </p>
                              </div>
                            </div>
                            <span style={{ textTransform: 'capitalize', fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
                              {formatDateTime(act.timestamp)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ATHLETE DEEP-DIVE FITNESS ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === 'athlete' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Athlete Selector Bar */}
          <div style={{
            background: 'var(--bg-secondary, #1e293b)',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Select Athlete:</label>
              <select
                value={selectedUserId || ''}
                onChange={e => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <option value="">-- Choose Athlete --</option>
                {athletes.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.first_name} {a.last_name || ''} ({a.email}) — {a.adherencePct}% Adherence
                  </option>
                ))}
              </select>
            </div>

            {userAnalytics?.user && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>
                Timezone: {userAnalytics.user.timezone} • Status: <strong style={{ color: userAnalytics.user.status === 'active' ? '#4ade80' : '#f87171' }}>{userAnalytics.user.status}</strong>
              </div>
            )}
          </div>

          {athleteTotalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              color: 'var(--text-secondary, #94a3b8)',
              fontSize: '12px',
            }}>
              <span>{loadingAthletes ? 'Loading athletes...' : `Page ${athletePage} of ${athleteTotalPages} (${athleteTotal} total athletes)`}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={loadingAthletes || athletePage <= 1}
                  onClick={() => {
                    setSelectedUserId(null);
                    setUserAnalytics(null);
                    setAthletePage(athletePage - 1);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: loadingAthletes || athletePage <= 1 ? 'rgba(255, 255, 255, 0.2)' : '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: loadingAthletes || athletePage <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                  }}
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <button
                  disabled={loadingAthletes || athletePage >= athleteTotalPages}
                  onClick={() => {
                    setSelectedUserId(null);
                    setUserAnalytics(null);
                    setAthletePage(athletePage + 1);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: loadingAthletes || athletePage >= athleteTotalPages ? 'rgba(255, 255, 255, 0.2)' : '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: loadingAthletes || athletePage >= athleteTotalPages ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

          {!selectedUserId ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)', background: 'var(--bg-secondary, #1e293b)', borderRadius: '12px', border: '1px dashed var(--border-color, rgba(255, 255, 255, 0.08))' }}>
              <Users size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>No Athlete Selected</h3>
              <p style={{ fontSize: '13px' }}>Select an athlete from the dropdown above to view performance, adherence, and progression curves.</p>
            </div>
          ) : loadingUserAnalytics ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
              <RefreshCw size={32} className="spin" style={{ marginBottom: '16px' }} />
              <p>Analyzing athlete metrics, progression curves, and logs...</p>
            </div>
          ) : userAnalyticsError ? (
            <div style={{ padding: '24px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} />
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Error Loading Athlete Analytics</h3>
              </div>
              <p style={{ marginTop: '6px', fontSize: '13px' }}>{userAnalyticsError}</p>
            </div>
          ) : userAnalytics ? (
            <>
              {/* Athlete KPI Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {/* Adherence */}
                <div style={{ background: 'var(--bg-secondary, #1e293b)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: '#a855f7' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Task Adherence</span>
                    <Award size={18} />
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: userAnalytics.adherence.overallPct >= 80 ? '#4ade80' : '#f59e0b' }}>
                    {userAnalytics.adherence.overallPct}%
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
                    {userAnalytics.adherence.completedTasks} completed / {userAnalytics.adherence.totalTasks} tasks
                  </p>
                </div>

                {/* Weight Goal & Progress */}
                <div style={{ background: 'var(--bg-secondary, #1e293b)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: '#fbbf24' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Weight Milestone</span>
                    <Scale size={18} />
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc' }}>
                    {userAnalytics.weight.currentWeightKg ? `${userAnalytics.weight.currentWeightKg} kg` : 'No logs'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
                    {userAnalytics.weight.targetWeightKg ? `Target: ${userAnalytics.weight.targetWeightKg} kg (${userAnalytics.weight.progressPct}% progress)` : 'No goal target set'}
                  </p>
                </div>

                {/* Workout Volume & Sets */}
                <div style={{ background: 'var(--bg-secondary, #1e293b)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: '#38bdf8' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Workout Tonnage</span>
                    <Dumbbell size={18} />
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc' }}>
                    {userAnalytics.workouts.totalVolumeKg.toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--text-secondary, #94a3b8)' }}>kg</span>
                  </p>
                  <p style={{ fontSize: '12px', color: '#38bdf8', marginTop: '4px' }}>
                    {userAnalytics.workouts.completedSessions} sessions • {userAnalytics.workouts.totalSets} completed sets
                  </p>
                </div>

                {/* Cardio Output */}
                <div style={{ background: 'var(--bg-secondary, #1e293b)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: '#f43f5e' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Cardio Duration</span>
                    <HeartPulse size={18} />
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc' }}>
                    {userAnalytics.cardio.totalMinutes} <span style={{ fontSize: '14px', color: 'var(--text-secondary, #94a3b8)' }}>mins</span>
                  </p>
                  <p style={{ fontSize: '12px', color: '#f43f5e', marginTop: '4px' }}>
                    {userAnalytics.cardio.totalDistanceKm} km • {userAnalytics.cardio.totalCalories} kcal burned
                  </p>
                </div>
              </div>

              {/* Exercise 1RM Progression Leaderboard */}
              <div style={{
                background: 'var(--bg-secondary, #1e293b)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flame size={18} color="#f97316" /> Strength & Exercise Progression (Estimated 1RM)
                </h3>

                {(!userAnalytics.exerciseProgression || userAnalytics.exerciseProgression.length === 0) ? (
                  <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '13px', padding: '16px' }}>
                    No completed exercise sets logged by this athlete yet.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary, #94a3b8)' }}>
                          <th style={{ padding: '10px' }}>Exercise</th>
                          <th style={{ padding: '10px' }}>Muscle Group</th>
                          <th style={{ padding: '10px' }}>Max Weight</th>
                          <th style={{ padding: '10px' }}>Est. 1RM</th>
                          <th style={{ padding: '10px' }}>Completed Sets</th>
                          <th style={{ padding: '10px' }}>Total Reps</th>
                          <th style={{ padding: '10px' }}>Sessions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userAnalytics.exerciseProgression.map((ep: any) => (
                          <tr key={ep.exercise_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            <td style={{ padding: '10px', fontWeight: 600, color: '#f8fafc' }}>{ep.exercise_name}</td>
                            <td style={{ padding: '10px', color: 'var(--text-secondary, #94a3b8)' }}>{ep.muscle_group || 'General'}</td>
                            <td style={{ padding: '10px', fontWeight: 700, color: '#38bdf8' }}>{ep.max_weight_kg} kg</td>
                            <td style={{ padding: '10px', fontWeight: 700, color: '#f97316' }}>{ep.estimated_one_rep_max ? `${ep.estimated_one_rep_max} kg` : '—'}</td>
                            <td style={{ padding: '10px' }}>{ep.total_sets_completed}</td>
                            <td style={{ padding: '10px' }}>{ep.total_reps}</td>
                            <td style={{ padding: '10px' }}>{ep.session_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Two Column Grid: Weight History & Hydration History */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                {/* Weight Entries */}
                <div style={{ background: 'var(--bg-secondary, #1e293b)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Scale size={16} color="#fbbf24" /> Weight Progression Log
                  </h3>
                  {userAnalytics.weight.history.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '13px', padding: '16px' }}>No weight measurements logged.</p>
                  ) : (
                    <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary, #94a3b8)' }}>
                            <th style={{ padding: '6px 8px' }}>Date</th>
                            <th style={{ padding: '6px 8px' }}>Weight</th>
                            <th style={{ padding: '6px 8px' }}>Source</th>
                            <th style={{ padding: '6px 8px' }}>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userAnalytics.weight.history.map((w: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                              <td style={{ padding: '6px 8px' }}>{w.measurement_date}</td>
                              <td style={{ padding: '6px 8px', fontWeight: 700, color: '#fbbf24' }}>{w.weight_kg} kg</td>
                              <td style={{ padding: '6px 8px', textTransform: 'capitalize' }}>{w.source}</td>
                              <td style={{ padding: '6px 8px', color: 'var(--text-secondary, #94a3b8)' }}>{w.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Hydration History */}
                <div style={{ background: 'var(--bg-secondary, #1e293b)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Droplets size={16} color="#60a5fa" /> Daily Hydration History (Target: {userAnalytics.water.targetMl} ml)
                  </h3>
                  {userAnalytics.water.dailyHistory.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '13px', padding: '16px' }}>No water intake logged.</p>
                  ) : (
                    <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary, #94a3b8)' }}>
                            <th style={{ padding: '6px 8px' }}>Date</th>
                            <th style={{ padding: '6px 8px' }}>Intake</th>
                            <th style={{ padding: '6px 8px' }}>Target Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userAnalytics.water.dailyHistory.map((we: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                              <td style={{ padding: '6px 8px' }}>{we.date}</td>
                              <td style={{ padding: '6px 8px', fontWeight: 700, color: '#60a5fa' }}>{we.totalMl} ml</td>
                              <td style={{ padding: '6px 8px' }}>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  background: we.targetMet ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                  color: we.targetMet ? '#4ade80' : '#f59e0b',
                                }}>
                                  {we.targetMet ? 'Target Met ✓' : `${Math.round((we.totalMl / userAnalytics.water.targetMl) * 100)}%`}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PLATFORM AUDIT TRAIL */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div style={{
          background: 'var(--bg-secondary, #1e293b)',
          borderRadius: '12px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))', backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
                <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary, #94a3b8)' }}>Timestamp</th>
                <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary, #94a3b8)' }}>Actor</th>
                <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary, #94a3b8)' }}>Action</th>
                <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary, #94a3b8)' }}>Entity Type</th>
                <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary, #94a3b8)' }}>Entity ID</th>
                <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary, #94a3b8)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.04))' }}>
                    <td style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)' }}>
                      {formatDateTime(log.created_at)}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>
                      {log.actor_email || 'System / Service'}
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: 'var(--accent-primary, #3b82f6)',
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: '#e2e8f0' }}>
                      {log.entity_type}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary, #94a3b8)' }}>
                      {log.entity_id || '—'}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleInspectLog(log.id)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: 'none',
                          color: 'var(--text-secondary, #94a3b8)',
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
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
                    No audit log entries recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {auditTotalPages > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary, #94a3b8)' }}>
              <span>Page {auditPage} of {auditTotalPages} ({auditTotal} total events)</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={auditPage <= 1}
                  onClick={() => setAuditPage(auditPage - 1)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: auditPage <= 1 ? 'rgba(255, 255, 255, 0.2)' : '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: auditPage <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Prev
                </button>
                <button
                  disabled={auditPage >= auditTotalPages}
                  onClick={() => setAuditPage(auditPage + 1)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: auditPage >= auditTotalPages ? 'rgba(255, 255, 255, 0.2)' : '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: auditPage >= auditTotalPages ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Detail Modal */}
      {selectedLog && (
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
            maxWidth: '650px',
            width: '100%',
            padding: '24px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={18} color="var(--accent-primary, #3b82f6)" />
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Audit Event #{selectedLog.id}</h2>
              </div>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
              <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><strong>Action:</strong> {selectedLog.action}</div>
                <div><strong>Entity Type:</strong> {selectedLog.entity_type}</div>
                <div><strong>Entity ID:</strong> {selectedLog.entity_id || '—'}</div>
                <div><strong>Actor:</strong> {selectedLog.actor_email || 'System'}</div>
                <div><strong>Timestamp:</strong> {formatDateTime(selectedLog.created_at)}</div>
                <div><strong>IP Address:</strong> {selectedLog.ip_address || '—'}</div>
                {selectedLog.request_id && <div style={{ gridColumn: 'span 2' }}><strong>Request ID:</strong> {selectedLog.request_id}</div>}
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>Metadata / Payload</h4>
                <pre style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#38bdf8',
                  overflowX: 'auto',
                  maxHeight: '200px',
                }}>
                  {JSON.stringify(selectedLog.parsedMetadata || selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>

              {selectedLog.before_data && (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>Before State</h4>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f87171',
                    overflowX: 'auto',
                  }}>
                    {selectedLog.before_data}
                  </pre>
                </div>
              )}

              {selectedLog.after_data && (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>After State</h4>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#4ade80',
                    overflowX: 'auto',
                  }}>
                    {selectedLog.after_data}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
