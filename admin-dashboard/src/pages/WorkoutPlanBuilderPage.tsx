import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Check, 
  Lock, 
  Layers, 
  Copy, 
  Calendar, 
  Dumbbell, 
  Clock, 
  Sparkles, 
  X,
  Search,
  ArrowUp,
  ArrowDown,
  Edit2,
  Eye,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import {
  Select,
  Button,
  IconButton,
  Badge,
  Card,
  Dialog,
  FormField,
  TextInput,
  NumberInput,
  TextArea,
  Checkbox,
} from '../components/ui';

interface WorkoutPlanBuilderProps {
  planId: number;
  initialVersionId?: number;
  onBack: () => void;
}

export const WorkoutPlanBuilderPage: React.FC<WorkoutPlanBuilderProps> = ({ planId, initialVersionId, onBack }) => {
  const [plan, setPlan] = useState<any>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(initialVersionId || null);
  const [versionDetails, setVersionDetails] = useState<any>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // 0 to 6 (Mon to Sun)
  const [loading, setLoading] = useState(true);
  const [showWeeklyPreview, setShowWeeklyPreview] = useState(false);
  const [expandedExerciseSets, setExpandedExerciseSets] = useState<Record<number, boolean>>({});

  // Exercise selection modal state
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<any | null>(null);
  const [libraryExercises, setLibraryExercises] = useState<any[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');

  // Day editor modal state
  const [showEditDayModal, setShowEditDayModal] = useState(false);
  const [dayNameInput, setDayNameInput] = useState('');
  const [dayNotesInput, setDayNotesInput] = useState('');

  // Neutral empty inputs for form state
  const [exForm, setExForm] = useState({
    exerciseId: '' as number | '',
    targetSets: '' as number | '',
    repsMin: '' as number | '',
    repsMax: '' as number | '',
    restSeconds: '' as number | '',
    notes: '',
    isOptional: false,
  });

  const fetchPlan = async () => {
    try {
      const data = await api.get<any>(`/admin/workout-plans/${planId}`);
      setPlan(data);
      if (!selectedVersionId && data.versions?.length > 0) {
        setSelectedVersionId(data.versions[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVersionDetails = async (vId: number) => {
    setLoading(true);
    try {
      const data = await api.get<any>(`/admin/workout-versions/${vId}`);
      setVersionDetails(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLibrary = async () => {
    try {
      const res = await api.get<any[]>('/admin/exercises');
      const exList = Array.isArray(res) ? res : [];
      setLibraryExercises(exList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPlan();
    fetchLibrary();
  }, [planId]);

  useEffect(() => {
    if (selectedVersionId) {
      fetchVersionDetails(selectedVersionId);
    }
  }, [selectedVersionId]);

  const handleCloneVersion = async () => {
    if (!selectedVersionId) return;
    try {
      const newVer = await api.post<any>(`/admin/workout-plans/${planId}/versions`, {
        fromVersionId: selectedVersionId,
      });
      await fetchPlan();
      setSelectedVersionId(newVer.id);
    } catch (err: any) {
      alert(err.message || 'Failed to clone version');
    }
  };

  const handlePublishVersion = async () => {
    if (!selectedVersionId) return;
    if (!window.confirm('Are you sure you want to publish this version? Once published, this version becomes read-only and immutable.')) {
      return;
    }
    try {
      await api.post(`/admin/workout-versions/${selectedVersionId}/publish`);
      await fetchPlan();
      await fetchVersionDetails(selectedVersionId);
    } catch (err: any) {
      alert(err.message || 'Failed to publish version');
    }
  };

  const activeDay = versionDetails?.days?.[selectedDayIndex];
  const isPublished = versionDetails?.status === 'published';

  const handleOpenAddModal = () => {
    setEditingExercise(null);
    setExForm({
      exerciseId: '',
      targetSets: '',
      repsMin: '',
      repsMax: '',
      restSeconds: '',
      notes: '',
      isOptional: false,
    });
    setShowAddExerciseModal(true);
  };

  const handleOpenEditModal = (ex: any) => {
    setEditingExercise(ex);
    setExForm({
      exerciseId: ex.exercise_id,
      targetSets: ex.target_sets ?? '',
      repsMin: ex.reps_min ?? '',
      repsMax: ex.reps_max ?? '',
      restSeconds: ex.rest_seconds ?? '',
      notes: ex.notes || '',
      isOptional: Boolean(ex.is_optional),
    });
    setShowAddExerciseModal(true);
  };

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDay) return;

    if (!exForm.exerciseId) {
      alert('Please select an exercise from the library');
      return;
    }

    if (exForm.targetSets === '' || Number(exForm.targetSets) < 1) {
      alert('Please enter valid target sets (minimum 1)');
      return;
    }

    if (exForm.repsMin === '' || Number(exForm.repsMin) < 1) {
      alert('Please enter valid minimum reps (minimum 1)');
      return;
    }

    if (exForm.repsMax !== '' && Number(exForm.repsMax) < Number(exForm.repsMin)) {
      alert('Max reps cannot be less than Min reps');
      return;
    }

    if (exForm.restSeconds !== '' && Number(exForm.restSeconds) < 0) {
      alert('Rest seconds cannot be negative');
      return;
    }

    try {
      if (editingExercise) {
        // Update existing exercise
        await api.patch(`/admin/workout-exercises/${editingExercise.id}`, {
          targetSets: Number(exForm.targetSets),
          repsMin: Number(exForm.repsMin),
          repsMax: exForm.repsMax !== '' ? Number(exForm.repsMax) : undefined,
          restSeconds: exForm.restSeconds !== '' ? Number(exForm.restSeconds) : undefined,
          notes: exForm.notes ? exForm.notes.trim() : undefined,
          isOptional: Boolean(exForm.isOptional),
        });
      } else {
        // Add new exercise
        await api.post(`/admin/workout-days/${activeDay.id}/exercises`, {
          exerciseId: Number(exForm.exerciseId),
          targetSets: Number(exForm.targetSets),
          repsMin: Number(exForm.repsMin),
          repsMax: exForm.repsMax !== '' ? Number(exForm.repsMax) : undefined,
          restSeconds: exForm.restSeconds !== '' ? Number(exForm.restSeconds) : undefined,
          notes: exForm.notes ? exForm.notes.trim() : undefined,
          isOptional: Boolean(exForm.isOptional),
          orderIndex: (activeDay.exercises?.length || 0) + 1,
        });
      }
      setShowAddExerciseModal(false);
      setEditingExercise(null);
      fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to save exercise');
    }
  };

  const handleMoveExercise = async (currentIndex: number, direction: 'up' | 'down') => {
    if (isPublished || !activeDay?.exercises) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= activeDay.exercises.length) return;

    const currentEx = activeDay.exercises[currentIndex];
    const targetEx = activeDay.exercises[targetIndex];

    try {
      const currentOrder = currentEx.order_index || (currentIndex + 1);
      const targetOrder = targetEx.order_index || (targetIndex + 1);

      await api.patch(`/admin/workout-exercises/${currentEx.id}`, { orderIndex: targetOrder });
      await api.patch(`/admin/workout-exercises/${targetEx.id}`, { orderIndex: currentOrder });
      fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to reorder exercise');
    }
  };

  const handleDeleteExercise = async (exerciseId: number) => {
    if (isPublished) return;
    if (!window.confirm('Remove this exercise from day?')) return;
    try {
      await api.delete(`/admin/workout-exercises/${exerciseId}`);
      fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to delete exercise');
    }
  };

  const handleToggleRestDay = async () => {
    if (isPublished || !activeDay) return;
    try {
      await api.patch(`/admin/workout-days/${activeDay.id}`, {
        isRestDay: !activeDay.is_rest_day,
      });
      fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to update day');
    }
  };

  const handleOpenEditDayModal = () => {
    if (!activeDay) return;
    setDayNameInput(activeDay.name || `Day ${selectedDayIndex + 1}`);
    setDayNotesInput(activeDay.notes || '');
    setShowEditDayModal(true);
  };

  const handleSaveDayDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDay) return;
    try {
      await api.patch(`/admin/workout-days/${activeDay.id}`, {
        name: dayNameInput.trim() || `Day ${selectedDayIndex + 1}`,
        notes: dayNotesInput.trim() || undefined,
      });
      setShowEditDayModal(false);
      fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to update day details');
    }
  };

  const toggleSetBreakdown = (exerciseId: number) => {
    setExpandedExerciseSets(prev => ({
      ...prev,
      [exerciseId]: !prev[exerciseId],
    }));
  };

  const filteredExercises = libraryExercises.filter(e => 
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
    (e.primary_muscle_group_name && e.primary_muscle_group_name.toLowerCase().includes(exerciseSearch.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button onClick={onBack} variant="secondary" size="sm" id="btn-back-to-plans" icon={<ArrowLeft size={16} />}>
            Back to Plans
          </Button>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{plan?.name || 'Workout Plan'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <Badge variant="info">{plan?.goal_category || 'General Fitness'}</Badge>
              <span>{plan?.description || 'No description provided'}</span>
            </div>
          </div>
        </div>

        {/* Version Selector & Global Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '180px' }}>
            <Select
              options={
                plan?.versions?.map((v: any) => ({
                  value: v.id,
                  label: `v${v.version_number} (${v.status ? v.status.toUpperCase() : 'DRAFT'})`,
                })) || []
              }
              value={selectedVersionId || ''}
              onChange={(val) => setSelectedVersionId(Number(val))}
              placeholder="Select Version..."
            />
          </div>

          <Button
            onClick={() => setShowWeeklyPreview(!showWeeklyPreview)}
            variant={showWeeklyPreview ? 'primary' : 'secondary'}
            size="sm"
            id="btn-toggle-weekly-preview"
            icon={<Eye size={14} />}
          >
            {showWeeklyPreview ? 'Back to Editor' : 'Weekly Preview'}
          </Button>

          <Button onClick={handleCloneVersion} variant="secondary" size="sm" id="btn-clone-version" title="Clone into editable draft version" icon={<Copy size={14} />}>
            Clone to Draft
          </Button>

          {!isPublished ? (
            <Button onClick={handlePublishVersion} variant="primary" size="sm" id="btn-publish-version" icon={<Check size={14} />}>
              Publish Version
            </Button>
          ) : (
            <span className="badge badge-success" style={{ padding: '0.5rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Lock size={12} />
              <span>Immutable (Published)</span>
            </span>
          )}
        </div>
      </div>

      {showWeeklyPreview ? (
        /* Full Weekly Preview Overview */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Complete Weekly Athlete Preview</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Audited schedule across all 7 days for {versionDetails?.version_number ? `Version ${versionDetails.version_number}` : 'Current Version'} ({versionDetails?.status ? versionDetails.status.toUpperCase() : 'DRAFT'}).
              </p>
            </div>
            <Button onClick={() => setShowWeeklyPreview(false)} variant="secondary" size="sm" icon={<ArrowLeft size={14} />}>
              Return to Daily Editor
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {versionDetails?.days?.map((day: any, dIdx: number) => (
              <Card
                key={day.id || dIdx}
                style={{
                  backgroundColor: day.is_rest_day ? 'rgba(245, 158, 11, 0.03)' : 'var(--bg-card)',
                  border: day.is_rest_day ? '1px dashed var(--accent-amber)' : '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                    Day {dIdx + 1}: {day.name}
                  </div>
                  <Badge variant={day.is_rest_day ? 'warning' : 'info'}>
                    {day.is_rest_day ? 'Rest Day' : `${day.exercises?.length || 0} Movements`}
                  </Badge>
                </div>

                {day.notes && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                    "{day.notes}"
                  </p>
                )}

                {day.is_rest_day ? (
                  <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--accent-amber)', fontSize: '0.85rem' }}>
                    Scheduled Rest & System Recovery
                  </div>
                ) : day.exercises && day.exercises.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {day.exercises.map((ex: any, exIdx: number) => (
                      <div 
                        key={ex.id || exIdx}
                        style={{
                          padding: '0.6rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700 }}>{exIdx + 1}. {ex.exercise_name}</span>
                          <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                            {ex.target_sets ? `${ex.target_sets} sets` : 'Sets unconfigured'} × {ex.reps_min && ex.reps_max ? `${ex.reps_min}–${ex.reps_max} reps` : (ex.reps_min ? `${ex.reps_min} reps` : 'Reps unconfigured')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          {ex.rest_seconds !== null && ex.rest_seconds !== undefined && <span>Rest {ex.rest_seconds}s</span>}
                          {ex.is_optional ? <span style={{ color: 'var(--accent-cyan)' }}>• Optional</span> : null}
                        </div>
                        {ex.notes && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            Cue: {ex.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No exercises programmed
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      ) : (
        /* Daily Editor View */
        <>
          {/* Weekday Schedule Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((dayName, idx) => {
              const isSelected = selectedDayIndex === idx;
              const dayData = versionDetails?.days?.[idx];
              const isRest = dayData?.is_rest_day;

              return (
                <Button
                  key={idx}
                  id={`btn-day-tab-${idx}`}
                  variant={isSelected ? 'primary' : 'secondary'}
                  onClick={() => setSelectedDayIndex(idx)}
                  style={{
                    padding: '0.85rem 0.5rem',
                    height: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Day {idx + 1}
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '0.2rem' }}>
                    {dayName}
                  </div>
                  <div style={{ fontSize: '0.7rem', marginTop: '0.35rem', color: isSelected ? '#ffffff' : (isRest ? 'var(--accent-amber)' : 'var(--text-secondary)') }}>
                    {isRest ? 'Rest Day' : `${dayData?.exercises?.length || 0} Exercises`}
                  </div>
                </Button>
              );
            })}
          </div>

          {/* Selected Day Workout Content */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                    {activeDay?.name || `Day ${selectedDayIndex + 1}`}
                  </h3>
                  {!isPublished && (
                    <Button
                      onClick={handleOpenEditDayModal}
                      variant="secondary"
                      size="sm"
                      title="Edit day title & notes"
                      icon={<Edit2 size={12} />}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Edit Title
                    </Button>
                  )}
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {activeDay?.is_rest_day ? 'Scheduled Rest and Recovery Day' : (activeDay?.notes || 'No day notes configured')}
                </span>
              </div>

              {!isPublished && (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <Button onClick={handleToggleRestDay} variant="secondary" size="sm" id="btn-toggle-rest-day">
                    {activeDay?.is_rest_day ? 'Convert to Training Day' : 'Set as Rest Day'}
                  </Button>
                  {!activeDay?.is_rest_day && (
                    <Button onClick={handleOpenAddModal} variant="primary" size="sm" id="btn-add-exercise" icon={<Plus size={14} />}>
                      Add Exercise
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Exercises List */}
            {!activeDay?.is_rest_day ? (
              activeDay?.exercises && activeDay.exercises.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeDay.exercises.map((ex: any, i: number) => {
                    const isExpanded = Boolean(expandedExerciseSets[ex.id]);
                    const setsCount = Number(ex.target_sets || 0);

                    return (
                      <div
                        key={ex.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                          padding: '1rem 1.25rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {/* Reordering Controls */}
                            {!isPublished && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                <IconButton
                                  icon={<ArrowUp size={14} />}
                                  label="Move Up"
                                  size="sm"
                                  disabled={i === 0}
                                  onClick={() => handleMoveExercise(i, 'up')}
                                  style={{ width: '22px', height: '22px' }}
                                />
                                <IconButton
                                  icon={<ArrowDown size={14} />}
                                  label="Move Down"
                                  size="sm"
                                  disabled={i === activeDay.exercises.length - 1}
                                  onClick={() => handleMoveExercise(i, 'down')}
                                  style={{ width: '22px', height: '22px' }}
                                />
                              </div>
                            )}

                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              color: 'var(--accent-primary)',
                            }}>
                              {i + 1}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{ex.exercise_name}</span>
                                {ex.is_optional ? (
                                  <Badge variant="info" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                                    Optional
                                  </Badge>
                                ) : null}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span>{ex.muscle_group_name || 'General'}</span>
                                <span>•</span>
                                <span>{ex.equipment_name || 'Standard'}</span>
                                <span>•</span>
                                <span>{ex.tracking_type || 'weight_reps'}</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {ex.target_sets ? `${ex.target_sets} Sets` : 'Sets unconfigured'} × {ex.reps_min && ex.reps_max ? `${ex.reps_min}–${ex.reps_max} Reps` : (ex.reps_min ? `${ex.reps_min} Reps` : 'Reps unconfigured')}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                {ex.rest_seconds !== null && ex.rest_seconds !== undefined && <span>Rest {ex.rest_seconds}s</span>}
                              </div>
                            </div>

                            {setsCount > 0 && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => toggleSetBreakdown(ex.id)}
                                icon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                              >
                                {isExpanded ? 'Hide Sets' : 'Sets'}
                              </Button>
                            )}

                            {!isPublished && (
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <IconButton
                                  icon={<Edit2 size={14} />}
                                  label="Edit Exercise Targets"
                                  size="sm"
                                  onClick={() => handleOpenEditModal(ex)}
                                />
                                <IconButton
                                  icon={<Trash2 size={14} />}
                                  label="Delete Exercise"
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleDeleteExercise(ex.id)}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Cue notes */}
                        {ex.notes && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                            <strong>Cues:</strong> {ex.notes}
                          </div>
                        )}

                        {/* Per-Set Target Breakdown View */}
                        {isExpanded && setsCount > 0 && (
                          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                              Programmed Set Breakdown
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                              {Array.from({ length: setsCount }).map((_, sIdx) => (
                                <div 
                                  key={sIdx}
                                  style={{
                                    padding: '0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  <div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Set {sIdx + 1}</div>
                                  <div style={{ color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                                    {ex.reps_min && ex.reps_max ? `${ex.reps_min}–${ex.reps_max} reps` : (ex.reps_min ? `${ex.reps_min} reps` : 'Unconfigured reps')}
                                  </div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                    {ex.rest_seconds !== null && ex.rest_seconds !== undefined ? `${ex.rest_seconds}s rest` : 'Rest unconfigured'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  No exercises added for this day. Click <strong>"Add Exercise"</strong> to add movements from your exercise library.
                </div>
              )
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--accent-amber, #f59e0b)', backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-md)' }}>
                Rest Day — Focus on nutrition, sleep, hydration, and active recovery.
              </div>
            )}
          </Card>
        </>
      )}

      {/* Add / Edit Exercise Modal */}
      {showAddExerciseModal && (
        <Dialog
          isOpen={showAddExerciseModal}
          onClose={() => setShowAddExerciseModal(false)}
          title={editingExercise ? `Edit ${editingExercise.exercise_name}` : `Add Exercise to ${activeDay?.name || 'Workout Day'}`}
          maxWidth="560px"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setShowAddExerciseModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" id="btn-save-exercise-modal" onClick={handleSaveExercise}>
                {editingExercise ? 'Save Changes' : 'Add to Day'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveExercise} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!editingExercise && (
              <FormField label="Select Exercise">
                {libraryExercises.length === 0 ? (
                  <p style={{ color: 'var(--accent-amber)', fontSize: '0.85rem' }}>No exercises found in library. Please create exercises in the Exercise Library first.</p>
                ) : (
                  <Select
                    options={[
                      { value: '', label: '-- Choose Exercise --' },
                      ...libraryExercises.map((ex) => ({
                        value: ex.id,
                        label: `${ex.name} (${ex.primary_muscle_group_name || 'General'})`,
                      })),
                    ]}
                    value={exForm.exerciseId}
                    onChange={(val) => setExForm({ ...exForm, exerciseId: val === '' ? '' : Number(val) })}
                    placeholder="Choose Exercise..."
                    searchable
                  />
                )}
              </FormField>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <FormField label="Working Sets" required>
                <NumberInput
                  id="input-target-sets"
                  min={1}
                  max={20}
                  required
                  placeholder="e.g. 3"
                  value={exForm.targetSets}
                  onChange={(val) => setExForm({ ...exForm, targetSets: val })}
                />
              </FormField>
              <FormField label="Min Reps" required>
                <NumberInput
                  id="input-reps-min"
                  min={1}
                  max={500}
                  required
                  placeholder="e.g. 8"
                  value={exForm.repsMin}
                  onChange={(val) => setExForm({ ...exForm, repsMin: val })}
                />
              </FormField>
              <FormField label="Max Reps">
                <NumberInput
                  id="input-reps-max"
                  min={1}
                  max={500}
                  placeholder="e.g. 12"
                  value={exForm.repsMax}
                  onChange={(val) => setExForm({ ...exForm, repsMax: val })}
                />
              </FormField>
            </div>

              <FormField label="Rest (seconds)">
                <NumberInput
                  id="input-rest-seconds"
                  min={0}
                  max={600}
                  step={15}
                  placeholder="e.g. 90"
                  value={exForm.restSeconds}
                  onChange={(val) => setExForm({ ...exForm, restSeconds: val })}
                />
              </FormField>

            <FormField label="Technique & Cue Notes">
              <TextArea
                id="input-exercise-notes"
                rows={2}
                placeholder="e.g. Pause 1 second at the bottom, maintain neutral spine"
                value={exForm.notes}
                onChange={(e) => setExForm({ ...exForm, notes: e.target.value })}
              />
            </FormField>

            <div style={{ marginTop: '0.25rem' }}>
              <Checkbox
                id="checkbox-is-optional"
                checked={exForm.isOptional}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExForm({ ...exForm, isOptional: e.target.checked })}
                label="Mark as Optional Movement (Accessory / Finisher)"
              />
            </div>
          </form>
        </Dialog>
      )}

      {/* Edit Day Details Modal */}
      {showEditDayModal && (
        <Dialog
          isOpen={showEditDayModal}
          onClose={() => setShowEditDayModal(false)}
          title={`Edit Day ${selectedDayIndex + 1} Details`}
          maxWidth="480px"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setShowEditDayModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" onClick={handleSaveDayDetails}>
                Save Day
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveDayDetails} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FormField label="Day Title" required>
              <TextInput
                required
                placeholder="e.g. Upper Body Hypertrophy"
                value={dayNameInput}
                onChange={(e) => setDayNameInput(e.target.value)}
              />
            </FormField>

            <FormField label="Day Focus / Warm-up Notes">
              <TextArea
                rows={3}
                placeholder="Warm-up protocols, focus muscle groups, recovery cues..."
                value={dayNotesInput}
                onChange={(e) => setDayNotesInput(e.target.value)}
              />
            </FormField>
          </form>
        </Dialog>
      )}
    </div>
  );
};
