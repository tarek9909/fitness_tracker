import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  ArrowLeft, Plus, Trash2, Check, Lock, Layers, 
  Utensils, Clock, Flame, X, Edit2, Copy, AlertCircle, RefreshCw,
  ChevronUp, ChevronDown
} from 'lucide-react';
import {
  Select,
  Button,
  IconButton,
  Card,
  Badge,
  Dialog,
  FormField,
  TextInput,
  NumberInput,
  TextArea,
  Checkbox,
} from '../components/ui';

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
        <Button onClick={fetchPlan} variant="primary" icon={<RefreshCw size={14} />}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button onClick={onBack} variant="secondary" size="sm" aria-label="Back to Diets" icon={<ArrowLeft size={16} />}>
            Back to Diets
          </Button>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{plan?.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <Badge variant="warning">
                {versionDetails?.daily_calories_target ? `${versionDetails.daily_calories_target} kcal` : (plan?.daily_calories_target ? `${plan.daily_calories_target} kcal` : 'Calorie target unconfigured')}
              </Badge>
              <span>{plan?.description || 'No description provided'}</span>
            </div>
          </div>
        </div>

        {/* Actions & Version Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Version Selector */}
          <div style={{ minWidth: '180px' }}>
            <Select
              options={
                plan?.versions?.map((v: any) => ({
                  value: v.id,
                  label: `v${v.version_number} (${v.status.toUpperCase()})`,
                })) || []
              }
              value={selectedVersionId || ''}
              onChange={(val) => setSelectedVersionId(Number(val))}
              placeholder="Select Version..."
            />
          </div>

          <Button onClick={handleCloneVersion} variant="secondary" size="sm" title="Draft New Version" icon={<Copy size={14} />}>
            New Version
          </Button>

          {!isPublished ? (
            <>
              <Button onClick={() => setShowEditVersionModal(true)} variant="secondary" size="sm" icon={<Edit2 size={14} />}>
                Edit Targets
              </Button>
              <Button onClick={handlePublish} variant="primary" size="sm" icon={<Check size={14} />}>
                Publish Version
              </Button>
            </>
          ) : (
            <Badge variant="success" style={{ padding: '0.5rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Lock size={12} />
              <span>Immutable (Published)</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Target Macros Snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
        <Card style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Daily Calories</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
            {versionDetails?.daily_calories_target ? `${versionDetails.daily_calories_target} kcal` : 'Unconfigured'}
          </div>
        </Card>
        <Card style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Protein Target</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {versionDetails?.daily_protein_target_g ? `${versionDetails.daily_protein_target_g}g` : 'Unconfigured'}
          </div>
        </Card>
        <Card style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Carbs Target</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            {versionDetails?.daily_carbs_target_g ? `${versionDetails.daily_carbs_target_g}g` : 'Unconfigured'}
          </div>
        </Card>
        <Card style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fat Target</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
            {versionDetails?.daily_fat_target_g ? `${versionDetails.daily_fat_target_g}g` : 'Unconfigured'}
          </div>
        </Card>
      </div>

      {/* Meals & Option Groups Builder */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Configured Meals</h3>
          {!isPublished && (
            <Button onClick={handleOpenAddMeal} variant="primary" size="sm" icon={<Plus size={14} />}>
              Add Meal
            </Button>
          )}
        </div>

        {versionDetails?.meals && versionDetails.meals.length > 0 ? (
          versionDetails.meals.map((meal: any, mIdx: number) => (
            <Card key={meal.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                      <IconButton
                        icon={<ChevronUp size={14} />}
                        label="Move Meal Up"
                        size="sm"
                        disabled={mIdx === 0}
                        onClick={() => handleMoveMeal(mIdx, 'up')}
                      />
                      <IconButton
                        icon={<ChevronDown size={14} />}
                        label="Move Meal Down"
                        size="sm"
                        disabled={mIdx === versionDetails.meals.length - 1}
                        onClick={() => handleMoveMeal(mIdx, 'down')}
                      />
                    </div>
                    <Button onClick={() => handleOpenAddGroup(meal.id)} variant="secondary" size="sm" icon={<Plus size={12} />}>
                      Add Option Group
                    </Button>
                    <IconButton
                      icon={<Edit2 size={12} />}
                      label="Edit Meal"
                      size="sm"
                      onClick={() => handleOpenEditMeal(meal)}
                    />
                    <IconButton
                      icon={<Trash2 size={12} />}
                      label="Delete Meal"
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteMeal(meal.id)}
                    />
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
                            <IconButton
                              icon={<ChevronUp size={12} />}
                              label="Move Group Up"
                              size="sm"
                              disabled={gIdx === 0}
                              onClick={() => handleMoveGroup(meal, gIdx, 'up')}
                            />
                            <IconButton
                              icon={<ChevronDown size={12} />}
                              label="Move Group Down"
                              size="sm"
                              disabled={gIdx === meal.optionGroups.length - 1}
                              onClick={() => handleMoveGroup(meal, gIdx, 'down')}
                            />
                            <Button onClick={() => handleOpenAddOption(group.id)} variant="secondary" size="sm" icon={<Plus size={10} />} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                              Add Choice
                            </Button>
                            <IconButton
                              icon={<Edit2 size={10} />}
                              label="Edit Group"
                              size="sm"
                              onClick={() => handleOpenEditGroup(group)}
                            />
                            <IconButton
                              icon={<Trash2 size={10} />}
                              label="Delete Group"
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteGroup(group.id)}
                            />
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
                                    <IconButton
                                      icon={<ChevronUp size={14} />}
                                      label="Move Option Up"
                                      size="sm"
                                      disabled={oIdx === 0}
                                      onClick={() => handleMoveOption(group, oIdx, 'up')}
                                    />
                                    <IconButton
                                      icon={<ChevronDown size={14} />}
                                      label="Move Option Down"
                                      size="sm"
                                      disabled={oIdx === group.options.length - 1}
                                      onClick={() => handleMoveOption(group, oIdx, 'down')}
                                    />
                                    <IconButton
                                      icon={<Edit2 size={12} />}
                                      label="Edit Option"
                                      size="sm"
                                      onClick={() => handleOpenEditOption(opt)}
                                    />
                                    <IconButton
                                      icon={<Trash2 size={12} />}
                                      label="Delete Option"
                                      variant="danger"
                                      size="sm"
                                      onClick={() => handleDeleteOption(opt.id)}
                                    />
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
            </Card>
          ))
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            No meals configured in this version yet.
          </div>
        )}
      </div>

      {/* Edit Version Metadata Modal */}
      {showEditVersionModal && (
        <Dialog
          isOpen={showEditVersionModal}
          onClose={() => setShowEditVersionModal(false)}
          title="Version Nutrition Targets"
          maxWidth="520px"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setShowEditVersionModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary" onClick={handleSaveVersionMeta}>Save Targets</Button>
            </>
          }
        >
          <form onSubmit={handleSaveVersionMeta} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FormField label="Version Title">
              <TextInput
                value={versionForm.title}
                onChange={(e) => setVersionForm({ ...versionForm, title: e.target.value })}
              />
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormField label="Daily Calories Target (kcal)">
                <NumberInput
                  placeholder="e.g. 2400"
                  value={versionForm.dailyCaloriesTarget}
                  onChange={(val) => setVersionForm({ ...versionForm, dailyCaloriesTarget: val })}
                />
              </FormField>
              <FormField label="Daily Protein Target (g)">
                <NumberInput
                  placeholder="e.g. 180"
                  value={versionForm.dailyProteinTargetG}
                  onChange={(val) => setVersionForm({ ...versionForm, dailyProteinTargetG: val })}
                />
              </FormField>
              <FormField label="Daily Carbs Target (g)">
                <NumberInput
                  placeholder="e.g. 250"
                  value={versionForm.dailyCarbsTargetG}
                  onChange={(val) => setVersionForm({ ...versionForm, dailyCarbsTargetG: val })}
                />
              </FormField>
              <FormField label="Daily Fat Target (g)">
                <NumberInput
                  placeholder="e.g. 70"
                  value={versionForm.dailyFatTargetG}
                  onChange={(val) => setVersionForm({ ...versionForm, dailyFatTargetG: val })}
                />
              </FormField>
            </div>
            <FormField label="Change Notes">
              <TextArea
                rows={2}
                value={versionForm.changeSummary}
                onChange={(e) => setVersionForm({ ...versionForm, changeSummary: e.target.value })}
              />
            </FormField>
          </form>
        </Dialog>
      )}

      {/* Add / Edit Meal Modal */}
      {showAddMealModal && (
        <Dialog
          isOpen={showAddMealModal}
          onClose={() => setShowAddMealModal(false)}
          title={editingMeal ? 'Edit Meal' : 'Add Meal'}
          maxWidth="480px"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setShowAddMealModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary" onClick={handleSaveMeal}>{editingMeal ? 'Update Meal' : 'Add Meal'}</Button>
            </>
          }
        >
          <form onSubmit={handleSaveMeal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FormField label="Meal Name" required>
              <TextInput
                required
                placeholder="e.g. Breakfast, Lunch, Snack"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
              />
            </FormField>
            <FormField label="Scheduled Time">
              <TextInput
                type="time"
                value={mealTime}
                onChange={(e) => setMealTime(e.target.value)}
              />
            </FormField>
            <FormField label="Instructions / Notes (Optional)">
              <TextInput
                placeholder="e.g. Consume within 60 mins of workout"
                value={mealNotes}
                onChange={(e) => setMealNotes(e.target.value)}
              />
            </FormField>
          </form>
        </Dialog>
      )}

      {/* Add / Edit Group Modal */}
      {showAddGroupModal !== null && (
        <Dialog
          isOpen={showAddGroupModal !== null}
          onClose={() => { setShowAddGroupModal(null); setEditingGroup(null); }}
          title={editingGroup ? 'Edit Option Group' : 'Add Option Group'}
          maxWidth="480px"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => { setShowAddGroupModal(null); setEditingGroup(null); }}>Cancel</Button>
              <Button type="submit" variant="primary" onClick={handleSaveGroup}>{editingGroup ? 'Update Group' : 'Save Group'}</Button>
            </>
          }
        >
          <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FormField label="Group Category Name" required>
              <TextInput
                required
                placeholder="e.g. Lean Protein Source, Carbohydrate Base"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormField label="Min Selections">
                <NumberInput
                  min={0}
                  max={20}
                  placeholder="e.g. 1"
                  value={minSelections}
                  onChange={(val) => setMinSelections(val)}
                />
              </FormField>
              <FormField label="Max Selections">
                <NumberInput
                  min={1}
                  max={20}
                  placeholder="e.g. 1"
                  value={maxSelections}
                  onChange={(val) => setMaxSelections(val)}
                />
              </FormField>
            </div>
            <div style={{ marginTop: '0.25rem' }}>
              <Checkbox
                id="groupReq"
                checked={groupRequired}
                onChange={(e) => setGroupRequired(e.target.checked)}
                label="Required Selection"
              />
            </div>
          </form>
        </Dialog>
      )}

      {/* Add / Edit Option Modal */}
      {showAddOptionModal !== null && (
        <Dialog
          isOpen={showAddOptionModal !== null}
          onClose={() => { setShowAddOptionModal(null); setEditingOption(null); }}
          title={editingOption ? 'Edit Food Choice' : 'Add Food Choice'}
          maxWidth="560px"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => { setShowAddOptionModal(null); setEditingOption(null); }}>Cancel</Button>
              <Button type="submit" variant="primary" onClick={handleSaveOption}>{editingOption ? 'Update Food Choice' : 'Save Food Choice'}</Button>
            </>
          }
        >
          <form onSubmit={handleSaveOption} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FormField label="Select Food Reference">
              {foods.length === 0 ? (
                <p style={{ color: 'var(--accent-amber)', fontSize: '0.85rem' }}>No foods found. Please add foods in the Food Database first.</p>
              ) : (
                <Select
                  options={[
                    { value: '', label: '-- Choose Food (or Enter Custom Nutrition) --' },
                    ...foods.map((f) => {
                      const calStr = f.calories != null ? `${f.calories} kcal` : 'Calories unconfigured';
                      const servingStr = (f.reference_quantity || f.default_serving_amount) 
                        ? `${f.reference_quantity || f.default_serving_amount}${f.unit_code ? ` ${f.unit_code}` : ''}`
                        : 'Serving unconfigured';
                      return {
                        value: f.id,
                        label: `${f.name} (${calStr} / ${servingStr})`,
                      };
                    }),
                  ]}
                  value={optionForm.foodId}
                  onChange={(val) => {
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
                  placeholder="Choose Food..."
                  searchable
                />
              )}
            </FormField>

            <FormField label="Custom Label (Optional)">
              <TextInput
                placeholder="e.g. 200g Grilled Chicken Breast"
                value={optionForm.customLabel}
                onChange={(e) => setOptionForm({ ...optionForm, customLabel: e.target.value })}
              />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormField label="Serving Quantity" required>
                <NumberInput
                  required
                  min={0.1}
                  value={optionForm.servingQuantity}
                  onChange={(val) => setOptionForm({ ...optionForm, servingQuantity: val })}
                />
              </FormField>
              <FormField label="Total Calories (kcal)" required>
                <NumberInput
                  required
                  min={0}
                  value={optionForm.calories}
                  onChange={(val) => setOptionForm({ ...optionForm, calories: val })}
                />
              </FormField>
              <FormField label="Protein (g)">
                <NumberInput
                  min={0}
                  value={optionForm.proteinG}
                  onChange={(val) => setOptionForm({ ...optionForm, proteinG: val })}
                />
              </FormField>
              <FormField label="Carbs (g)">
                <NumberInput
                  min={0}
                  value={optionForm.carbsG}
                  onChange={(val) => setOptionForm({ ...optionForm, carbsG: val })}
                />
              </FormField>
              <FormField label="Fat (g)">
                <NumberInput
                  min={0}
                  value={optionForm.fatG}
                  onChange={(val) => setOptionForm({ ...optionForm, fatG: val })}
                />
              </FormField>
              <div style={{ marginTop: '1.25rem' }}>
                <Checkbox
                  id="isDefaultOpt"
                  checked={optionForm.isDefault}
                  onChange={(e) => setOptionForm({ ...optionForm, isDefault: e.target.checked })}
                  label="Default Selection"
                />
              </div>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};
