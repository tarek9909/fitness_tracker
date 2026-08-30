import { getDatabasePool } from '../../database/pool.js';

export class FoodsRepository {
  private db = getDatabasePool();

  async findAll(params: { search?: string; page?: number; limit?: number; isArchived?: boolean; includeInactive?: boolean }): Promise<{ foods: any[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let where: string[] = [];
    let values: any[] = [];

    if (params.isArchived === true) {
      where.push('f.is_active = 0');
    } else if (params.includeInactive !== true) {
      where.push('f.is_active = 1');
    }

    if (params.search) {
      where.push('f.name LIKE ?');
      values.push(`%${params.search}%`);
    }

    const whereStr = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as count FROM foods f ${whereStr}`;
    const countRes = await this.db.queryOne<{ count: number }>(countSql, values);
    const total = countRes?.count || 0;

    const sql = `
      SELECT f.*, 
             f.reference_unit_id as measurement_unit_id,
             f.reference_quantity as default_serving_amount,
             mu.code as unit_code, mu.name as unit_name
      FROM foods f
      LEFT JOIN measurement_units mu ON mu.id = f.reference_unit_id
      ${whereStr}
      ORDER BY f.name ASC
      LIMIT ? OFFSET ?
    `;

    const foods = await this.db.query(sql, [...values, limit, offset]);
    return { foods, total };
  }

  async findById(id: number): Promise<any | null> {
    const sql = `
      SELECT f.*, 
             f.reference_unit_id as measurement_unit_id,
             f.reference_quantity as default_serving_amount,
             mu.code as unit_code, mu.name as unit_name
      FROM foods f
      LEFT JOIN measurement_units mu ON mu.id = f.reference_unit_id
      WHERE f.id = ?
    `;
    return this.db.queryOne(sql, [id]);
  }

  async create(data: {
    name: string;
    brand?: string | null;
    referenceUnitId?: number;
    measurementUnitId?: number;
    referenceQuantity?: number;
    defaultServingAmount?: number;
    calories?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    fiberG?: number | null;
    notes?: string | null;
    createdBy?: number | null;
  }): Promise<number> {
    const unitId = data.referenceUnitId || data.measurementUnitId || 1;
    const quantity = data.referenceQuantity || data.defaultServingAmount || 100;
    const sql = `
      INSERT INTO foods (name, brand, reference_quantity, reference_unit_id, calories, protein_g, carbs_g, fat_g, fiber_g, notes, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `;
    const res = await this.db.execute(sql, [
      data.name,
      data.brand || null,
      quantity,
      unitId,
      data.calories ?? null,
      data.proteinG ?? null,
      data.carbsG ?? null,
      data.fatG ?? null,
      data.fiberG ?? null,
      data.notes || null,
      data.createdBy || null,
    ]);
    return res.insertId;
  }

  async update(id: number, data: {
    name?: string;
    brand?: string | null;
    referenceUnitId?: number;
    measurementUnitId?: number;
    referenceQuantity?: number;
    defaultServingAmount?: number;
    calories?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    fiberG?: number | null;
    notes?: string | null;
  }): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.brand !== undefined) {
      updates.push('brand = ?');
      values.push(data.brand);
    }
    const unitId = data.referenceUnitId ?? data.measurementUnitId;
    if (unitId !== undefined) {
      updates.push('reference_unit_id = ?');
      values.push(unitId);
    }
    const quantity = data.referenceQuantity ?? data.defaultServingAmount;
    if (quantity !== undefined) {
      updates.push('reference_quantity = ?');
      values.push(quantity);
    }
    if (data.calories !== undefined) {
      updates.push('calories = ?');
      values.push(data.calories);
    }
    if (data.proteinG !== undefined) {
      updates.push('protein_g = ?');
      values.push(data.proteinG);
    }
    if (data.carbsG !== undefined) {
      updates.push('carbs_g = ?');
      values.push(data.carbsG);
    }
    if (data.fatG !== undefined) {
      updates.push('fat_g = ?');
      values.push(data.fatG);
    }
    if (data.fiberG !== undefined) {
      updates.push('fiber_g = ?');
      values.push(data.fiberG);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes);
    }

    if (updates.length === 0) return;

    const sql = `UPDATE foods SET ${updates.join(', ')} WHERE id = ?`;
    await this.db.execute(sql, [...values, id]);
  }

  async setArchiveStatus(id: number, isArchived: boolean): Promise<void> {
    const sql = `UPDATE foods SET is_active = ? WHERE id = ?`;
    await this.db.execute(sql, [isArchived ? 0 : 1, id]);
  }

  async getMeasurementUnits(): Promise<any[]> {
    return this.db.query('SELECT * FROM measurement_units ORDER BY id ASC');
  }
}
