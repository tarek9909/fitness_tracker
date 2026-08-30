import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Utensils, Plus, Layers, Edit, CheckCircle2, Flame, RefreshCw, AlertCircle, X } from 'lucide-react';

interface DietPlansPageProps {
  onOpenBuilder: (planId: number, versionId?: number) => void;
}

export const DietPlansPage: React.FC<DietPlansPageProps> = ({ onOpenBuilder }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

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
    if (!form.name.trim()) {
      alert('Please enter a protocol name');
      return;
    }
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
      alert(err.message || 'Failed to create plan');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Diet Protocols</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Configure meals, option groups, food alternatives, and macronutrient targets.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>New Diet Protocol</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
          <p>Loading diet protocols...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={32} color="var(--accent-rose)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Unable to Load Diet Protocols</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={fetchPlans} className="btn btn-primary">
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      ) : plans.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
          <Utensils size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Diet Protocols Found</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            Create your first nutrition protocol to prescribe meals, option groups, and target macros to clients.
          </p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Create First Diet Protocol</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {plans.map((plan) => (
            <div key={plan.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-amber)', fontSize: '0.85rem', fontWeight: 700 }}>
                    <Flame size={16} />
                    <span>{plan.daily_calories_target ? `${plan.daily_calories_target} kcal` : 'Calorie target unconfigured'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Layers size={14} />
                    <span>{plan.version_count !== undefined ? `${plan.version_count} Version(s)` : 'Versioned'}</span>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {plan.name}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {plan.description || 'Flexible meal options protocol.'}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={14} />
                  <span>{plan.active_version_number ? `Active: v${plan.active_version_number}` : 'Draft Only'}</span>
                </div>
                <button onClick={() => onOpenBuilder(plan.id)} className="btn btn-secondary btn-sm">
                  <Edit size={14} />
                  <span>Open Builder</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Plan Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Create New Diet Protocol</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Protocol Name
                </label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. 2400 kcal Hypertrophy Recomp"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Daily Calorie Target (kcal)
                </label>
                <input
                  type="number"
                  className="input"
                  placeholder="e.g. 2400"
                  value={form.dailyCaloriesTarget}
                  onChange={(e) => setForm({ ...form, dailyCaloriesTarget: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Description / Guidelines (Optional)
                </label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Dietary rules, macro breakdown, meal timing recommendations..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Protocol & Launch Builder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
