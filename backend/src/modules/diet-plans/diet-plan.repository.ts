import { getDatabasePool } from '../../database/pool.js';
import { DbConnection } from '../../database/types.js';

export class DietPlanRepository {
  private db = getDatabasePool();

  async findAllPlans(): Promise<any[]> {
    const sql = `
      SELECT dp.*, 
             (CASE WHEN dp.status = 'archived' THEN 1 ELSE 0 END) as is_archived,
             (SELECT COUNT(*) FROM diet_plan_versions dpv WHERE dpv.diet_plan_id = dp.id) as version_count,
             (SELECT dpv.version_number FROM diet_plan_versions dpv WHERE dpv.diet_plan_id = dp.id AND dpv.status = 'published' ORDER BY dpv.version_number DESC LIMIT 1) as active_version_number,
             (SELECT dpv.daily_calorie_target FROM diet_plan_versions dpv WHERE dpv.diet_plan_id = dp.id ORDER BY dpv.version_number DESC LIMIT 1) as daily_calories_target,
             (SELECT dpv.daily_calorie_target FROM diet_plan_versions dpv WHERE dpv.diet_plan_id = dp.id ORDER BY dpv.version_number DESC LIMIT 1) as daily_calorie_target
      FROM diet_plans dp
      ORDER BY dp.id DESC
    `;
    return this.db.query(sql);
  }

  async findPlanById(planId: number, client: DbConnection = this.db): Promise<any | null> {
    const sql = `
      SELECT dp.*, 
             (CASE WHEN dp.status = 'archived' THEN 1 ELSE 0 END) as is_archived,
             (SELECT dpv.daily_calorie_target FROM diet_plan_versions dpv WHERE dpv.diet_plan_id = dp.id ORDER BY dpv.version_number DESC LIMIT 1) as daily_calories_target,
             (SELECT dpv.daily_calorie_target FROM diet_plan_versions dpv WHERE dpv.diet_plan_id = dp.id ORDER BY dpv.version_number DESC LIMIT 1) as daily_calorie_target
      FROM diet_plans dp WHERE dp.id = ?
    `;
    return client.queryOne(sql, [planId]);
  }

  async createPlan(data: {
    name: string;
    description?: string | null;
    dailyCaloriesTarget?: number | null;
    dailyProteinTargetG?: number | null;
    dailyCarbsTargetG?: number | null;
    dailyFatTargetG?: number | null;
    createdBy?: number | null;
    ownerUserId?: number | null;
    visibility?: string;
  }, client: DbConnection = this.db): Promise<number> {
    const sql = `
      INSERT INTO diet_plans (name, description, status, created_by, owner_user_id, visibility)
      VALUES (?, ?, 'active', ?, ?, ?)
    `;
    const res = await client.execute(sql, [
      data.name,
      data.description || null,
      data.createdBy || null,
      data.ownerUserId || null,
      data.visibility || 'admin',
    ]);
    return res.insertId;
  }

  async findPlansForUser(userId: number): Promise<any[]> {
    const sql = `
      SELECT dp.*, 
             (CASE WHEN dp.status = 'archived' THEN 1 ELSE 0 END) as is_archived,
             (SELECT COUNT(*) FROM diet_plan_versions dpv WHERE dpv.diet_plan_id = dp.id) as version_count,
             (SELECT dpv.version_number FROM diet_plan_versions dpv WHERE dpv.diet_plan_id = dp.id AND dpv.status = 'published' ORDER BY dpv.version_number DESC LIMIT 1) as active_version_number,
             (SELECT dpv.daily_calorie_target FROM diet_plan_versions dpv WHERE dpv.diet_plan_id = dp.id ORDER BY dpv.version_number DESC LIMIT 1) as daily_calories_target,
             (SELECT dpv.daily_calorie_target FROM diet_plan_versions dpv WHERE dpv.diet_plan_id = dp.id ORDER BY dpv.version_number DESC LIMIT 1) as daily_calorie_target
      FROM diet_plans dp
      WHERE dp.owner_user_id = ? OR dp.visibility = 'admin'
      ORDER BY dp.id DESC
    `;
    return this.db.query(sql, [userId]);
  }

