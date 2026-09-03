import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Dumbbell, Plus, Edit2, Archive, RotateCcw } from 'lucide-react';
import {
  Card,
  Button,
  IconButton,
  Badge,
  SearchInput,
  Select,
  Dialog,
  FormField,
  TextInput,
  TextArea,
  Pagination,
  EmptyState,
  Skeleton,
  ErrorView,
} from '../components/ui';

export const ExercisesPage: React.FC = () => {
  const [exercises, setExercises] = useState<any[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<any[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('');
  const [isArchivedTab, setIsArchivedTab] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    primaryMuscleGroupId: '' as number | '',
    equipmentTypeId: '' as number | '',
    trackingType: 'weight_reps',
    instructions: '',
  });

  const fetchTaxonomies = async () => {
    try {
      const [mgData, eqData] = await Promise.all([
        api.get<any[]>('/admin/muscle-groups'),
        api.get<any[]>('/admin/equipment-types'),
      ]);
      setMuscleGroups(Array.isArray(mgData) ? mgData : []);
      setEquipmentTypes(Array.isArray(eqData) ? eqData : []);
    } catch (err) {
      console.error('Failed to load taxonomies', err);
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
      q.append('archived', isArchivedTab ? 'true' : 'false');
      q.append('page', String(page));
      q.append('limit', '20');

      const res = await api.get<any>(`/admin/exercises?${q.toString()}`);
      setExercises(Array.isArray(res) ? res : res?.data || res?.exercises || []);
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
    fetchTaxonomies();
  }, []);

  useEffect(() => {
    fetchExercises();
  }, [search, muscleFilter, equipmentFilter, isArchivedTab, page]);

  const handleOpenCreateModal = () => {
    setEditingExercise(null);
    setForm({
      name: '',
      description: '',
      primaryMuscleGroupId: muscleGroups.length > 0 ? muscleGroups[0].id : '',
      equipmentTypeId: equipmentTypes.length > 0 ? equipmentTypes[0].id : '',
      trackingType: 'weight_reps',
      instructions: '',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (ex: any) => {
    setEditingExercise(ex);
    setForm({
      name: ex.name,
      description: ex.description || '',
      primaryMuscleGroupId: ex.primary_muscle_group_id || ex.primaryMuscleGroupId || '',
      equipmentTypeId: ex.equipment_type_id || ex.equipmentTypeId || '',
      trackingType: ex.tracking_type || 'weight_reps',
      instructions: ex.instructions || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.primaryMuscleGroupId === '' || form.equipmentTypeId === '') {
      alert('Please fill all required exercise attributes');
      return;
    }

    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: number) => {
    if (!window.confirm('Archive this exercise from active builder catalogs?')) return;
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Exercise Library</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Catalog of resistance exercises, anatomical classifications, and tracking metrics.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenCreateModal} icon={<Plus size={16} />}>
          New Exercise
        </Button>
      </div>

      {/* Filters Card */}
      <Card style={{ padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant={!isArchivedTab ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setIsArchivedTab(false); setPage(1); }}
            >
              Active Exercises
            </Button>
            <Button
              variant={isArchivedTab ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setIsArchivedTab(true); setPage(1); }}
            >
              Archived Exercises
            </Button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ minWidth: '220px', flex: 1, maxWidth: '300px' }}>
              <SearchInput
                placeholder="Search exercise..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            <div style={{ minWidth: '160px' }}>
              <Select
                options={[
                  { value: '', label: 'All Muscle Groups' },
                  ...muscleGroups.map((mg) => ({ value: String(mg.id), label: mg.name })),
                ]}
                value={muscleFilter}
                onChange={(val) => { setMuscleFilter(val); setPage(1); }}
                placeholder="Muscle Group"
                ariaLabel="Filter by muscle group"
              />
            </div>

            <div style={{ minWidth: '160px' }}>
              <Select
                options={[
                  { value: '', label: 'All Equipment' },
                  ...equipmentTypes.map((eq) => ({ value: String(eq.id), label: eq.name })),
                ]}
                value={equipmentFilter}
                onChange={(val) => { setEquipmentFilter(val); setPage(1); }}
                placeholder="Equipment"
                ariaLabel="Filter by equipment"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Exercises Table Card */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '1.5rem' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '1rem' }}>
                <Skeleton width="35%" height="20px" />
                <Skeleton width="20%" height="20px" />
                <Skeleton width="20%" height="20px" />
                <Skeleton width="15%" height="20px" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: '2rem' }}>
            <ErrorView message={error} onRetry={fetchExercises} />
          </div>
        ) : exercises.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <EmptyState
              icon={<Dumbbell size={36} color="var(--text-muted)" />}
              title={search || muscleFilter || equipmentFilter ? 'No matching exercises found' : isArchivedTab ? 'No archived exercises' : 'No exercises in the library yet'}
              description="Adjust your search filters or add a new exercise movement to get started."
              action={
                <Button variant="primary" size="sm" onClick={handleOpenCreateModal} icon={<Plus size={14} />}>
                  Add Exercise
                </Button>
              }
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '0.875rem 1.25rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exercise Name</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary Muscle</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipment</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tracking Metric</th>
                  <th style={{ padding: '0.875rem 1.25rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exercises.map((ex) => (
                  <tr key={ex.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ex.name}</div>
                      {ex.instructions && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '340px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '0.15rem' }}>
                          {ex.instructions}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <Badge variant="info">{ex.muscle_group_name || ex.muscle_group || 'Unassigned'}</Badge>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <Badge variant="warning">{ex.equipment_name || ex.equipment_type || 'Bodyweight'}</Badge>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {ex.tracking_type ? ex.tracking_type.replace('_', ' ') : 'Weight & Reps'}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <IconButton
                          icon={<Edit2 size={14} />}
                          label="Edit Exercise"
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenEditModal(ex)}
                        />
                        {!isArchivedTab ? (
                          <IconButton
                            icon={<Archive size={14} />}
                            label="Archive Exercise"
                            size="sm"
                            variant="danger"
                            onClick={() => handleArchive(ex.id)}
                          />
                        ) : (
                          <IconButton
                            icon={<RotateCcw size={14} />}
                            label="Restore Exercise"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRestore(ex.id)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{ padding: '0.5rem 1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </Card>

      {/* Exercise Create/Edit Dialog */}
      <Dialog
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingExercise ? 'Edit Exercise Movement' : 'New Exercise Movement'}
        description="Configure target muscle anatomy, equipment constraints, and tracking fields."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={submitting}>
              {editingExercise ? 'Update Exercise' : 'Save Exercise'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Exercise Name" required>
            <TextInput
              required
              placeholder="e.g. Incline Dumbbell Bench Press"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Primary Muscle Group" required>
              <Select
                options={muscleGroups.map((mg) => ({ value: mg.id, label: mg.name }))}
                value={form.primaryMuscleGroupId}
                onChange={(val) => setForm({ ...form, primaryMuscleGroupId: Number(val) })}
                placeholder="Select Muscle"
              />
            </FormField>

            <FormField label="Equipment Type" required>
              <Select
                options={equipmentTypes.map((eq) => ({ value: eq.id, label: eq.name }))}
                value={form.equipmentTypeId}
                onChange={(val) => setForm({ ...form, equipmentTypeId: Number(val) })}
                placeholder="Select Equipment"
              />
            </FormField>
          </div>

          <FormField label="Tracking Metric">
            <Select
              options={[
                { value: 'weight_reps', label: 'Weight & Reps' },
                { value: 'reps_only', label: 'Reps Only (Bodyweight)' },
                { value: 'duration', label: 'Duration (Time)' },
                { value: 'distance', label: 'Distance' },
                { value: 'weight_duration', label: 'Weight & Duration' },
              ]}
              value={form.trackingType}
              onChange={(val) => setForm({ ...form, trackingType: val })}
            />
          </FormField>

          <FormField label="Execution Instructions (Optional)">
            <TextArea
              rows={3}
              placeholder="Setup, range of motion cues, breathing, safety pointers..."
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            />
          </FormField>
        </form>
      </Dialog>
    </div>
  );
};
