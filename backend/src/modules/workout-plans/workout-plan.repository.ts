import { getDatabasePool } from '../../database/pool.js';
import { DbConnection } from '../../database/types.js';

export class WorkoutPlanRepository {
  private db = getDatabasePool();

  async findAllPlans(): Promise<any[]> {
    const sql = `
      SELECT wp.*, 
             wp.goal as goal_category,
             (CASE WHEN wp.status = 'archived' THEN 1 ELSE 0 END) as is_archived,
             (SELECT COUNT(*) FROM workout_plan_versions wpv WHERE wpv.workout_plan_id = wp.id) as version_count,
             (SELECT wpv.version_number FROM workout_plan_versions wpv WHERE wpv.workout_plan_id = wp.id AND wpv.status = 'published' ORDER BY wpv.version_number DESC LIMIT 1) as active_version_number
      FROM workout_plans wp
      ORDER BY wp.id DESC
    `;
    return this.db.query(sql);
  }

  async findPlanById(planId: number, client: DbConnection = this.db): Promise<any | null> {
    const sql = `
      SELECT *, 
             goal as goal_category, 
             (CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as is_archived 
      FROM workout_plans WHERE id = ?
    `;
    return client.queryOne(sql, [planId]);
  }

  async createPlan(data: { name: string; description?: string | null; goalCategory?: string | null; createdBy?: number | null }, client: DbConnection = this.db): Promise<number> {
    const sql = `
      INSERT INTO workout_plans (name, description, goal, status, created_by)
      VALUES (?, ?, ?, 'active', ?)
    `;
    const res = await client.execute(sql, [data.name, data.description || null, data.goalCategory || null, data.createdBy || null]);
    return res.insertId;
  }

