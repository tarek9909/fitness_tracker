import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { formatDateOnly } from '../utils/date-utils';
import { parseBoundedInteger, parseBoundedFloat } from '../utils/number-utils';
import {
  User, Dumbbell, Utensils, Droplets, HeartPulse,
  Calendar, CheckCircle2, XCircle, ArrowLeft, RefreshCw,
  Scale, ShieldAlert, AlertTriangle, Smartphone, Plus, X, Edit3, AlertCircle, Trash2, Sliders, Layers
} from 'lucide-react';
import {
  Button, IconButton, Dialog, FormField, TextInput, NumberInput, Select, AlertBanner, Badge
} from '../components/ui';

interface UserDetailPageProps {
  userId: number;
  onBack: () => void;
}

const WEEKDAYS = [
  { id: 1, name: 'Mon', full: 'Monday' },
  { id: 2, name: 'Tue', full: 'Tuesday' },
  { id: 3, name: 'Wed', full: 'Wednesday' },
  { id: 4, name: 'Thu', full: 'Thursday' },
  { id: 5, name: 'Fri', full: 'Friday' },
  { id: 6, name: 'Sat', full: 'Saturday' },
  { id: 7, name: 'Sun', full: 'Sunday' },
];

export const UserDetailPage: React.FC<UserDetailPageProps> = ({ userId, onBack }) => {
  const [dossier, setDossier] = useState<any>(null);
  const [cardioActivities, setCardioActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- Modals State ---
  // 1. Water Target Modal
  const [waterModalOpen, setWaterModalOpen] = useState<boolean>(false);
  const [waterTargetMl, setWaterTargetMl] = useState<number | ''>('');
  const [waterEffectiveFrom, setWaterEffectiveFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [savingWater, setSavingWater] = useState<boolean>(false);

  // 2. Water Quick-Add Modal
  const [quickAddModalOpen, setQuickAddModalOpen] = useState<boolean>(false);
  const [quickAddList, setQuickAddList] = useState<number[]>([]);
  const [newQuickAddInput, setNewQuickAddInput] = useState<string>('');
  const [savingQuickAdd, setSavingQuickAdd] = useState<boolean>(false);

  // 3. Weight Goal Modal
  const [weightModalOpen, setWeightModalOpen] = useState<boolean>(false);
  const [startWeightKg, setStartWeightKg] = useState<number | ''>('');
  const [targetWeightKg, setTargetWeightKg] = useState<number | ''>('');
  const [weightStartDate, setWeightStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [weightTargetDate, setWeightTargetDate] = useState<string>('');
  const [weightNotes, setWeightNotes] = useState<string>('');
  const [savingWeight, setSavingWeight] = useState<boolean>(false);

  // 4. Cardio Target Modal
  const [cardioModalOpen, setCardioModalOpen] = useState<boolean>(false);
  const [cardioActivityId, setCardioActivityId] = useState<number | ''>('');
  const [cardioMinDuration, setCardioMinDuration] = useState<number | ''>('');
  const [cardioMaxDuration, setCardioMaxDuration] = useState<number | ''>('');
  const [cardioWeekdays, setCardioWeekdays] = useState<number[]>([]);
  const [cardioSpeedMin, setCardioSpeedMin] = useState<string>('');
  const [cardioSpeedMax, setCardioSpeedMax] = useState<string>('');
  const [cardioInclineMin, setCardioInclineMin] = useState<string>('');
  const [cardioInclineMax, setCardioInclineMax] = useState<string>('');
  const [cardioDistMin, setCardioDistMin] = useState<string>('');
  const [cardioDistMax, setCardioDistMax] = useState<string>('');
  const [cardioEffectiveFrom, setCardioEffectiveFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [cardioEffectiveUntil, setCardioEffectiveUntil] = useState<string>('');
  const [cardioNotes, setCardioNotes] = useState<string>('');
  const [savingCardio, setSavingCardio] = useState<boolean>(false);

  // 5. Adherence Weights Modal
  const [adherenceModalOpen, setAdherenceModalOpen] = useState<boolean>(false);
  const [dietWeight, setDietWeight] = useState<number>(35);
  const [workoutWeight, setWorkoutWeight] = useState<number>(25);
  const [cardioWeight, setCardioWeight] = useState<number>(15);
  const [waterWeight, setWaterWeight] = useState<number>(15);
  const [weightLoggingWeight, setWeightLoggingWeight] = useState<number>(10);
  const [savingAdherence, setSavingAdherence] = useState<boolean>(false);

  const adherenceSum = useMemo(() => {
    return Math.round((dietWeight + workoutWeight + cardioWeight + waterWeight + weightLoggingWeight) * 100) / 100;
  }, [dietWeight, workoutWeight, cardioWeight, waterWeight, weightLoggingWeight]);

  const isAdherenceValid = Math.abs(adherenceSum - 100) < 0.01;

  const fetchDossier = async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, activities] = await Promise.all([
        api.get<any>(`/admin/users/${userId}/monitoring`),
        api.get<any[]>('/admin/cardio/activities'),
      ]);

      setDossier(data);
      if (Array.isArray(activities)) {
        setCardioActivities(activities);
      }

      // Populate Water Target Defaults
      setWaterTargetMl(data.goals?.water?.target_ml ?? '');
      if (data.goals?.water?.effective_from) {
        setWaterEffectiveFrom(data.goals.water.effective_from);
      }

      // Populate Water Quick Add
      setQuickAddList(Array.isArray(data.goals?.waterQuickAdd)
        ? data.goals.waterQuickAdd.map((o: any) => o.amount_ml)
        : []);

      // Populate Weight Goal
      if (data.goals?.weight?.target_weight_kg) {
        setTargetWeightKg(data.goals.weight.target_weight_kg);
        setStartWeightKg(data.goals.weight.starting_weight_kg ?? (data.today?.latestWeight?.weight_kg ?? ''));
        if (data.goals.weight.start_date) setWeightStartDate(data.goals.weight.start_date);
        if (data.goals.weight.target_date) setWeightTargetDate(data.goals.weight.target_date);
        if (data.goals.weight.notes) setWeightNotes(data.goals.weight.notes);
      } else if (data.today?.latestWeight?.weight_kg) {
        setStartWeightKg(data.today.latestWeight.weight_kg);
        setTargetWeightKg('');
      } else {
        setStartWeightKg('');
        setTargetWeightKg('');
      }

      // Populate Adherence Weights
      if (data.goals?.adherenceConfig) {
        setDietWeight(Number(data.goals.adherenceConfig.diet_weight_pct ?? 35));
        setWorkoutWeight(Number(data.goals.adherenceConfig.workout_weight_pct ?? 25));
        setCardioWeight(Number(data.goals.adherenceConfig.cardio_weight_pct ?? 15));
        setWaterWeight(Number(data.goals.adherenceConfig.water_weight_pct ?? 15));
        setWeightLoggingWeight(Number(data.goals.adherenceConfig.weight_logging_weight_pct ?? 10));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load user monitoring dossier');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDossier();
  }, [userId]);

  const handleToggleStatus = async () => {
    if (!dossier?.user) return;
    const isCurrentlyActive = dossier.user.status === 'active';
    const action = isCurrentlyActive ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} this user's account?`)) return;

    try {
      setTogglingStatus(true);
      await api.post(`/admin/users/${userId}/${action}`);
      setFeedback({ type: 'success', message: `Account ${action}d successfully` });
      await fetchDossier();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || `Failed to ${action} user` });
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleSaveWaterTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (waterTargetMl === '' || Number(waterTargetMl) < 500 || Number(waterTargetMl) > 10000) {
      setFeedback({ type: 'error', message: 'Please enter a valid daily water target between 500 ml and 10,000 ml' });
      return;
    }
    try {
      setSavingWater(true);
      await api.post(`/admin/users/${userId}/water-targets`, {
        dailyTargetMl: Number(waterTargetMl),
        effectiveFrom: waterEffectiveFrom,
      });
      setFeedback({ type: 'success', message: 'Water target updated successfully' });
      setWaterModalOpen(false);
      await fetchDossier();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to set water target' });
    } finally {
      setSavingWater(false);
    }
  };

  const handleSaveQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAddList.length === 0) {
      setFeedback({ type: 'error', message: 'Please include at least one quick-add preset' });
      return;
    }
    try {
      setSavingQuickAdd(true);
      await api.put(`/admin/users/${userId}/water-quick-add`, {
        options: quickAddList.map((amount, idx) => ({
          amountMl: amount,
          displayOrder: idx + 1,
          isActive: true,
        })),
      });
      setFeedback({ type: 'success', message: 'Water quick-add presets updated successfully' });
      setQuickAddModalOpen(false);
      await fetchDossier();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update water quick-add presets' });
    } finally {
      setSavingQuickAdd(false);
    }
  };

  const handleAddQuickAddAmount = () => {
    const val = parseInt(newQuickAddInput.trim(), 10);
    if (isNaN(val) || val < 50 || val > 5000) {
      alert('Please enter a valid amount between 50 ml and 5000 ml');
      return;
    }
    if (quickAddList.includes(val)) {
      alert('This amount is already in your quick-add presets');
      return;
    }
    setQuickAddList([...quickAddList, val].sort((a, b) => a - b));
    setNewQuickAddInput('');
  };

  const handleRemoveQuickAddAmount = (amountToRemove: number) => {
    setQuickAddList(quickAddList.filter(a => a !== amountToRemove));
  };

  const handleSaveWeightGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (startWeightKg === '' || targetWeightKg === '') {
      setFeedback({ type: 'error', message: 'Please enter starting and target weight values' });
      return;
    }
    const parsedStartWeight = parseBoundedFloat(startWeightKg, { min: 20, max: 500, fallback: 0 });
    const parsedTargetWeight = parseBoundedFloat(targetWeightKg, { min: 20, max: 500, fallback: 0 });
    if (parsedStartWeight < 20 || parsedTargetWeight < 20) {
      setFeedback({ type: 'error', message: 'Weight values must be between 20 kg and 500 kg' });
      return;
    }
    try {
      setSavingWeight(true);
      await api.post(`/admin/users/${userId}/weight-goals`, {
        startingWeightKg: parsedStartWeight,
        targetWeightKg: parsedTargetWeight,
        startDate: weightStartDate,
        targetDate: weightTargetDate.trim() || null,
        notes: weightNotes.trim() || null,
      });
      setFeedback({ type: 'success', message: 'Weight goal updated successfully' });
      setWeightModalOpen(false);
      await fetchDossier();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to set weight goal' });
    } finally {
      setSavingWeight(false);
    }
  };

  const handleSaveCardioTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cardioMinDuration === '' || Number(cardioMinDuration) < 1) {
      alert('Please enter a minimum duration of at least 1 minute');
      return;
    }
    if (cardioWeekdays.length === 0) {
      alert('Please select at least one weekday');
      return;
    }
    try {
      setSavingCardio(true);
      const payload: any = {
        cardioActivityId: cardioActivityId === '' ? null : Number(cardioActivityId),
        minDurationMinutes: Number(cardioMinDuration),
        weekdays: cardioWeekdays,
        effectiveFrom: cardioEffectiveFrom,
        effectiveUntil: cardioEffectiveUntil.trim() || null,
        notes: cardioNotes.trim() || null,
      };

      if (cardioMaxDuration !== '') payload.maxDurationMinutes = Number(cardioMaxDuration);
      if (cardioSpeedMin.trim() !== '') payload.targetSpeedMinKmh = parseFloat(cardioSpeedMin);
      if (cardioSpeedMax.trim() !== '') payload.targetSpeedMaxKmh = parseFloat(cardioSpeedMax);
      if (cardioInclineMin.trim() !== '') payload.targetInclineMin = parseFloat(cardioInclineMin);
      if (cardioInclineMax.trim() !== '') payload.targetInclineMax = parseFloat(cardioInclineMax);
      if (cardioDistMin.trim() !== '') payload.targetDistanceMinKm = parseFloat(cardioDistMin);
      if (cardioDistMax.trim() !== '') payload.targetDistanceMaxKm = parseFloat(cardioDistMax);

      await api.post(`/admin/users/${userId}/cardio-targets`, payload);
      setFeedback({ type: 'success', message: 'Cardio target created successfully' });
      setCardioModalOpen(false);
      await fetchDossier();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create cardio target' });
    } finally {
      setSavingCardio(false);
    }
  };

  const handleDeleteCardioTarget = async (targetId: number) => {
    if (!window.confirm('Are you sure you want to remove this cardio target?')) return;
    try {
      await api.delete(`/admin/users/${userId}/cardio-targets/${targetId}`);
      setFeedback({ type: 'success', message: 'Cardio target removed successfully' });
      await fetchDossier();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to remove cardio target' });
    }
  };

  const handleSaveAdherenceWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdherenceValid) {
      alert(`Adherence weights must total exactly 100% (currently ${adherenceSum}%)`);
      return;
    }
    try {
      setSavingAdherence(true);
      await api.put(`/admin/users/${userId}/adherence-config`, {
        dietWeightPct: dietWeight,
        workoutWeightPct: workoutWeight,
        cardioWeightPct: cardioWeight,
        waterWeightPct: waterWeight,
        weightLoggingWeightPct: weightLoggingWeight,
      });
      setFeedback({ type: 'success', message: 'Adherence configuration saved successfully' });
      setAdherenceModalOpen(false);
      await fetchDossier();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save adherence configuration' });
    } finally {
      setSavingAdherence(false);
    }
  };

  const toggleWeekday = (dayId: number) => {
    if (cardioWeekdays.includes(dayId)) {
      setCardioWeekdays(cardioWeekdays.filter(d => d !== dayId));
    } else {
      setCardioWeekdays([...cardioWeekdays, dayId].sort((a, b) => a - b));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
        <RefreshCw size={32} className="spin" style={{ marginBottom: '16px' }} />
        <p style={{ fontSize: '16px' }}>Loading client dossier & tracking metrics...</p>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div style={{ padding: '24px' }}>
        <Button
          onClick={onBack}
          variant="secondary"
          size="sm"
          icon={<ArrowLeft size={16} />}
          style={{ marginBottom: '16px' }}
        >
          Back to Users
        </Button>
        <AlertBanner
          type="error"
          message={error || 'User not found'}
        />
      </div>
    );
  }

  const { user, assignments, goals, today, adherence, recentTasks, recentWeightHistory, pushDevices } = dossier;
  const isActive = user.status === 'active';
  const adherenceConf = goals.adherenceConfig || {
    diet_weight_pct: 35,
    workout_weight_pct: 25,
    cardio_weight_pct: 15,
    water_weight_pct: 15,
    weight_logging_weight_pct: 10,
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <Button
          onClick={onBack}
          variant="secondary"
          size="sm"
          icon={<ArrowLeft size={16} />}
        >
          Back to Users List
        </Button>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Button
            onClick={fetchDossier}
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
          <Button
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            variant={isActive ? 'danger' : 'primary'}
            size="sm"
            icon={<ShieldAlert size={15} />}
          >
            {isActive ? 'Disable Account' : 'Activate Account'}
          </Button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <AlertBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
          style={{ marginBottom: '20px' }}
        />
      )}

      {/* User Header Profile Card */}
      <div style={{
        background: 'var(--bg-secondary, #1e293b)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent-primary, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: 700,
            color: '#fff',
          }}>
            {user.first_name ? user.first_name[0].toUpperCase() : 'U'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 700 }}>
                {user.first_name} {user.last_name || ''}
              </h1>
              <span style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                background: isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isActive ? '#4ade80' : '#f87171',
              }}>
                {user.status}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '14px', marginTop: '4px' }}>
              {user.email} • Timezone: {user.timezone || 'UTC'} • Joined: {formatDateOnly(user.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {/* Workout Plan */}
        <div style={{
          background: 'var(--bg-secondary, #1e293b)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#38bdf8', marginBottom: '8px' }}>
            <Dumbbell size={20} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Active Workout Plan</h3>
          </div>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
            {assignments.workout ? assignments.workout.workout_plan_name : 'None Assigned'}
          </p>
          {assignments.workout && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
              Version {assignments.workout.version_number} • From {assignments.workout.effective_from}
            </p>
          )}
        </div>

        {/* Diet Plan */}
        <div style={{
          background: 'var(--bg-secondary, #1e293b)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#4ade80', marginBottom: '8px' }}>
            <Utensils size={20} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Active Diet Plan</h3>
          </div>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
            {assignments.diet ? assignments.diet.diet_plan_name : 'None Assigned'}
          </p>
          {assignments.diet && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
              Version {assignments.diet.version_number} • From {assignments.diet.effective_from}
            </p>
          )}
        </div>

        {/* Water & Weight Target Summary */}
        <div style={{
          background: 'var(--bg-secondary, #1e293b)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', marginBottom: '8px' }}>
            <Droplets size={20} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Water & Weight Targets</h3>
          </div>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
            {goals.water?.target_ml ? `${goals.water.target_ml} ml / day` : 'Not configured'}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
            {goals.weight ? `Target: ${goals.weight.target_weight_kg} kg (from ${goals.weight.starting_weight_kg || '—'} kg)` : 'No weight goal set'}
          </p>
        </div>

        {/* Adherence Score */}
        <div style={{
          background: 'var(--bg-secondary, #1e293b)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#a855f7', marginBottom: '8px' }}>
            <HeartPulse size={20} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>Adherence Score</h3>
          </div>
          <p style={{ fontSize: '24px', fontWeight: 800, color: adherence.adherenceRate >= 80 ? '#4ade80' : '#f59e0b' }}>
            {adherence.adherenceRate}%
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
            {adherence.completedTasksCount} completed / {adherence.missedTasksCount} missed ({adherence.totalTasksEvaluated} evaluated)
          </p>
        </div>
      </div>

      {/* Target Management Control Center */}
      <div style={{
        background: 'var(--bg-secondary, #1e293b)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={20} color="var(--accent-primary, #3b82f6)" /> Goals & Target Management
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
              Configure hydration targets, body weight milestones, cardio schedules, and adherence weights.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              onClick={() => setWaterModalOpen(true)}
              variant="secondary"
              size="sm"
              icon={<Droplets size={14} />}
            >
              Water Target
            </Button>
            <Button
              onClick={() => setQuickAddModalOpen(true)}
              variant="secondary"
              size="sm"
              icon={<Layers size={14} />}
            >
              Water Quick-Adds
            </Button>
            <Button
              onClick={() => setWeightModalOpen(true)}
              variant="secondary"
              size="sm"
              icon={<Scale size={14} />}
            >
              Weight Goal
            </Button>
            <Button
              onClick={() => setCardioModalOpen(true)}
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
            >
              Add Cardio Target
            </Button>
            <Button
              onClick={() => setAdherenceModalOpen(true)}
              variant="secondary"
              size="sm"
              icon={<Sliders size={14} />}
            >
              Adherence Weights
            </Button>
          </div>
        </div>

        {/* 3 Grid Panels in Target Management */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {/* Panel A: Water Quick Adds */}
          <div style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa' }}>Water Quick-Add Presets</span>
              <IconButton
                icon={<Edit3 size={14} />}
                onClick={() => setQuickAddModalOpen(true)}
                label="Edit Water Quick-Adds"
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {goals.waterQuickAdd && goals.waterQuickAdd.length > 0
                ? goals.waterQuickAdd.map((opt: any, idx: number) => {
                    const amount = typeof opt === 'number' ? opt : opt.amount_ml;
                    return (
                      <span
                        key={idx}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'rgba(96, 165, 250, 0.12)',
                          border: '1px solid rgba(96, 165, 250, 0.25)',
                          color: '#93c5fd',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        +{amount} ml
                      </span>
                    );
                  })
                : <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '12px' }}>No presets configured</span>}
            </div>
          </div>

          {/* Panel B: Adherence Component Weights */}
          <div style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#c084fc' }}>Adherence Weights (Total: 100%)</span>
              <IconButton
                icon={<Edit3 size={14} />}
                onClick={() => setAdherenceModalOpen(true)}
                label="Edit Adherence Weights"
              />
            </div>
            {/* Visual Distribution Bar */}
            <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
              <div style={{ width: `${adherenceConf.diet_weight_pct}%`, background: '#4ade80' }} title={`Diet: ${adherenceConf.diet_weight_pct}%`} />
              <div style={{ width: `${adherenceConf.workout_weight_pct}%`, background: '#38bdf8' }} title={`Workout: ${adherenceConf.workout_weight_pct}%`} />
              <div style={{ width: `${adherenceConf.cardio_weight_pct}%`, background: '#f43f5e' }} title={`Cardio: ${adherenceConf.cardio_weight_pct}%`} />
              <div style={{ width: `${adherenceConf.water_weight_pct}%`, background: '#60a5fa' }} title={`Water: ${adherenceConf.water_weight_pct}%`} />
              <div style={{ width: `${adherenceConf.weight_logging_weight_pct}%`, background: '#fbbf24' }} title={`Weight: ${adherenceConf.weight_logging_weight_pct}%`} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
              <span>Diet: <strong style={{ color: '#4ade80' }}>{adherenceConf.diet_weight_pct}%</strong></span>
              <span>Workout: <strong style={{ color: '#38bdf8' }}>{adherenceConf.workout_weight_pct}%</strong></span>
              <span>Cardio: <strong style={{ color: '#f43f5e' }}>{adherenceConf.cardio_weight_pct}%</strong></span>
              <span>Water: <strong style={{ color: '#60a5fa' }}>{adherenceConf.water_weight_pct}%</strong></span>
              <span>Weight: <strong style={{ color: '#fbbf24' }}>{adherenceConf.weight_logging_weight_pct}%</strong></span>
            </div>
          </div>

          {/* Panel C: Weight Goal Status */}
          <div style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#34d399' }}>Body Weight Milestones</span>
              <IconButton
                icon={<Edit3 size={14} />}
                onClick={() => setWeightModalOpen(true)}
                label="Edit Body Weight Goal"
              />
            </div>
            {goals.weight ? (
              <div style={{ fontSize: '12px' }}>
                <p style={{ color: '#f8fafc', fontWeight: 600 }}>
                  Start: {goals.weight.starting_weight_kg} kg ➔ Target: {goals.weight.target_weight_kg} kg
                </p>
                <p style={{ color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
                  From: {goals.weight.start_date} {goals.weight.target_date ? `to ${goals.weight.target_date}` : ''}
                </p>
                {goals.weight.notes && (
                  <p style={{ color: 'var(--text-secondary, #94a3b8)', fontStyle: 'italic', marginTop: '2px' }}>
                    Note: {goals.weight.notes}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>No active weight goal assigned.</p>
            )}
          </div>
        </div>

        {/* Cardio Target Schedule List */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HeartPulse size={16} /> Scheduled Cardio Targets ({Array.isArray(goals.cardio) ? goals.cardio.length : 0})
            </h3>
          </div>
          {(!Array.isArray(goals.cardio) || goals.cardio.length === 0) ? (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary, #94a3b8)', padding: '12px', background: 'rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}>
              No cardio targets scheduled for this client. Click "Add Cardio Target" to assign weekly cardio requirements.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {goals.cardio.map((ct: any) => {
                const targetDays = Array.isArray(ct.weekdays)
                  ? ct.weekdays.map((w: number) => WEEKDAYS.find(d => d.id === w)?.name || `D${w}`).join(', ')
                  : 'All Days';

                return (
                  <div
                    key={ct.id}
                    style={{
                      padding: '14px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '10px',
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '14px' }}>
                          {ct.activity_name || 'General Cardio'}
                        </span>
                        <IconButton
                          icon={<Trash2 size={14} />}
                          onClick={() => handleDeleteCardioTarget(ct.id)}
                          label="Remove Cardio Target"
                          style={{ color: '#ef4444' }}
                        />
                      </div>
                      <p style={{ fontSize: '12px', color: '#f43f5e', fontWeight: 600, marginTop: '2px' }}>
                        {ct.min_duration_minutes || ct.target_minutes_min}
                        {ct.max_duration_minutes || ct.target_minutes_max ? `-${ct.max_duration_minutes || ct.target_minutes_max}` : ''} mins • Days: {targetDays}
                      </p>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {ct.target_speed_min_kmh && <span>Speed: {ct.target_speed_min_kmh}{ct.target_speed_max_kmh ? `-${ct.target_speed_max_kmh}` : ''} km/h</span>}
                        {ct.target_incline_min && <span>Incline: {ct.target_incline_min}{ct.target_incline_max ? `-${ct.target_incline_max}` : ''}%</span>}
                        {ct.target_distance_min_km && <span>Dist: {ct.target_distance_min_km}{ct.target_distance_max_km ? `-${ct.target_distance_max_km}` : ''} km</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '6px' }}>
                      Effective: {ct.effective_from} {ct.effective_until ? `to ${ct.effective_until}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout: Today's Execution + Recent Tasks Checklist */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '24px',
        marginBottom: '24px',
      }}>
        {/* Today's Activity Card */}
        <div style={{
          background: 'var(--bg-secondary, #1e293b)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--accent-primary, #3b82f6)" /> Today's Live Logging
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Water */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Droplets size={18} color="#60a5fa" />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Water Intake</span>
              </div>
              <span style={{ fontWeight: 700, color: '#60a5fa', fontSize: '15px' }}>{today.waterMl} ml</span>
            </div>

            {/* Workout */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Dumbbell size={18} color="#38bdf8" />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Workout Session</span>
              </div>
              <span style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                background: today.workout?.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: today.workout?.status === 'completed' ? '#4ade80' : '#f59e0b',
              }}>
                {today.workout ? today.workout.status : 'Not Started'}
              </span>
            </div>

            {/* Meals Logged */}
            <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: today.meals.length > 0 ? '8px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Utensils size={18} color="#4ade80" />
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>Meals Logged Today</span>
                </div>
                <span style={{ fontWeight: 700, color: '#4ade80' }}>{today.meals.length}</span>
              </div>
              {today.meals.map((m: any) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
                  <span>{m.meal_name}</span>
                  <span style={{ textTransform: 'capitalize', color: m.status === 'completed' ? '#4ade80' : '#f59e0b' }}>{m.status}</span>
                </div>
              ))}
            </div>

            {/* Cardio */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <HeartPulse size={18} color="#f43f5e" />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Cardio Activity</span>
              </div>
              <span style={{ fontWeight: 700, color: '#f43f5e' }}>{today.cardio.length} sessions</span>
            </div>
          </div>
        </div>

        {/* Recent Tasks Checklist */}
        <div style={{
          background: 'var(--bg-secondary, #1e293b)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="var(--accent-primary, #3b82f6)" /> Recent Tasks & Compliance
          </h2>

          <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentTasks.length === 0 ? (
              <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                No tasks generated for this user yet.
              </p>
            ) : (
              recentTasks.map((t: any) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {t.status === 'completed' ? (
                      <CheckCircle2 size={16} color="#22c55e" />
                    ) : (
                      <XCircle size={16} color={t.status === 'missed' ? '#ef4444' : '#f59e0b'} />
                    )}
                    <div>
                      <p style={{ fontWeight: 600, color: '#f8fafc' }}>{t.title_snapshot}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>{t.task_date} • {t.task_type}</p>
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    background: t.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: t.status === 'completed' ? '#4ade80' : '#f87171',
                  }}>
                    {t.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Push Devices Card */}
      {pushDevices && pushDevices.length > 0 && (
        <div style={{
          background: 'var(--bg-secondary, #1e293b)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          marginBottom: '24px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Smartphone size={18} color="var(--accent-primary, #3b82f6)" /> Registered Client Devices ({pushDevices.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {pushDevices.map((d: any) => (
              <div key={d.id} style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase', color: '#38bdf8' }}>{d.platform}</span>
                  <span style={{ color: d.is_active ? '#4ade80' : '#f87171' }}>{d.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <div style={{ color: 'var(--text-secondary, #94a3b8)' }}>UUID: {d.device_uuid}</div>
                {d.app_version && <div style={{ color: 'var(--text-secondary, #94a3b8)' }}>App Ver: {d.app_version}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weight History Table */}
      {recentWeightHistory && recentWeightHistory.length > 0 && (
        <div style={{
          background: 'var(--bg-secondary, #1e293b)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scale size={18} color="var(--accent-primary, #3b82f6)" /> Weight Entries (Last 7)
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
                <th style={{ padding: '10px 12px', color: 'var(--text-secondary, #94a3b8)' }}>Date</th>
                <th style={{ padding: '10px 12px', color: 'var(--text-secondary, #94a3b8)' }}>Weight (kg)</th>
                <th style={{ padding: '10px 12px', color: 'var(--text-secondary, #94a3b8)' }}>Source</th>
                <th style={{ padding: '10px 12px', color: 'var(--text-secondary, #94a3b8)' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {recentWeightHistory.map((w: any) => (
                <tr key={w.id} style={{ borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.04))' }}>
                  <td style={{ padding: '10px 12px' }}>{w.measurement_date}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#38bdf8' }}>{w.weight_kg} kg</td>
                  <td style={{ padding: '10px 12px', textTransform: 'capitalize' }}>{w.source}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary, #94a3b8)' }}>{w.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- MODALS --- */}

      {/* 1. Water Target Modal */}
      <Dialog
        isOpen={waterModalOpen}
        onClose={() => setWaterModalOpen(false)}
        title="Set Daily Water Target"
      >
        <form onSubmit={handleSaveWaterTarget} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FormField label="Daily Target (ml)" required>
            <NumberInput
              value={waterTargetMl}
              onChange={val => setWaterTargetMl(val === '' ? '' : parseBoundedInteger(String(val), { min: 500, max: 10000, fallback: 0 }))}
              required
              min={500}
              max={10000}
            />
          </FormField>
          <FormField label="Effective From Date" required>
            <TextInput
              type="date"
              value={waterEffectiveFrom}
              onChange={e => setWaterEffectiveFrom(e.target.value)}
              required
            />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setWaterModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={savingWater}>
              Save Target
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 2. Water Quick-Add Presets Modal */}
      <Dialog
        isOpen={quickAddModalOpen}
        onClose={() => setQuickAddModalOpen(false)}
        title="Configure Water Quick-Adds"
      >
        <form onSubmit={handleSaveQuickAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Active Quick-Add Amounts</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {quickAddList.map((amt) => (
                <span
                  key={amt}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
                >
                  +{amt} ml
                  <IconButton
                    icon={<X size={14} />}
                    onClick={() => handleRemoveQuickAddAmount(amt)}
                    label={`Remove ${amt} ml`}
                    style={{ color: '#f87171', padding: 0 }}
                  />
                </span>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Add Preset (ml)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <NumberInput
                min={50}
                max={5000}
                placeholder="e.g. 330"
                value={newQuickAddInput === '' ? '' : Number(newQuickAddInput)}
                onChange={val => setNewQuickAddInput(val === '' ? '' : String(val))}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddQuickAddAmount}
              >
                Add
              </Button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setQuickAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={savingQuickAdd} disabled={quickAddList.length === 0}>
              Save Quick-Adds
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 3. Weight Goal Modal */}
      <Dialog
        isOpen={weightModalOpen}
        onClose={() => setWeightModalOpen(false)}
        title="Set Body Weight Goal"
      >
        <form onSubmit={handleSaveWeightGoal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Starting Weight (kg)" required>
              <NumberInput
                step={0.1}
                placeholder="e.g. 82.5"
                value={startWeightKg}
                onChange={val => setStartWeightKg(val === '' ? '' : Number(val))}
                required
              />
            </FormField>
            <FormField label="Target Weight (kg)" required>
              <NumberInput
                step={0.1}
                placeholder="e.g. 78.0"
                value={targetWeightKg}
                onChange={val => setTargetWeightKg(val === '' ? '' : Number(val))}
                required
              />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Start Date" required>
              <TextInput
                type="date"
                value={weightStartDate}
                onChange={e => setWeightStartDate(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Target Date (Optional)">
              <TextInput
                type="date"
                value={weightTargetDate}
                onChange={e => setWeightTargetDate(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Goal Notes">
            <TextInput
              value={weightNotes}
              onChange={e => setWeightNotes(e.target.value)}
              placeholder="e.g. 12-week lean bulk"
            />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setWeightModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={savingWeight}>
              Save Goal
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 4. Cardio Target Modal */}
      <Dialog
        isOpen={cardioModalOpen}
        onClose={() => setCardioModalOpen(false)}
        title="Configure Cardio Target"
      >
        <form onSubmit={handleSaveCardioTarget} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Cardio Activity</label>
            <Select
              options={[
                { value: '', label: 'General Cardio (Any)' },
                ...cardioActivities.map(act => ({
                  value: act.id,
                  label: act.name,
                })),
              ]}
              value={cardioActivityId}
              onChange={val => setCardioActivityId(val === '' ? '' : Number(val))}
              placeholder="Choose Cardio Activity..."
              searchable
            />
          </div>

          {/* Weekdays Checkboxes */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Scheduled Weekdays</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {WEEKDAYS.map(w => {
                const isSelected = cardioWeekdays.includes(w.id);
                return (
                  <Button
                    key={w.id}
                    type="button"
                    variant={isSelected ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => toggleWeekday(w.id)}
                  >
                    {w.name}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Duration range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Min Duration (mins)" required>
              <NumberInput
                min={1}
                max={1440}
                value={cardioMinDuration}
                onChange={val => setCardioMinDuration(val === '' ? '' : Number(val))}
                required
              />
            </FormField>
            <FormField label="Max Duration (Optional)">
              <NumberInput
                min={cardioMinDuration === '' ? 1 : Number(cardioMinDuration)}
                max={1440}
                placeholder="e.g. 45"
                value={cardioMaxDuration}
                onChange={val => setCardioMaxDuration(val === '' ? '' : Number(val))}
              />
            </FormField>
          </div>

          {/* Speed range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Min Speed (km/h)">
              <TextInput
                placeholder="e.g. 8.0"
                value={cardioSpeedMin}
                onChange={e => setCardioSpeedMin(e.target.value)}
              />
            </FormField>
            <FormField label="Max Speed (km/h)">
              <TextInput
                placeholder="e.g. 11.5"
                value={cardioSpeedMax}
                onChange={e => setCardioSpeedMax(e.target.value)}
              />
            </FormField>
          </div>

          {/* Incline range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Min Incline (%)">
              <TextInput
                placeholder="e.g. 1.0"
                value={cardioInclineMin}
                onChange={e => setCardioInclineMin(e.target.value)}
              />
            </FormField>
            <FormField label="Max Incline (%)">
              <TextInput
                placeholder="e.g. 4.0"
                value={cardioInclineMax}
                onChange={e => setCardioInclineMax(e.target.value)}
              />
            </FormField>
          </div>

          {/* Distance range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Min Distance (km)">
              <TextInput
                placeholder="e.g. 3.0"
                value={cardioDistMin}
                onChange={e => setCardioDistMin(e.target.value)}
              />
            </FormField>
            <FormField label="Max Distance (km)">
              <TextInput
                placeholder="e.g. 5.0"
                value={cardioDistMax}
                onChange={e => setCardioDistMax(e.target.value)}
              />
            </FormField>
          </div>

          {/* Effective Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Effective From" required>
              <TextInput
                type="date"
                value={cardioEffectiveFrom}
                onChange={e => setCardioEffectiveFrom(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Effective Until (Optional)">
              <TextInput
                type="date"
                value={cardioEffectiveUntil}
                onChange={e => setCardioEffectiveUntil(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Target Notes">
            <TextInput
              placeholder="e.g. Zone 2 aerobic threshold training"
              value={cardioNotes}
              onChange={e => setCardioNotes(e.target.value)}
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setCardioModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={savingCardio}>
              Create Target
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 5. Adherence Weights Modal */}
      <Dialog
        isOpen={adherenceModalOpen}
        onClose={() => setAdherenceModalOpen(false)}
        title="Configure Adherence Weights"
      >
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginBottom: '16px' }}>
            Define component contribution to the client's daily adherence score.
          </p>

          {/* Total Indicator Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '16px',
            background: isAdherenceValid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${isAdherenceValid ? '#22c55e' : '#ef4444'}`,
            color: isAdherenceValid ? '#4ade80' : '#f87171',
            fontWeight: 700,
            fontSize: '14px',
          }}>
            <span>Total Weight:</span>
            <span>{adherenceSum}% {isAdherenceValid ? '✓ (Valid)' : '✗ (Must equal 100%)'}</span>
          </div>

          <form onSubmit={handleSaveAdherenceWeights} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FormField label={`Diet Plan Adherence (${dietWeight}%)`} required>
              <NumberInput
                min={0}
                max={100}
                value={dietWeight}
                onChange={val => setDietWeight(val === '' ? 0 : parseBoundedFloat(String(val), { min: 0, max: 100, fallback: 0 }))}
                required
              />
            </FormField>

            <FormField label={`Workout Plan Adherence (${workoutWeight}%)`} required>
              <NumberInput
                min={0}
                max={100}
                value={workoutWeight}
                onChange={val => setWorkoutWeight(val === '' ? 0 : parseBoundedFloat(String(val), { min: 0, max: 100, fallback: 0 }))}
                required
              />
            </FormField>

            <FormField label={`Cardio Target Adherence (${cardioWeight}%)`} required>
              <NumberInput
                min={0}
                max={100}
                value={cardioWeight}
                onChange={val => setCardioWeight(val === '' ? 0 : parseBoundedFloat(String(val), { min: 0, max: 100, fallback: 0 }))}
                required
              />
            </FormField>

            <FormField label={`Water Target Adherence (${waterWeight}%)`} required>
              <NumberInput
                min={0}
                max={100}
                value={waterWeight}
                onChange={val => setWaterWeight(val === '' ? 0 : parseBoundedFloat(String(val), { min: 0, max: 100, fallback: 0 }))}
                required
              />
            </FormField>

            <FormField label={`Weight Logging Adherence (${weightLoggingWeight}%)`} required>
              <NumberInput
                min={0}
                max={100}
                value={weightLoggingWeight}
                onChange={val => setWeightLoggingWeight(val === '' ? 0 : parseBoundedFloat(String(val), { min: 0, max: 100, fallback: 0 }))}
                required
              />
            </FormField>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <Button type="button" variant="secondary" onClick={() => setAdherenceModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={savingAdherence}
                disabled={!isAdherenceValid}
              >
                Save Weights
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </div>
  );
};
