import { getDatabasePool } from '../../database/pool.js';
import { getUserLocalDate, getWeekdayNumber } from '../../shared/utils/date-utils.js';
import { UsersRepository } from '../users/users.repository.js';
import { AssignmentRepository } from '../assignments/assignment.routes.js';
import { GoalsRepository } from '../goals/goals.routes.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { parseDateOnly } from '../../shared/utils/request-utils.js';

export class DailyPlanService {
  private db = getDatabasePool();
  private usersRepo = new UsersRepository();
  private assignRepo = new AssignmentRepository();
  private goalsRepo = new GoalsRepository();

  async resolveDailyPlan(userId: number, customDate?: string) {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const dateStr = customDate || getUserLocalDate(user.timezone || 'UTC');
    const weekday = getWeekdayNumber(dateStr);

    // 1. Resolve Active Assignments concurrently
    const [activeWorkoutAssign, activeDietAssign] = await Promise.all([
      this.assignRepo.getActiveWorkoutAssignment(userId, dateStr),
      this.assignRepo.getActiveDietAssignment(userId, dateStr),
    ]);

    // 2. Resolve Today's Workout Day & Exercises
    let todayWorkout: any = null;
    if (activeWorkoutAssign) {
      const daySql = `
        SELECT *, 
               weekday as weekday_number, 
               day_order as order_index 
        FROM workout_plan_days 
        WHERE workout_plan_version_id = ? AND weekday = ?
      `;
      todayWorkout = await this.db.queryOne(daySql, [activeWorkoutAssign.workout_plan_version_id, weekday]);
      if (todayWorkout) {
        const exercisesSql = `
          SELECT wpe.*, 
                 wpe.exercise_order as order_index,
                 wpe.target_reps_min as reps_min,
                 wpe.target_reps_max as reps_max,
                 e.name as exercise_name, 
                 e.tracking_type, 
                 e.instructions, 
                 e.video_url,
                 mg.name as muscle_group_name, 
                 eq.name as equipment_name
          FROM workout_plan_exercises wpe
          JOIN exercises e ON e.id = wpe.exercise_id
          LEFT JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id AND emg.is_primary = 1
          LEFT JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
          LEFT JOIN equipment_types eq ON eq.id = e.equipment_type_id
          WHERE wpe.workout_plan_day_id = ?
          ORDER BY wpe.exercise_order ASC
        `;
        const sessionSql = `
          SELECT *, workout_date as session_date FROM workout_sessions 
          WHERE user_id = ? AND workout_date = ?
          ORDER BY id DESC LIMIT 1
        `;
        const [exercises, activeSession] = await Promise.all([
          this.db.query(exercisesSql, [todayWorkout.id]),
          this.db.queryOne(sessionSql, [userId, dateStr]),
        ]);
        todayWorkout.exercises = exercises;
        todayWorkout.activeSession = activeSession;
      }
    }

    // 3. Resolve Today's Meals & Logged State using set-based batch queries for the active diet version
    let todayDiet: any = { meals: [] };
    if (activeDietAssign) {
      const versionId = activeDietAssign.diet_plan_version_id;
      const mealsSql = `
        SELECT *, 
               meal_order as order_index, 
               description as notes 
        FROM diet_meals 
        WHERE diet_plan_version_id = ? 
        ORDER BY meal_order ASC
      `;
      const groupsSql = `
        SELECT dmog.*, 
               dmog.group_order as order_index, 
               dmog.min_selection_count as min_selections, 
               dmog.max_selection_count as max_selections 
        FROM diet_meal_option_groups dmog
        JOIN diet_meals dm ON dm.id = dmog.diet_meal_id
        WHERE dm.diet_plan_version_id = ?
        ORDER BY dmog.group_order ASC, dmog.id ASC
      `;
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
               f.name as food_name, 
               mu.code as unit_code
        FROM diet_meal_options dmo
        JOIN diet_meal_option_groups dmog ON dmog.id = dmo.diet_meal_option_group_id
        JOIN diet_meals dm ON dm.id = dmog.diet_meal_id
        LEFT JOIN foods f ON f.id = dmo.food_id
        LEFT JOIN measurement_units mu ON mu.id = dmo.unit_id
        WHERE dm.diet_plan_version_id = ?
        ORDER BY dmo.option_order ASC, dmo.id ASC
      `;
      const logsSql = `
        SELECT ml.*, ml.meal_date as log_date 
        FROM meal_logs ml
        JOIN diet_meals dm ON dm.id = ml.diet_meal_id
        WHERE ml.user_id = ? AND ml.meal_date = ? AND dm.diet_plan_version_id = ?
      `;

      const [meals, groups, options, logs] = await Promise.all([
        this.db.query<any>(mealsSql, [versionId]),
        this.db.query<any>(groupsSql, [versionId]),
        this.db.query<any>(optionsSql, [versionId]),
        this.db.query<any>(logsSql, [userId, dateStr, versionId]),
      ]);

      if (meals.length > 0) {
        const optionsByGroupId = new Map<number, any[]>();
        for (const opt of options) {
          const gid = Number(opt.diet_meal_option_group_id);
          let list = optionsByGroupId.get(gid);
          if (!list) {
            list = [];
            optionsByGroupId.set(gid, list);
          }
          list.push(opt);
        }

        const groupsByMealId = new Map<number, any[]>();
        for (const grp of groups) {
          grp.options = optionsByGroupId.get(Number(grp.id)) || [];
          const mid = Number(grp.diet_meal_id);
          let list = groupsByMealId.get(mid);
          if (!list) {
            list = [];
            groupsByMealId.set(mid, list);
          }
          list.push(grp);
        }

        const logsByMealId = new Map<number, any>();
        const logIds = logs.map((l: any) => l.id);
        let allLogSelections: any[] = [];
        if (logIds.length > 0) {
          allLogSelections = await this.db.query(
            `SELECT * FROM meal_log_selections WHERE meal_log_id IN (${logIds.map(() => '?').join(',')}) ORDER BY id ASC`,
            logIds,
          );
        }

        const selectionsByLogId = new Map<number, any[]>();
        const customFoodsByLogId = new Map<number, any[]>();
        for (const sel of allLogSelections) {
          const lid = Number(sel.meal_log_id);
          if (sel.diet_meal_option_id != null) {
            if (!selectionsByLogId.has(lid)) selectionsByLogId.set(lid, []);
            selectionsByLogId.get(lid)!.push(sel);
          } else {
            if (!customFoodsByLogId.has(lid)) customFoodsByLogId.set(lid, []);
            customFoodsByLogId.get(lid)!.push({
              name: sel.option_label_snapshot,
              servingSize: sel.unit_code_snapshot,
              quantity: sel.quantity_snapshot,
              calories: sel.calories_snapshot,
              proteinG: sel.protein_g_snapshot,
              carbsG: sel.carbs_g_snapshot,
              fatG: sel.fat_g_snapshot,
            });
          }
        }

        for (const log of logs) {
          const lid = Number(log.id);
          log.selections = selectionsByLogId.get(lid) || [];
          log.customFoods = customFoodsByLogId.get(lid) || [];
          logsByMealId.set(Number(log.diet_meal_id), log);
        }

        for (const meal of meals) {
          meal.optionGroups = groupsByMealId.get(Number(meal.id)) || [];
          meal.log = logsByMealId.get(Number(meal.id)) || null;
        }

        todayDiet.meals = meals;
      }
    }

    // 4. Resolve Water, Cardio, and Weight concurrently
    const waterEntriesSql = `SELECT * FROM water_entries WHERE user_id = ? AND intake_date = ? ORDER BY id ASC`;
    const quickAddSql = `SELECT *, display_order as order_index FROM user_water_quick_add_options WHERE user_id = ? AND is_active = 1 ORDER BY display_order ASC, amount_ml ASC`;
    const cardioLogsSql = `
      SELECT cl.*, ca.name as activity_name 
      FROM cardio_logs cl
      JOIN cardio_activities ca ON ca.id = cl.cardio_activity_id
      WHERE cl.user_id = ? AND cl.cardio_date = ?
    `;
    const weightEntrySql = `SELECT * FROM body_weight_entries WHERE user_id = ? AND measurement_date = ?`;

    const [
      waterTarget,
      waterEntries,
      quickAdds,
      cardioTarget,
      cardioLogs,
      weightGoal,
      todayWeight,
    ] = await Promise.all([
      this.goalsRepo.getActiveWaterTarget(userId, dateStr),
      this.db.query(waterEntriesSql, [userId, dateStr]),
      this.db.query(quickAddSql, [userId]),
      this.goalsRepo.getActiveCardioTarget(userId, dateStr, weekday),
      this.db.query(cardioLogsSql, [userId, dateStr]),
      this.goalsRepo.getActiveWeightGoal(userId),
      this.db.queryOne(weightEntrySql, [userId, dateStr]),
    ]);

    const totalWaterMl = waterEntries.reduce((sum, e) => sum + (e.amount_ml || 0), 0);
    const rawWaterTarget = waterTarget?.target_ml ?? waterTarget?.daily_target_ml;
    const targetMl = rawWaterTarget != null ? Number(rawWaterTarget) : null;
    const totalCardioMinutes = cardioLogs.reduce((sum, c) => sum + (c.duration_minutes || 0), 0);

    // 7. Materialize Deterministic Daily Tasks
    await this.materializeTasks(userId, dateStr, {
      todayWorkout,
      meals: todayDiet.meals,
      waterTarget: targetMl,
      totalWaterMl,
      cardioTarget,
      totalCardioMinutes,
      todayWeight,
    });

    const tasksSql = `
      SELECT *, 
             title_snapshot as title, 
             description_snapshot as description,
             time(scheduled_at) as scheduled_time,
             1 as is_required
      FROM daily_tasks 
      WHERE user_id = ? AND task_date = ? 
      ORDER BY scheduled_at ASC, id ASC
    `;
    const tasks = await this.db.query(tasksSql, [userId, dateStr]);

    // 8. Calculate Overall Progress & Adherence
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTasks = tasks.length;

    // Compute weighted adherence using user adherence config
    const adherenceConfig = await this.goalsRepo.getAdherenceConfigForUser(userId, dateStr);
    const weights = {
      diet: Number(adherenceConfig.diet_weight_pct ?? 35),
      workout: Number(adherenceConfig.workout_weight_pct ?? 25),
      cardio: Number(adherenceConfig.cardio_weight_pct ?? 15),
      water: Number(adherenceConfig.water_weight_pct ?? 15),
      weight: Number(adherenceConfig.weight_logging_weight_pct ?? 10),
    };

    let totalActiveWeight = 0;
    let weightedSum = 0;

    // Diet component (if diet assigned for today)
    if (todayDiet && todayDiet.meals && todayDiet.meals.length > 0) {
      const completedMeals = todayDiet.meals.filter((m: any) => m.log && m.log.status === 'completed').length;
      const rate = completedMeals / todayDiet.meals.length;
      totalActiveWeight += weights.diet;
      weightedSum += rate * weights.diet;
    }

    // Workout component (if workout assigned for today and not a rest day)
    if (todayWorkout && !todayWorkout.is_rest_day) {
      const workoutCompleted = todayWorkout.activeSession?.status === 'completed';
      const rate = workoutCompleted ? 1 : 0;
      totalActiveWeight += weights.workout;
      weightedSum += rate * weights.workout;
    }

    // Cardio component (if cardio target configured for today)
    if (cardioTarget && cardioTarget.min_duration_minutes > 0) {
      const rate = Math.min(1, totalCardioMinutes / cardioTarget.min_duration_minutes);
      totalActiveWeight += weights.cardio;
      weightedSum += rate * weights.cardio;
    }

    // Water component (if water target configured)
    if (targetMl != null && targetMl > 0) {
      const rate = Math.min(1, totalWaterMl / targetMl);
      totalActiveWeight += weights.water;
      weightedSum += rate * weights.water;
    }

    // Weight component (if weight goal or today weight logged)
    if (weightGoal != null || todayWeight != null) {
      const rate = todayWeight ? 1 : 0;
      totalActiveWeight += weights.weight;
      weightedSum += rate * weights.weight;
    }

    const overallAdherencePct = totalActiveWeight > 0
      ? Math.round((weightedSum / totalActiveWeight) * 100)
      : (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);

    return {
      date: dateStr,
      weekday,
      timezone: user.timezone,
      weight: {
        current: todayWeight?.weight_kg || null,
        goal: weightGoal ? { start: weightGoal.start_weight_kg, target: weightGoal.target_weight_kg } : null,
        logged: !!todayWeight,
      },
      water: {
        totalMl: totalWaterMl,
        targetMl: targetMl != null ? targetMl : null,
        remainingMl: targetMl != null ? Math.max(0, targetMl - totalWaterMl) : null,
        completionPercent: targetMl != null && targetMl > 0 ? Math.min(100, Math.round((totalWaterMl / targetMl) * 100)) : null,
        entries: waterEntries,
        quickAdds,
      },
      diet: todayDiet,
      workout: todayWorkout,
      activeWorkoutAssignment: activeWorkoutAssign || null,
      activeDietAssignment: activeDietAssign || null,
      cardio: {
        target: cardioTarget,
        totalMinutes: totalCardioMinutes,
        logs: cardioLogs,
      },
      tasks: tasks.map(t => ({
        id: t.id,
        taskKey: t.task_key,
        taskType: t.task_type,
        title: t.title,
        status: t.status,
        isRequired: !!t.is_required,
        scheduledTime: t.scheduled_time,
        isCompleted: t.status === 'completed',
      })),
      summary: {
        completedTasks,
        totalTasks,
        overallAdherencePct,
      },
    };
  }

  private computeDueDateTime(taskDate: string, scheduledTime: string, graceMinutes: number = 60): string {
    const parts = scheduledTime.split(':');
    const h = Number(parts[0]) || 0;
    const m = Number(parts[1]) || 0;
    const s = Number(parts[2]) || 0;
    const totalMinutes = h * 60 + m + graceMinutes;
    if (totalMinutes >= 1440) {
      return `${taskDate} 23:59:59`;
    }
    const newH = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const newM = (totalMinutes % 60).toString().padStart(2, '0');
    const newS = s.toString().padStart(2, '0');
    return `${taskDate} ${newH}:${newM}:${newS}`;
  }

  private async materializeTasks(userId: number, dateStr: string, state: any) {
    interface TaskSpec {
      taskKey: string;
      taskType: string;
      title: string;
      scheduledTime: string;
      dueDateTime: string;
      isCompleted: boolean;
      sourceType?: string;
      sourceId?: number;
      customStatus?: string;
    }

    const specs: TaskSpec[] = [];

    // Weight task
    specs.push({
      taskKey: 'weight',
      taskType: 'weight',
      title: 'Log Morning Body Weight',
      scheduledTime: '08:00:00',
      dueDateTime: `${dateStr} 12:00:00`,
      isCompleted: !!state.todayWeight,
    });

    // Water task (only if target is configured)
    if (state.waterTarget != null && state.waterTarget > 0) {
      specs.push({
        taskKey: 'water',
        taskType: 'water',
        title: 'Hit Daily Water Goal',
        scheduledTime: '21:00:00',
        dueDateTime: `${dateStr} 23:59:59`,
        isCompleted: state.totalWaterMl >= state.waterTarget,
      });
    }

    // Meals tasks
    for (const meal of state.meals || []) {
      const scheduledTime = meal.scheduled_time || '12:00:00';
      const dueDateTime = this.computeDueDateTime(dateStr, scheduledTime, meal.default_grace_minutes || 60);
      specs.push({
        taskKey: `meal:${meal.id}`,
        taskType: 'meal',
        title: `Meal: ${meal.name}`,
        scheduledTime,
        dueDateTime,
        isCompleted: meal.log && meal.log.status === 'completed',
        sourceType: 'diet_meals',
        sourceId: meal.id,
      });
    }

    // Workout task (if not a rest day)
    if (state.todayWorkout && !state.todayWorkout.is_rest_day) {
      const workoutCompleted = state.todayWorkout.activeSession?.status === 'completed';
      const workoutInProgress = state.todayWorkout.activeSession?.status === 'in_progress';
      specs.push({
        taskKey: `workout:${state.todayWorkout.id}`,
        taskType: 'workout',
        title: `Workout: ${state.todayWorkout.name}`,
        scheduledTime: '17:00:00',
        dueDateTime: `${dateStr} 23:59:59`,
        isCompleted: workoutCompleted,
        sourceType: 'workout_plan_days',
        sourceId: state.todayWorkout.id,
        customStatus: workoutInProgress ? 'in_progress' : undefined,
      });
    }

    // Cardio task (if target configured for today)
    if (state.cardioTarget) {
      specs.push({
        taskKey: `cardio:${state.cardioTarget.id}`,
        taskType: 'cardio',
        title: `Cardio: ${state.cardioTarget.activity_name}`,
        scheduledTime: '18:00:00',
        dueDateTime: `${dateStr} 23:59:59`,
        isCompleted: state.totalCardioMinutes >= state.cardioTarget.min_duration_minutes,
        sourceType: 'user_cardio_targets',
        sourceId: state.cardioTarget.id,
      });
    }

    await this.db.withTransaction(async (conn) => {
      const existingRows = await conn.query<any>(
        'SELECT id, task_key, status, due_at FROM daily_tasks WHERE user_id = ? AND task_date = ?',
        [userId, dateStr]
      );
      const existingMap = new Map<string, any>();
      for (const row of existingRows) {
        existingMap.set(row.task_key, row);
      }

      for (const spec of specs) {
        const existing = existingMap.get(spec.taskKey);
        const status = spec.customStatus || (spec.isCompleted ? 'completed' : 'pending');
        const scheduledDateTime = spec.scheduledTime ? `${dateStr} ${spec.scheduledTime}` : null;

        if (!existing) {
          const sql = `
            INSERT INTO daily_tasks (
              user_id, task_date, task_key, task_type,
              diet_meal_id, workout_plan_day_id, user_cardio_target_id,
              title_snapshot, scheduled_at, due_at, status, completed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          await conn.execute(sql, [
            userId,
            dateStr,
            spec.taskKey,
            spec.taskType,
            spec.sourceType === 'diet_meals' ? spec.sourceId || null : null,
            spec.sourceType === 'workout_plan_days' ? spec.sourceId || null : null,
            spec.sourceType === 'user_cardio_targets' ? spec.sourceId || null : null,
            spec.title,
            scheduledDateTime,
            spec.dueDateTime,
            status,
            spec.isCompleted ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
          ]);
        } else {
          // Only perform write if status or due_at changed
          const statusChanged = existing.status !== status;
          const dueAtChanged = !existing.due_at && !!spec.dueDateTime;
          if (statusChanged || dueAtChanged) {
            const updateSql = `
              UPDATE daily_tasks 
              SET status = ?, completed_at = ?, due_at = COALESCE(due_at, ?)
              WHERE id = ?
            `;
            await conn.execute(updateSql, [
              status,
              spec.isCompleted ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
              spec.dueDateTime,
              existing.id,
            ]);
          }
        }
      }
    });
  }
}

export async function dailyPlanRoutes(fastify: FastifyInstance) {
  const service = new DailyPlanService();

  fastify.get('/me/today', { preHandler: [authenticate] }, async (req, res) => {
    const auth = (req as AuthenticatedRequest).user;
    const plan = await service.resolveDailyPlan(auth.userId);
    return res.status(200).send({ success: true, data: plan });
  });

  fastify.get('/me/daily-plan/today', { preHandler: [authenticate] }, async (req, res) => {
    const auth = (req as AuthenticatedRequest).user;
    const plan = await service.resolveDailyPlan(auth.userId);
    return res.status(200).send({ success: true, data: plan });
  });

  fastify.get('/me/days/:date', { preHandler: [authenticate] }, async (req, res) => {
    const auth = (req as AuthenticatedRequest).user;
    const params = req.params as { date: string };
    const dateStr = parseDateOnly(params.date, 'date');
    const plan = await service.resolveDailyPlan(auth.userId, dateStr);
    return res.status(200).send({ success: true, data: plan });
  });
}
