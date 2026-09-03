import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { formatDateOnly } from '../utils/date-utils';
import { UserCheck, Plus, CheckCircle2, Dumbbell, Utensils, AlertCircle, X, Calendar } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Select,
  Dialog,
  FormField,
  TextInput,
  EmptyState,
  Skeleton,
  ErrorView,
  AlertBanner,
} from '../components/ui';

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
  const [submittingWorkout, setSubmittingWorkout] = useState(false);
  const [submittingDiet, setSubmittingDiet] = useState(false);

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
    if (!selectedUserId || !selectedWorkoutVersionId || !effectiveFrom) {
      alert('Please fill all required assignment fields');
      return;
    }

    setSubmittingWorkout(true);
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
    } finally {
      setSubmittingWorkout(false);
    }
  };

  const handleAssignDiet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !selectedDietVersionId || !effectiveFrom) {
      alert('Please fill all required assignment fields');
      return;
    }

    setSubmittingDiet(true);
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
    } finally {
      setSubmittingDiet(false);
    }
  };

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
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <Skeleton width="40%" height="28px" style={{ margin: '0 auto 1.5rem' }} />
        <Skeleton width="100%" height="80px" />
      </div>
    );
  }

  if (error) {
    return <ErrorView message={error} onRetry={fetchInitialData} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Plan Assignments</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Assign authoritative published workout and diet protocols to active client profiles.
          </p>
        </div>
      </div>

      {feedback && (
        <AlertBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Select Client Bar Card */}
      <Card style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            Select Client:
          </label>
          <div style={{ flex: 1, maxWidth: '400px' }}>
            <Select
              options={[
                { value: '', label: '-- Choose a Client Account --' },
                ...users.map((u) => ({
                  value: u.id,
                  label: `${u.firstName || u.first_name} ${u.lastName || u.last_name}`,
                  subLabel: u.email,
                })),
              ]}
              value={selectedUserId || ''}
              onChange={(val) => setSelectedUserId(val ? Number(val) : null)}
              placeholder="Choose a Client Account"
              searchable
            />
          </div>
        </div>

        {selectedUserId && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button variant="primary" size="sm" onClick={handleOpenWorkoutModal} icon={<Dumbbell size={14} />}>
              Assign Workout
            </Button>
            <Button variant="secondary" size="sm" onClick={handleOpenDietModal} icon={<Utensils size={14} />}>
              Assign Diet
            </Button>
          </div>
        )}
      </Card>

      {!selectedUserId ? (
        <EmptyState
          icon={<UserCheck size={36} color="var(--text-muted)" />}
          title="No Client Selected"
          description="Select a client account above to view active, upcoming, and past plan assignments."
        />
      ) : loadingAssignments ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          <Card style={{ height: '220px' }}>
            <Skeleton width="40%" height="24px" style={{ marginBottom: '1rem' }} />
            <Skeleton width="100%" height="60px" />
          </Card>
          <Card style={{ height: '220px' }}>
            <Skeleton width="40%" height="24px" style={{ marginBottom: '1rem' }} />
            <Skeleton width="100%" height="60px" />
          </Card>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Workout Assignments Section */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
                <Dumbbell size={18} color="var(--accent-cyan)" />
                <span>Workout Plan Assignments</span>
              </div>
              <Button variant="primary" size="sm" onClick={handleOpenWorkoutModal} icon={<Plus size={12} />}>
                Assign
              </Button>
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
                      <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'var(--accent-primary-muted)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }}>
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
                      <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'var(--accent-cyan-muted)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }}>
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
                      <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', opacity: 0.75 }}>
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
          </Card>

          {/* Diet Assignments Section */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
                <Utensils size={18} color="var(--accent-amber)" />
                <span>Diet Protocol Assignments</span>
              </div>
              <Button variant="secondary" size="sm" onClick={handleOpenDietModal} icon={<Plus size={12} />}>
                Assign
              </Button>
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
                      <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'var(--accent-primary-muted)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }}>
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
                      <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'var(--accent-cyan-muted)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }}>
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
                      <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', opacity: 0.75 }}>
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
          </Card>
        </div>
      )}

      {/* Assign Workout Dialog */}
      <Dialog
        isOpen={showWorkoutModal}
        onClose={() => setShowWorkoutModal(false)}
        title="Assign Workout Plan"
        description="Prescribe an immutable published workout version to this client."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowWorkoutModal(false)} disabled={submittingWorkout}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAssignWorkout}
              disabled={workoutPlansWithPublished.length === 0}
              loading={submittingWorkout}
            >
              Confirm Assignment
            </Button>
          </>
        }
      >
        <form onSubmit={handleAssignWorkout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Select Published Workout Version" required>
            {workoutPlansWithPublished.length === 0 ? (
              <p style={{ color: 'var(--accent-rose)', fontSize: '0.85rem' }}>
                No published workout plans found. You must publish a workout plan version in Workout Plans before it can be assigned.
              </p>
            ) : (
              <Select
                options={workoutPlansWithPublished.flatMap((p) =>
                  p.publishedVersions.map((v: any) => ({
                    value: v.id,
                    label: `${p.name} — Version ${v.version_number}`,
                    subLabel: 'Published Protocol',
                  }))
                )}
                value={selectedWorkoutVersionId}
                onChange={(val) => setSelectedWorkoutVersionId(val ? Number(val) : '')}
                placeholder="Choose Published Plan Version"
              />
            )}
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Effective Start Date" required>
              <TextInput
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </FormField>

            <FormField label="Effective End Date (Optional)">
              <TextInput
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Assignment Notes (Optional)">
            <TextInput
              placeholder="e.g. 8-week progressive overload mesocycle"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
        </form>
      </Dialog>

      {/* Assign Diet Dialog */}
      <Dialog
        isOpen={showDietModal}
        onClose={() => setShowDietModal(false)}
        title="Assign Diet Protocol"
        description="Prescribe an immutable published diet protocol version to this client."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDietModal(false)} disabled={submittingDiet}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAssignDiet}
              disabled={dietPlansWithPublished.length === 0}
              loading={submittingDiet}
            >
              Confirm Assignment
            </Button>
          </>
        }
      >
        <form onSubmit={handleAssignDiet} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Select Published Diet Version" required>
            {dietPlansWithPublished.length === 0 ? (
              <p style={{ color: 'var(--accent-rose)', fontSize: '0.85rem' }}>
                No published diet protocols found. You must publish a diet protocol version in Diet Protocols before it can be assigned.
              </p>
            ) : (
              <Select
                options={dietPlansWithPublished.flatMap((p) =>
                  p.publishedVersions.map((v: any) => ({
                    value: v.id,
                    label: `${p.name} — Version ${v.version_number}`,
                    subLabel: 'Published Protocol',
                  }))
                )}
                value={selectedDietVersionId}
                onChange={(val) => setSelectedDietVersionId(val ? Number(val) : '')}
                placeholder="Choose Published Diet Version"
              />
            )}
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Effective Start Date" required>
              <TextInput
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </FormField>

            <FormField label="Effective End Date (Optional)">
              <TextInput
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Assignment Notes (Optional)">
            <TextInput
              placeholder="e.g. Hypertrophy cut with flexible meal options"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
        </form>
      </Dialog>
    </div>
  );
};
