import { WorkoutPlanRepository } from './workout-plan.repository.js';
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors/app-error.js';
import { getDatabasePool } from '../../database/pool.js';

export class WorkoutPlanService {
  private repo = new WorkoutPlanRepository();
  private db = getDatabasePool();

  async getPlans() {
    return this.repo.findAllPlans();
  }

  async getPlanById(planId: number) {
    const plan = await this.repo.findPlanById(planId);
    if (!plan) throw new NotFoundError('Workout plan not found');
    const versions = await this.repo.findVersionsByPlanId(planId);
    return { ...plan, versions };
  }

  async createPlan(data: { name: string; description?: string; goalCategory?: string; createdBy?: number }) {
    const planId = await this.db.withTransaction(async (conn) => {
      const planId = await this.repo.createPlan(data, conn);
      // Automatically create version 1 draft
      const versionId = await this.repo.createVersion({
        workoutPlanId: planId,
        versionNumber: 1,
        title: 'Version 1 Draft',
        status: 'draft',
        createdBy: data.createdBy,
      }, conn);

      // Create 7 days template (Mon-Sun)
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      for (let i = 1; i <= 7; i++) {
        await this.repo.createDay({
          workoutPlanVersionId: versionId,
          weekdayNumber: i,
          name: dayNames[i - 1],
          isRestDay: i === 3 || i === 6 || i === 7 ? 1 : 0,
          orderIndex: i,
        }, conn);
      }

      return planId;
    });
    return this.getPlanById(planId);
  }

  async updatePlan(planId: number, data: Partial<{ name: string; description: string; goalCategory: string; isArchived: boolean }>) {
    await this.getPlanById(planId);
    await this.repo.updatePlan(planId, {
      name: data.name,
      description: data.description,
      goalCategory: data.goalCategory,
      isArchived: data.isArchived !== undefined ? (data.isArchived ? 1 : 0) : undefined,
    });
    return this.getPlanById(planId);
  }

  async getVersionDetails(versionId: number) {
    const version = await this.repo.findVersionById(versionId);
    if (!version) throw new NotFoundError('Workout plan version not found');
    const days = await this.repo.getDaysForVersion(versionId);
    return { ...version, days };
  }

  async createNewVersion(planId: number, fromVersionId?: number, createdBy?: number) {
    const newVersionId = await this.db.withTransaction(async (conn) => {
      const plan = await this.repo.findPlanById(planId, conn);
      if (!plan) throw new NotFoundError('Workout plan not found');

      const latestVersionNum = await this.repo.getLatestVersionNumber(planId, conn);
      const newVersionNum = latestVersionNum + 1;

      const sourceVersion = fromVersionId ? await this.repo.findVersionById(fromVersionId, conn) : null;
      if (fromVersionId && (!sourceVersion || sourceVersion.workout_plan_id !== planId)) {
        throw new ValidationError('The source workout version does not belong to the requested workout plan');
      }

      const newVersionId = await this.repo.createVersion({
        workoutPlanId: planId,
        versionNumber: newVersionNum,
        title: `Version ${newVersionNum} Draft`,
        status: 'draft',
        changeSummary: fromVersionId ? `Cloned from version ${fromVersionId}` : 'New drafted version',
        createdBy,
      }, conn);

      if (fromVersionId) {
        const sourceDays = await this.repo.getDaysForVersion(fromVersionId, conn);
        for (const day of sourceDays) {
          const newDayId = await this.repo.createDay({
            workoutPlanVersionId: newVersionId,
            weekdayNumber: day.weekday_number,
            name: day.name,
            isRestDay: day.is_rest_day,
            notes: day.notes,
            orderIndex: day.order_index,
          }, conn);

          for (const ex of day.exercises || []) {
            await this.repo.addExerciseToDay({
              workoutPlanDayId: newDayId,
              exerciseId: ex.exercise_id,
              orderIndex: ex.order_index,
              targetSets: ex.target_sets,
              repsMin: ex.reps_min,
              repsMax: ex.reps_max,
              rirTarget: ex.rir_target,
              restSeconds: ex.rest_seconds,
              notes: ex.notes,
              isOptional: ex.is_optional,
            }, conn);
          }
        }
      }

      return newVersionId;
    });
    return this.getVersionDetails(newVersionId);
  }