  async updatePlan(planId: number, data: Partial<{ name: string; description: string | null; goalCategory: string | null; isArchived: number }>): Promise<void> {
    const set: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { set.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { set.push('description = ?'); values.push(data.description); }
    if (data.goalCategory !== undefined) { set.push('goal = ?'); values.push(data.goalCategory); }
    if (data.isArchived !== undefined) { set.push('status = ?'); values.push(data.isArchived ? 'archived' : 'active'); }

    if (set.length === 0) return;
    const sql = `UPDATE workout_plans SET ${set.join(', ')} WHERE id = ?`;
    await this.db.execute(sql, [...values, planId]);
  }

  async findVersionsByPlanId(planId: number): Promise<any[]> {
    const sql = `
      SELECT wpv.*,
             wpv.change_notes as change_summary,
             (SELECT COUNT(*) FROM workout_plan_days wpd WHERE wpd.workout_plan_version_id = wpv.id) as days_count
      FROM workout_plan_versions wpv
      WHERE wpv.workout_plan_id = ?
      ORDER BY wpv.version_number DESC
    `;
    return this.db.query(sql, [planId]);
  }

  async findVersionById(versionId: number, client: DbConnection = this.db): Promise<any | null> {
    const sql = `SELECT *, change_notes as change_summary FROM workout_plan_versions WHERE id = ?`;
    return client.queryOne(sql, [versionId]);
  }

  async getLatestVersionNumber(planId: number, client: DbConnection = this.db): Promise<number> {
    const sql = `SELECT MAX(version_number) as max_version FROM workout_plan_versions WHERE workout_plan_id = ?`;
    const res = await client.queryOne<{ max_version: number | null }>(sql, [planId]);
    return res?.max_version || 0;
  }

  async createVersion(data: {
    workoutPlanId: number;
    versionNumber: number;
    title?: string | null;
    status: string;
    changeSummary?: string | null;
    createdBy?: number | null;
  }, client: DbConnection = this.db): Promise<number> {
    const sql = `
      INSERT INTO workout_plan_versions (workout_plan_id, version_number, status, change_notes, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;
    const res = await client.execute(sql, [
      data.workoutPlanId,
      data.versionNumber,
      data.status || 'draft',
      data.changeSummary || null,
      data.createdBy || null,
    ]);
    return res.insertId;
  }

  async publishVersion(versionId: number): Promise<void> {
    const sql = `
      UPDATE workout_plan_versions 
      SET status = 'published', published_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    await this.db.execute(sql, [versionId]);
  }

  async getDaysForVersion(versionId: number, client: DbConnection = this.db): Promise<any[]> {
    const daysSql = `
      SELECT *, 
             weekday as weekday_number, 
             day_order as order_index 
      FROM workout_plan_days 
      WHERE workout_plan_version_id = ? 
      ORDER BY weekday ASC, day_order ASC
    `;
    const days = await client.query(daysSql, [versionId]);
    if (days.length === 0) return [];

    const dayIds = days.map((d: any) => d.id);
    const placeholders = dayIds.map(() => '?').join(',');
    const exercisesSql = `
      SELECT wpe.*, 
             wpe.exercise_order as order_index,
             wpe.target_reps_min as reps_min,
             wpe.target_reps_max as reps_max,
             e.name as exercise_name, 
             e.tracking_type, 
             mg.name as muscle_group_name, 
             eq.name as equipment_name
      FROM workout_plan_exercises wpe
      JOIN exercises e ON e.id = wpe.exercise_id
      LEFT JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id AND emg.is_primary = 1
      LEFT JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
      LEFT JOIN equipment_types eq ON eq.id = e.equipment_type_id
      WHERE wpe.workout_plan_day_id IN (${placeholders})
      ORDER BY wpe.exercise_order ASC
    `;
    const allExercises = await client.query(exercisesSql, dayIds);

    const exercisesByDayId = new Map<number, any[]>();
    for (const ex of allExercises) {
      if (!exercisesByDayId.has(ex.workout_plan_day_id)) {
        exercisesByDayId.set(ex.workout_plan_day_id, []);
      }
      exercisesByDayId.get(ex.workout_plan_day_id)!.push(ex);
    }

    for (const day of days) {
      day.exercises = exercisesByDayId.get(day.id) || [];
    }

    return days;
  }

  async createDay(data: {
    workoutPlanVersionId: number;
    weekdayNumber: number;
    name: string;
    isRestDay?: number;
    notes?: string | null;
    orderIndex?: number;
  }, client: DbConnection = this.db): Promise<number> {
    const sql = `
      INSERT INTO workout_plan_days (workout_plan_version_id, weekday, name, is_rest_day, notes, day_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const res = await client.execute(sql, [
      data.workoutPlanVersionId,
      data.weekdayNumber,
      data.name,
      data.isRestDay ? 1 : 0,
      data.notes || null,
      data.orderIndex || data.weekdayNumber,
    ]);
    return res.insertId;
  }

  async updateDay(dayId: number, data: Partial<{ name: string; isRestDay: number; notes: string | null; orderIndex: number }>): Promise<void> {
    const set: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { set.push('name = ?'); values.push(data.name); }
    if (data.isRestDay !== undefined) { set.push('is_rest_day = ?'); values.push(data.isRestDay); }
    if (data.notes !== undefined) { set.push('notes = ?'); values.push(data.notes); }
    if (data.orderIndex !== undefined) { set.push('day_order = ?'); values.push(data.orderIndex); }

    if (set.length === 0) return;
    const sql = `UPDATE workout_plan_days SET ${set.join(', ')} WHERE id = ?`;
    await this.db.execute(sql, [...values, dayId]);
  }

  async deleteDay(dayId: number): Promise<void> {
    await this.db.execute('DELETE FROM workout_plan_days WHERE id = ?', [dayId]);
  }

  async addExerciseToDay(data: {
    workoutPlanDayId: number;
    exerciseId: number;
    orderIndex: number;
    targetSets: number;
    repsMin?: number | null;
    repsMax?: number | null;
    rirTarget?: number | null;
    restSeconds?: number | null;
    notes?: string | null;
    isOptional?: number;
  }, client: DbConnection = this.db): Promise<number> {
    const exercise = await client.queryOne<{ name: string; tracking_type: string }>('SELECT name, tracking_type FROM exercises WHERE id = ?', [data.exerciseId]);
    const exerciseName = exercise?.name || 'Exercise';
    const trackingType = exercise?.tracking_type || 'weight_reps';

    const sql = `
      INSERT INTO workout_plan_exercises (
        workout_plan_day_id, exercise_id, exercise_order, exercise_name_snapshot, tracking_type_snapshot,
        target_sets, target_reps_min, target_reps_max, rir_target, rest_seconds, notes, is_optional
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const res = await client.execute(sql, [
      data.workoutPlanDayId,
      data.exerciseId,
      data.orderIndex,
      exerciseName,
      trackingType,
      data.targetSets,
      data.repsMin ?? null,
      data.repsMax ?? null,
      data.rirTarget ?? null,
      data.restSeconds ?? null,
      data.notes || null,
      data.isOptional ? 1 : 0,
    ]);
    return res.insertId;
  }

  async updateExercise(exerciseId: number, data: Partial<{
    orderIndex: number;
    targetSets: number;
    repsMin: number | null;
    repsMax: number | null;
    rirTarget: number | null;
    restSeconds: number | null;
    notes: string | null;
    isOptional: number;
  }>): Promise<void> {
    const set: string[] = [];
    const values: any[] = [];

    if (data.orderIndex !== undefined) { set.push('exercise_order = ?'); values.push(data.orderIndex); }
    if (data.targetSets !== undefined) { set.push('target_sets = ?'); values.push(data.targetSets); }
    if (data.repsMin !== undefined) { set.push('target_reps_min = ?'); values.push(data.repsMin); }
    if (data.repsMax !== undefined) { set.push('target_reps_max = ?'); values.push(data.repsMax); }
    if (data.rirTarget !== undefined) { set.push('rir_target = ?'); values.push(data.rirTarget); }
    if (data.restSeconds !== undefined) { set.push('rest_seconds = ?'); values.push(data.restSeconds); }
    if (data.notes !== undefined) { set.push('notes = ?'); values.push(data.notes); }
    if (data.isOptional !== undefined) { set.push('is_optional = ?'); values.push(data.isOptional); }

    if (set.length === 0) return;
    const sql = `UPDATE workout_plan_exercises SET ${set.join(', ')} WHERE id = ?`;
    await this.db.execute(sql, [...values, exerciseId]);
  }

  async deleteExercise(exerciseId: number): Promise<void> {
    await this.db.execute('DELETE FROM workout_plan_exercises WHERE id = ?', [exerciseId]);
  }
}
