import { DietPlanRepository } from './diet-plan.repository.js';
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors/app-error.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { recordAuditEvent } from '../../shared/utils/audit-utils.js';
import { getDatabasePool } from '../../database/pool.js';
import { isDateOnly, parsePositiveInt } from '../../shared/utils/request-utils.js';
import { assertCanViewDietPlan, assertCanModifyDietPlan } from './diet-plan-ownership.js';
import { getUserLocalDate, shiftDate } from '../../shared/utils/date-utils.js';

export class DietPlanService {
  private repo = new DietPlanRepository();
  private db = getDatabasePool();

  async getPlans() {
    return this.repo.findAllPlans();
  }

  async getPlansForUser(userId: number) {
    return this.repo.findPlansForUser(userId);
  }

  async getPlanById(planId: number) {
    const plan = await this.repo.findPlanById(planId);
    if (!plan) throw new NotFoundError('Diet plan not found');
    const versions = await this.repo.findVersionsByPlanId(planId);
    return { ...plan, versions };
  }

  async createPlan(data: {
    name: string;
    description?: string;
    dailyCaloriesTarget?: number;
    dailyProteinTargetG?: number;
    dailyCarbsTargetG?: number;
    dailyFatTargetG?: number;
    createdBy?: number;
    ownerUserId?: number;
    visibility?: string;
  }) {
    const planId = await this.db.withTransaction(async (conn) => {
      const planId = await this.repo.createPlan(data, conn);
      await this.repo.createVersion({
        dietPlanId: planId,
        versionNumber: 1,
        title: 'Version 1 Draft',
        status: 'draft',
        dailyCaloriesTarget: data.dailyCaloriesTarget,
        dailyProteinTargetG: data.dailyProteinTargetG,
        dailyCarbsTargetG: data.dailyCarbsTargetG,
        dailyFatTargetG: data.dailyFatTargetG,
        createdBy: data.createdBy,
      }, conn);
      return planId;
    });
    return this.getPlanById(planId);
  }

  async clonePlan(sourcePlanId: number, targetUserId: number, customName?: string) {
    const sourcePlan = await this.repo.findPlanById(sourcePlanId);
    if (!sourcePlan) throw new NotFoundError('Source diet plan not found');

    const versions = await this.repo.findVersionsByPlanId(sourcePlanId);
    const sourceVersion = versions.find((v: any) => v.status === 'published') || versions[0];
    if (!sourceVersion) {
      throw new NotFoundError('Source diet plan has no versions');
    }
    const sourceMeals = await this.repo.getMealsForVersion(sourceVersion.id);

    const newPlanName = customName || `${sourcePlan.name} (My Plan)`;

    return this.db.withTransaction(async (conn) => {
      const planId = await this.repo.createPlan({
        name: newPlanName,
        description: sourcePlan.description,
        dailyCaloriesTarget: sourceVersion.daily_calorie_target ?? sourceVersion.daily_calories_target,
        dailyProteinTargetG: sourceVersion.daily_protein_target_g,
        dailyCarbsTargetG: sourceVersion.daily_carbs_target_g,
        dailyFatTargetG: sourceVersion.daily_fat_target_g,
        createdBy: targetUserId,
        ownerUserId: targetUserId,
        visibility: 'private',
      }, conn);

      const versionId = await this.repo.createVersion({
        dietPlanId: planId,
        versionNumber: 1,
        title: 'Version 1 Draft',
        status: 'draft',
        dailyCaloriesTarget: sourceVersion.daily_calorie_target ?? sourceVersion.daily_calories_target,
        dailyProteinTargetG: sourceVersion.daily_protein_target_g,
        dailyCarbsTargetG: sourceVersion.daily_carbs_target_g,
        dailyFatTargetG: sourceVersion.daily_fat_target_g,
        createdBy: targetUserId,
      }, conn);

      for (const meal of sourceMeals) {
        const newMealId = await this.repo.createMeal({
          dietPlanVersionId: versionId,
          name: meal.name,
          scheduledTime: meal.scheduled_time,
          orderIndex: meal.order_index,
          notes: meal.notes,
        }, conn);

        for (const group of meal.optionGroups || []) {
          const newGroupId = await this.repo.createOptionGroup({
            dietMealId: newMealId,
            name: group.name,
            isRequired: group.is_required,
            minSelections: group.min_selections,
            maxSelections: group.max_selections,
            orderIndex: group.order_index,
          }, conn);

          for (const opt of group.options || []) {
            await this.repo.createOption({
              dietMealOptionGroupId: newGroupId,
              foodId: opt.food_id,
              customLabel: opt.custom_label,
              servingQuantity: opt.serving_quantity,
              servingUnitId: opt.serving_unit_id,
              calories: opt.calories,
              proteinG: opt.protein_g,
              carbsG: opt.carbs_g,
              fatG: opt.fat_g,
              isDefault: opt.is_default,
              orderIndex: opt.order_index,
            }, conn);
          }
        }
      }

      return this.getPlanById(planId);
    });
  }

  async updatePlan(planId: number, data: Partial<{ name: string; description?: string; isArchived?: boolean }>) {
    await this.getPlanById(planId);
    await this.repo.updatePlan(planId, {
      name: data.name,
      description: data.description,
      isArchived: data.isArchived ? 1 : 0,
    });
    return this.getPlanById(planId);
  }