  async publishVersion(versionId: number) {
    const version = await this.repo.findVersionById(versionId);
    if (!version) throw new NotFoundError('Workout plan version not found');
    if (version.status === 'published') {
      throw new ConflictError('Version is already published', 'VERSION_ALREADY_PUBLISHED');
    }

    const days = await this.repo.getDaysForVersion(versionId);
    if (days.length === 0) {
      throw new ValidationError('Cannot publish a workout version with no configured days');
    }

    const trainingDays = days.filter(d => !d.is_rest_day);
    if (trainingDays.length === 0) {
      throw new ValidationError('Cannot publish a workout plan with only rest days. At least one active workout day is required.');
    }

    let hasConfiguredExercises = false;
    for (const day of trainingDays) {
      const exercises = day.exercises || [];
      if (exercises.length > 0) hasConfiguredExercises = true;

      for (const ex of exercises) {
        if (!ex.exercise_id) {
          throw new ValidationError(`Exercise on day ${day.weekday_number || day.name} is missing a valid exercise reference`);
        }
        if (ex.target_sets !== undefined && ex.target_sets !== null && ex.target_sets < 1) {
          throw new ValidationError(`Exercise ${ex.exercise_name || ex.exercise_id} must have target_sets >= 1`);
        }
        if (ex.reps_min !== undefined && ex.reps_min !== null && ex.reps_min < 1) {
          throw new ValidationError(`Exercise ${ex.exercise_name || ex.exercise_id} must have reps_min >= 1`);
        }
        if (
          ex.reps_min !== undefined && ex.reps_min !== null &&
          ex.reps_max !== undefined && ex.reps_max !== null &&
          ex.reps_max < ex.reps_min
        ) {
          throw new ValidationError(`Exercise ${ex.exercise_name || ex.exercise_id} reps_max (${ex.reps_max}) cannot be less than reps_min (${ex.reps_min})`);
        }
      }
    }

    if (!hasConfiguredExercises) {
      throw new ValidationError('Cannot publish a workout plan with no configured exercises on any training day');
    }

    await this.db.withTransaction(async (conn) => {
      const result = await conn.execute(
        `UPDATE workout_plan_versions SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'`,
        [versionId]
      );
      if (result.affectedRows !== 1) {
        throw new ConflictError('Workout plan version changed before it could be published', 'VERSION_PUBLISH_CONFLICT');
      }
    });

    return this.getVersionDetails(versionId);
  }

  private async assertDraftVersion(versionId: number) {
    const version = await this.repo.findVersionById(versionId);
    if (!version) throw new NotFoundError('Workout plan version not found');
    if (version.status === 'published') {
      throw new ConflictError('Published plan versions are immutable. Create a new version draft to make changes.', 'PLAN_VERSION_IMMUTABLE');
    }
    return version;
  }