  async updatePlan(planId: number, data: Partial<{ name: string; description: string | null; isArchived: number }>): Promise<void> {
    const set: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { set.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { set.push('description = ?'); values.push(data.description); }
    if (data.isArchived !== undefined) { set.push('status = ?'); values.push(data.isArchived ? 'archived' : 'active'); }
    if (set.length === 0) return;
    const sql = `UPDATE diet_plans SET ${set.join(', ')} WHERE id = ?`;
    await this.db.execute(sql, [...values, planId]);
  }

  async findVersionsByPlanId(planId: number): Promise<any[]> {
    const sql = `
      SELECT *, 
             daily_calorie_target as daily_calories_target,
             change_notes as change_summary 
      FROM diet_plan_versions 
      WHERE diet_plan_id = ? 
      ORDER BY version_number DESC
    `;
    return this.db.query(sql, [planId]);
  }

  async findVersionById(versionId: number, client: DbConnection = this.db): Promise<any | null> {
    const sql = `
      SELECT *, 
             daily_calorie_target as daily_calories_target,
             change_notes as change_summary 
      FROM diet_plan_versions WHERE id = ?
    `;
    return client.queryOne(sql, [versionId]);
  }

  async getLatestVersionNumber(planId: number, client: DbConnection = this.db): Promise<number> {
    const sql = `SELECT MAX(version_number) as max_version FROM diet_plan_versions WHERE diet_plan_id = ?`;
    const res = await client.queryOne<{ max_version: number | null }>(sql, [planId]);
    return res?.max_version || 0;
  }

  async createVersion(data: {
    dietPlanId: number;
    versionNumber: number;
    title?: string | null;
    status: string;
    dailyCaloriesTarget?: number | null;
    dailyProteinTargetG?: number | null;
    dailyCarbsTargetG?: number | null;
    dailyFatTargetG?: number | null;
    changeSummary?: string | null;
    createdBy?: number | null;
  }, client: DbConnection = this.db): Promise<number> {
    const sql = `
      INSERT INTO diet_plan_versions (
        diet_plan_id, version_number, status,
        daily_calorie_target, daily_protein_target_g, daily_carbs_target_g, daily_fat_target_g,
        change_notes, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const res = await client.execute(sql, [
      data.dietPlanId,
      data.versionNumber,
      data.status || 'draft',
      data.dailyCaloriesTarget ?? null,
      data.dailyProteinTargetG ?? null,
      data.dailyCarbsTargetG ?? null,
      data.dailyFatTargetG ?? null,
      data.changeSummary || null,
      data.createdBy || null,
    ]);
    return res.insertId;
  }

  async publishVersion(versionId: number): Promise<void> {
    const sql = `
      UPDATE diet_plan_versions 
      SET status = 'published', published_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    await this.db.execute(sql, [versionId]);
  }

  async getMealsForVersion(versionId: number, client: DbConnection = this.db): Promise<any[]> {
    const mealsSql = `
      SELECT *, 
             meal_order as order_index, 
             description as notes 
      FROM diet_meals 
      WHERE diet_plan_version_id = ? 
      ORDER BY meal_order ASC
    `;
    const meals = await client.query(mealsSql, [versionId]);
    if (meals.length === 0) return [];

    const mealIds = meals.map((m: any) => m.id);
    const mealPlaceholders = mealIds.map(() => '?').join(',');
    const groupsSql = `
      SELECT *, 
             group_order as order_index, 
             min_selection_count as min_selections, 
             max_selection_count as max_selections 
      FROM diet_meal_option_groups 
      WHERE diet_meal_id IN (${mealPlaceholders})
      ORDER BY group_order ASC
    `;
    const allGroups = await client.query(groupsSql, mealIds);

    let allOptions: any[] = [];
    if (allGroups.length > 0) {
      const groupIds = allGroups.map((g: any) => g.id);
      const groupPlaceholders = groupIds.map(() => '?').join(',');
      const optionsSql = `
        SELECT dmo.*, 
               dmo.option_order as order_index,
               dmo.label as custom_label,
               dmo.quantity as serving_quantity,
               dmo.unit_id as serving_unit_id,
               dmo.calories_snapshot as calories,
               dmo.protein_g_snapshot as protein_g,
               dmo.carbs_g_snapshot as carbs_g,
               dmo.fat_g_snapshot as fat_g,
               dmo.fiber_g_snapshot as fiber_g,
               f.name as food_name, 
               f.calories as food_base_calories, 
               mu.code as unit_code
        FROM diet_meal_options dmo
        LEFT JOIN foods f ON f.id = dmo.food_id
        LEFT JOIN measurement_units mu ON mu.id = dmo.unit_id
        WHERE dmo.diet_meal_option_group_id IN (${groupPlaceholders})
        ORDER BY dmo.option_order ASC
      `;
      allOptions = await client.query(optionsSql, groupIds);
    }

    const optionsByGroupId = new Map<number, any[]>();
    for (const opt of allOptions) {
      if (!optionsByGroupId.has(opt.diet_meal_option_group_id)) {
        optionsByGroupId.set(opt.diet_meal_option_group_id, []);
      }
      optionsByGroupId.get(opt.diet_meal_option_group_id)!.push(opt);
    }

    const groupsByMealId = new Map<number, any[]>();
    for (const g of allGroups) {
      g.options = optionsByGroupId.get(g.id) || [];
      if (!groupsByMealId.has(g.diet_meal_id)) {
        groupsByMealId.set(g.diet_meal_id, []);
      }
      groupsByMealId.get(g.diet_meal_id)!.push(g);
    }

    for (const meal of meals) {
      meal.optionGroups = groupsByMealId.get(meal.id) || [];
    }

    return meals;
  }

  async createMeal(data: { dietPlanVersionId: number; name: string; scheduledTime?: string | null; orderIndex: number; notes?: string | null; isRequired?: number | null }, client: DbConnection = this.db): Promise<number> {
    const sql = `
      INSERT INTO diet_meals (diet_plan_version_id, name, scheduled_time, meal_order, description, is_required)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const res = await client.execute(sql, [
      data.dietPlanVersionId,
      data.name,
      data.scheduledTime || null,
      data.orderIndex,
      data.notes || null,
      data.isRequired !== 0 ? 1 : 0,
    ]);
    return res.insertId;
  }

  async createOptionGroup(data: { dietMealId: number; name: string; isRequired: number; minSelections: number; maxSelections: number; orderIndex: number; notes?: string | null }, client: DbConnection = this.db): Promise<number> {
    const sql = `
      INSERT INTO diet_meal_option_groups (diet_meal_id, name, is_required, min_selection_count, max_selection_count, group_order, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const res = await client.execute(sql, [
      data.dietMealId,
      data.name,
      data.isRequired,
      data.minSelections,
      data.maxSelections,
      data.orderIndex,
      data.notes || null,
    ]);
    return res.insertId;
  }

  async createOption(data: {
    dietMealOptionGroupId: number;
    foodId?: number | null;
    customLabel?: string | null;
    servingQuantity: number;
    servingUnitId?: number | null;
    calories?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    fiberG?: number | null;
    isDefault?: number;
    orderIndex?: number;
    notes?: string | null;
  }, client: DbConnection = this.db): Promise<number> {
    const sql = `
      INSERT INTO diet_meal_options (
        diet_meal_option_group_id, food_id, option_order, label, quantity, unit_id,
        calories_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot, fiber_g_snapshot, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const res = await client.execute(sql, [
      data.dietMealOptionGroupId,
      data.foodId || null,
      data.orderIndex || 1,
      data.customLabel || 'Serving',
      data.servingQuantity,
      data.servingUnitId || null,
      data.calories || null,
      data.proteinG || null,
      data.carbsG || null,
      data.fatG || null,
      data.fiberG || null,
      data.notes || null,
    ]);
    return res.insertId;
  }

  async updateVersion(versionId: number, data: {
    title?: string | null;
    dailyCaloriesTarget?: number | null;
    dailyProteinTargetG?: number | null;
    dailyCarbsTargetG?: number | null;
    dailyFatTargetG?: number | null;
    changeSummary?: string | null;
  }): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.dailyCaloriesTarget !== undefined) {
      updates.push('daily_calorie_target = ?');
      values.push(data.dailyCaloriesTarget);
    }
    if (data.dailyProteinTargetG !== undefined) {
      updates.push('daily_protein_target_g = ?');
      values.push(data.dailyProteinTargetG);
    }
    if (data.dailyCarbsTargetG !== undefined) {
      updates.push('daily_carbs_target_g = ?');
      values.push(data.dailyCarbsTargetG);
    }
    if (data.dailyFatTargetG !== undefined) {
      updates.push('daily_fat_target_g = ?');
      values.push(data.dailyFatTargetG);
    }
    if (data.changeSummary !== undefined) {
      updates.push('change_notes = ?');
      values.push(data.changeSummary);
    }

    if (updates.length === 0) return;
    const sql = `UPDATE diet_plan_versions SET ${updates.join(', ')} WHERE id = ?`;
    await this.db.execute(sql, [...values, versionId]);
  }

  async updateMeal(mealId: number, data: {
    name?: string;
    scheduledTime?: string | null;
    orderIndex?: number;
    notes?: string | null;
  }): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.scheduledTime !== undefined) {
      updates.push('scheduled_time = ?');
      values.push(data.scheduledTime);
    }
    if (data.orderIndex !== undefined) {
      updates.push('meal_order = ?');
      values.push(data.orderIndex);
    }
    if (data.notes !== undefined) {
      updates.push('description = ?');
      values.push(data.notes);
    }

    if (updates.length === 0) return;
    const sql = `UPDATE diet_meals SET ${updates.join(', ')} WHERE id = ?`;
    await this.db.execute(sql, [...values, mealId]);
  }

  async deleteMeal(mealId: number): Promise<void> {
    await this.db.execute('DELETE FROM diet_meals WHERE id = ?', [mealId]);
  }

  async updateOptionGroup(groupId: number, data: {
    name?: string;
    isRequired?: number;
    minSelections?: number;
    maxSelections?: number;
    orderIndex?: number;
  }): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.isRequired !== undefined) {
      updates.push('is_required = ?');
      values.push(data.isRequired);
    }
    if (data.minSelections !== undefined) {
      updates.push('min_selection_count = ?');
      values.push(data.minSelections);
    }
    if (data.maxSelections !== undefined) {
      updates.push('max_selection_count = ?');
      values.push(data.maxSelections);
    }
    if (data.orderIndex !== undefined) {
      updates.push('group_order = ?');
      values.push(data.orderIndex);
    }

    if (updates.length === 0) return;
    const sql = `UPDATE diet_meal_option_groups SET ${updates.join(', ')} WHERE id = ?`;
    await this.db.execute(sql, [...values, groupId]);
  }

  async deleteOptionGroup(groupId: number): Promise<void> {
    await this.db.execute('DELETE FROM diet_meal_option_groups WHERE id = ?', [groupId]);
  }

  async updateOption(optionId: number, data: {
    foodId?: number | null;
    customLabel?: string | null;
    servingQuantity?: number;
    servingUnitId?: number | null;
    calories?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    isDefault?: number;
    orderIndex?: number;
  }): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.foodId !== undefined) {
      updates.push('food_id = ?');
      values.push(data.foodId);
    }
    if (data.customLabel !== undefined) {
      updates.push('label = ?');
      values.push(data.customLabel);
    }
    if (data.servingQuantity !== undefined) {
      updates.push('quantity = ?');
      values.push(data.servingQuantity);
    }
    if (data.servingUnitId !== undefined) {
      updates.push('unit_id = ?');
      values.push(data.servingUnitId);
    }
    if (data.calories !== undefined) {
      updates.push('calories_snapshot = ?');
      values.push(data.calories);
    }
    if (data.proteinG !== undefined) {
      updates.push('protein_g_snapshot = ?');
      values.push(data.proteinG);
    }
    if (data.carbsG !== undefined) {
      updates.push('carbs_g_snapshot = ?');
      values.push(data.carbsG);
    }
    if (data.fatG !== undefined) {
      updates.push('fat_g_snapshot = ?');
      values.push(data.fatG);
    }
    if (data.orderIndex !== undefined) {
      updates.push('option_order = ?');
      values.push(data.orderIndex);
    }

    if (updates.length === 0) return;
    const sql = `UPDATE diet_meal_options SET ${updates.join(', ')} WHERE id = ?`;
    await this.db.execute(sql, [...values, optionId]);
  }

  async deleteOption(optionId: number): Promise<void> {
    await this.db.execute('DELETE FROM diet_meal_options WHERE id = ?', [optionId]);
  }
}
