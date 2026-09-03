import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Dumbbell, Plus, Layers, Edit, CheckCircle2 } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Dialog,
  FormField,
  TextInput,
  TextArea,
  Select,
  EmptyState,
  Skeleton,
  ErrorView,
} from '../components/ui';

interface WorkoutPlansPageProps {
  onOpenBuilder: (planId: number, versionId?: number) => void;
}

export const WorkoutPlansPage: React.FC<WorkoutPlansPageProps> = ({ onOpenBuilder }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanGoal, setNewPlanGoal] = useState('hypertrophy');
  const [newPlanDesc, setNewPlanDesc] = useState('');

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/admin/workout-plans');
      setPlans(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load workout plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.post('/admin/workout-plans', {
        name: newPlanName.trim(),
        goalCategory: newPlanGoal,
        description: newPlanDesc.trim(),
      });
      setShowCreateModal(false);
      setNewPlanName('');
      setNewPlanDesc('');
      fetchPlans();
      // Open the builder for the new plan
      if (res.versions && res.versions.length > 0) {
        onOpenBuilder(res.id, res.versions[0].id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create plan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Workout Protocols</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Authoritative, versioned workout plan templates. Published versions are immutable.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)} icon={<Plus size={16} />}>
          New Workout Plan
        </Button>
      </div>

      {/* Grid of Workout Plans */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {[1, 2, 3].map((i) => (
            <Card key={i} style={{ height: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Skeleton width="40%" height="20px" />
              <Skeleton width="80%" height="16px" />
              <Skeleton width="100%" height="14px" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorView message={error} onRetry={fetchPlans} />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<Dumbbell size={40} color="var(--text-muted)" />}
          title="No Workout Plans Found"
          description="Create your first workout protocol to structure training days, exercises, target sets, and rep ranges."
          action={
            <Button variant="primary" onClick={() => setShowCreateModal(true)} icon={<Plus size={16} />}>
              Create First Workout Plan
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {plans.map((plan) => (
            <Card key={plan.id} hover style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem' }}>
                  <Badge variant="info">
                    {(plan.goal_category || 'General Fitness').replace('_', ' ')}
                  </Badge>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Layers size={14} />
                    <span>{plan.version_count != null ? `${plan.version_count} Version(s)` : 'Not configured'}</span>
                  </div>
                </div>

                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {plan.name}
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {plan.description || 'No detailed description provided.'}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 500 }}>
                  <CheckCircle2 size={14} />
                  <span>{plan.active_version_number != null ? `Active: v${plan.active_version_number}` : 'No published version'}</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenBuilder(plan.id)}
                  icon={<Edit size={14} />}
                >
                  Open Builder
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal Dialog */}
      <Dialog
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Workout Plan"
        description="Initialize a new protocol template and start authoring version 1."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreatePlan} loading={submitting}>
              Create & Launch Builder
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Plan Title" required>
            <TextInput
              required
              placeholder="e.g. 5-Day Push / Pull / Legs Hypertrophy"
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
            />
          </FormField>

          <FormField label="Goal Focus">
            <Select
              options={[
                { value: 'hypertrophy', label: 'Hypertrophy / Muscle Building' },
                { value: 'strength', label: 'Strength & Power' },
                { value: 'fat_loss', label: 'Fat Loss & Conditioning' },
                { value: 'endurance', label: 'Muscular Endurance' },
              ]}
              value={newPlanGoal}
              onChange={(val) => setNewPlanGoal(val)}
            />
          </FormField>

          <FormField label="Description & Guidelines">
            <TextArea
              rows={3}
              placeholder="Program overview, progression rules, and periodization guidelines..."
              value={newPlanDesc}
              onChange={(e) => setNewPlanDesc(e.target.value)}
            />
          </FormField>
        </form>
      </Dialog>
    </div>
  );
};
