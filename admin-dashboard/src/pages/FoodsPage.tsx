import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Apple, Plus, Edit2, Archive, RotateCcw } from 'lucide-react';
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
  NumberInput,
  Pagination,
  EmptyState,
  Skeleton,
  ErrorView,
} from '../components/ui';

export const FoodsPage: React.FC = () => {
  const [foods, setFoods] = useState<any[]>([]);
  const [measurementUnits, setMeasurementUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [isArchivedTab, setIsArchivedTab] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingFood, setEditingFood] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    brand: '',
    measurementUnitId: '' as number | '',
    defaultServingAmount: '' as number | '',
    calories: '' as number | '',
    proteinG: '' as number | '',
    carbsG: '' as number | '',
    fatG: '' as number | '',
    fiberG: '' as number | '',
    notes: '',
  });

  const fetchMeasurementUnits = async () => {
    try {
      const units = await api.get<any[]>('/admin/measurement-units');
      setMeasurementUnits(Array.isArray(units) ? units : []);
    } catch (err) {
      console.error('Failed to load measurement units', err);
    }
  };

  const fetchFoods = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.append('search', search.trim());
      q.append('archived', isArchivedTab ? 'true' : 'false');
      q.append('page', String(page));
      q.append('limit', '20');

      const res = await api.get<any>(`/admin/foods?${q.toString()}`);
      setFoods(Array.isArray(res) ? res : res?.data || res?.foods || []);
      if (res?.pagination) {
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages || 1);
      } else {
        setTotal(Array.isArray(res) ? res.length : 0);
        setTotalPages(1);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load food database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeasurementUnits();
  }, []);

  useEffect(() => {
    fetchFoods();
  }, [search, isArchivedTab, page]);

  const handleOpenCreateModal = () => {
    setEditingFood(null);
    setForm({
      name: '',
      brand: '',
      measurementUnitId: measurementUnits.length > 0 ? measurementUnits[0].id : '',
      defaultServingAmount: 100,
      calories: '',
      proteinG: '',
      carbsG: '',
      fatG: '',
      fiberG: '',
      notes: '',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (food: any) => {
    setEditingFood(food);
    setForm({
      name: food.name,
      brand: food.brand || '',
      measurementUnitId: food.measurement_unit_id || food.measurementUnitId || '',
      defaultServingAmount: food.reference_quantity || food.default_serving_amount || 100,
      calories: food.calories !== null ? food.calories : '',
      proteinG: food.protein_g !== null ? food.protein_g : '',
      carbsG: food.carbs_g !== null ? food.carbs_g : '',
      fatG: food.fat_g !== null ? food.fat_g : '',
      fiberG: food.fiber_g !== null ? food.fiber_g : '',
      notes: food.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.measurementUnitId === '' || form.calories === '') {
      alert('Please fill all required food fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        measurementUnitId: Number(form.measurementUnitId),
        defaultServingAmount: Number(form.defaultServingAmount),
        calories: Number(form.calories),
        proteinG: form.proteinG !== '' ? Number(form.proteinG) : 0,
        carbsG: form.carbsG !== '' ? Number(form.carbsG) : 0,
        fatG: form.fatG !== '' ? Number(form.fatG) : 0,
        fiberG: form.fiberG !== '' ? Number(form.fiberG) : 0,
        notes: form.notes.trim() || undefined,
      };

      if (editingFood) {
        await api.patch(`/admin/foods/${editingFood.id}`, payload);
      } else {
        await api.post('/admin/foods', payload);
      }

      setShowModal(false);
      fetchFoods();
    } catch (err: any) {
      alert(err.message || 'Failed to save food');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: number) => {
    if (!window.confirm('Archive this food item from active meal plan catalogs?')) return;
    try {
      await api.post(`/admin/foods/${id}/archive`);
      fetchFoods();
    } catch (err: any) {
      alert(err.message || 'Failed to archive food');
    }
  };

  const handleRestore = async (id: number) => {
    try {
      await api.post(`/admin/foods/${id}/restore`);
      fetchFoods();
    } catch (err: any) {
      alert(err.message || 'Failed to restore food');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Food Database</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Nutritional reference values and serving measurements for diet plan builders.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenCreateModal} icon={<Plus size={16} />}>
          New Food Item
        </Button>
      </div>

      {/* Tabs & Search Card */}
      <Card style={{ padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant={!isArchivedTab ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setIsArchivedTab(false); setPage(1); }}
            >
              Active Foods
            </Button>
            <Button
              variant={isArchivedTab ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setIsArchivedTab(true); setPage(1); }}
            >
              Archived Foods
            </Button>
          </div>

          <div style={{ minWidth: '260px', flex: 1, maxWidth: '400px' }}>
            <SearchInput
              placeholder="Search foods or brands..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </Card>

      {/* Foods Table Card */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '1.5rem' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '1rem' }}>
                <Skeleton width="30%" height="20px" />
                <Skeleton width="15%" height="20px" />
                <Skeleton width="10%" height="20px" />
                <Skeleton width="10%" height="20px" />
                <Skeleton width="10%" height="20px" />
                <Skeleton width="10%" height="20px" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: '2rem' }}>
            <ErrorView message={error} onRetry={fetchFoods} />
          </div>
        ) : foods.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <EmptyState
              icon={<Apple size={36} color="var(--text-muted)" />}
              title={search ? 'No matching foods found' : isArchivedTab ? 'No archived foods' : 'No foods in the database yet'}
              description="Adjust your search query or add a new food item with validated macronutrients."
              action={
                <Button variant="primary" size="sm" onClick={handleOpenCreateModal} icon={<Plus size={14} />}>
                  Add Food Item
                </Button>
              }
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '0.875rem 1.25rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Food Name</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Serving Size</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calories</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protein</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Carbs</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fat</th>
                  <th style={{ padding: '0.875rem 1.25rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {foods.map((food) => (
                  <tr key={food.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{food.name}</div>
                      {food.brand && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{food.brand}</div>}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>
                      {(food.reference_quantity || food.default_serving_amount) != null
                        ? `${food.reference_quantity || food.default_serving_amount}${food.unit_code ? ` ${food.unit_code}` : ''}`
                        : 'Unconfigured'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--accent-amber)' }}>
                      {food.calories !== null && food.calories !== undefined ? `${food.calories} kcal` : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
                      {food.protein_g !== null && food.protein_g !== undefined ? `${food.protein_g}g` : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--accent-cyan)', fontWeight: 500 }}>
                      {food.carbs_g !== null && food.carbs_g !== undefined ? `${food.carbs_g}g` : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--accent-rose)', fontWeight: 500 }}>
                      {food.fat_g !== null && food.fat_g !== undefined ? `${food.fat_g}g` : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <IconButton
                          icon={<Edit2 size={14} />}
                          label="Edit Food"
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenEditModal(food)}
                        />
                        {!isArchivedTab ? (
                          <IconButton
                            icon={<Archive size={14} />}
                            label="Archive Food"
                            size="sm"
                            variant="danger"
                            onClick={() => handleArchive(food.id)}
                          />
                        ) : (
                          <IconButton
                            icon={<RotateCcw size={14} />}
                            label="Restore Food"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRestore(food.id)}
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

      {/* Food Create/Edit Dialog */}
      <Dialog
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingFood ? 'Edit Nutritional Item' : 'New Nutritional Item'}
        description="Specify serving quantity and macronutrient reference metrics."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={submitting}>
              {editingFood ? 'Update Food' : 'Create Food Item'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Food Name" required>
            <TextInput
              required
              placeholder="e.g. Chicken Breast, Jasmine Rice, Avocado"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>

          <FormField label="Brand / Manufacturer (Optional)">
            <TextInput
              placeholder="e.g. Kirkland, Chobani, Generic"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Measurement Unit" required>
              <Select
                options={measurementUnits.map((u) => ({ value: u.id, label: `${u.name} (${u.code})` }))}
                value={form.measurementUnitId}
                onChange={(val) => setForm({ ...form, measurementUnitId: Number(val) })}
                placeholder="Choose Unit"
              />
            </FormField>

            <FormField label="Serving Quantity" required>
              <NumberInput
                required
                min={0.1}
                placeholder="e.g. 100"
                value={form.defaultServingAmount}
                onChange={(val) => setForm({ ...form, defaultServingAmount: val })}
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField label="Calories (kcal)" required>
              <NumberInput
                required
                min={0}
                placeholder="e.g. 165"
                value={form.calories}
                onChange={(val) => setForm({ ...form, calories: val })}
              />
            </FormField>

            <FormField label="Protein (g)">
              <NumberInput
                min={0}
                placeholder="e.g. 31"
                value={form.proteinG}
                onChange={(val) => setForm({ ...form, proteinG: val })}
              />
            </FormField>

            <FormField label="Carbohydrates (g)">
              <NumberInput
                min={0}
                placeholder="e.g. 0"
                value={form.carbsG}
                onChange={(val) => setForm({ ...form, carbsG: val })}
              />
            </FormField>

            <FormField label="Fat (g)">
              <NumberInput
                min={0}
                placeholder="e.g. 3.6"
                value={form.fatG}
                onChange={(val) => setForm({ ...form, fatG: val })}
              />
            </FormField>
          </div>

          <FormField label="Notes / Source Details (Optional)">
            <TextInput
              placeholder="e.g. USDA verified, raw skinless"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </FormField>
        </form>
      </Dialog>
    </div>
  );
};
