import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  ArrowLeft, Plus, Trash2, Check, Lock, Layers, 
  Utensils, Clock, Flame, X, Edit2, Copy, AlertCircle, RefreshCw,
  ChevronUp, ChevronDown
} from 'lucide-react';

interface DietPlanBuilderProps {
  planId: number;
  initialVersionId?: number;
  onBack: () => void;
}

interface DietOptionForm {
  foodId: number | '';
  customLabel: string;
  servingQuantity: number | '';
  calories: number | '';
  proteinG: number | '';
  carbsG: number | '';
  fatG: number | '';
  isDefault: boolean;
}

export const DietPlanBuilderPage: React.FC<DietPlanBuilderProps> = ({ planId, initialVersionId, onBack }) => {
  const [plan, setPlan] = useState<any>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(initialVersionId || null);
  const [versionDetails, setVersionDetails] = useState<any>(null);
  const [foods, setFoods] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showAddMealModal, setShowAddMealModal] = useState<boolean>(false);
  const [editingMeal, setEditingMeal] = useState<any | null>(null);

  const [showAddGroupModal, setShowAddGroupModal] = useState<number | null>(null); // Meal ID
  const [editingGroup, setEditingGroup] = useState<any | null>(null);

  const [showAddOptionModal, setShowAddOptionModal] = useState<number | null>(null); // Group ID
  const [editingOption, setEditingOption] = useState<any | null>(null);

  const [showEditVersionModal, setShowEditVersionModal] = useState<boolean>(false);

  // Meal Form
  const [mealName, setMealName] = useState('');
  const [mealTime, setMealTime] = useState('');
  const [mealNotes, setMealNotes] = useState('');

  // Group Form
  const [groupName, setGroupName] = useState('');
  const [groupRequired, setGroupRequired] = useState(true);
  const [minSelections, setMinSelections] = useState<number | ''>('');
  const [maxSelections, setMaxSelections] = useState<number | ''>('');

  // Option Form
  const [optionForm, setOptionForm] = useState<DietOptionForm>({
    foodId: '',
    customLabel: '',
    servingQuantity: '',
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    isDefault: false,
  });

  // Version Meta Form
  const [versionForm, setVersionForm] = useState({
    title: '',
    dailyCaloriesTarget: '' as number | '',
    dailyProteinTargetG: '' as number | '',
    dailyCarbsTargetG: '' as number | '',
    dailyFatTargetG: '' as number | '',
    changeSummary: '',
  });

  const fetchPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/admin/diet-plans/${planId}`);
      setPlan(data);
      if (!selectedVersionId && data.versions?.length > 0) {
        setSelectedVersionId(data.versions[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load diet plan');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionDetails = async (vId: number) => {
    try {
      const data = await api.get(`/admin/diet-versions/${vId}`);
      setVersionDetails(data);
      setVersionForm({
        title: data.title || `Version ${data.version_number}`,
        dailyCaloriesTarget: data.daily_calories_target ?? data.daily_calorie_target ?? '',
        dailyProteinTargetG: data.daily_protein_target_g ?? '',
        dailyCarbsTargetG: data.daily_carbs_target_g ?? '',
        dailyFatTargetG: data.daily_fat_target_g ?? '',
        changeSummary: data.change_notes || data.change_summary || '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load version details');
    }
  };

  const fetchFoods = async () => {
    try {
      const res = await api.get<any[]>('/admin/foods?limit=100');
      const foodList = Array.isArray(res) ? res : (res as any)?.data || [];
      setFoods(foodList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPlan();
    fetchFoods();
  }, [planId]);

  useEffect(() => {
    if (selectedVersionId) {
      fetchVersionDetails(selectedVersionId);
    }
  }, [selectedVersionId]);

  const isPublished = versionDetails?.status === 'published';

  const handlePublish = async () => {
    if (!selectedVersionId) return;
    if (!window.confirm('Publish this diet version? Published versions are immutable.')) return;
    try {
      await api.post(`/admin/diet-versions/${selectedVersionId}/publish`);
      await fetchPlan();
      await fetchVersionDetails(selectedVersionId);
    } catch (err: any) {
      alert(err.message || 'Failed to publish version');
    }
  };

  const handleCloneVersion = async () => {
    if (!selectedVersionId) return;
    try {
      const newVer = await api.post(`/admin/diet-plans/${planId}/versions`, {
        fromVersionId: selectedVersionId,
      });
      await fetchPlan();
      setSelectedVersionId(newVer.id);
    } catch (err: any) {
      alert(err.message || 'Failed to clone version');
    }
  };

  const handleSaveVersionMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersionId || isPublished) return;
    try {
      const payload: any = {
        title: versionForm.title || undefined,
        changeSummary: versionForm.changeSummary || undefined,
      };
      if (versionForm.dailyCaloriesTarget !== '') {
        payload.dailyCaloriesTarget = Number(versionForm.dailyCaloriesTarget);
      }
      if (versionForm.dailyProteinTargetG !== '') {
        payload.dailyProteinTargetG = Number(versionForm.dailyProteinTargetG);
      }
      if (versionForm.dailyCarbsTargetG !== '') {
        payload.dailyCarbsTargetG = Number(versionForm.dailyCarbsTargetG);
      }
      if (versionForm.dailyFatTargetG !== '') {
        payload.dailyFatTargetG = Number(versionForm.dailyFatTargetG);
      }
      await api.patch(`/admin/diet-versions/${selectedVersionId}`, payload);
      setShowEditVersionModal(false);
      fetchPlan();
      fetchVersionDetails(selectedVersionId);
    } catch (err: any) {
      alert(err.message || 'Failed to update version metadata');
    }
  };

  // Meal Handlers
  const handleOpenAddMeal = () => {
    setEditingMeal(null);
    setMealName('');
    setMealTime('');
    setMealNotes('');
    setShowAddMealModal(true);
  };

  const handleOpenEditMeal = (meal: any) => {
    setEditingMeal(meal);
    setMealName(meal.name);
    setMealTime(meal.scheduled_time ? meal.scheduled_time.substring(0, 5) : '');
    setMealNotes(meal.notes || meal.description || '');
    setShowAddMealModal(true);
  };

  const handleSaveMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersionId || isPublished) return;
    try {
      if (editingMeal) {
        await api.patch(`/admin/diet-meals/${editingMeal.id}`, {
          name: mealName.trim(),
          scheduledTime: mealTime ? `${mealTime}:00` : undefined,
          notes: mealNotes.trim() || undefined,
        });
      } else {
        await api.post(`/admin/diet-versions/${selectedVersionId}/meals`, {
          name: mealName.trim(),
          scheduledTime: mealTime ? `${mealTime}:00` : undefined,
          notes: mealNotes.trim() || undefined,
          orderIndex: (versionDetails?.meals?.length || 0) + 1,
        });
      }
      setShowAddMealModal(false);
      fetchVersionDetails(selectedVersionId);
    } catch (err: any) {
      alert(err.message || 'Failed to save meal');
    }
  };

  const handleDeleteMeal = async (mealId: number) => {
    if (isPublished) return;
    if (!window.confirm('Delete this meal and all its option groups?')) return;
    try {
      await api.delete(`/admin/diet-meals/${mealId}`);
      fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to delete meal');
    }
  };

  // Option Group Handlers
  const handleOpenAddGroup = (mealId: number) => {
    setEditingGroup(null);
    setShowAddGroupModal(mealId);
    setGroupName('');
    setGroupRequired(true);
    setMinSelections('');
    setMaxSelections('');
  };

  const handleOpenEditGroup = (group: any) => {
    setEditingGroup(group);
    setShowAddGroupModal(group.diet_meal_id);
    setGroupName(group.name);
    setGroupRequired(group.is_required === 1 || group.is_required === true);
    setMinSelections(group.min_selections ?? '');
    setMaxSelections(group.max_selections ?? '');
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublished) return;
    if (!groupName.trim()) {
      alert('Please enter a group category name');
      return;
    }
    if (minSelections === '' || isNaN(Number(minSelections))) {
      alert('Please enter a valid min selections count (0 or higher)');
      return;
    }
    if (maxSelections === '' || isNaN(Number(maxSelections))) {
      alert('Please enter a valid max selections count (1 or higher)');
      return;
    }
    const minVal = Number(minSelections);
    const maxVal = Number(maxSelections);
    if (minVal < 0) {
      alert('Min selections cannot be negative');
      return;
    }
    if (maxVal < 1) {
      alert('Max selections must be at least 1');
      return;
    }
    if (maxVal < minVal) {
      alert('Max selections cannot be less than Min selections');
      return;
    }
    try {
      if (editingGroup) {
        await api.patch(`/admin/diet-option-groups/${editingGroup.id}`, {
          name: groupName.trim(),
          isRequired: groupRequired,
          minSelections: minVal,
          maxSelections: maxVal,
        });
      } else if (showAddGroupModal) {
        await api.post(`/admin/diet-meals/${showAddGroupModal}/groups`, {
          name: groupName.trim(),
          isRequired: groupRequired,
          minSelections: minVal,
          maxSelections: maxVal,
        });
      }
      setShowAddGroupModal(null);
      setEditingGroup(null);
      fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to save option group');
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (isPublished) return;
    if (!window.confirm('Delete this option group and its food options?')) return;
    try {
      await api.delete(`/admin/diet-option-groups/${groupId}`);
      fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to delete option group');
    }
  };

  // Option Handlers
  const handleOpenAddOption = (groupId: number) => {
    setEditingOption(null);
    setShowAddOptionModal(groupId);
    setOptionForm({
      foodId: '',
      customLabel: '',
      servingQuantity: '',
      calories: '',
      proteinG: '',
      carbsG: '',
      fatG: '',
      isDefault: false,
    });
  };

  const handleOpenEditOption = (option: any) => {
    setEditingOption(option);
    setShowAddOptionModal(option.diet_meal_option_group_id);
    setOptionForm({
      foodId: option.food_id ?? '',
      customLabel: option.custom_label ?? option.label ?? '',
      servingQuantity: option.serving_quantity ?? option.quantity ?? '',
      calories: option.calories ?? option.calories_snapshot ?? '',
      proteinG: option.protein_g ?? option.protein_g_snapshot ?? '',
      carbsG: option.carbs_g ?? option.carbs_g_snapshot ?? '',
      fatG: option.fat_g ?? option.fat_g_snapshot ?? '',
      isDefault: option.is_default === 1 || option.is_default === true,
    });
  };

  const handleSaveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublished) return;
    if (optionForm.servingQuantity === '' || Number(optionForm.servingQuantity) <= 0) {
      alert('Please enter a valid positive serving quantity');
      return;
    }
    if (optionForm.calories === '' || Number(optionForm.calories) < 0) {
      alert('Please enter valid non-negative calories');
      return;
    }
    try {
      const payload: any = {
        foodId: optionForm.foodId ? Number(optionForm.foodId) : undefined,
        customLabel: optionForm.customLabel ? optionForm.customLabel.trim() : undefined,
        servingQuantity: Number(optionForm.servingQuantity),
        calories: Number(optionForm.calories),
        proteinG: optionForm.proteinG !== '' ? Number(optionForm.proteinG) : undefined,
        carbsG: optionForm.carbsG !== '' ? Number(optionForm.carbsG) : undefined,
        fatG: optionForm.fatG !== '' ? Number(optionForm.fatG) : undefined,
        isDefault: optionForm.isDefault,
      };
      if (editingOption) {
        await api.patch(`/admin/diet-options/${editingOption.id}`, payload);
      } else if (showAddOptionModal) {
        await api.post(`/admin/diet-option-groups/${showAddOptionModal}/options`, payload);
      }
      setShowAddOptionModal(null);
      setEditingOption(null);
      fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to save food option');
    }
  };

  const handleDeleteOption = async (optionId: number) => {
    if (isPublished) return;
    if (!window.confirm('Delete this food choice?')) return;
    try {
      await api.delete(`/admin/diet-options/${optionId}`);
      fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to delete option');
    }
  };

  const handleMoveMeal = async (mIdx: number, direction: 'up' | 'down') => {
    if (isPublished || !versionDetails?.meals) return;
    const targetIdx = direction === 'up' ? mIdx - 1 : mIdx + 1;
    if (targetIdx < 0 || targetIdx >= versionDetails.meals.length) return;
    const currentMeal = versionDetails.meals[mIdx];
    const targetMeal = versionDetails.meals[targetIdx];
    try {
      await api.patch(`/admin/diet-meals/${currentMeal.id}`, {
        orderIndex: targetMeal.order_index ?? targetMeal.orderIndex ?? (targetIdx + 1),
      });
      await fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to reorder meal');
    }
  };

  const handleMoveGroup = async (meal: any, gIdx: number, direction: 'up' | 'down') => {
    if (isPublished || !meal?.optionGroups) return;
    const targetIdx = direction === 'up' ? gIdx - 1 : gIdx + 1;
    if (targetIdx < 0 || targetIdx >= meal.optionGroups.length) return;
    const currentGroup = meal.optionGroups[gIdx];
    const targetGroup = meal.optionGroups[targetIdx];
    try {
      await api.patch(`/admin/diet-option-groups/${currentGroup.id}`, {
        orderIndex: targetGroup.order_index ?? targetGroup.orderIndex ?? (targetIdx + 1),
      });
      await fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to reorder option group');
    }
  };

  const handleMoveOption = async (group: any, oIdx: number, direction: 'up' | 'down') => {
    if (isPublished || !group?.options) return;
    const targetIdx = direction === 'up' ? oIdx - 1 : oIdx + 1;
    if (targetIdx < 0 || targetIdx >= group.options.length) return;
    const currentOption = group.options[oIdx];
    const targetOption = group.options[targetIdx];
    try {
      await api.patch(`/admin/diet-options/${currentOption.id}`, {
        orderIndex: targetOption.order_index ?? targetOption.orderIndex ?? (targetIdx + 1),
      });
      await fetchVersionDetails(selectedVersionId!);
    } catch (err: any) {
      alert(err.message || 'Failed to reorder option');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
        <p>Loading diet protocol builder...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={32} color="var(--accent-rose)" style={{ marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Failed to Load Diet Protocol</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
        <button onClick={fetchPlan} className="btn btn-primary">
          <RefreshCw size={14} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={onBack} className="btn btn-secondary btn-sm" aria-label="Back to Diets">
            <ArrowLeft size={16} />
            <span>Back to Diets</span>
          </button>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{plan?.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span className="badge badge-warning">
                {versionDetails?.daily_calories_target ? `${versionDetails.daily_calories_target} kcal` : (plan?.daily_calories_target ? `${plan.daily_calories_target} kcal` : 'Calorie target unconfigured')}
              </span>
              <span>{plan?.description || 'No description provided'}</span>
            </div>
          </div>
        </div>

        {/* Actions & Version Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Version Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-md)' }}>
            <Layers size={14} color="var(--accent-amber)" />
            <select
              value={selectedVersionId || ''}
              onChange={(e) => setSelectedVersionId(Number(e.target.value))}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
              aria-label="Select Diet Plan Version"
            >
              {plan?.versions?.map((v: any) => (
                <option key={v.id} value={v.id} style={{ background: 'var(--bg-secondary)', color: '#fff' }}>
                  v{v.version_number} ({v.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <button onClick={handleCloneVersion} className="btn btn-secondary btn-sm" title="Draft New Version">
            <Copy size={14} />
            <span>New Version</span>
          </button>

          {!isPublished ? (
            <>
              <button onClick={() => setShowEditVersionModal(true)} className="btn btn-secondary btn-sm">
                <Edit2 size={14} />
                <span>Edit Targets</span>
              </button>
              <button onClick={handlePublish} className="btn btn-primary btn-sm">
                <Check size={14} />
                <span>Publish Version</span>
              </button>
            </>
          ) : (
            <span className="badge badge-success" style={{ padding: '0.5rem 0.8rem' }}>
              <Lock size={12} />
              <span>Immutable (Published)</span>
            </span>
          )}
        </div>
      </div>

      {/* Target Macros Snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
        <div className="card" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Daily Calories</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
            {versionDetails?.daily_calories_target ? `${versionDetails.daily_calories_target} kcal` : 'Unconfigured'}
          </div>
        </div>
        <div className="card" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Protein Target</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {versionDetails?.daily_protein_target_g ? `${versionDetails.daily_protein_target_g}g` : 'Unconfigured'}
          </div>
        </div>
        <div className="card" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Carbs Target</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            {versionDetails?.daily_carbs_target_g ? `${versionDetails.daily_carbs_target_g}g` : 'Unconfigured'}
          </div>
        </div>
        <div className="card" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fat Target</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
            {versionDetails?.daily_fat_target_g ? `${versionDetails.daily_fat_target_g}g` : 'Unconfigured'}
          </div>
        </div>
      </div>

      {/* Meals & Option Groups Builder */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Configured Meals</h3>
          {!isPublished && (
            <button onClick={handleOpenAddMeal} className="btn btn-primary btn-sm">
              <Plus size={14} />
              <span>Add Meal</span>
            </button>
          )}
        </div>

        {versionDetails?.meals && versionDetails.meals.length > 0 ? (
          versionDetails.meals.map((meal: any, mIdx: number) => (
            <div key={meal.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--accent-amber)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}>
                    {mIdx + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{meal.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} />
                        <span>{meal.scheduled_time ? meal.scheduled_time.substring(0, 5) : 'Flexible'}</span>
                      </span>
                      {meal.notes && <span>• {meal.notes}</span>}
                    </div>
                  </div>
                </div>

                {!isPublished && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <button
                        onClick={() => handleMoveMeal(mIdx, 'up')}
                        disabled={mIdx === 0}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.35rem 0.5rem' }}
                        aria-label="Move Meal Up"
                        title="Move Meal Up"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => handleMoveMeal(mIdx, 'down')}
                        disabled={mIdx === versionDetails.meals.length - 1}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.35rem 0.5rem' }}
                        aria-label="Move Meal Down"
                        title="Move Meal Down"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <button onClick={() => handleOpenAddGroup(meal.id)} className="btn btn-secondary btn-sm">
                      <Plus size={12} />
                      <span>Add Option Group</span>
                    </button>
                    <button onClick={() => handleOpenEditMeal(meal)} className="btn btn-secondary btn-sm" aria-label="Edit Meal">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => handleDeleteMeal(meal.id)} className="btn btn-danger btn-sm" aria-label="Delete Meal">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Option Groups */}
              {meal.optionGroups && meal.optionGroups.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  {meal.optionGroups.map((group: any, gIdx: number) => (
                    <div key={group.id} style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                            {group.name}
                          </span>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {group.min_selections != null && group.max_selections != null
                              ? group.min_selections === group.max_selections 
                                ? `Select exactly ${group.min_selections}` 
                                : `Select ${group.min_selections} to ${group.max_selections}`
                              : 'Selection rules unconfigured'}
                            {group.is_required ? ' (Required)' : ' (Optional)'}
                          </div>
                        </div>

                        {!isPublished && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <button
                              onClick={() => handleMoveGroup(meal, gIdx, 'up')}
                              disabled={gIdx === 0}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.2rem 0.35rem' }}
                              aria-label="Move Group Up"
                              title="Move Group Up"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              onClick={() => handleMoveGroup(meal, gIdx, 'down')}
                              disabled={gIdx === meal.optionGroups.length - 1}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.2rem 0.35rem' }}
                              aria-label="Move Group Down"
                              title="Move Group Down"
                            >
                              <ChevronDown size={12} />
                            </button>
                            <button onClick={() => handleOpenAddOption(group.id)} className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                              <Plus size={10} />
                              <span>Add Choice</span>
                            </button>
                            <button onClick={() => handleOpenEditGroup(group)} className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.4rem' }} aria-label="Edit Group">
                              <Edit2 size={10} />
                            </button>
                            <button onClick={() => handleDeleteGroup(group.id)} className="btn btn-danger btn-sm" style={{ padding: '0.2rem 0.4rem' }} aria-label="Delete Group">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Options List */}
                      {group.options && group.options.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {group.options.map((opt: any, oIdx: number) => (
                            <div key={opt.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem 0.75rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8rem',
                            }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{opt.custom_label || opt.food_name || 'Custom Option'}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {(opt.serving_quantity ?? opt.quantity) != null
                                    ? `${opt.serving_quantity ?? opt.quantity}${opt.unit_code ? ` ${opt.unit_code}` : ''}`
                                    : 'Serving unconfigured'}
                                  {(opt.protein_g ?? opt.protein_g_snapshot) != null ? ` • ${opt.protein_g ?? opt.protein_g_snapshot}g P` : ''}
                                  {(opt.carbs_g ?? opt.carbs_g_snapshot) != null ? ` • ${opt.carbs_g ?? opt.carbs_g_snapshot}g C` : ''}
                                  {(opt.fat_g ?? opt.fat_g_snapshot) != null ? ` • ${opt.fat_g ?? opt.fat_g_snapshot}g F` : ''}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>
                                  {(opt.calories ?? opt.calories_snapshot) != null ? `${opt.calories ?? opt.calories_snapshot} kcal` : 'Calories unconfigured'}
                                </span>
                                {!isPublished && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <button
                                      onClick={() => handleMoveOption(group, oIdx, 'up')}
                                      disabled={oIdx === 0}
                                      style={{ background: 'none', border: 'none', color: oIdx === 0 ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: oIdx === 0 ? 'not-allowed' : 'pointer', opacity: oIdx === 0 ? 0.3 : 1 }}
                                      aria-label="Move Option Up"
                                      title="Move Option Up"
                                    >
                                      <ChevronUp size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleMoveOption(group, oIdx, 'down')}
                                      disabled={oIdx === group.options.length - 1}
                                      style={{ background: 'none', border: 'none', color: oIdx === group.options.length - 1 ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: oIdx === group.options.length - 1 ? 'not-allowed' : 'pointer', opacity: oIdx === group.options.length - 1 ? 0.3 : 1 }}
                                      aria-label="Move Option Down"
                                      title="Move Option Down"
                                    >
                                      <ChevronDown size={14} />
                                    </button>
                                    <button onClick={() => handleOpenEditOption(opt)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Edit Option">
                                      <Edit2 size={12} />
                                    </button>
                                    <button onClick={() => handleDeleteOption(opt.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer' }} aria-label="Delete Option">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem' }}>
                          No food choices configured yet.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  No option groups yet. Add a category (e.g. "Protein Source", "Carb Source").
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            No meals configured in this version yet.
          </div>
        )}
      </div>

      {/* Edit Version Metadata Modal */}
      {showEditVersionModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Version Nutrition Targets</h3>
              <button onClick={() => setShowEditVersionModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveVersionMeta} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Version Title</label>
                <input
                  type="text"
                  className="input"
                  value={versionForm.title}
                  onChange={(e) => setVersionForm({ ...versionForm, title: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Daily Calories Target (kcal)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 2400"
                    value={versionForm.dailyCaloriesTarget}
                    onChange={(e) => setVersionForm({ ...versionForm, dailyCaloriesTarget: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Daily Protein Target (g)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 180"
                    value={versionForm.dailyProteinTargetG}
                    onChange={(e) => setVersionForm({ ...versionForm, dailyProteinTargetG: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Daily Carbs Target (g)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 250"
                    value={versionForm.dailyCarbsTargetG}
                    onChange={(e) => setVersionForm({ ...versionForm, dailyCarbsTargetG: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Daily Fat Target (g)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 70"
                    value={versionForm.dailyFatTargetG}
                    onChange={(e) => setVersionForm({ ...versionForm, dailyFatTargetG: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Change Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  value={versionForm.changeSummary}
                  onChange={(e) => setVersionForm({ ...versionForm, changeSummary: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowEditVersionModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Targets</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Meal Modal */}
      {showAddMealModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{editingMeal ? 'Edit Meal' : 'Add Meal'}</h3>
              <button onClick={() => setShowAddMealModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveMeal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Meal Name</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Breakfast, Lunch, Snack"
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Scheduled Time</label>
                <input
                  type="time"
                  className="input"
                  value={mealTime}
                  onChange={(e) => setMealTime(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Instructions / Notes (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Consume within 60 mins of workout"
                  value={mealNotes}
                  onChange={(e) => setMealNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddMealModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingMeal ? 'Update Meal' : 'Add Meal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Group Modal */}
      {showAddGroupModal !== null && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{editingGroup ? 'Edit Option Group' : 'Add Option Group'}</h3>
              <button onClick={() => { setShowAddGroupModal(null); setEditingGroup(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Group Category Name</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Lean Protein Source, Carbohydrate Base"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Min Selections</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    placeholder="e.g. 1"
                    className="input"
                    value={minSelections}
                    onChange={(e) => setMinSelections(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Max Selections</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    placeholder="e.g. 1"
                    className="input"
                    value={maxSelections}
                    onChange={(e) => setMaxSelections(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="groupReq"
                  checked={groupRequired}
                  onChange={(e) => setGroupRequired(e.target.checked)}
                />
                <label htmlFor="groupReq" style={{ fontSize: '0.85rem' }}>Required Selection</label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => { setShowAddGroupModal(null); setEditingGroup(null); }} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingGroup ? 'Update Group' : 'Save Group'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Option Modal */}
      {showAddOptionModal !== null && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{editingOption ? 'Edit Food Choice' : 'Add Food Choice'}</h3>
              <button onClick={() => { setShowAddOptionModal(null); setEditingOption(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveOption} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Select Food Reference</label>
                {foods.length === 0 ? (
                  <p style={{ color: 'var(--accent-amber)', fontSize: '0.85rem' }}>No foods found. Please add foods in the Food Database first.</p>
                ) : (
                  <select
                    className="select"
                    value={optionForm.foodId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setOptionForm({
                          ...optionForm,
                          foodId: '',
                          servingQuantity: '',
                          calories: '',
                          proteinG: '',
                          carbsG: '',
                          fatG: '',
                        });
                        return;
                      }
                      const fId = Number(val);
                      const selected = foods.find(f => f.id === fId);
                      if (selected) {
                        setOptionForm({
                          ...optionForm,
                          foodId: fId,
                          servingQuantity: selected.reference_quantity ?? selected.default_serving_amount ?? '',
                          calories: selected.calories ?? '',
                          proteinG: selected.protein_g ?? '',
                          carbsG: selected.carbs_g ?? '',
                          fatG: selected.fat_g ?? '',
                        });
                      }
                    }}
                  >
                    <option value="">-- Choose Food (or Enter Custom Nutrition) --</option>
                    {foods.map((f) => {
                      const calStr = f.calories != null ? `${f.calories} kcal` : 'Calories unconfigured';
                      const servingStr = (f.reference_quantity || f.default_serving_amount) 
                        ? `${f.reference_quantity || f.default_serving_amount}${f.unit_code ? ` ${f.unit_code}` : ''}`
                        : 'Serving unconfigured';
                      return (
                        <option key={f.id} value={f.id}>{f.name} ({calStr} / {servingStr})</option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Custom Label (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 200g Grilled Chicken Breast"
                  value={optionForm.customLabel}
                  onChange={(e) => setOptionForm({ ...optionForm, customLabel: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Serving Quantity</label>
                  <input
                    type="number"
                    className="input"
                    required
                    min="0.1"
                    value={optionForm.servingQuantity}
                    onChange={(e) => setOptionForm({ ...optionForm, servingQuantity: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Total Calories (kcal)</label>
                  <input
                    type="number"
                    className="input"
                    required
                    min="0"
                    value={optionForm.calories}
                    onChange={(e) => setOptionForm({ ...optionForm, calories: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Protein (g)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    value={optionForm.proteinG}
                    onChange={(e) => setOptionForm({ ...optionForm, proteinG: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Carbs (g)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    value={optionForm.carbsG}
                    onChange={(e) => setOptionForm({ ...optionForm, carbsG: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Fat (g)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    value={optionForm.fatG}
                    onChange={(e) => setOptionForm({ ...optionForm, fatG: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
                  <input
                    type="checkbox"
                    id="isDefaultOpt"
                    checked={optionForm.isDefault}
                    onChange={(e) => setOptionForm({ ...optionForm, isDefault: e.target.checked })}
                  />
                  <label htmlFor="isDefaultOpt" style={{ fontSize: '0.85rem' }}>Default Selection</label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => { setShowAddOptionModal(null); setEditingOption(null); }} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingOption ? 'Update Food Choice' : 'Save Food Choice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
