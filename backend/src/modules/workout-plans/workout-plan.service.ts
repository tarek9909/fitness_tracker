import { WorkoutPlanRepository } from './workout-plan.repository.js';
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors/app-error.js';
import { getDatabasePool } from '../../database/pool.js';
import { shiftDate } from '../../shared/utils/date-utils.js';

export class WorkoutPlanService {
  private repo = new WorkoutPlanRepository();
  private db = getDatabasePool();

  async getPlans() {
    return this.repo.findAllPlans();
  }

  async getPlansForUser(userId: number) {
    return this.repo.findPlansForUser(userId);
  }

  async getPlanById(planId: number, userId?: number) {
    const plan = await this.repo.findPlanById(planId);
    if (!plan) throw new NotFoundError('Workout plan not found');
    const versions = await this.repo.findVersionsByPlanId(planId);
    let isCurrentlyActive = false;
    if (userId) {
      const activeAssign = await this.db.queryOne<any>(
        `SELECT 1 FROM user_workout_assignments uwa
         JOIN workout_plan_versions wpv ON wpv.id = uwa.workout_plan_version_id
         WHERE wpv.workout_plan_id = ? AND uwa.user_id = ? AND uwa.status = 'active'
         LIMIT 1`,
        [planId, userId]
      );
      isCurrentlyActive = !!activeAssign;
    }
    return { ...plan, versions, is_currently_active: isCurrentlyActive };
  }