  async activatePlanForUser(userId: number, planId: number, effectiveFrom?: string) {
    const plan = await this.repo.findPlanById(planId);
    if (!plan) throw new NotFoundError('Diet plan not found');

    const publishedVersion = await this.db.queryOne<any>(
      `SELECT * FROM diet_plan_versions 
       WHERE diet_plan_id = ? AND status = 'published' 
       ORDER BY version_number DESC LIMIT 1`,
      [planId]
    );
    if (!publishedVersion) {
      throw new ValidationError('Diet plan must have a published version before it can be activated');
    }

    const effectiveFromDate = effectiveFrom || new Date().toISOString().split('T')[0];
    const effectiveUntil = shiftDate(effectiveFromDate, -1);

    return this.db.withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE user_diet_assignments 
         SET status = 'completed', effective_until = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND status = 'active' AND effective_from < ?`,
        [effectiveUntil, userId, effectiveFromDate]
      );

      await conn.execute(
        `UPDATE user_diet_assignments
         SET status = 'cancelled', effective_until = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND status = 'active' AND effective_from >= ?`,
        [effectiveUntil, userId, effectiveFromDate]
      );

      const res = await conn.execute(
        `INSERT INTO user_diet_assignments (
           user_id, diet_plan_version_id, assignment_source, effective_from, status
         ) VALUES (?, ?, 'self_service', ?, 'active')`,
        [userId, publishedVersion.id, effectiveFromDate]
      );

      await conn.execute(
        `UPDATE daily_tasks 
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND task_type = 'diet' AND status = 'pending' AND task_date >= ?`,
        [userId, effectiveFromDate]
      );

      return {
        assignmentId: res.insertId,
        dietPlanId: planId,
        versionId: publishedVersion.id,
        effectiveFrom: effectiveFromDate,
      };
    });
  }

  async createNewVersion(planId: number, fromVersionId?: number, createdBy?: number) {
    const newVersionId = await this.db.withTransaction(async (conn) => {
      const plan = await this.repo.findPlanById(planId, conn);
      if (!plan) throw new NotFoundError('Diet plan not found');

      const latestVerNum = await this.repo.getLatestVersionNumber(planId, conn);
      const newVersionNum = latestVerNum + 1;

      const sourceVersion = fromVersionId ? await this.repo.findVersionById(fromVersionId, conn) : null;
      if (fromVersionId && (!sourceVersion || sourceVersion.diet_plan_id !== planId)) {
        throw new ValidationError('The source diet version does not belong to the requested diet plan');
      }

      const newVersionId = await this.repo.createVersion({
        dietPlanId: planId,
        versionNumber: newVersionNum,
        title: `Version ${newVersionNum} Draft`,
        status: 'draft',
        dailyCaloriesTarget: sourceVersion?.daily_calorie_target ?? sourceVersion?.daily_calories_target ?? null,
        dailyProteinTargetG: sourceVersion?.daily_protein_target_g ?? null,
        dailyCarbsTargetG: sourceVersion?.daily_carbs_target_g ?? null,
        dailyFatTargetG: sourceVersion?.daily_fat_target_g ?? null,
        changeSummary: fromVersionId ? `Cloned from version ${fromVersionId}` : 'New drafted version',
        createdBy,
      }, conn);

      if (fromVersionId) {
        const sourceMeals = await this.repo.getMealsForVersion(fromVersionId, conn);
        for (const meal of sourceMeals) {
          const newMealId = await this.repo.createMeal({
            dietPlanVersionId: newVersionId,
            name: meal.name,
            scheduledTime: meal.scheduled_time,
            orderIndex: meal.order_index,
            notes: meal.notes,
          }, conn);

          for (const group of meal.optionGroups || []) {
            const newGroupId = await this.repo.createOptionGroup({
              dietMealId: newMealId,
              name: group.name,
              isRequired: group.is_required,
              minSelections: group.min_selections,
              maxSelections: group.max_selections,
              orderIndex: group.order_index,
            }, conn);

            for (const opt of group.options || []) {
              await this.repo.createOption({
                dietMealOptionGroupId: newGroupId,
                foodId: opt.food_id,
                customLabel: opt.custom_label,
                servingQuantity: opt.serving_quantity,
                servingUnitId: opt.serving_unit_id,
                calories: opt.calories,
                proteinG: opt.protein_g,
                carbsG: opt.carbs_g,
                fatG: opt.fat_g,
                isDefault: opt.is_default,
                orderIndex: opt.order_index,
              }, conn);
            }
          }
        }
      }

      return newVersionId;
    });
    return this.getVersionDetails(newVersionId);
  }

  async getVersionDetails(versionId: number) {
    const version = await this.repo.findVersionById(versionId);
    if (!version) throw new NotFoundError('Diet plan version not found');
    const meals = await this.repo.getMealsForVersion(versionId);
    return { ...version, meals };
  }

  async publishVersion(versionId: number) {
    const version = await this.repo.findVersionById(versionId);
    if (!version) throw new NotFoundError('Diet plan version not found');
    if (version.status === 'published') {
      throw new ConflictError('Version is already published', 'VERSION_ALREADY_PUBLISHED');
    }

    const meals = await this.repo.getMealsForVersion(versionId);
    if (meals.length === 0) {
      throw new ValidationError('Cannot publish diet version with no meals configured');
    }

    for (const meal of meals) {
      const groups = meal.optionGroups || [];
      if (groups.length === 0) {
        throw new ValidationError(`Meal "${meal.name}" must have at least one option group configured`);
      }
      for (const group of groups) {
        if (group.min_selections !== undefined && group.min_selections < 0) {
          throw new ValidationError(`Option group "${group.name}" min_selections cannot be negative`);
        }
        if (
          group.min_selections !== undefined &&
          group.max_selections !== undefined &&
          group.max_selections !== null &&
          group.max_selections < group.min_selections
        ) {
          throw new ValidationError(`Option group "${group.name}" max_selections (${group.max_selections}) cannot be less than min_selections (${group.min_selections})`);
        }
        const options = group.options || [];
        if (options.length === 0) {
          throw new ValidationError(`Option group "${group.name}" in meal "${meal.name}" must have at least one food option`);
        }
        for (const opt of options) {
          if (!opt.food_id) {
            throw new ValidationError(`Option "${opt.custom_label || opt.id}" in group "${group.name}" must have a valid food reference`);
          }
        }
      }
    }

    await this.db.withTransaction(async (conn) => {
      const result = await conn.execute(
        `UPDATE diet_plan_versions SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'`,
        [versionId]
      );
      if (result.affectedRows !== 1) {
        throw new ConflictError('Diet plan version changed before it could be published', 'VERSION_PUBLISH_CONFLICT');
      }
    });

    return this.getVersionDetails(versionId);
  }

  private async assertDraftVersion(versionId: number) {
    const version = await this.repo.findVersionById(versionId);
    if (!version) throw new NotFoundError('Diet plan version not found');
    if (version.status === 'published') {
      throw new ConflictError('Published diet versions are immutable. Create a new draft version to make changes.', 'PLAN_VERSION_IMMUTABLE');
    }
    return version;
  }

  async updateVersion(versionId: number, data: {
    title?: string;
    dailyCaloriesTarget?: number;
    dailyProteinTargetG?: number;
    dailyCarbsTargetG?: number;
    dailyFatTargetG?: number;
    changeSummary?: string;
  }) {
    await this.db.withTransaction(async (conn) => {
      const version = await conn.queryOne<any>('SELECT status FROM diet_plan_versions WHERE id = ?', [versionId]);
      if (!version) throw new NotFoundError('Diet plan version not found');
      if (version.status === 'published') {
        throw new ConflictError('Published diet versions are immutable. Create a new draft version to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      const set: string[] = [];
      const values: any[] = [];
      if (data.title !== undefined) { set.push('version_notes = ?'); values.push(data.title); }
      if (data.dailyCaloriesTarget !== undefined) { set.push('daily_calorie_target = ?'); values.push(data.dailyCaloriesTarget); }
      if (data.dailyProteinTargetG !== undefined) { set.push('daily_protein_target_g = ?'); values.push(data.dailyProteinTargetG); }
      if (data.dailyCarbsTargetG !== undefined) { set.push('daily_carbs_target_g = ?'); values.push(data.dailyCarbsTargetG); }
      if (data.dailyFatTargetG !== undefined) { set.push('daily_fat_target_g = ?'); values.push(data.dailyFatTargetG); }
      if (data.changeSummary !== undefined) { set.push('change_notes = ?'); values.push(data.changeSummary); }

      if (set.length > 0) {
        await conn.execute(`UPDATE diet_plan_versions SET ${set.join(', ')} WHERE id = ?`, [...values, versionId]);
      }
    });
    return this.getVersionDetails(versionId);
  }

  async addMeal(versionId: number, data: { name: string; scheduledTime?: string; orderIndex?: number; notes?: string }) {
    await this.db.withTransaction(async (conn) => {
      const version = await conn.queryOne<any>('SELECT status FROM diet_plan_versions WHERE id = ?', [versionId]);
      if (!version) throw new NotFoundError('Diet plan version not found');
      if (version.status === 'published') {
        throw new ConflictError('Published diet versions are immutable. Create a new draft version to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      let orderIndex = data.orderIndex;
      if (orderIndex === undefined) {
        const maxRes = await conn.queryOne<{ max_order: number | null }>(
          'SELECT MAX(meal_order) as max_order FROM diet_meals WHERE diet_plan_version_id = ?',
          [versionId]
        );
        orderIndex = (maxRes?.max_order ?? 0) + 1;
      }

      await conn.execute(
        `INSERT INTO diet_meals (diet_plan_version_id, name, scheduled_time, meal_order, description)
         VALUES (?, ?, ?, ?, ?)`,
        [
          versionId,
          data.name,
          data.scheduledTime || null,
          orderIndex,
          data.notes || null,
        ]
      );
    });
    return this.getVersionDetails(versionId);
  }

  async updateMeal(mealId: number, data: { name?: string; scheduledTime?: string; orderIndex?: number; notes?: string }) {
    let versionId: number = 0;
    await this.db.withTransaction(async (conn) => {
      const meal = await conn.queryOne<any>(
        `SELECT dm.diet_plan_version_id, dm.meal_order, dpv.status 
         FROM diet_meals dm 
         JOIN diet_plan_versions dpv ON dpv.id = dm.diet_plan_version_id 
         WHERE dm.id = ?`,
        [mealId]
      );
      if (!meal) throw new NotFoundError('Meal not found');
      if (meal.status === 'published') {
        throw new ConflictError('Published diet versions are immutable. Create a new draft version to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }
      versionId = meal.diet_plan_version_id;

      const updatePayload = { ...data };
      if (data.orderIndex !== undefined && data.orderIndex !== meal.meal_order) {
        const existingAtTarget = await conn.queryOne<any>(
          'SELECT id, meal_order FROM diet_meals WHERE diet_plan_version_id = ? AND meal_order = ? AND id != ?',
          [meal.diet_plan_version_id, data.orderIndex, mealId]
        );
        if (existingAtTarget) {
          await conn.execute('UPDATE diet_meals SET meal_order = ? WHERE id = ?', [-9999, existingAtTarget.id]);
          await conn.execute('UPDATE diet_meals SET meal_order = ? WHERE id = ?', [data.orderIndex, mealId]);
          await conn.execute('UPDATE diet_meals SET meal_order = ? WHERE id = ?', [meal.meal_order, existingAtTarget.id]);
          delete updatePayload.orderIndex;
        }
      }

      const set: string[] = [];
      const values: any[] = [];
      if (updatePayload.name !== undefined) { set.push('name = ?'); values.push(updatePayload.name); }
      if (updatePayload.scheduledTime !== undefined) { set.push('scheduled_time = ?'); values.push(updatePayload.scheduledTime); }
      if (updatePayload.orderIndex !== undefined) { set.push('meal_order = ?'); values.push(updatePayload.orderIndex); }
      if (updatePayload.notes !== undefined) { set.push('description = ?'); values.push(updatePayload.notes); }

      if (set.length > 0) {
        await conn.execute(`UPDATE diet_meals SET ${set.join(', ')} WHERE id = ?`, [...values, mealId]);
      }
    });
    return this.getVersionDetails(versionId);
  }

  async deleteMeal(mealId: number) {
    let versionId: number = 0;
    await this.db.withTransaction(async (conn) => {
      const meal = await conn.queryOne<any>(
        `SELECT dm.diet_plan_version_id, dpv.status 
         FROM diet_meals dm 
         JOIN diet_plan_versions dpv ON dpv.id = dm.diet_plan_version_id 
         WHERE dm.id = ?`,
        [mealId]
      );
      if (!meal) throw new NotFoundError('Meal not found');
      if (meal.status === 'published') {
        throw new ConflictError('Published diet versions are immutable. Create a new draft version to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }
      versionId = meal.diet_plan_version_id;

      await conn.execute('DELETE FROM diet_meals WHERE id = ?', [mealId]);
    });
    return { success: true, versionId };
  }

  async addOptionGroup(mealId: number, data: { name: string; isRequired?: boolean; minSelections?: number; maxSelections?: number; orderIndex?: number }) {
    if (data.minSelections !== undefined && data.maxSelections !== undefined && data.maxSelections < data.minSelections) {
      throw new ValidationError('maxSelections cannot be less than minSelections');
    }

    return this.db.withTransaction(async (conn) => {
      const meal = await conn.queryOne<any>(
        `SELECT dm.diet_plan_version_id, dpv.status 
         FROM diet_meals dm 
         JOIN diet_plan_versions dpv ON dpv.id = dm.diet_plan_version_id 
         WHERE dm.id = ?`,
        [mealId]
      );
      if (!meal) throw new NotFoundError('Meal not found');
      if (meal.status === 'published') {
        throw new ConflictError('Published diet versions are immutable. Create a new draft version to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      let orderIndex = data.orderIndex;
      if (orderIndex === undefined) {
        const maxRes = await conn.queryOne<{ max_order: number | null }>(
          'SELECT MAX(group_order) as max_order FROM diet_meal_option_groups WHERE diet_meal_id = ?',
          [mealId]
        );
        orderIndex = (maxRes?.max_order ?? 0) + 1;
      }

      const res = await conn.execute(
        `INSERT INTO diet_meal_option_groups (
          diet_meal_id, name, is_required, min_selection_count, max_selection_count, group_order
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          mealId,
          data.name,
          data.isRequired !== false ? 1 : 0,
          data.minSelections ?? 1,
          data.maxSelections ?? 1,
          orderIndex,
        ]
      );
      return { id: res.insertId };
    });
  }

  async updateOptionGroup(groupId: number, data: { name?: string; isRequired?: boolean; minSelections?: number; maxSelections?: number; orderIndex?: number }) {
    return this.db.withTransaction(async (conn) => {
      const group = await conn.queryOne<any>(
        `SELECT dm.diet_plan_version_id, dmog.diet_meal_id, dmog.group_order, dmog.min_selection_count, dmog.max_selection_count, dpv.status
         FROM diet_meal_option_groups dmog
         JOIN diet_meals dm ON dm.id = dmog.diet_meal_id
         JOIN diet_plan_versions dpv ON dpv.id = dm.diet_plan_version_id
         WHERE dmog.id = ?`,
        [groupId]
      );
      if (!group) throw new NotFoundError('Option group not found');
      if (group.status === 'published') {
        throw new ConflictError('Published diet versions are immutable. Create a new draft version to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }
      const effectiveMin = data.minSelections ?? group.min_selection_count;
      const effectiveMax = data.maxSelections ?? group.max_selection_count;
      if (effectiveMin !== null && effectiveMin !== undefined && effectiveMax !== null && effectiveMax !== undefined && effectiveMax < effectiveMin) {
        throw new ValidationError('maxSelections cannot be less than minSelections');
      }

      const updatePayload = { ...data };
      if (data.orderIndex !== undefined && data.orderIndex !== group.group_order) {
        const existingAtTarget = await conn.queryOne<any>(
          'SELECT id, group_order FROM diet_meal_option_groups WHERE diet_meal_id = ? AND group_order = ? AND id != ?',
          [group.diet_meal_id, data.orderIndex, groupId]
        );
        if (existingAtTarget) {
          await conn.execute('UPDATE diet_meal_option_groups SET group_order = ? WHERE id = ?', [-9999, existingAtTarget.id]);
          await conn.execute('UPDATE diet_meal_option_groups SET group_order = ? WHERE id = ?', [data.orderIndex, groupId]);
          await conn.execute('UPDATE diet_meal_option_groups SET group_order = ? WHERE id = ?', [group.group_order, existingAtTarget.id]);
          delete updatePayload.orderIndex;
        }
      }

      const set: string[] = [];
      const values: any[] = [];
      if (updatePayload.name !== undefined) { set.push('name = ?'); values.push(updatePayload.name); }
      if (updatePayload.isRequired !== undefined) { set.push('is_required = ?'); values.push(updatePayload.isRequired ? 1 : 0); }
      if (updatePayload.minSelections !== undefined) { set.push('min_selection_count = ?'); values.push(updatePayload.minSelections); }
      if (updatePayload.maxSelections !== undefined) { set.push('max_selection_count = ?'); values.push(updatePayload.maxSelections); }
      if (updatePayload.orderIndex !== undefined) { set.push('group_order = ?'); values.push(updatePayload.orderIndex); }

      if (set.length > 0) {
        await conn.execute(`UPDATE diet_meal_option_groups SET ${set.join(', ')} WHERE id = ?`, [...values, groupId]);
      }
      return { id: groupId };
    });
  }

  async deleteOptionGroup(groupId: number) {
    return this.db.withTransaction(async (conn) => {
      const group = await conn.queryOne<any>(
        `SELECT dm.diet_plan_version_id, dpv.status 
         FROM diet_meal_option_groups dmog
         JOIN diet_meals dm ON dm.id = dmog.diet_meal_id
         JOIN diet_plan_versions dpv ON dpv.id = dm.diet_plan_version_id
         WHERE dmog.id = ?`,
        [groupId]
      );
      if (!group) throw new NotFoundError('Option group not found');
      if (group.status === 'published') {
        throw new ConflictError('Published diet versions are immutable. Create a new draft version to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      await conn.execute('DELETE FROM diet_meal_option_groups WHERE id = ?', [groupId]);
      return { success: true };
    });
  }

  async addOption(groupId: number, data: {
    foodId?: number;
    customLabel?: string;
    servingQuantity: number;
    servingUnitId?: number;
    calories?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    isDefault?: boolean;
    orderIndex?: number;
  }) {
    return this.db.withTransaction(async (conn) => {
      const group = await conn.queryOne<any>(
        `SELECT dm.diet_plan_version_id, dpv.status 
         FROM diet_meal_option_groups dmog
         JOIN diet_meals dm ON dm.id = dmog.diet_meal_id
         JOIN diet_plan_versions dpv ON dpv.id = dm.diet_plan_version_id
         WHERE dmog.id = ?`,
        [groupId]
      );
      if (!group) throw new NotFoundError('Option group not found');
      if (group.status === 'published') {
        throw new ConflictError('Published diet versions are immutable. Create a new draft version to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      let orderIndex = data.orderIndex;
      if (orderIndex === undefined) {
        const maxRes = await conn.queryOne<{ max_order: number | null }>(
          'SELECT MAX(option_order) as max_order FROM diet_meal_options WHERE diet_meal_option_group_id = ?',
          [groupId]
        );
        orderIndex = (maxRes?.max_order ?? 0) + 1;
      }

      let calories = data.calories ?? null;
      let proteinG = data.proteinG ?? null;
      let carbsG = data.carbsG ?? null;
      let fatG = data.fatG ?? null;
      let servingUnitId = data.servingUnitId ?? null;

      if (data.foodId && (calories === null || proteinG === null || carbsG === null || fatG === null)) {
        const food = await conn.queryOne<any>('SELECT * FROM foods WHERE id = ?', [data.foodId]);
        if (food) {
          const referenceQuantity = Number(food.reference_quantity || 100);
          const ratio = (data.servingQuantity || referenceQuantity) / referenceQuantity;
          if (calories === null) calories = Math.round((food.calories || 0) * ratio);
          if (proteinG === null) proteinG = Math.round((food.protein_g || 0) * ratio * 10) / 10;
          if (carbsG === null) carbsG = Math.round((food.carbs_g || 0) * ratio * 10) / 10;
          if (fatG === null) fatG = Math.round((food.fat_g || 0) * ratio * 10) / 10;
          if (servingUnitId === null) servingUnitId = food.reference_unit_id;
        }
      }

      const res = await conn.execute(
        `INSERT INTO diet_meal_options (
          diet_meal_option_group_id, food_id, option_order, label, quantity, unit_id,
          calories_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          groupId,
          data.foodId || null,
          orderIndex,
          data.customLabel || null,
          data.servingQuantity,
          servingUnitId,
          calories,
          proteinG,
          carbsG,
          fatG,
        ]
      );
      return { id: res.insertId };
    });
  }

  async updateOption(optionId: number, data: {
    foodId?: number;
    customLabel?: string;
    servingQuantity?: number;
    servingUnitId?: number;
    calories?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    isDefault?: boolean;
    orderIndex?: number;
  }) {
    return this.db.withTransaction(async (conn) => {
      const option = await conn.queryOne<any>(
        `SELECT dm.diet_plan_version_id, dmo.diet_meal_option_group_id, dmo.option_order, dpv.status 
         FROM diet_meal_options dmo
         JOIN diet_meal_option_groups dmog ON dmog.id = dmo.diet_meal_option_group_id
         JOIN diet_meals dm ON dm.id = dmog.diet_meal_id
         JOIN diet_plan_versions dpv ON dpv.id = dm.diet_plan_version_id
         WHERE dmo.id = ?`,
        [optionId]
      );
      if (!option) throw new NotFoundError('Option not found');
      if (option.status === 'published') {
        throw new ConflictError('Published diet versions are immutable. Create a new draft version to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      const updatePayload = { ...data };
      if (data.orderIndex !== undefined && data.orderIndex !== option.option_order) {
        const existingAtTarget = await conn.queryOne<any>(
          'SELECT id, option_order FROM diet_meal_options WHERE diet_meal_option_group_id = ? AND option_order = ? AND id != ?',
          [option.diet_meal_option_group_id, data.orderIndex, optionId]
        );
        if (existingAtTarget) {
          await conn.execute('UPDATE diet_meal_options SET option_order = ? WHERE id = ?', [-9999, existingAtTarget.id]);
          await conn.execute('UPDATE diet_meal_options SET option_order = ? WHERE id = ?', [data.orderIndex, optionId]);
          await conn.execute('UPDATE diet_meal_options SET option_order = ? WHERE id = ?', [option.option_order, existingAtTarget.id]);
          delete updatePayload.orderIndex;
        }
      }

      const set: string[] = [];
      const values: any[] = [];
      if (updatePayload.foodId !== undefined) { set.push('food_id = ?'); values.push(updatePayload.foodId); }
      if (updatePayload.customLabel !== undefined) { set.push('label = ?'); values.push(updatePayload.customLabel); }
      if (updatePayload.servingQuantity !== undefined) { set.push('quantity = ?'); values.push(updatePayload.servingQuantity); }
      if (updatePayload.servingUnitId !== undefined) { set.push('unit_id = ?'); values.push(updatePayload.servingUnitId); }
      if (updatePayload.calories !== undefined) { set.push('calories_snapshot = ?'); values.push(updatePayload.calories); }
      if (updatePayload.proteinG !== undefined) { set.push('protein_g_snapshot = ?'); values.push(updatePayload.proteinG); }
      if (updatePayload.carbsG !== undefined) { set.push('carbs_g_snapshot = ?'); values.push(updatePayload.carbsG); }
      if (updatePayload.fatG !== undefined) { set.push('fat_g_snapshot = ?'); values.push(updatePayload.fatG); }
      if (updatePayload.orderIndex !== undefined) { set.push('option_order = ?'); values.push(updatePayload.orderIndex); }

      if (set.length > 0) {
        await conn.execute(`UPDATE diet_meal_options SET ${set.join(', ')} WHERE id = ?`, [...values, optionId]);
      }
      return { id: optionId };
    });
  }

  async deleteOption(optionId: number) {
    return this.db.withTransaction(async (conn) => {
      const option = await conn.queryOne<any>(
        `SELECT dm.diet_plan_version_id, dpv.status 
         FROM diet_meal_options dmo
         JOIN diet_meal_option_groups dmog ON dmog.id = dmo.diet_meal_option_group_id
         JOIN diet_meals dm ON dm.id = dmog.diet_meal_id
         JOIN diet_plan_versions dpv ON dpv.id = dm.diet_plan_version_id
         WHERE dmo.id = ?`,
        [optionId]
      );
      if (!option) throw new NotFoundError('Option not found');
      if (option.status === 'published') {
        throw new ConflictError('Published diet versions are immutable. Create a new draft version to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      await conn.execute('DELETE FROM diet_meal_options WHERE id = ?', [optionId]);
      return { success: true };
    });
  }
}

const createPlanSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  dailyCaloriesTarget: z.number().int().min(500).max(10000).optional(),
  dailyProteinTargetG: z.number().min(0).max(1000).optional(),
  dailyCarbsTargetG: z.number().min(0).max(1000).optional(),
  dailyFatTargetG: z.number().min(0).max(1000).optional(),
});

const updatePlanSchema = createPlanSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

const cloneVersionSchema = z.object({
  fromVersionId: z.number().int().positive().optional(),
});

const updateVersionSchema = z.object({
  title: z.string().max(150).optional(),
  dailyCaloriesTarget: z.number().int().min(500).max(10000).optional(),
  dailyProteinTargetG: z.number().min(0).max(1000).optional(),
  dailyCarbsTargetG: z.number().min(0).max(1000).optional(),
  dailyFatTargetG: z.number().min(0).max(1000).optional(),
  changeSummary: z.string().max(2000).optional(),
});

const addMealSchema = z.object({
  name: z.string().min(1).max(100),
  scheduledTime: z.string().max(20).optional(),
  orderIndex: z.number().int().min(1).optional(),
  notes: z.string().max(2000).optional(),
});

const updateMealSchema = addMealSchema.partial();

const groupFields = {
  name: z.string().min(1).max(100),
  isRequired: z.boolean().optional(),
  minSelections: z.number().int().min(0).max(20).optional(),
  maxSelections: z.number().int().min(1).max(20).optional(),
  orderIndex: z.number().int().min(1).optional(),
};

const validateSelectionRange = (data: { minSelections?: number; maxSelections?: number }, ctx: z.RefinementCtx) => {
  if (data.minSelections !== undefined && data.maxSelections !== undefined && data.maxSelections < data.minSelections) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxSelections'], message: 'maxSelections cannot be less than minSelections' });
  }
};

const addGroupSchema = z.object(groupFields).superRefine(validateSelectionRange);

const updateGroupSchema = z.object(groupFields).partial().superRefine(validateSelectionRange);

const addOptionSchema = z.object({
  foodId: z.number().int().positive().optional(),
  customLabel: z.string().max(150).optional(),
  servingQuantity: z.number().min(0.01).max(10000),
  servingUnitId: z.number().int().positive().optional(),
  calories: z.number().min(0).max(10000).optional(),
  proteinG: z.number().min(0).max(1000).optional(),
  carbsG: z.number().min(0).max(1000).optional(),
  fatG: z.number().min(0).max(1000).optional(),
  isDefault: z.boolean().optional(),
  orderIndex: z.number().int().min(1).optional(),
});

const updateOptionSchema = addOptionSchema.partial();

export class DietPlanController {
  private service = new DietPlanService();
  private db = getDatabasePool();

  private async getPlanForVersion(versionId: number) {
    return this.db.queryOne<any>(
      `SELECT dp.* FROM diet_plans dp
       JOIN diet_plan_versions dpv ON dpv.diet_plan_id = dp.id
       WHERE dpv.id = ?`,
      [versionId]
    );
  }

  private async getPlanForMeal(mealId: number) {
    return this.db.queryOne<any>(
      `SELECT dp.* FROM diet_plans dp
       JOIN diet_plan_versions dpv ON dpv.diet_plan_id = dp.id
       JOIN diet_meals dm ON dm.diet_plan_version_id = dpv.id
       WHERE dm.id = ?`,
      [mealId]
    );
  }

  private async getPlanForGroup(groupId: number) {
    return this.db.queryOne<any>(
      `SELECT dp.* FROM diet_plans dp
       JOIN diet_plan_versions dpv ON dpv.diet_plan_id = dp.id
       JOIN diet_meals dm ON dm.diet_plan_version_id = dpv.id
       JOIN diet_meal_option_groups dmog ON dmog.diet_meal_id = dm.id
       WHERE dmog.id = ?`,
      [groupId]
    );
  }

  private async getPlanForOption(optionId: number) {
    return this.db.queryOne<any>(
      `SELECT dp.* FROM diet_plans dp
       JOIN diet_plan_versions dpv ON dpv.diet_plan_id = dp.id
       JOIN diet_meals dm ON dm.diet_plan_version_id = dpv.id
       JOIN diet_meal_option_groups dmog ON dmog.diet_meal_id = dm.id
       JOIN diet_meal_options dmo ON dmo.diet_meal_option_group_id = dmog.id
       WHERE dmo.id = ?`,
      [optionId]
    );
  }

  // --- Admin Endpoints ---

  async listPlans(request: FastifyRequest, reply: FastifyReply) {
    const plans = await this.service.getPlans();
    return reply.status(200).send({ success: true, data: plans });
  }

  async getPlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id: string };
    const planId = parsePositiveInt(params.id, 'planId');
    const plan = await this.service.getPlanById(planId);
    assertCanViewDietPlan(plan, auth);
    return reply.status(200).send({ success: true, data: plan });
  }

  async createPlan(request: FastifyRequest, reply: FastifyReply) {
    const body = createPlanSchema.parse(request.body);
    const auth = (request as AuthenticatedRequest).user;
    const plan = await this.service.createPlan({ ...body, createdBy: auth.userId, visibility: 'admin' });
    await recordAuditEvent(request, 'diet_plan.created', 'diet_plan', plan.id, { name: plan.name });
    return reply.status(201).send({ success: true, data: plan });
  }

  async updatePlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id: string };
    const planId = parsePositiveInt(params.id, 'planId');
    const existing = await this.service.getPlanById(planId);
    assertCanModifyDietPlan(existing, auth);
    const body = updatePlanSchema.parse(request.body);
    const plan = await this.service.updatePlan(planId, body);
    await recordAuditEvent(request, 'diet_plan.updated', 'diet_plan', plan.id, body);
    return reply.status(200).send({ success: true, data: plan });
  }

  async deletePlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id: string };
    const planId = parsePositiveInt(params.id, 'planId');
    const existing = await this.service.getPlanById(planId);
    assertCanModifyDietPlan(existing, auth);
    await this.service.updatePlan(planId, { isArchived: true });
    return reply.status(200).send({ success: true, data: { message: 'Diet plan archived successfully' } });
  }

  async getVersion(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { versionId: string };
    const versionId = parsePositiveInt(params.versionId, 'versionId');
    const plan = await this.getPlanForVersion(versionId);
    assertCanViewDietPlan(plan, auth);
    const version = await this.service.getVersionDetails(versionId);
    return reply.status(200).send({ success: true, data: version });
  }

  async updateVersion(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { versionId: string };
    const versionId = parsePositiveInt(params.versionId, 'versionId');
    const plan = await this.getPlanForVersion(versionId);
    assertCanModifyDietPlan(plan, auth);
    const body = updateVersionSchema.parse(request.body);
    const version = await this.service.updateVersion(versionId, body);
    return reply.status(200).send({ success: true, data: version });
  }

  async createVersion(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id: string };
    const planId = parsePositiveInt(params.id, 'planId');
    const plan = await this.service.getPlanById(planId);
    assertCanModifyDietPlan(plan, auth);
    const body = cloneVersionSchema.parse(request.body || {});
    const version = await this.service.createNewVersion(planId, body.fromVersionId, auth.userId);
    await recordAuditEvent(request, 'diet_plan_version.cloned', 'diet_plan_version', version.id, { planId, fromVersionId: body.fromVersionId });
    return reply.status(201).send({ success: true, data: version });
  }

  async publishVersion(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { versionId: string };
    const versionId = parsePositiveInt(params.versionId, 'versionId');
    const plan = await this.getPlanForVersion(versionId);
    assertCanModifyDietPlan(plan, auth);
    const version = await this.service.publishVersion(versionId);
    await recordAuditEvent(request, 'diet_plan_version.published', 'diet_plan_version', version.id, { versionNumber: version.version_number });
    return reply.status(200).send({ success: true, data: version });
  }

  async addMeal(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { versionId: string };
    const versionId = parsePositiveInt(params.versionId, 'versionId');
    const plan = await this.getPlanForVersion(versionId);
    assertCanModifyDietPlan(plan, auth);
    const body = addMealSchema.parse(request.body);
    const version = await this.service.addMeal(versionId, body);
    return reply.status(201).send({ success: true, data: version });
  }

  async updateMeal(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { mealId: string };
    const mealId = parsePositiveInt(params.mealId, 'mealId');
    const plan = await this.getPlanForMeal(mealId);
    assertCanModifyDietPlan(plan, auth);
    const body = updateMealSchema.parse(request.body);
    const version = await this.service.updateMeal(mealId, body);
    return reply.status(200).send({ success: true, data: version });
  }

  async deleteMeal(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { mealId: string };
    const mealId = parsePositiveInt(params.mealId, 'mealId');
    const plan = await this.getPlanForMeal(mealId);
    assertCanModifyDietPlan(plan, auth);
    const result = await this.service.deleteMeal(mealId);
    return reply.status(200).send({ success: true, data: result });
  }

  async addGroup(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { mealId: string };
    const mealId = parsePositiveInt(params.mealId, 'mealId');
    const plan = await this.getPlanForMeal(mealId);
    assertCanModifyDietPlan(plan, auth);
    const body = addGroupSchema.parse(request.body);
    const result = await this.service.addOptionGroup(mealId, body);
    return reply.status(201).send({ success: true, data: result });
  }

  async updateGroup(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { groupId: string };
    const groupId = parsePositiveInt(params.groupId, 'groupId');
    const plan = await this.getPlanForGroup(groupId);
    assertCanModifyDietPlan(plan, auth);
    const body = updateGroupSchema.parse(request.body);
    const result = await this.service.updateOptionGroup(groupId, body);
    return reply.status(200).send({ success: true, data: result });
  }

  async deleteGroup(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { groupId: string };
    const groupId = parsePositiveInt(params.groupId, 'groupId');
    const plan = await this.getPlanForGroup(groupId);
    assertCanModifyDietPlan(plan, auth);
    const result = await this.service.deleteOptionGroup(groupId);
    return reply.status(200).send({ success: true, data: result });
  }

  async addOption(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { groupId: string };
    const groupId = parsePositiveInt(params.groupId, 'groupId');
    const plan = await this.getPlanForGroup(groupId);
    assertCanModifyDietPlan(plan, auth);
    const body = addOptionSchema.parse(request.body);
    const result = await this.service.addOption(groupId, body);
    return reply.status(201).send({ success: true, data: result });
  }

  async updateOption(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { optionId: string };
    const optionId = parsePositiveInt(params.optionId, 'optionId');
    const plan = await this.getPlanForOption(optionId);
    assertCanModifyDietPlan(plan, auth);
    const body = updateOptionSchema.parse(request.body);
    const result = await this.service.updateOption(optionId, body);
    return reply.status(200).send({ success: true, data: result });
  }

  async deleteOption(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { optionId: string };
    const optionId = parsePositiveInt(params.optionId, 'optionId');
    const plan = await this.getPlanForOption(optionId);
    assertCanModifyDietPlan(plan, auth);
    const result = await this.service.deleteOption(optionId);
    return reply.status(200).send({ success: true, data: result });
  }

  // --- Self-Service User Endpoints (/me/diet-plans) ---

  async listMyPlans(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const plans = await this.service.getPlansForUser(auth.userId);
    return reply.status(200).send({ success: true, data: plans });
  }

  async createMyPlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = createPlanSchema.parse(request.body);
    const plan = await this.service.createPlan({
      ...body,
      createdBy: auth.userId,
      ownerUserId: auth.userId,
      visibility: 'private',
    });
    await recordAuditEvent(request, 'diet_plan.created', 'diet_plan', plan.id, { name: plan.name, isPrivate: true });
    return reply.status(201).send({ success: true, data: plan });
  }

  async cloneMyPlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id: string };
    const planId = parsePositiveInt(params.id, 'planId');
    const sourcePlan = await this.service.getPlanById(planId);
    assertCanViewDietPlan(sourcePlan, auth);
    const body = z.object({ name: z.string().min(1).max(150).optional() }).parse(request.body || {});
    const cloned = await this.service.clonePlan(planId, auth.userId, body.name);
    return reply.status(201).send({ success: true, data: cloned });
  }

  async activateMyPlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id: string };
    const planId = parsePositiveInt(params.id, 'planId');
    const plan = await this.service.getPlanById(planId);
    assertCanViewDietPlan(plan, auth);
    const body = z.object({
      effectiveFrom: z.string().refine(isDateOnly, 'effectiveFrom must be a valid YYYY-MM-DD date').optional(),
    }).parse(request.body || {});
    const user = await this.db.queryOne<{ timezone?: string | null }>('SELECT timezone FROM users WHERE id = ?', [auth.userId]);
    const today = getUserLocalDate(user?.timezone || 'UTC');
    const effectiveFrom = body.effectiveFrom || today;
    if (effectiveFrom < today) {
      throw new ValidationError('A plan cannot be activated in the past.');
    }
    const result = await this.service.activatePlanForUser(auth.userId, planId, effectiveFrom);
    await recordAuditEvent(request, 'diet_plan.activated', 'diet_plan', planId, { versionId: result.versionId, effectiveFrom });
    return reply.status(200).send({ success: true, data: result });
  }
}

