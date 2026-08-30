import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Dumbbell, Plus, Layers, Edit, Eye, CheckCircle2, Lock, X } from 'lucide-react';

interface WorkoutPlansPageProps {
  onOpenBuilder: (planId: number, versionId?: number) => void;
}

export const WorkoutPlansPage: React.FC<WorkoutPlansPageProps> = ({ onOpenBuilder }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanGoal, setNewPlanGoal] = useState('hypertrophy');
  const [newPlanDesc, setNewPlanDesc] = useState('');

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/workout-plans');
      setPlans(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/workout-plans', {
        name: newPlanName,
        goalCategory: newPlanGoal,
        description: newPlanDesc,
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
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Workout Protocols</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Authoritative, versioned workout plan templates. Published versions are immutable.
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>New Workout Plan</span>
        </button>
      </div>

      {/* Grid of Workout Plans */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>Loading workout plans...</p>
        </div>
      ) : plans.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
          <Dumbbell size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Workout Plans Found</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            Create your first workout protocol to structure training days, exercises, target sets, and rep ranges.
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Create First Workout Plan</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {plans.map((plan) => (
            <div key={plan.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                    {plan.goal_category || 'General Fitness'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Layers size={14} />
                    <span>{plan.version_count != null ? `${plan.version_count} Version(s)` : 'Not configured'}</span>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {plan.name}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {plan.description || 'No detailed description provided.'}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={14} />
                  <span>{plan.active_version_number != null ? `Active: v${plan.active_version_number}` : 'No published version'}</span>
                </div>
                <button
                  onClick={() => onOpenBuilder(plan.id)}
                  className="btn btn-secondary btn-sm"
                >
                  <Edit size={14} />
                  <span>Open Plan Builder</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Create Workout Plan</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Plan Title</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. 5-Day Push / Pull / Legs Hypertrophy"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Goal Focus</label>
                <select
                  className="select"
                  value={newPlanGoal}
                  onChange={(e) => setNewPlanGoal(e.target.value)}
                >
                  <option value="hypertrophy">Hypertrophy / Muscle Building</option>
                  <option value="strength">Strength & Power</option>
                  <option value="fat_loss">Fat Loss & Conditioning</option>
                  <option value="endurance">Muscular Endurance</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Description & Guidelines</label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="Program overview, progression rules, and periodization instructions..."
                  value={newPlanDesc}
                  onChange={(e) => setNewPlanDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create & Launch Builder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