  async createPlan(data: {
    name: string;
    description?: string;
    goalCategory?: string;
    createdBy?: number;
    ownerUserId?: number;
    visibility?: string;
  }) {
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

      // Private self-service plans start empty so every day and rest-day
      // choice is explicitly entered by the user. Admin-authored plans keep
      // the established weekly template for backwards compatibility.
      if (data.ownerUserId === undefined) {
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
      }

      return planId;
    });
    return this.getPlanById(planId);
  }

  async clonePlan(sourcePlanId: number, targetUserId: number, customName?: string) {
    const sourcePlan = await this.repo.findPlanById(sourcePlanId);
    if (!sourcePlan) throw new NotFoundError('Source workout plan not found');

    const versions = await this.repo.findVersionsByPlanId(sourcePlanId);
    const sourceVersion = versions.find((v: any) => v.status === 'published') || versions[0];
    if (!sourceVersion) {
      throw new NotFoundError('Source workout plan has no versions');
    }
    const sourceDetails = await this.getVersionDetails(sourceVersion.id);

    const newPlanName = customName || `${sourcePlan.name} (My Plan)`;

    return this.db.withTransaction(async (conn) => {
      const planId = await this.repo.createPlan({
        name: newPlanName,
        description: sourcePlan.description,
        goalCategory: sourcePlan.goal,
        createdBy: targetUserId,
        ownerUserId: targetUserId,
        visibility: 'private',
      }, conn);

      const versionId = await this.repo.createVersion({
        workoutPlanId: planId,
        versionNumber: 1,
        title: 'Version 1 Draft',
        status: 'draft',
        createdBy: targetUserId,
      }, conn);

      for (const day of sourceDetails.days || []) {
        const dayId = await this.repo.createDay({
          workoutPlanVersionId: versionId,
          weekdayNumber: day.weekday,
          name: day.name,
          isRestDay: day.is_rest_day,
          notes: day.notes,
          orderIndex: day.order_index,
        }, conn);

        for (const ex of day.exercises || []) {
          await this.repo.addExercise({
            workoutPlanDayId: dayId,
            exerciseId: ex.exercise_id,
            orderIndex: ex.order_index,
            targetSets: ex.target_sets,
            repsMin: ex.reps_min,
            repsMax: ex.reps_max,
            targetDurationSeconds: ex.target_duration_seconds,
            targetDistanceMeters: ex.target_distance_meters,
            restSeconds: ex.rest_seconds,
            notes: ex.notes,
            isOptional: ex.is_optional,
            sets: (ex.sets || []).map((set: any) => ({
              setNumber: set.set_number,
              targetRepsMin: set.target_reps_min ?? set.target_reps ?? null,
              targetRepsMax: set.target_reps_max ?? set.target_reps ?? null,
              targetWeightKg: set.target_weight_kg ?? null,
              targetDurationSeconds: set.target_duration_seconds ?? null,
              targetDistanceMeters: set.target_distance_meters ?? null,
              restSeconds: set.rest_seconds ?? null,
              notes: set.notes ?? null,
            })),
          }, conn);
        }
      }

      return this.getPlanById(planId);
    });
  }

  async updatePlan(planId: number, data: Partial<{ name: string; description: string | null; goalCategory: string | null; isArchived: boolean }>) {
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
            await this.repo.addExercise({
              workoutPlanDayId: newDayId,
              exerciseId: ex.exercise_id,
              orderIndex: ex.order_index,
              targetSets: ex.target_sets,
              repsMin: ex.reps_min,
              repsMax: ex.reps_max,
              targetDurationSeconds: ex.target_duration_seconds,
              targetDistanceMeters: ex.target_distance_meters,
              restSeconds: ex.rest_seconds,
              notes: ex.notes,
              isOptional: ex.is_optional,
              sets: (ex.sets || []).map((set: any) => ({
                setNumber: set.set_number,
                targetRepsMin: set.target_reps_min ?? set.target_reps ?? null,
                targetRepsMax: set.target_reps_max ?? set.target_reps ?? null,
                targetWeightKg: set.target_weight_kg ?? null,
                targetDurationSeconds: set.target_duration_seconds ?? null,
                targetDistanceMeters: set.target_distance_meters ?? null,
                restSeconds: set.rest_seconds ?? null,
                notes: set.notes ?? null,
              })),
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

  private async validatePublishedStructure(versionId: number, conn: any): Promise<void> {
    const days = await conn.query(
      'SELECT id, is_rest_day FROM workout_plan_days WHERE workout_plan_version_id = ?',
      [versionId],
    );
    if (days.length === 0) throw new ValidationError('Published workout plans must contain at least one day');
    const trainingDays = days.filter((day: any) => !day.is_rest_day);
    if (trainingDays.length === 0) {
      throw new ValidationError('Published workout plans must contain at least one active workout day');
    }
    const dayIds = trainingDays.map((day: any) => day.id);
    const exercises = await conn.query(
      `SELECT id, exercise_id, target_sets, target_reps_min, target_reps_max
       FROM workout_plan_exercises WHERE workout_plan_day_id IN (${dayIds.map(() => '?').join(',')})`,
      dayIds,
    );
    if (exercises.length === 0) throw new ValidationError('Published workout plans must contain at least one exercise');
    for (const exercise of exercises) {
      if (!exercise.exercise_id || Number(exercise.target_sets) < 1) {
        throw new ValidationError('Published workout exercises must have a valid exercise and at least one set');
      }
      if (exercise.target_reps_min != null && exercise.target_reps_max != null && exercise.target_reps_max < exercise.target_reps_min) {
        throw new ValidationError('Published workout exercise rep ranges are invalid');
      }
    }
  }

  private defaultSets(data: any, targetSets: number) {
    return Array.from({ length: targetSets }, (_, index) => ({
      setNumber: index + 1,
      targetRepsMin: data.repsMin ?? null,
      targetRepsMax: data.repsMax ?? null,
      targetWeightKg: null,
      targetDurationSeconds: data.targetDurationSeconds ?? null,
      targetDistanceMeters: data.targetDistanceMeters ?? null,
      restSeconds: data.restSeconds ?? null,
      notes: data.notes ?? null,
    }));
  }

  async addDay(versionId: number, data: { weekdayNumber: number; name: string; isRestDay?: boolean | null; notes?: string | null; orderIndex?: number | null }) {
    const { dayId, dayOrder } = await this.db.withTransaction(async (conn) => {
      const version = await conn.queryOne<any>('SELECT status FROM workout_plan_versions WHERE id = ?', [versionId]);
      if (!version) throw new NotFoundError('Workout plan version not found');

      const existingWeekday = await conn.queryOne<any>(
        'SELECT id FROM workout_plan_days WHERE workout_plan_version_id = ? AND weekday = ?',
        [versionId, data.weekdayNumber]
      );
      if (existingWeekday) {
        throw new ConflictError(
          `Weekday ${data.weekdayNumber} is already scheduled in this workout plan version`,
          'WORKOUT_DAY_WEEKDAY_EXISTS'
        );
      }

      let order = data.orderIndex;
      if (order === undefined || order === null) {
        const maxOrderRes = await conn.queryOne<{ max_order: number | null }>(
          'SELECT MAX(day_order) as max_order FROM workout_plan_days WHERE workout_plan_version_id = ?',
          [versionId]
        );
        order = (maxOrderRes?.max_order ?? 0) + 1;
      } else {
        const existingOrder = await conn.queryOne<any>(
          'SELECT id FROM workout_plan_days WHERE workout_plan_version_id = ? AND day_order = ?',
          [versionId, order]
        );
        if (existingOrder) {
          throw new ConflictError(
            `A workout day with order ${order} already exists in this plan version`,
            'WORKOUT_DAY_ORDER_EXISTS'
          );
        }
      }

      try {
        const result = await conn.execute(
          `INSERT INTO workout_plan_days (workout_plan_version_id, weekday, name, is_rest_day, notes, day_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            versionId,
            data.weekdayNumber,
            data.name,
            data.isRestDay ? 1 : 0,
            data.notes || null,
            order,
          ]
        );
        if (version.status === 'published') await this.validatePublishedStructure(versionId, conn);
        return { dayId: result.insertId, dayOrder: order };
      } catch (err: any) {
        if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('Duplicate entry') || err.message?.includes('UNIQUE constraint failed')) {
          if (err.message?.includes('weekday') || err.message?.includes('uq_workout_plan_day_weekday')) {
            throw new ConflictError(
              `Weekday ${data.weekdayNumber} is already scheduled in this workout plan version`,
              'WORKOUT_DAY_WEEKDAY_EXISTS'
            );
          }
          if (err.message?.includes('day_order') || err.message?.includes('uq_workout_plan_day_order')) {
            throw new ConflictError(
              `A workout day with order ${order} already exists in this plan version`,
              'WORKOUT_DAY_ORDER_EXISTS'
            );
          }
          throw new ConflictError('A workout day with these parameters already exists in this plan version', 'WORKOUT_DAY_CONFLICT');
        }
        throw err;
      }
    });
    return {
      id: dayId,
      workout_plan_version_id: versionId,
      weekday: data.weekdayNumber,
      name: data.name,
      is_rest_day: data.isRestDay ? 1 : 0,
      notes: data.notes || null,
      day_order: dayOrder,
      exercises: [],
    };
  }

  async updateDay(dayId: number, data: { name?: string; isRestDay?: boolean | null; notes?: string | null; orderIndex?: number }) {
    await this.db.withTransaction(async (conn) => {
      const day = await conn.queryOne<any>(
        `SELECT wpd.workout_plan_version_id, wpv.status 
         FROM workout_plan_days wpd 
         JOIN workout_plan_versions wpv ON wpv.id = wpd.workout_plan_version_id 
         WHERE wpd.id = ?`,
        [dayId]
      );
      if (!day) throw new NotFoundError('Workout day not found');
      const set: string[] = [];
      const values: any[] = [];
      if (data.name !== undefined) { set.push('name = ?'); values.push(data.name); }
      if (data.isRestDay !== undefined) { set.push('is_rest_day = ?'); values.push(data.isRestDay ? 1 : 0); }
      if (data.notes !== undefined) { set.push('notes = ?'); values.push(data.notes); }

      if (data.orderIndex !== undefined) {
        const current = await conn.queryOne<any>('SELECT day_order FROM workout_plan_days WHERE id = ?', [dayId]);
        if (current && current.day_order !== data.orderIndex) {
          const target = await conn.queryOne<any>(
            'SELECT id FROM workout_plan_days WHERE workout_plan_version_id = ? AND day_order = ? AND id != ?',
            [day.workout_plan_version_id, data.orderIndex, dayId],
          );
          if (target) {
            const maxRes = await conn.queryOne<{ max_order: number | null }>(
              'SELECT MAX(day_order) as max_order FROM workout_plan_days WHERE workout_plan_version_id = ?',
              [day.workout_plan_version_id]
            );
            const tempOrder = (maxRes?.max_order ?? 0) + 1000;
            await conn.execute('UPDATE workout_plan_days SET day_order = ? WHERE id = ?', [tempOrder, target.id]);
            await conn.execute('UPDATE workout_plan_days SET day_order = ? WHERE id = ?', [data.orderIndex, dayId]);
            await conn.execute('UPDATE workout_plan_days SET day_order = ? WHERE id = ?', [current.day_order, target.id]);
          } else {
            await conn.execute('UPDATE workout_plan_days SET day_order = ? WHERE id = ?', [data.orderIndex, dayId]);
          }
        }
      }

      if (set.length > 0) {
        await conn.execute(`UPDATE workout_plan_days SET ${set.join(', ')} WHERE id = ?`, [...values, dayId]);
      }
      if (day.status === 'published') await this.validatePublishedStructure(day.workout_plan_version_id, conn);
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
      await conn.execute('DELETE FROM workout_plan_days WHERE id = ?', [dayId]);
      if (day.status === 'published') await this.validatePublishedStructure(day.workout_plan_version_id, conn);
    });
  }

  async addExercise(dayId: number, data: {
    exerciseId: number;
    orderIndex?: number;
    targetSets: number;
    repsMin?: number;
    repsMax?: number;
    targetDurationSeconds?: number;
    targetDistanceMeters?: number;
    restSeconds?: number;
    notes?: string;
    isOptional?: boolean;
    sets?: any[];
  }) {
    return this.db.withTransaction(async (conn) => {
      const day = await conn.queryOne<any>(
        `SELECT wpd.*, wpv.status FROM workout_plan_days wpd
         JOIN workout_plan_versions wpv ON wpv.id = wpd.workout_plan_version_id
         WHERE wpd.id = ?`,
        [dayId]
      );
      if (!day) throw new NotFoundError('Workout day not found');
      const exercise = await conn.queryOne<{ name: string; tracking_type: string }>(
        'SELECT name, tracking_type FROM exercises WHERE id = ?',
        [data.exerciseId]
      );
      const exerciseName = exercise?.name || 'Exercise';
      const trackingType = exercise?.tracking_type || 'weight_reps';

      let orderIndex = data.orderIndex;
      if (orderIndex === undefined || orderIndex === null) {
        const maxRes = await conn.queryOne<{ max_order: number | null }>(
          'SELECT MAX(exercise_order) as max_order FROM workout_plan_exercises WHERE workout_plan_day_id = ?',
          [dayId]
        );
        orderIndex = (maxRes?.max_order ?? 0) + 1;
      } else {
        const existingOrder = await conn.queryOne<any>(
          'SELECT id FROM workout_plan_exercises WHERE workout_plan_day_id = ? AND exercise_order = ?',
          [dayId, orderIndex]
        );
        if (existingOrder) {
          throw new ConflictError(
            `An exercise with order ${orderIndex} already exists in this workout day`,
            'WORKOUT_EXERCISE_ORDER_EXISTS'
          );
        }
      }

      let res: any;
      try {
        res = await conn.execute(
          `INSERT INTO workout_plan_exercises (
            workout_plan_day_id, exercise_id, exercise_order, exercise_name_snapshot, tracking_type_snapshot,
            target_sets, target_reps_min, target_reps_max, target_duration_seconds,
            target_distance_meters, rest_seconds, notes, is_optional
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            dayId,
            data.exerciseId,
            orderIndex,
            exerciseName,
            trackingType,
            data.targetSets,
            data.repsMin ?? null,
            data.repsMax ?? null,
            data.targetDurationSeconds ?? null,
            data.targetDistanceMeters ?? null,
            data.restSeconds ?? null,
            data.notes || null,
            data.isOptional ? 1 : 0,
          ]
        );
      } catch (err: any) {
        if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('Duplicate entry') || err.message?.includes('UNIQUE constraint failed')) {
          throw new ConflictError(
            `An exercise with order ${orderIndex} already exists in this workout day`,
            'WORKOUT_EXERCISE_ORDER_EXISTS'
          );
        }
        throw err;
      }
      await this.repo.replaceExerciseSets(res.insertId, data.sets || this.defaultSets(data, data.targetSets), conn);
      if (day.status === 'published') await this.validatePublishedStructure(day.workout_plan_version_id, conn);
      return { id: res.insertId };
    });
  }

  async addExerciseToDay(dayId: number, data: any) {
    return this.addExercise(dayId, data);
  }

  async updateExercise(exerciseId: number, data: any) {
    await this.db.withTransaction(async (conn) => {
      const ex = await conn.queryOne<any>(
        `SELECT wpd.workout_plan_version_id, wpe.workout_plan_day_id, wpe.exercise_order,
                wpe.target_sets, wpe.target_reps_min, wpe.target_reps_max,
                wpe.target_duration_seconds, wpe.target_distance_meters,
                wpe.rest_seconds, wpe.notes, wpv.status
         FROM workout_plan_exercises wpe
         JOIN workout_plan_days wpd ON wpd.id = wpe.workout_plan_day_id
         JOIN workout_plan_versions wpv ON wpv.id = wpd.workout_plan_version_id
         WHERE wpe.id = ?`,
        [exerciseId]
      );
      if (!ex) throw new NotFoundError('Workout exercise not found');
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
          // Use temporary positive order to prevent UNIQUE(workout_plan_day_id, exercise_order) constraint collision
          // and prevent MySQL ER_WARN_DATA_OUT_OF_RANGE on UNSIGNED columns
          const maxRes = await conn.queryOne<{ max_order: number | null }>(
            'SELECT MAX(exercise_order) as max_order FROM workout_plan_exercises WHERE workout_plan_day_id = ?',
            [ex.workout_plan_day_id]
          );
          const tempOrder = (maxRes?.max_order ?? 0) + 1000;
          await conn.execute('UPDATE workout_plan_exercises SET exercise_order = ? WHERE id = ?', [tempOrder, existingAtTarget.id]);
          await conn.execute('UPDATE workout_plan_exercises SET exercise_order = ? WHERE id = ?', [data.orderIndex, exerciseId]);
          await conn.execute('UPDATE workout_plan_exercises SET exercise_order = ? WHERE id = ?', [ex.exercise_order, existingAtTarget.id]);
          delete updatePayload.orderIndex; // Order swap already executed atomically
        }
      }

      const set: string[] = [];
      const values: any[] = [];
      if (updatePayload.exerciseId !== undefined && updatePayload.exerciseId !== ex.exercise_id) {
        const exerciseLib = await conn.queryOne<any>('SELECT name, tracking_type FROM exercises WHERE id = ?', [updatePayload.exerciseId]);
        if (!exerciseLib) throw new NotFoundError('Exercise not found in library');
        set.push('exercise_id = ?'); values.push(updatePayload.exerciseId);
        set.push('exercise_name_snapshot = ?'); values.push(exerciseLib.name);
        set.push('tracking_type_snapshot = ?'); values.push(exerciseLib.tracking_type || 'weight_reps');
      }
      if (updatePayload.orderIndex !== undefined) { set.push('exercise_order = ?'); values.push(updatePayload.orderIndex); }
      if (updatePayload.targetSets !== undefined) { set.push('target_sets = ?'); values.push(updatePayload.targetSets); }
      if (updatePayload.repsMin !== undefined) { set.push('target_reps_min = ?'); values.push(updatePayload.repsMin); }
      if (updatePayload.repsMax !== undefined) { set.push('target_reps_max = ?'); values.push(updatePayload.repsMax); }
      if (updatePayload.targetDurationSeconds !== undefined) { set.push('target_duration_seconds = ?'); values.push(updatePayload.targetDurationSeconds); }
      if (updatePayload.targetDistanceMeters !== undefined) { set.push('target_distance_meters = ?'); values.push(updatePayload.targetDistanceMeters); }
      if (updatePayload.restSeconds !== undefined) { set.push('rest_seconds = ?'); values.push(updatePayload.restSeconds); }
      if (updatePayload.notes !== undefined) { set.push('notes = ?'); values.push(updatePayload.notes); }
      if (updatePayload.isOptional !== undefined) { set.push('is_optional = ?'); values.push(updatePayload.isOptional ? 1 : 0); }

      if (set.length > 0) {
        await conn.execute(`UPDATE workout_plan_exercises SET ${set.join(', ')} WHERE id = ?`, [...values, exerciseId]);
      }
      if (data.sets !== undefined) {
        await this.repo.replaceExerciseSets(exerciseId, data.sets, conn);
      } else if (data.targetSets !== undefined && data.targetSets !== ex.target_sets) {
        await this.repo.replaceExerciseSets(exerciseId, this.defaultSets({
          repsMin: effectiveRepsMin,
          repsMax: effectiveRepsMax,
          targetDurationSeconds: data.targetDurationSeconds ?? ex.target_duration_seconds,
          targetDistanceMeters: data.targetDistanceMeters ?? ex.target_distance_meters,
          restSeconds: data.restSeconds ?? ex.rest_seconds,
          notes: data.notes ?? ex.notes,
        }, data.targetSets), conn);
      }
      if (ex.status === 'published') await this.validatePublishedStructure(ex.workout_plan_version_id, conn);
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
      await conn.execute('DELETE FROM workout_plan_exercises WHERE id = ?', [exerciseId]);
      if (ex.status === 'published') await this.validatePublishedStructure(ex.workout_plan_version_id, conn);
    });
  }

  async activatePlanForUser(userId: number, planId: number, effectiveFrom?: string) {
    const plan = await this.repo.findPlanById(planId);
    if (!plan) throw new NotFoundError('Workout plan not found');

    let publishedVersion = await this.db.queryOne<any>(
      `SELECT * FROM workout_plan_versions 
       WHERE workout_plan_id = ? AND status = 'published' 
       ORDER BY version_number DESC LIMIT 1`,
      [planId]
    );
    if (!publishedVersion) {
      const draftVersion = await this.db.queryOne<any>(
        `SELECT * FROM workout_plan_versions
         WHERE workout_plan_id = ? AND status = 'draft'
         ORDER BY version_number DESC LIMIT 1`,
        [planId]
      );
      if (draftVersion) {
        await this.publishVersion(draftVersion.id);
        publishedVersion = await this.db.queryOne<any>(
          `SELECT * FROM workout_plan_versions WHERE id = ?`,
          [draftVersion.id]
        );
      }
    }
    if (!publishedVersion) {
      throw new ValidationError('Workout plan must have a published version before it can be activated');
    }

    const effectiveFromDate = effectiveFrom || new Date().toISOString().split('T')[0];
    const effectiveUntil = shiftDate(effectiveFromDate, -1);

    return this.db.withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE user_workout_assignments 
         SET status = 'ended', effective_until = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND status = 'active' AND effective_from < ?`,
        [effectiveUntil, userId, effectiveFromDate]
      );

      await conn.execute(
        `UPDATE user_workout_assignments
         SET status = 'cancelled', effective_until = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND status = 'active' AND effective_from >= ?`,
        [effectiveUntil, userId, effectiveFromDate]
      );

      const res = await conn.execute(
        `INSERT INTO user_workout_assignments (
           user_id, workout_plan_version_id, assignment_source, effective_from, status
         ) VALUES (?, ?, 'self_service', ?, 'active')`,
        [userId, publishedVersion.id, effectiveFromDate]
      );

      await conn.execute(
        `UPDATE daily_tasks 
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND task_type = 'workout' AND status = 'pending' AND task_date >= ?`,
        [userId, effectiveFromDate]
      );

      return {
        assignmentId: res.insertId,
        workoutPlanId: planId,
        versionId: publishedVersion.id,
        effectiveFrom: effectiveFromDate,
      };
    });
  }
}