  async addDay(versionId: number, data: { weekdayNumber: number; name: string; isRestDay?: boolean; notes?: string }) {
    await this.db.withTransaction(async (conn) => {
      const version = await conn.queryOne<any>('SELECT status FROM workout_plan_versions WHERE id = ?', [versionId]);
      if (!version) throw new NotFoundError('Workout plan version not found');
      if (version.status === 'published') {
        throw new ConflictError('Published plan versions are immutable. Create a new version draft to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      await conn.execute(
        `INSERT INTO workout_plan_days (workout_plan_version_id, weekday, name, is_rest_day, notes, day_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          versionId,
          data.weekdayNumber,
          data.name,
          data.isRestDay ? 1 : 0,
          data.notes || null,
          data.weekdayNumber,
        ]
      );
    });
    return this.getVersionDetails(versionId);
  }

  async updateDay(dayId: number, data: { name?: string; isRestDay?: boolean; notes?: string }) {
    await this.db.withTransaction(async (conn) => {
      const day = await conn.queryOne<any>(
        `SELECT wpd.workout_plan_version_id, wpv.status 
         FROM workout_plan_days wpd 
         JOIN workout_plan_versions wpv ON wpv.id = wpd.workout_plan_version_id 
         WHERE wpd.id = ?`,
        [dayId]
      );
      if (!day) throw new NotFoundError('Workout day not found');
      if (day.status === 'published') {
        throw new ConflictError('Published plan versions are immutable. Create a new version draft to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      const set: string[] = [];
      const values: any[] = [];
      if (data.name !== undefined) { set.push('name = ?'); values.push(data.name); }
      if (data.isRestDay !== undefined) { set.push('is_rest_day = ?'); values.push(data.isRestDay ? 1 : 0); }
      if (data.notes !== undefined) { set.push('notes = ?'); values.push(data.notes); }

      if (set.length > 0) {
        await conn.execute(`UPDATE workout_plan_days SET ${set.join(', ')} WHERE id = ?`, [...values, dayId]);
      }
    });
  }

  async deleteDay(dayId: number) {
    await this.db.withTransaction(async (conn) => {
      const day = await conn.queryOne<any>(
        `SELECT wpd.workout_plan_version_id, wpv.status 
         FROM workout_plan_days wpd 
         JOIN workout_plan_versions wpv ON wpv.id = wpd.workout_plan_version_id 
         WHERE wpd.id = ?`,
        [dayId]
      );
      if (!day) throw new NotFoundError('Workout day not found');
      if (day.status === 'published') {
        throw new ConflictError('Published plan versions are immutable. Create a new version draft to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      await conn.execute('DELETE FROM workout_plan_days WHERE id = ?', [dayId]);
    });
  }

  async addExerciseToDay(dayId: number, data: {
    exerciseId: number;
    targetSets: number;
    orderIndex?: number;
    repsMin?: number;
    repsMax?: number;
    rirTarget?: number;
    restSeconds?: number;
    notes?: string;
    isOptional?: boolean;
  }) {
    if (data.repsMin !== undefined && data.repsMax !== undefined && data.repsMax < data.repsMin) {
      throw new ValidationError('repsMax cannot be less than repsMin');
    }

    return this.db.withTransaction(async (conn) => {
      const day = await conn.queryOne<any>(
        `SELECT wpd.workout_plan_version_id, wpv.status 
         FROM workout_plan_days wpd 
         JOIN workout_plan_versions wpv ON wpv.id = wpd.workout_plan_version_id 
         WHERE wpd.id = ?`,
        [dayId]
      );
      if (!day) throw new NotFoundError('Workout day not found');
      if (day.status === 'published') {
        throw new ConflictError('Published plan versions are immutable. Create a new version draft to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      const exercise = await conn.queryOne<{ name: string; tracking_type: string }>(
        'SELECT name, tracking_type FROM exercises WHERE id = ?',
        [data.exerciseId]
      );
      const exerciseName = exercise?.name || 'Exercise';
      const trackingType = exercise?.tracking_type || 'weight_reps';

      const res = await conn.execute(
        `INSERT INTO workout_plan_exercises (
          workout_plan_day_id, exercise_id, exercise_order, exercise_name_snapshot, tracking_type_snapshot,
          target_sets, target_reps_min, target_reps_max, rir_target, rest_seconds, notes, is_optional
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dayId,
          data.exerciseId,
          data.orderIndex ?? 1,
          exerciseName,
          trackingType,
          data.targetSets,
          data.repsMin ?? null,
          data.repsMax ?? null,
          data.rirTarget ?? null,
          data.restSeconds ?? null,
          data.notes || null,
          data.isOptional ? 1 : 0,
        ]
      );
      return { id: res.insertId };
    });
  }

  async updateExercise(exerciseId: number, data: any) {
    await this.db.withTransaction(async (conn) => {
      const ex = await conn.queryOne<any>(
        `SELECT wpd.workout_plan_version_id, wpe.workout_plan_day_id, wpe.exercise_order,
                wpe.target_reps_min, wpe.target_reps_max, wpv.status
         FROM workout_plan_exercises wpe
         JOIN workout_plan_days wpd ON wpd.id = wpe.workout_plan_day_id
         JOIN workout_plan_versions wpv ON wpv.id = wpd.workout_plan_version_id
         WHERE wpe.id = ?`,
        [exerciseId]
      );
      if (!ex) throw new NotFoundError('Workout exercise not found');
      if (ex.status === 'published') {
        throw new ConflictError('Published plan versions are immutable. Create a new version draft to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      const effectiveRepsMin = data.repsMin !== undefined ? data.repsMin : ex.target_reps_min;
      const effectiveRepsMax = data.repsMax !== undefined ? data.repsMax : ex.target_reps_max;
      if (effectiveRepsMin !== null && effectiveRepsMin !== undefined && effectiveRepsMax !== null && effectiveRepsMax !== undefined && effectiveRepsMax < effectiveRepsMin) {
        throw new ValidationError('repsMax cannot be less than repsMin');
      }

      const updatePayload = { ...data };

      if (data.orderIndex !== undefined && data.orderIndex !== ex.exercise_order) {
        const existingAtTarget = await conn.queryOne<any>(
          'SELECT id FROM workout_plan_exercises WHERE workout_plan_day_id = ? AND exercise_order = ? AND id != ?',
          [ex.workout_plan_day_id, data.orderIndex, exerciseId]
        );
        if (existingAtTarget) {
          // Use temporary negative order to prevent UNIQUE(workout_plan_day_id, exercise_order) constraint collision
          await conn.execute('UPDATE workout_plan_exercises SET exercise_order = ? WHERE id = ?', [-9999, existingAtTarget.id]);
          await conn.execute('UPDATE workout_plan_exercises SET exercise_order = ? WHERE id = ?', [data.orderIndex, exerciseId]);
          await conn.execute('UPDATE workout_plan_exercises SET exercise_order = ? WHERE id = ?', [ex.exercise_order, existingAtTarget.id]);
          delete updatePayload.orderIndex; // Order swap already executed atomically
        }
      }

      const set: string[] = [];
      const values: any[] = [];
      if (updatePayload.orderIndex !== undefined) { set.push('exercise_order = ?'); values.push(updatePayload.orderIndex); }
      if (updatePayload.targetSets !== undefined) { set.push('target_sets = ?'); values.push(updatePayload.targetSets); }
      if (updatePayload.repsMin !== undefined) { set.push('target_reps_min = ?'); values.push(updatePayload.repsMin); }
      if (updatePayload.repsMax !== undefined) { set.push('target_reps_max = ?'); values.push(updatePayload.repsMax); }
      if (updatePayload.rirTarget !== undefined) { set.push('rir_target = ?'); values.push(updatePayload.rirTarget); }
      if (updatePayload.restSeconds !== undefined) { set.push('rest_seconds = ?'); values.push(updatePayload.restSeconds); }
      if (updatePayload.notes !== undefined) { set.push('notes = ?'); values.push(updatePayload.notes); }
      if (updatePayload.isOptional !== undefined) { set.push('is_optional = ?'); values.push(updatePayload.isOptional ? 1 : 0); }

      if (set.length > 0) {
        await conn.execute(`UPDATE workout_plan_exercises SET ${set.join(', ')} WHERE id = ?`, [...values, exerciseId]);
      }
    });
  }

  async deleteExercise(exerciseId: number) {
    await this.db.withTransaction(async (conn) => {
      const ex = await conn.queryOne<any>(
        `SELECT wpd.workout_plan_version_id, wpv.status 
         FROM workout_plan_exercises wpe
         JOIN workout_plan_days wpd ON wpd.id = wpe.workout_plan_day_id
         JOIN workout_plan_versions wpv ON wpv.id = wpd.workout_plan_version_id
         WHERE wpe.id = ?`,
        [exerciseId]
      );
      if (!ex) throw new NotFoundError('Workout exercise not found');
      if (ex.status === 'published') {
        throw new ConflictError('Published plan versions are immutable. Create a new version draft to make changes.', 'PLAN_VERSION_IMMUTABLE');
      }

      await conn.execute('DELETE FROM workout_plan_exercises WHERE id = ?', [exerciseId]);
    });
  }
}
