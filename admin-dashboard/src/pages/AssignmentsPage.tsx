import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { formatDateOnly } from '../utils/date-utils';
import { UserCheck, Plus, CheckCircle2, Dumbbell, Utensils, AlertCircle, RefreshCw, X, Calendar, Clock } from 'lucide-react';

export const AssignmentsPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [workoutAssignments, setWorkoutAssignments] = useState<any[]>([]);
  const [dietAssignments, setDietAssignments] = useState<any[]>([]);

  const [workoutPlansWithPublished, setWorkoutPlansWithPublished] = useState<any[]>([]);
  const [dietPlansWithPublished, setDietPlansWithPublished] = useState<any[]>([]);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showDietModal, setShowDietModal] = useState(false);

  const [selectedWorkoutVersionId, setSelectedWorkoutVersionId] = useState<number | ''>('');
  const [selectedDietVersionId, setSelectedDietVersionId] = useState<number | ''>('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [notes, setNotes] = useState('');

  const fetchInitialData = async () => {
    setLoadingInitial(true);
    setError(null);
    try {
      const [uRes, wPlans, dPlans] = await Promise.all([
        api.get<any>('/admin/users'),
        api.get<any[]>('/admin/workout-plans'),
        api.get<any[]>('/admin/diet-plans'),
      ]);

      const userList = Array.isArray(uRes) ? uRes : (uRes?.users || uRes?.data || []);
      setUsers(userList);

      // Fetch details for workout plans to extract ONLY published versions
      const wPlansDetails = await Promise.all(
        wPlans.map(async (p: any) => {
          try {
            const detail = await api.get<any>(`/admin/workout-plans/${p.id}`);
            const publishedVersions = (detail.versions || []).filter((v: any) => v.status === 'published');
            return {
              ...p,
              publishedVersions,
            };
          } catch {
            return { ...p, publishedVersions: [] };
          }
        })
      );
      // Filter out plans with no published versions
      setWorkoutPlansWithPublished(wPlansDetails.filter((p: any) => p.publishedVersions.length > 0));

      // Fetch details for diet plans to extract ONLY published versions
      const dPlansDetails = await Promise.all(
        dPlans.map(async (p: any) => {
          try {
            const detail = await api.get<any>(`/admin/diet-plans/${p.id}`);
            const publishedVersions = (detail.versions || []).filter((v: any) => v.status === 'published');
            return {
              ...p,
              publishedVersions,
            };
          } catch {
            return { ...p, publishedVersions: [] };
          }
        })
      );
      setDietPlansWithPublished(dPlansDetails.filter((p: any) => p.publishedVersions.length > 0));
    } catch (err: any) {
      setError(err.message || 'Failed to load initial assignment data');
    } finally {
      setLoadingInitial(false);
    }
  };

  const fetchUserAssignments = async (uId: number) => {
    setLoadingAssignments(true);
    try {
      const [wAssign, dAssign] = await Promise.all([
        api.get<any[]>(`/admin/users/${uId}/workout-assignments`),
        api.get<any[]>(`/admin/users/${uId}/diet-assignments`),
      ]);
      setWorkoutAssignments(Array.isArray(wAssign) ? wAssign : []);
      setDietAssignments(Array.isArray(dAssign) ? dAssign : []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load client assignments' });
    } finally {
      setLoadingAssignments(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserAssignments(selectedUserId);
    } else {
      setWorkoutAssignments([]);
      setDietAssignments([]);
    }
  }, [selectedUserId]);

  const handleOpenWorkoutModal = () => {
    setSelectedWorkoutVersionId('');
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setEffectiveTo('');
    setNotes('');
    setShowWorkoutModal(true);
  };

  const handleOpenDietModal = () => {
    setSelectedDietVersionId('');
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setEffectiveTo('');
    setNotes('');
    setShowDietModal(true);
  };

  const handleAssignWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      alert('Please select a client account first');
      return;
    }
    if (!selectedWorkoutVersionId) {
      alert('Please select a published workout plan version');
      return;
    }
    if (!effectiveFrom) {
      alert('Please enter an effective start date');
      return;
    }

    try {
      await api.post(`/admin/users/${selectedUserId}/workout-assignments`, {
        workoutPlanVersionId: Number(selectedWorkoutVersionId),
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
        notes: notes.trim() || undefined,
      });
      setShowWorkoutModal(false);
      setFeedback({ type: 'success', message: 'Workout plan version assigned successfully' });
      fetchUserAssignments(selectedUserId);
    } catch (err: any) {
      alert(err.message || 'Assignment failed');
    }
  };

  const handleAssignDiet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      alert('Please select a client account first');
      return;
    }
    if (!selectedDietVersionId) {
      alert('Please select a published diet protocol version');
      return;
    }
    if (!effectiveFrom) {
      alert('Please enter an effective start date');
      return;
    }

    try {
      await api.post(`/admin/users/${selectedUserId}/diet-assignments`, {
        dietPlanVersionId: Number(selectedDietVersionId),
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
        notes: notes.trim() || undefined,
      });
      setShowDietModal(false);
      setFeedback({ type: 'success', message: 'Diet protocol assigned successfully' });
      fetchUserAssignments(selectedUserId);
    } catch (err: any) {
      alert(err.message || 'Assignment failed');
    }
  };

  // Categorize assignments into current, upcoming, and history
  const categorizeAssignments = (assignments: any[]) => {
    const today = new Date().toISOString().split('T')[0];
    const current: any[] = [];
    const upcoming: any[] = [];
    const history: any[] = [];

    assignments.forEach((a) => {
      const from = a.effective_from || a.effectiveFrom || '';
      const to = a.effective_to || a.effectiveTo || '';

      if (from > today) {
        upcoming.push(a);
      } else if (to && to < today) {
        history.push(a);
      } else {
        current.push(a);
      }
    });

    return { current, upcoming, history };
  };

  const categorizedWorkouts = categorizeAssignments(workoutAssignments);
  const categorizedDiets = categorizeAssignments(dietAssignments);

  if (loadingInitial) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
        <p>Loading plan assignments center...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={32} color="var(--accent-rose)" style={{ marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Failed to Load Assignments</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
        <button onClick={fetchInitialData} className="btn btn-primary">
          <RefreshCw size={14} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Plan Assignments</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Assign authoritative published workout and diet protocols to active client profiles.
          </p>
        </div>
      </div>

      {feedback && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
          border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#f43f5e'}`,
          color: feedback.type === 'success' ? '#34d399' : '#fb7185',
          fontSize: '0.875rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Select Client Bar */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            Select Client:
          </label>
          <select
            className="select"
            value={selectedUserId || ''}
            onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
            aria-label="Select Client Account"
          >
            <option value="">-- Choose a Client Account --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} ({u.email})
              </option>
            ))}
          </select>
        </div>

        {selectedUserId && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleOpenWorkoutModal} className="btn btn-primary btn-sm">
              <Dumbbell size={14} />
              <span>Assign Workout</span>
            </button>
            <button onClick={handleOpenDietModal} className="btn btn-secondary btn-sm">
              <Utensils size={14} />
              <span>Assign Diet</span>
            </button>
          </div>
        )}
      </div>

      {!selectedUserId ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
          <UserCheck size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Client Selected</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Select a client account above to view active, upcoming, and past plan assignments.</p>
        </div>
      ) : loadingAssignments ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
          <p>Loading client assignments...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Workout Assignments Section */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
                <Dumbbell size={18} color="var(--accent-cyan)" />
                <span>Workout Plan Assignments</span>
              </div>
              <button onClick={handleOpenWorkoutModal} className="btn btn-primary btn-sm">
                <Plus size={12} />
                <span>Assign</span>
              </button>
            </div>

            {workoutAssignments.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No workout plans assigned to this client.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {categorizedWorkouts.current.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Active / Current ({categorizedWorkouts.current.length})
                    </div>
                    {categorizedWorkouts.current.map((a) => (
                      <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 700 }}>{a.plan_name || a.workout_name || 'Workout Plan'} (v{a.version_number || a.plan_version_number || '—'})</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          From: {formatDateOnly(a.effective_from || a.effectiveFrom)} {a.effective_to ? `• To: ${formatDateOnly(a.effective_to)}` : '• Ongoing'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {categorizedWorkouts.upcoming.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Upcoming ({categorizedWorkouts.upcoming.length})
                    </div>
                    {categorizedWorkouts.upcoming.map((a) => (
                      <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'rgba(6, 182, 212, 0.06)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 700 }}>{a.plan_name || a.workout_name || 'Workout Plan'} (v{a.version_number || a.plan_version_number || '—'})</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          Starts: {formatDateOnly(a.effective_from || a.effectiveFrom)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {categorizedWorkouts.history.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Past / History ({categorizedWorkouts.history.length})
                    </div>
                    {categorizedWorkouts.history.map((a) => (
                      <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', opacity: 0.75 }}>
                        <div style={{ fontWeight: 600 }}>{a.plan_name || a.workout_name || 'Workout Plan'} (v{a.version_number || a.plan_version_number || '—'})</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          {formatDateOnly(a.effective_from || a.effectiveFrom)} to {formatDateOnly(a.effective_to || a.effectiveTo)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Diet Assignments Section */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
                <Utensils size={18} color="var(--accent-amber)" />
                <span>Diet Protocol Assignments</span>
              </div>
              <button onClick={handleOpenDietModal} className="btn btn-secondary btn-sm">
                <Plus size={12} />
                <span>Assign</span>
              </button>
            </div>

            {dietAssignments.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No diet protocols assigned to this client.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {categorizedDiets.current.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Active / Current ({categorizedDiets.current.length})
                    </div>
                    {categorizedDiets.current.map((a) => (
                      <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 700 }}>{a.plan_name || a.diet_name || 'Diet Protocol'} (v{a.version_number || a.plan_version_number || '—'})</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          From: {formatDateOnly(a.effective_from || a.effectiveFrom)} {a.effective_to ? `• To: ${formatDateOnly(a.effective_to)}` : '• Ongoing'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {categorizedDiets.upcoming.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Upcoming ({categorizedDiets.upcoming.length})
                    </div>
                    {categorizedDiets.upcoming.map((a) => (
                      <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'rgba(6, 182, 212, 0.06)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 700 }}>{a.plan_name || a.diet_name || 'Diet Protocol'} (v{a.version_number || a.plan_version_number || '—'})</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          Starts: {formatDateOnly(a.effective_from || a.effectiveFrom)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {categorizedDiets.history.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Past / History ({categorizedDiets.history.length})
                    </div>
                    {categorizedDiets.history.map((a) => (
                      <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', opacity: 0.75 }}>
                        <div style={{ fontWeight: 600 }}>{a.plan_name || a.diet_name || 'Diet Protocol'} (v{a.version_number || a.plan_version_number || '—'})</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          {formatDateOnly(a.effective_from || a.effectiveFrom)} to {formatDateOnly(a.effective_to || a.effectiveTo)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Workout Modal */}
      {showWorkoutModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Assign Workout Plan</h3>
              <button onClick={() => setShowWorkoutModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignWorkout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Select Published Workout Version *
                </label>
                {workoutPlansWithPublished.length === 0 ? (
                  <p style={{ color: 'var(--accent-rose)', fontSize: '0.85rem' }}>
                    No published workout plans found. You must publish a workout plan version in Workout Plans before it can be assigned.
                  </p>
                ) : (
                  <select
                    className="select"
                    required
                    value={selectedWorkoutVersionId}
                    onChange={(e) => setSelectedWorkoutVersionId(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <option value="">-- Choose Published Plan Version --</option>
                    {workoutPlansWithPublished.map((p) =>
                      p.publishedVersions.map((v: any) => (
                        <option key={v.id} value={v.id}>
                          {p.name} — Version {v.version_number} (Published)
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Effective Start Date *
                  </label>
                  <input
                    type="date"
                    className="input"
                    required
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Effective End Date (Optional)
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Assignment Notes (Optional)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 8-week progressive overload mesocycle"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowWorkoutModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={workoutPlansWithPublished.length === 0} className="btn btn-primary">
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Diet Modal */}
      {showDietModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Assign Diet Protocol</h3>
              <button onClick={() => setShowDietModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignDiet} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Select Published Diet Version *
                </label>
                {dietPlansWithPublished.length === 0 ? (
                  <p style={{ color: 'var(--accent-rose)', fontSize: '0.85rem' }}>
                    No published diet protocols found. You must publish a diet protocol version in Diet Protocols before it can be assigned.
                  </p>
                ) : (
                  <select
                    className="select"
                    required
                    value={selectedDietVersionId}
                    onChange={(e) => setSelectedDietVersionId(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <option value="">-- Choose Published Diet Version --</option>
                    {dietPlansWithPublished.map((p) =>
                      p.publishedVersions.map((v: any) => (
                        <option key={v.id} value={v.id}>
                          {p.name} — Version {v.version_number} (Published)
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Effective Start Date *
                  </label>
                  <input
                    type="date"
                    className="input"
                    required
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Effective End Date (Optional)
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Assignment Notes (Optional)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Hypertrophy cut with flexible meal options"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowDietModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={dietPlansWithPublished.length === 0} className="btn btn-primary">
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
