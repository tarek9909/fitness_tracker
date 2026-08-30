import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Apple, Plus, Search, Flame, Edit2, Archive, RotateCcw, RefreshCw, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';

export const FoodsPage: React.FC = () => {
  const [foods, setFoods] = useState<any[]>([]);
  const [measurementUnits, setMeasurementUnits] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isArchivedTab, setIsArchivedTab] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingFood, setEditingFood] = useState<any | null>(null);

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

  const fetchUnits = async () => {
    try {
      const res = await api.get<any[]>('/admin/foods/measurement-units');
      setMeasurementUnits(Array.isArray(res) ? res : []);
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
      if (isArchivedTab) q.append('isArchived', 'true');
      q.append('page', String(page));
      q.append('limit', '25');

      const res = await api.get<any>(`/admin/foods?${q.toString()}`);
      setFoods(Array.isArray(res) ? res : (res?.data || []));
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
    fetchUnits();
  }, []);

  useEffect(() => {
    fetchFoods();
  }, [search, isArchivedTab, page]);

  const handleOpenCreateModal = () => {
    setEditingFood(null);
    setForm({
      name: '',
      brand: '',
      measurementUnitId: '',
      defaultServingAmount: '',
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
      name: food.name || '',
      brand: food.brand || '',
      measurementUnitId: food.reference_unit_id || food.measurement_unit_id || '',
      defaultServingAmount: food.reference_quantity || food.default_serving_amount || '',
      calories: food.calories !== null && food.calories !== undefined ? food.calories : '',
      proteinG: food.protein_g !== null && food.protein_g !== undefined ? food.protein_g : '',
      carbsG: food.carbs_g !== null && food.carbs_g !== undefined ? food.carbs_g : '',
      fatG: food.fat_g !== null && food.fat_g !== undefined ? food.fat_g : '',
      fiberG: food.fiber_g !== null && food.fiber_g !== undefined ? food.fiber_g : '',
      notes: food.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('Please enter a food name');
      return;
    }
    if (form.measurementUnitId === '') {
      alert('Please select a measurement unit');
      return;
    }
    if (form.defaultServingAmount === '' || Number(form.defaultServingAmount) <= 0) {
      alert('Please enter a valid positive serving amount');
      return;
    }
    if (form.calories === '' || Number(form.calories) < 0) {
      alert('Please enter valid calories (kcal)');
      return;
    }

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
    }
  };

  const handleArchive = async (id: number) => {
    if (!window.confirm('Archive this food item?')) return;
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Food Database</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Nutritional reference values and serving measurements for diet plan builders.
          </p>
        </div>
        <button onClick={handleOpenCreateModal} className="btn btn-primary">
          <Plus size={16} />
          <span>New Food Item</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => { setIsArchivedTab(false); setPage(1); }}
              className={`btn btn-sm ${!isArchivedTab ? 'btn-primary' : 'btn-secondary'}`}
            >
              Active Foods
            </button>
            <button
              onClick={() => { setIsArchivedTab(true); setPage(1); }}
              className={`btn btn-sm ${isArchivedTab ? 'btn-primary' : 'btn-secondary'}`}
            >
              Archived Foods
            </button>
          </div>

          <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '400px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Search foods or brands..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {/* Foods Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
            <p>Loading food items...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <AlertCircle size={32} color="var(--accent-rose)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Failed to Load Foods</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
            <button onClick={fetchFoods} className="btn btn-primary">
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        ) : foods.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Apple size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <p>{search ? 'No matching foods found.' : isArchivedTab ? 'No archived foods.' : 'No foods in the database yet.'}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Food Name</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Serving Size</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Calories</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Protein</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Carbs</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Fat</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {foods.map((food) => (
                  <tr key={food.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{food.name}</div>
                      {food.brand && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{food.brand}</div>}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>
                      {(food.reference_quantity || food.default_serving_amount) != null
                        ? `${food.reference_quantity || food.default_serving_amount}${food.unit_code ? ` ${food.unit_code}` : ''}`
                        : 'Not configured'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--accent-amber)' }}>
                      {food.calories !== null && food.calories !== undefined ? `${food.calories} kcal` : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--accent-primary)' }}>
                      {food.protein_g !== null && food.protein_g !== undefined ? `${food.protein_g}g` : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--accent-cyan)' }}>
                      {food.carbs_g !== null && food.carbs_g !== undefined ? `${food.carbs_g}g` : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--accent-rose)' }}>
                      {food.fat_g !== null && food.fat_g !== undefined ? `${food.fat_g}g` : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button onClick={() => handleOpenEditModal(food)} className="btn btn-secondary btn-sm" aria-label="Edit Food">
                          <Edit2 size={13} />
                        </button>
                        {!isArchivedTab ? (
                          <button onClick={() => handleArchive(food.id)} className="btn btn-danger btn-sm" aria-label="Archive Food" title="Archive">
                            <Archive size={13} />
                          </button>
                        ) : (
                          <button onClick={() => handleRestore(food.id)} className="btn btn-secondary btn-sm" aria-label="Restore Food" title="Restore">
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
            <span>Page {page} of {totalPages} ({total} total foods)</span>
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

      {/* Food Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingFood ? 'Edit Food Item' : 'New Food Item'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Food Name *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Chicken Breast, Jasmine Rice, Avocado"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Brand / Manufacturer (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Kirkland, Chobani, Generic"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Measurement Unit *</label>
                  <select
                    className="select"
                    required
                    value={form.measurementUnitId}
                    onChange={(e) => setForm({ ...form, measurementUnitId: e.target.value === '' ? '' : Number(e.target.value) })}
                  >
                    <option value="">-- Choose Unit --</option>
                    {measurementUnits.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Serving Quantity *</label>
                  <input
                    type="number"
                    className="input"
                    required
                    min="0.1"
                    placeholder="e.g. 100"
                    value={form.defaultServingAmount}
                    onChange={(e) => setForm({ ...form, defaultServingAmount: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Calories (kcal) *</label>
                  <input
                    type="number"
                    className="input"
                    required
                    min="0"
                    placeholder="e.g. 165"
                    value={form.calories}
                    onChange={(e) => setForm({ ...form, calories: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Protein (g)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    placeholder="e.g. 31"
                    value={form.proteinG}
                    onChange={(e) => setForm({ ...form, proteinG: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Carbohydrates (g)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    placeholder="e.g. 0"
                    value={form.carbsG}
                    onChange={(e) => setForm({ ...form, carbsG: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Fat (g)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    placeholder="e.g. 3.6"
                    value={form.fatG}
                    onChange={(e) => setForm({ ...form, fatG: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Notes / Source Details (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. USDA verified, raw skinless"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingFood ? 'Update Food' : 'Create Food Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