export async function dietPlansRoutes(fastify: FastifyInstance) {
  const controller = new DietPlanController();

  // Admin Diet Plans Endpoints
  fastify.get('/admin/diet-plans', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.listPlans(req, res));
  fastify.post('/admin/diet-plans', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.createPlan(req, res));
  fastify.get('/admin/diet-plans/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getPlan(req, res));
  fastify.patch('/admin/diet-plans/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updatePlan(req, res));
  fastify.delete('/admin/diet-plans/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.deletePlan(req, res));
  fastify.post('/admin/diet-plans/:id/versions', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.createVersion(req, res));

  fastify.get('/admin/diet-versions/:versionId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getVersion(req, res));
  fastify.patch('/admin/diet-versions/:versionId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updateVersion(req, res));
  fastify.post('/admin/diet-versions/:versionId/publish', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.publishVersion(req, res));

  fastify.post('/admin/diet-versions/:versionId/meals', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.addMeal(req, res));
  fastify.patch('/admin/diet-meals/:mealId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updateMeal(req, res));
  fastify.delete('/admin/diet-meals/:mealId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.deleteMeal(req, res));

  fastify.post('/admin/diet-meals/:mealId/groups', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.addGroup(req, res));
  fastify.patch('/admin/diet-option-groups/:groupId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updateGroup(req, res));
  fastify.delete('/admin/diet-option-groups/:groupId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.deleteGroup(req, res));

  fastify.post('/admin/diet-option-groups/:groupId/options', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.addOption(req, res));
  fastify.patch('/admin/diet-options/:optionId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updateOption(req, res));
  fastify.delete('/admin/diet-options/:optionId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.deleteOption(req, res));

  // Self-Service User Diet Plans (/me/diet-plans)
  fastify.get('/me/diet-plans', { preHandler: [authenticate] }, (req, res) => controller.listMyPlans(req, res));
  fastify.post('/me/diet-plans', { preHandler: [authenticate] }, (req, res) => controller.createMyPlan(req, res));
  fastify.get('/me/diet-plans/:id', { preHandler: [authenticate] }, (req, res) => controller.getPlan(req, res));
  fastify.put('/me/diet-plans/:id', { preHandler: [authenticate] }, (req, res) => controller.updatePlan(req, res));
  fastify.patch('/me/diet-plans/:id', { preHandler: [authenticate] }, (req, res) => controller.updatePlan(req, res));
  fastify.delete('/me/diet-plans/:id', { preHandler: [authenticate] }, (req, res) => controller.deletePlan(req, res));
  fastify.post('/me/diet-plans/:id/clone', { preHandler: [authenticate] }, (req, res) => controller.cloneMyPlan(req, res));
  fastify.post('/me/diet-plans/:id/activate', { preHandler: [authenticate] }, (req, res) => controller.activateMyPlan(req, res));

  fastify.get('/me/diet-plans/:id/versions/:versionId', { preHandler: [authenticate] }, (req, res) => controller.getVersion(req, res));
  fastify.post('/me/diet-plans/:id/versions/:versionId/publish', { preHandler: [authenticate] }, (req, res) => controller.publishVersion(req, res));
  fastify.post('/me/diet-plans/:id/versions/:versionId/meals', { preHandler: [authenticate] }, (req, res) => controller.addMeal(req, res));
  fastify.put('/me/diet-plans/:id/meals/:mealId', { preHandler: [authenticate] }, (req, res) => controller.updateMeal(req, res));
  fastify.patch('/me/diet-plans/:id/meals/:mealId', { preHandler: [authenticate] }, (req, res) => controller.updateMeal(req, res));
  fastify.delete('/me/diet-plans/:id/meals/:mealId', { preHandler: [authenticate] }, (req, res) => controller.deleteMeal(req, res));
  fastify.post('/me/diet-plans/:id/meals/:mealId/option-groups', { preHandler: [authenticate] }, (req, res) => controller.addGroup(req, res));
  fastify.post('/me/diet-plans/:id/meals/:mealId/groups', { preHandler: [authenticate] }, (req, res) => controller.addGroup(req, res));
  fastify.put('/me/diet-plans/:id/option-groups/:groupId', { preHandler: [authenticate] }, (req, res) => controller.updateGroup(req, res));
  fastify.delete('/me/diet-plans/:id/option-groups/:groupId', { preHandler: [authenticate] }, (req, res) => controller.deleteGroup(req, res));
  fastify.post('/me/diet-plans/:id/option-groups/:groupId/options', { preHandler: [authenticate] }, (req, res) => controller.addOption(req, res));
  fastify.put('/me/diet-plans/:id/options/:optionId', { preHandler: [authenticate] }, (req, res) => controller.updateOption(req, res));
  fastify.delete('/me/diet-plans/:id/options/:optionId', { preHandler: [authenticate] }, (req, res) => controller.deleteOption(req, res));
}
