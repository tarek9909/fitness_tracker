import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Library, Plus, Search, Dumbbell, Tag, Edit2, Archive, RotateCcw, RefreshCw, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';

export const ExercisesPage: React.FC = () => {
  const [exercises, setExercises] = useState<any[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<any[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('');
  const [isArchivedTab, setIsArchivedTab] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<any | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    primaryMuscleGroupId: '' as number | '',
    equipmentTypeId: '' as number | '',
    trackingType: 'weight_reps',
    instructions: '',
  });

  const fetchMetadata = async () => {
    try {
      const meta = await api.get<any>('/admin/exercises/metadata');
      setMuscleGroups(meta.muscleGroups || []);
      setEquipmentTypes(meta.equipmentTypes || []);
    } catch (err) {
      console.error('Failed to load exercises metadata', err);
    }
  };

  const fetchExercises = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.append('search', search.trim());
      if (muscleFilter) q.append('muscleGroupId', muscleFilter);
      if (equipmentFilter) q.append('equipmentTypeId', equipmentFilter);
      if (isArchivedTab) q.append('isArchived', 'true');
      q.append('page', String(page));
      q.append('limit', '25');

      const res = await api.get<any>(`/admin/exercises?${q.toString()}`);
      setExercises(Array.isArray(res) ? res : (res?.data || []));
      if (res?.pagination) {
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages || 1);
      } else {
        setTotal(Array.isArray(res) ? res.length : 0);
        setTotalPages(1);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchExercises();
  }, [search, muscleFilter, equipmentFilter, isArchivedTab, page]);

  const handleOpenCreateModal = () => {
    setEditingExercise(null);
    setForm({
      name: '',
      description: '',
      primaryMuscleGroupId: '',
      equipmentTypeId: '',
      trackingType: 'weight_reps',
      instructions: '',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (exercise: any) => {
    setEditingExercise(exercise);
    setForm({
      name: exercise.name || '',
      description: exercise.description || '',
      primaryMuscleGroupId: exercise.primary_muscle_group_id || '',
      equipmentTypeId: exercise.equipment_type_id || '',
      trackingType: exercise.tracking_type || 'weight_reps',
      instructions: exercise.instructions || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('Please enter an exercise name');
      return;
    }
    if (form.primaryMuscleGroupId === '') {
      alert('Please select a primary muscle group');
      return;
    }
    if (form.equipmentTypeId === '') {
      alert('Please select an equipment type');
      return;
    }

    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description ? form.description.trim() : undefined,
        primaryMuscleGroupId: Number(form.primaryMuscleGroupId),
        equipmentTypeId: Number(form.equipmentTypeId),
        trackingType: form.trackingType,
        instructions: form.instructions ? form.instructions.trim() : undefined,
      };

      if (editingExercise) {
        await api.patch(`/admin/exercises/${editingExercise.id}`, payload);
      } else {
        await api.post('/admin/exercises', payload);
      }

      setShowModal(false);
      fetchExercises();
    } catch (err: any) {
      alert(err.message || 'Failed to save exercise');
    }
  };

  const handleArchive = async (id: number) => {
    if (!window.confirm('Archive this exercise?')) return;
    try {
      await api.post(`/admin/exercises/${id}/archive`);
      fetchExercises();
    } catch (err: any) {
      alert(err.message || 'Failed to archive exercise');
    }
  };

  const handleRestore = async (id: number) => {
    try {
      await api.post(`/admin/exercises/${id}/restore`);
      fetchExercises();
    } catch (err: any) {
      alert(err.message || 'Failed to restore exercise');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Exercise Library</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Catalog of resistance exercises, anatomical classifications, and tracking metrics.
          </p>
        </div>
        <button onClick={handleOpenCreateModal} className="btn btn-primary">
          <Plus size={16} />
          <span>New Exercise</span>
        </button>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => { setIsArchivedTab(false); setPage(1); }}
              className={`btn btn-sm ${!isArchivedTab ? 'btn-primary' : 'btn-secondary'}`}
            >
              Active Exercises
            </button>
            <button
              onClick={() => { setIsArchivedTab(true); setPage(1); }}
              className={`btn btn-sm ${isArchivedTab ? 'btn-primary' : 'btn-secondary'}`}
            >
              Archived Exercises
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Search exercise..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            <select
              className="select"
              style={{ width: 'auto', minWidth: '160px' }}
              value={muscleFilter}
              onChange={(e) => { setMuscleFilter(e.target.value); setPage(1); }}
              aria-label="Filter by Muscle Group"
            >
              <option value="">All Muscle Groups</option>
              {muscleGroups.map((mg) => (
                <option key={mg.id} value={mg.id}>{mg.name}</option>
              ))}
            </select>

            <select
              className="select"
              style={{ width: 'auto', minWidth: '160px' }}
              value={equipmentFilter}
              onChange={(e) => { setEquipmentFilter(e.target.value); setPage(1); }}
              aria-label="Filter by Equipment Type"
            >
              <option value="">All Equipment</option>
              {equipmentTypes.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Exercises Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
            <p>Loading exercise library...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <AlertCircle size={32} color="var(--accent-rose)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Failed to Load Exercises</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
            <button onClick={fetchExercises} className="btn btn-primary">
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        ) : exercises.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Dumbbell size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <p>{search || muscleFilter || equipmentFilter ? 'No matching exercises found.' : isArchivedTab ? 'No archived exercises.' : 'No exercises in the library yet.'}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Exercise Name</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Primary Muscle</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Equipment</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tracking Metric</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exercises.map((ex) => (
                  <tr key={ex.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ex.name}</div>
                      {ex.instructions && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ex.instructions}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span className="badge badge-info">{ex.muscle_group_name || ex.muscle_group || 'Unassigned'}</span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span className="badge badge-warning">{ex.equipment_name || ex.equipment_type || 'None / Bodyweight'}</span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {ex.tracking_type ? ex.tracking_type.replace('_', ' ') : 'Weight & Reps'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button onClick={() => handleOpenEditModal(ex)} className="btn btn-secondary btn-sm" aria-label="Edit Exercise">
                          <Edit2 size={13} />
                        </button>
                        {!isArchivedTab ? (
                          <button onClick={() => handleArchive(ex.id)} className="btn btn-danger btn-sm" aria-label="Archive Exercise" title="Archive">
                            <Archive size={13} />
                          </button>
                        ) : (
                          <button onClick={() => handleRestore(ex.id)} className="btn btn-secondary btn-sm" aria-label="Restore Exercise" title="Restore">
                            <RotateCcw size={13} />
                          </button>
                        )}
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
            <span>Page {page} of {totalPages} ({total} total exercises)</span>
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

      {/* Exercise Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingExercise ? 'Edit Exercise' : 'New Exercise'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Exercise Name *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Incline Dumbbell Bench Press"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Primary Muscle Group *</label>
                  <select
                    className="select"
                    required
                    value={form.primaryMuscleGroupId}
                    onChange={(e) => setForm({ ...form, primaryMuscleGroupId: e.target.value === '' ? '' : Number(e.target.value) })}
                  >
                    <option value="">-- Choose Muscle Group --</option>
                    {muscleGroups.map((mg) => (
                      <option key={mg.id} value={mg.id}>{mg.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Equipment Type *</label>
                  <select
                    className="select"
                    required
                    value={form.equipmentTypeId}
                    onChange={(e) => setForm({ ...form, equipmentTypeId: e.target.value === '' ? '' : Number(e.target.value) })}
                  >
                    <option value="">-- Choose Equipment --</option>
                    {equipmentTypes.map((eq) => (
                      <option key={eq.id} value={eq.id}>{eq.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Tracking Metric</label>
                <select
                  className="select"
                  value={form.trackingType}
                  onChange={(e) => setForm({ ...form, trackingType: e.target.value })}
                >
                  <option value="weight_reps">Weight & Reps</option>
                  <option value="reps_only">Reps Only (Bodyweight)</option>
                  <option value="duration">Duration (Time)</option>
                  <option value="distance">Distance</option>
                  <option value="weight_duration">Weight & Duration</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Execution Instructions (Optional)</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Setup, range of motion cues, breathing, safety pointers..."
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingExercise ? 'Update Exercise' : 'Save Exercise'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
