import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Utensils, Plus, Layers, Edit, CheckCircle2, Flame } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Dialog,
  FormField,
  TextInput,
  NumberInput,
  TextArea,
  EmptyState,
  Skeleton,
  ErrorView,
} from '../components/ui';

interface DietPlansPageProps {
  onOpenBuilder: (planId: number, versionId?: number) => void;
}

export const DietPlansPage: React.FC<DietPlansPageProps> = ({ onOpenBuilder }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    dailyCaloriesTarget: '' as number | '',
  });

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/admin/diet-plans');
      setPlans(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load diet protocols');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSubmitting(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description ? form.description.trim() : undefined,
      };
      if (form.dailyCaloriesTarget !== '') {
        payload.dailyCaloriesTarget = Number(form.dailyCaloriesTarget);
      }
      const res = await api.post('/admin/diet-plans', payload);
      setShowModal(false);
      setForm({ name: '', description: '', dailyCaloriesTarget: '' });
      fetchPlans();
      if (res.versions && res.versions.length > 0) {
        onOpenBuilder(res.id, res.versions[0].id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create diet plan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Diet Protocols</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Configure meals, option groups, food alternatives, and macronutrient targets.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)} icon={<Plus size={16} />}>
          New Diet Protocol
        </Button>
      </div>

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
          icon={<Utensils size={40} color="var(--text-muted)" />}
          title="No Diet Protocols Found"
          description="Create your first nutrition protocol to prescribe meals, option groups, and target macros to clients."
          action={
            <Button variant="primary" onClick={() => setShowModal(true)} icon={<Plus size={16} />}>
              Create First Diet Protocol
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {plans.map((plan) => (
            <Card key={plan.id} hover style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-amber)', fontSize: '0.8125rem', fontWeight: 600 }}>
                    <Flame size={15} />
                    <span>{plan.daily_calories_target ? `${plan.daily_calories_target} kcal` : 'Unconfigured kcal'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Layers size={14} />
                    <span>{plan.version_count !== undefined ? `${plan.version_count} Version(s)` : 'Versioned'}</span>
                  </div>
                </div>

                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {plan.name}
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {plan.description || 'Flexible meal options protocol.'}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 500 }}>
                  <CheckCircle2 size={14} />
                  <span>{plan.active_version_number ? `Active: v${plan.active_version_number}` : 'Draft Only'}</span>
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

      {/* Create Plan Dialog */}
      <Dialog
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create New Diet Protocol"
        description="Initialize a nutritional framework with flexible meals and macros."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreatePlan} loading={submitting}>
              Create Protocol & Launch Builder
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Protocol Name" required>
            <TextInput
              required
              placeholder="e.g. 2400 kcal Hypertrophy Recomp"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>

          <FormField label="Daily Calorie Target (kcal, optional)">
            <NumberInput
              placeholder="e.g. 2400"
              value={form.dailyCaloriesTarget}
              onChange={(val) => setForm({ ...form, dailyCaloriesTarget: val })}
              min={500}
              max={10000}
            />
          </FormField>

          <FormField label="Description / Guidelines (Optional)">
            <TextArea
              rows={3}
              placeholder="Dietary rules, macro breakdown, meal timing recommendations..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormField>
        </form>
      </Dialog>
    </div>
  );
};
