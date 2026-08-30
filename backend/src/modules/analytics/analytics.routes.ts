import { getDatabasePool } from '../../database/pool.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';
import { parsePositiveInt, parseBoundedPositiveInt } from '../../shared/utils/request-utils.js';
import { getUserLocalDate } from '../../shared/utils/date-utils.js';

export class AnalyticsController {
  private db = getDatabasePool();

  async getAdminOverview(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { days?: string };
    const days = query.days ? Math.min(365, Math.max(1, parseInt(query.days, 10) || 30)) : 30;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [
      totalUsersRes,
      activeUsersRes,
      totalWorkoutsRes,
      totalPlansRes,
      waterAggRes,
      cardioAggRes,
      weightAggRes,
      mealAggRes,
    ] = await Promise.all([
      this.db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE role_id = 3'),
      this.db.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM users WHERE role_id = 3 AND status = 'active'`),
      this.db.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM workout_sessions WHERE status = 'completed'`),
      this.db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM workout_plans WHERE status = \'active\''),
      this.db.queryOne<{ total_ml: number }>(
        `SELECT COALESCE(SUM(amount_ml), 0) as total_ml FROM water_entries WHERE intake_date >= ?`,
        [cutoffDate]
      ),
      this.db.queryOne<{ total_minutes: number; total_distance: number; total_calories: number; count: number }>(
        `SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes,
                COALESCE(SUM(distance_km), 0) as total_distance,
                COALESCE(SUM(calories_burned), 0) as total_calories,
                COUNT(*) as count
         FROM cardio_logs WHERE cardio_date >= ?`,
        [cutoffDate]
      ),
      this.db.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM body_weight_entries WHERE measurement_date >= ?`,
        [cutoffDate]
      ),
      this.db.queryOne<{ total: number; completed: number }>(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
         FROM meal_logs WHERE meal_date >= ?`,
        [cutoffDate]
      ),
    ]);

    // Task adherence across window
    const taskRows = await this.db.query<{ status: string; task_type: string; count: number }>(
      `SELECT status, task_type, COUNT(*) as count
       FROM daily_tasks
       WHERE task_date >= ?
       GROUP BY status, task_type`,
      [cutoffDate]
    );

    let evaluatedTasks = 0;
    let completedTasks = 0;
    let missedTasks = 0;

    const breakdownByType: Record<string, { total: number; completed: number; ratePct: number }> = {
      workout: { total: 0, completed: 0, ratePct: 0 },
      diet: { total: 0, completed: 0, ratePct: 0 },
      cardio: { total: 0, completed: 0, ratePct: 0 },
      water: { total: 0, completed: 0, ratePct: 0 },
      weight: { total: 0, completed: 0, ratePct: 0 },
    };

    for (const row of taskRows) {
      const c = Number(row.count || 0);
      evaluatedTasks += c;
      if (row.status === 'completed') {
        completedTasks += c;
      } else if (row.status === 'missed' || row.status === 'skipped') {
        missedTasks += c;
      }

      const typeKey = row.task_type?.toLowerCase();
      if (typeKey && breakdownByType[typeKey]) {
        breakdownByType[typeKey].total += c;
        if (row.status === 'completed') {
          breakdownByType[typeKey].completed += c;
        }
      }
    }

    for (const key of Object.keys(breakdownByType)) {
      const item = breakdownByType[key];
      item.ratePct = item.total > 0 ? Math.round((item.completed / item.total) * 1000) / 10 : (null as any);
    }

    const platformAdherencePct = evaluatedTasks > 0
      ? Math.round((completedTasks / evaluatedTasks) * 1000) / 10
      : null;

    // Daily timeline trends
    const dailyTaskTrends = await this.db.query<{ task_date: string; total: number; completed: number }>(
      `SELECT task_date,
              COUNT(*) as total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM daily_tasks
       WHERE task_date >= ?
       GROUP BY task_date
       ORDER BY task_date ASC`,
      [cutoffDate]
    );

    const dailyWorkouts = await this.db.query<{ workout_date: string; count: number }>(
      `SELECT workout_date, COUNT(*) as count
       FROM workout_sessions
       WHERE workout_date >= ? AND status = 'completed'
       GROUP BY workout_date`,
      [cutoffDate]
    );
    const workoutsMap = new Map(dailyWorkouts.map(w => [w.workout_date, w.count]));

    const dailyWater = await this.db.query<{ intake_date: string; total_ml: number }>(
      `SELECT intake_date, SUM(amount_ml) as total_ml
       FROM water_entries
       WHERE intake_date >= ?
       GROUP BY intake_date`,
      [cutoffDate]
    );
    const waterMap = new Map(dailyWater.map(w => [w.intake_date, w.total_ml]));

    const dailyCardio = await this.db.query<{ cardio_date: string; total_mins: number }>(
      `SELECT cardio_date, SUM(duration_minutes) as total_mins
       FROM cardio_logs
       WHERE cardio_date >= ?
       GROUP BY cardio_date`,
      [cutoffDate]
    );
    const cardioMap = new Map(dailyCardio.map(c => [c.cardio_date, c.total_mins]));

    const dailyTrends = dailyTaskTrends.map(t => {
      const total = Number(t.total || 0);
      const completed = Number(t.completed || 0);
      return {
        date: t.task_date,
        totalTasks: total,
        completedTasks: completed,
        adherencePct: total > 0 ? Math.round((completed / total) * 100) : 100,
        workoutsCompleted: workoutsMap.get(t.task_date) || 0,
        waterMl: waterMap.get(t.task_date) || 0,
        cardioMinutes: cardioMap.get(t.task_date) || 0,
      };
    });

    // Recent activity feed
    const recentActivity = await this.db.query(`
      SELECT 'workout' as type, ws.id, ws.user_id, u.first_name, u.last_name, ws.workout_name_snapshot as title, ws.workout_date as session_date, ws.completed_at as timestamp
      FROM workout_sessions ws
      JOIN users u ON u.id = ws.user_id
      WHERE ws.status = 'completed'
      UNION ALL
      SELECT 'cardio' as type, cl.id, cl.user_id, u.first_name, u.last_name, cl.activity_name_snapshot as title, cl.cardio_date as session_date, cl.completed_at as timestamp
      FROM cardio_logs cl
      JOIN users u ON u.id = cl.user_id
      UNION ALL
      SELECT 'weight' as type, bwe.id, bwe.user_id, u.first_name, u.last_name, (CAST(bwe.weight_kg AS TEXT) || ' kg') as title, bwe.measurement_date as session_date, bwe.measured_at as timestamp
      FROM body_weight_entries bwe
      JOIN users u ON u.id = bwe.user_id
      ORDER BY timestamp DESC
      LIMIT 15
    `);

    return reply.status(200).send({
      success: true,
      data: {
        totalUsers: totalUsersRes?.count || 0,
        activeUsers: activeUsersRes?.count || 0,
        completedWorkouts: totalWorkoutsRes?.count || 0,
        activeWorkoutPlans: totalPlansRes?.count || 0,
        platformAdherencePct,
        adherenceWindowDays: days,
        evaluatedTasks,
        completedTasks,
        missedTasks,
        totalWaterLiters: Math.round(((waterAggRes?.total_ml || 0) / 1000) * 10) / 10,
        totalCardioMinutes: cardioAggRes?.total_minutes || 0,
        totalCardioDistanceKm: Math.round((cardioAggRes?.total_distance || 0) * 10) / 10,
        totalCardioSessions: cardioAggRes?.count || 0,
        totalWeightEntries: weightAggRes?.count || 0,
        totalMealLogs: mealAggRes?.total || 0,
        mealCompliancePct: (mealAggRes?.total || 0) > 0 ? Math.round(((mealAggRes?.completed || 0) / (mealAggRes?.total || 1)) * 100) : null,
        adherenceBreakdown: breakdownByType,
        dailyTrends,
        recentActivity,
      },
    });
  }

  async getUsersAnalyticsSummary(request: FastifyRequest, reply: FastifyReply) {
    const query = (request.query || {}) as { page?: string; limit?: string };
    const page = parseBoundedPositiveInt(query.page, 'page', 1, 100000, 1);
    const limit = parseBoundedPositiveInt(query.limit, 'limit', 1, 100, 50);
    const offset = (page - 1) * limit;
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [users, totalRow] = await Promise.all([
      this.db.query<any>(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.status, u.timezone, u.created_at
         FROM users u
         WHERE u.role_id = 3
         ORDER BY u.id ASC
         LIMIT ? OFFSET ?`,
        [limit, offset],
      ),
      this.db.queryOne<{ total: number }>(
        'SELECT COUNT(*) as total FROM users WHERE role_id = 3',
      ),
    ]);
    const total = Number(totalRow?.total || 0);

    if (users.length === 0) {
      return reply.status(200).send({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    const userIds = users.map((user: any) => Number(user.id));
    const userPlaceholders = userIds.map(() => '?').join(',');

    const [workoutsRows, weightRows, taskRows, lastActiveRows] = await Promise.all([
      this.db.query<{ user_id: number; count: number }>(
        `SELECT user_id, COUNT(*) as count
         FROM workout_sessions
         WHERE status = 'completed' AND user_id IN (${userPlaceholders})
         GROUP BY user_id`,
        userIds,
      ),
      this.db.query<{ user_id: number; weight_kg: number }>(
        `SELECT bwe.user_id, bwe.weight_kg
         FROM body_weight_entries bwe
         WHERE bwe.user_id IN (${userPlaceholders})
           AND NOT EXISTS (
             SELECT 1
             FROM body_weight_entries newer
             WHERE newer.user_id = bwe.user_id
               AND (newer.measurement_date > bwe.measurement_date
                 OR (newer.measurement_date = bwe.measurement_date AND newer.id > bwe.id))
           )`,
        userIds,
      ),
      this.db.query<{ user_id: number; status: string; count: number }>(
        `SELECT user_id, status, COUNT(*) as count
         FROM daily_tasks
         WHERE task_date >= ? AND user_id IN (${userPlaceholders})
         GROUP BY user_id, status`,
        [cutoffDate, ...userIds],
      ),
      this.db.query<{ user_id: number; last_date: string }>(
        `SELECT user_id, MAX(dt) as last_date FROM (
           SELECT user_id, MAX(task_date) as dt FROM daily_tasks WHERE status = 'completed' AND user_id IN (${userPlaceholders}) GROUP BY user_id
           UNION ALL
           SELECT user_id, MAX(workout_date) as dt FROM workout_sessions WHERE status = 'completed' AND user_id IN (${userPlaceholders}) GROUP BY user_id
           UNION ALL
           SELECT user_id, MAX(intake_date) as dt FROM water_entries WHERE user_id IN (${userPlaceholders}) GROUP BY user_id
           UNION ALL
           SELECT user_id, MAX(cardio_date) as dt FROM cardio_logs WHERE user_id IN (${userPlaceholders}) GROUP BY user_id
           UNION ALL
           SELECT user_id, MAX(measurement_date) as dt FROM body_weight_entries WHERE user_id IN (${userPlaceholders}) GROUP BY user_id
         ) sub
         GROUP BY user_id`,
        [...userIds, ...userIds, ...userIds, ...userIds, ...userIds],
      ),
    ]);

    const completedWorkoutsMap = new Map<number, number>();
    for (const row of workoutsRows) {
      completedWorkoutsMap.set(Number(row.user_id), Number(row.count || 0));
    }

    const latestWeightMap = new Map<number, number>();
    for (const row of weightRows) {
      if (row.weight_kg !== null && row.weight_kg !== undefined) {
        latestWeightMap.set(Number(row.user_id), Number(row.weight_kg));
      }
    }

    const taskAdherenceMap = new Map<number, { total: number; completed: number }>();
    for (const row of taskRows) {
      const uid = Number(row.user_id);
      const current = taskAdherenceMap.get(uid) || { total: 0, completed: 0 };
      const count = Number(row.count || 0);
      current.total += count;
      if (row.status === 'completed') {
        current.completed += count;
      }
      taskAdherenceMap.set(uid, current);
    }

    const lastActiveMap = new Map<number, string>();
    for (const row of lastActiveRows) {
      if (row.last_date) {
        lastActiveMap.set(Number(row.user_id), String(row.last_date));
      }
    }

    const userSummaries = users.map((u: any) => {
      const uid = Number(u.id);
      const tasks = taskAdherenceMap.get(uid);
      const adherencePct = tasks && tasks.total > 0
        ? Math.round((tasks.completed / tasks.total) * 100)
        : null;

      return {
        id: u.id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        status: u.status,
        timezone: u.timezone,
        created_at: u.created_at,
        completedWorkouts: completedWorkoutsMap.get(uid) || 0,
        latestWeightKg: latestWeightMap.get(uid) ?? null,
        adherencePct,
        lastActiveDate: lastActiveMap.get(uid) || null,
      };
    });

    return reply.status(200).send({
      success: true,
      data: userSummaries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  async getUserAnalyticsDetail(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const query = request.query as { days?: string };
    const days = query.days ? Math.min(365, Math.max(1, parseInt(query.days, 10) || 30)) : 30;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const user = await this.db.queryOne<any>(
      `SELECT id, email, first_name, last_name, status, timezone, height_cm, gender, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'User not found' },
      });
    }

    const today = getUserLocalDate(user.timezone || 'UTC');

    const [
      weightGoal,
      weightsHistory,
      tasks,
      workouts,
      workoutSetRows,
      waterEntries,
      waterTarget,
      meals,
      cardioLogs,
      exerciseProgressionRows,
    ] = await Promise.all([
      this.db.queryOne<any>(
        `SELECT * FROM user_weight_goals WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
        [userId]
      ),
      this.db.query<any>(
        `SELECT weight_kg, measurement_date, source, notes
         FROM body_weight_entries
         WHERE user_id = ? AND measurement_date >= ?
         ORDER BY measurement_date ASC`,
        [userId, cutoffDate]
      ),
      this.db.query<any>(
        `SELECT id, task_date, task_type, title_snapshot, status, completed_at
         FROM daily_tasks
         WHERE user_id = ? AND task_date >= ?
         ORDER BY task_date DESC, id DESC`,
        [userId, cutoffDate]
      ),
      this.db.query<any>(
        `SELECT ws.id, ws.workout_date, ws.workout_name_snapshot, ws.status, ws.completed_at,
                COUNT(wse.id) as total_exercises
         FROM workout_sessions ws
         LEFT JOIN workout_session_exercises wse ON wse.workout_session_id = ws.id
         WHERE ws.user_id = ? AND ws.workout_date >= ?
         GROUP BY ws.id
         ORDER BY ws.workout_date DESC`,
        [userId, cutoffDate]
      ),
      this.db.query<any>(
        `SELECT wse.workout_session_id as workout_id, wsets.weight_kg, wsets.reps
         FROM workout_sets wsets
         JOIN workout_session_exercises wse ON wse.id = wsets.workout_session_exercise_id
         JOIN workout_sessions ws ON ws.id = wse.workout_session_id
         WHERE ws.user_id = ? AND ws.workout_date >= ? AND wsets.completed = 1
         ORDER BY ws.workout_date DESC, wse.exercise_order ASC, wsets.set_number ASC`,
        [userId, cutoffDate]
      ),
      this.db.query<any>(
        `SELECT intake_date, SUM(amount_ml) as total_ml
         FROM water_entries
         WHERE user_id = ? AND intake_date >= ?
         GROUP BY intake_date
         ORDER BY intake_date ASC`,
        [userId, cutoffDate]
      ),
      this.db.queryOne<any>(
        `SELECT target_ml FROM user_water_targets 
         WHERE user_id = ? AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until >= ?) 
         ORDER BY effective_from DESC, id DESC LIMIT 1`,
        [userId, today, today]
      ),
      this.db.query<any>(
        `SELECT id, meal_date, meal_name_snapshot, status, actual_calories, actual_protein_g, actual_carbs_g, actual_fat_g
         FROM meal_logs
         WHERE user_id = ? AND meal_date >= ?
         ORDER BY meal_date DESC`,
        [userId, cutoffDate]
      ),
      this.db.query<any>(
        `SELECT cl.id, cl.cardio_date, cl.activity_name_snapshot, cl.duration_minutes, cl.distance_km, cl.calories_burned, cl.speed_kmh, cl.incline
         FROM cardio_logs cl
         WHERE cl.user_id = ? AND cl.cardio_date >= ?
         ORDER BY cl.cardio_date DESC`,
        [userId, cutoffDate]
      ),
      this.db.query<any>(
        `SELECT e.id as exercise_id, e.name as exercise_name, mg.name as muscle_group,
                MAX(wsets.weight_kg) as max_weight_kg,
                MAX(wsets.weight_kg * (1 + wsets.reps / 30.0)) as estimated_one_rep_max,
                COUNT(wsets.id) as total_sets_completed,
                SUM(wsets.reps) as total_reps,
                COUNT(DISTINCT ws.id) as session_count
         FROM workout_sets wsets
         JOIN workout_session_exercises wse ON wse.id = wsets.workout_session_exercise_id
         JOIN workout_sessions ws ON ws.id = wse.workout_session_id
         JOIN exercises e ON e.id = wse.exercise_id
         LEFT JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id AND emg.is_primary = 1
         LEFT JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
         WHERE ws.user_id = ? AND wsets.completed = 1 AND wsets.weight_kg IS NOT NULL
         GROUP BY e.id, e.name, mg.name
         ORDER BY session_count DESC, max_weight_kg DESC
         LIMIT 20`,
        [userId]
      ),
    ]);

    // Process Task Adherence
    let completedTasks = 0;
    let missedTasks = 0;
    const byType: Record<string, { total: number; completed: number; ratePct: number | null }> = {
      workout: { total: 0, completed: 0, ratePct: null },
      diet: { total: 0, completed: 0, ratePct: null },
      cardio: { total: 0, completed: 0, ratePct: null },
      water: { total: 0, completed: 0, ratePct: null },
      weight: { total: 0, completed: 0, ratePct: null },
    };

    for (const t of tasks) {
      if (t.status === 'completed') completedTasks++;
      if (t.status === 'missed' || t.status === 'skipped') missedTasks++;

      const typeKey = t.task_type?.toLowerCase();
      if (typeKey && byType[typeKey]) {
        byType[typeKey].total++;
        if (t.status === 'completed') byType[typeKey].completed++;
      }
    }

    const adherenceConfig = await this.db.queryOne<{
      diet_weight_pct: number;
      workout_weight_pct: number;
      cardio_weight_pct: number;
      water_weight_pct: number;
      weight_logging_weight_pct: number;
    }>(
      `SELECT diet_weight_pct, workout_weight_pct, cardio_weight_pct, water_weight_pct, weight_logging_weight_pct 
       FROM user_adherence_configs 
       WHERE user_id = ? AND is_active = 1 AND effective_from <= ? AND (effective_until IS NULL OR effective_until >= ?) 
       ORDER BY effective_from DESC, id DESC LIMIT 1`,
      [userId, today, today]
    );

    const weights = {
      diet: Number(adherenceConfig?.diet_weight_pct ?? 35),
      workout: Number(adherenceConfig?.workout_weight_pct ?? 25),
      cardio: Number(adherenceConfig?.cardio_weight_pct ?? 15),
      water: Number(adherenceConfig?.water_weight_pct ?? 15),
      weight: Number(adherenceConfig?.weight_logging_weight_pct ?? 10),
    };

    let totalActiveWeight = 0;
    let weightedSum = 0;

    for (const k of Object.keys(byType) as Array<keyof typeof weights>) {
      const itm = byType[k];
      if (itm.total > 0) {
        const rate = itm.completed / itm.total;
        itm.ratePct = Math.round(rate * 100);
        const w = weights[k] || 0;
        totalActiveWeight += w;
        weightedSum += rate * w;
      } else {
        itm.ratePct = null;
      }
    }

    const overallAdherencePct = tasks.length > 0 && totalActiveWeight > 0
      ? Math.round((weightedSum / totalActiveWeight) * 100)
      : (tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : null);

    // Process Weight Progression
    const startWeight = (weightGoal?.starting_weight_kg !== undefined && weightGoal?.starting_weight_kg !== null)
      ? Number(weightGoal.starting_weight_kg)
      : weightsHistory[0]?.weight_kg || null;
    const currentWeight = weightsHistory.length > 0 ? weightsHistory[weightsHistory.length - 1].weight_kg : startWeight;
    const targetWeight = weightGoal?.target_weight_kg || null;

    let weightProgressPct = 0;
    if (startWeight && currentWeight && targetWeight && startWeight !== targetWeight) {
      weightProgressPct = Math.min(100, Math.max(0, Math.round(((startWeight - currentWeight) / (startWeight - targetWeight)) * 100)));
    }

    // Process Workouts
    let totalVolumeKg = 0;
    let totalSets = 0;
    const setsByWorkoutId = new Map<number, Array<{ weight_kg: number | null; reps: number | null }>>();
    for (const set of workoutSetRows) {
      const workoutId = Number(set.workout_id);
      const existing = setsByWorkoutId.get(workoutId) || [];
      existing.push(set);
      setsByWorkoutId.set(workoutId, existing);
    }

    const workoutDetails = workouts.map((w) => {
      const sets = setsByWorkoutId.get(Number(w.id)) || [];
      let sessionVol = 0;
      for (const s of sets) {
        if (s.weight_kg != null && s.reps != null) {
          sessionVol += Number(s.weight_kg) * Number(s.reps);
          totalVolumeKg += Number(s.weight_kg) * Number(s.reps);
        }
        totalSets++;
      }
      return {
        ...w,
        completedSets: sets.length,
        totalVolumeKg: Math.round(sessionVol),
      };
    });

    // Process Cardio Aggregates
    let totalCardioMinutes = 0;
    let totalCardioDistance = 0;
    let totalCardioCalories = 0;
    const activityMap = new Map<string, { count: number; minutes: number; distance: number; calories: number }>();

    for (const c of cardioLogs) {
      totalCardioMinutes += Number(c.duration_minutes || 0);
      totalCardioDistance += Number(c.distance_km || 0);
      totalCardioCalories += Number(c.calories_burned || 0);

      const actName = c.activity_name_snapshot || 'Cardio';
      const existing = activityMap.get(actName) || { count: 0, minutes: 0, distance: 0, calories: 0 };
      existing.count += 1;
      existing.minutes += Number(c.duration_minutes || 0);
      existing.distance += Number(c.distance_km || 0);
      existing.calories += Number(c.calories_burned || 0);
      activityMap.set(actName, existing);
    }

    const cardioActivitiesBreakdown = Array.from(activityMap.entries()).map(([activityName, stat]) => ({
      activityName,
      sessionCount: stat.count,
      totalMinutes: stat.minutes,
      totalDistanceKm: Math.round(stat.distance * 10) / 10,
      totalCalories: Math.round(stat.calories),
    }));

    // Process Water Aggregates
    const dailyWaterTarget = waterTarget?.target_ml != null ? Number(waterTarget.target_ml) : null;
    const totalWaterMl = waterEntries.reduce((sum, w) => sum + Number(w.total_ml || 0), 0);
    const dailyAverageWaterMl = waterEntries.length > 0 ? Math.round(totalWaterMl / waterEntries.length) : 0;

    return reply.status(200).send({
      success: true,
      data: {
        user,
        adherence: {
          overallPct: overallAdherencePct,
          totalTasks: tasks.length,
          completedTasks,
          missedTasks,
          byType,
          timeline: tasks.slice(0, 30),
        },
        weight: {
          startWeightKg: startWeight,
          currentWeightKg: currentWeight,
          targetWeightKg: targetWeight,
          weightLostKg: startWeight && currentWeight ? Math.round((startWeight - currentWeight) * 10) / 10 : 0,
          progressPct: weightProgressPct,
          history: weightsHistory,
        },
        workouts: {
          completedSessions: workouts.filter(w => w.status === 'completed').length,
          totalSessions: workouts.length,
          totalVolumeKg: Math.round(totalVolumeKg),
          totalSets,
          recentSessions: workoutDetails,
        },
        exerciseProgression: exerciseProgressionRows.map(ep => ({
          ...ep,
          max_weight_kg: Number(ep.max_weight_kg || 0),
          estimated_one_rep_max: ep.estimated_one_rep_max ? Math.round(Number(ep.estimated_one_rep_max) * 10) / 10 : null,
          total_sets_completed: Number(ep.total_sets_completed || 0),
          total_reps: Number(ep.total_reps || 0),
          session_count: Number(ep.session_count || 0),
        })),
        nutrition: {
          totalMealsLogged: meals.length,
          completedMealsCount: meals.filter(m => m.status === 'completed').length,
          compliancePct: meals.length > 0 ? Math.round((meals.filter(m => m.status === 'completed').length / meals.length) * 100) : null,
          recentMealLogs: meals,
        },
        water: {
          totalWaterMl,
          dailyAverageMl: dailyAverageWaterMl,
          targetMl: dailyWaterTarget,
          dailyHistory: waterEntries.map(we => ({
            date: we.intake_date,
            totalMl: Number(we.total_ml),
            targetMet: dailyWaterTarget != null ? Number(we.total_ml) >= dailyWaterTarget : null,
          })),
        },
        cardio: {
          totalMinutes: totalCardioMinutes,
          totalCalories: Math.round(totalCardioCalories),
          totalDistanceKm: Math.round(totalCardioDistance * 10) / 10,
          sessionCount: cardioLogs.length,
          activitiesBreakdown: cardioActivitiesBreakdown,
          recentLogs: cardioLogs,
        },
      },
    });
  }

  async getAuditLogs(request: FastifyRequest, reply: FastifyReply) {
    const logs = await this.db.query(`
      SELECT al.*, u.email as actor_email 
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.actor_user_id
      ORDER BY al.created_at DESC
      LIMIT 100
    `);
    return reply.status(200).send({
      success: true,
      data: logs,
    });
  }

  async getAuditLogDetail(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const logId = parsePositiveInt(params.id, 'logId');
    const log = await this.db.queryOne(
      `SELECT al.*, u.email as actor_email, u.first_name as actor_first_name, u.last_name as actor_last_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       WHERE al.id = ?`,
      [logId]
    );
    if (!log) {
      return reply.status(404).send({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Audit log entry not found' },
      });
    }

    let parsedMetadata = log.metadata;
    if (typeof log.metadata === 'string') {
      try {
        parsedMetadata = JSON.parse(log.metadata);
      } catch {
        parsedMetadata = log.metadata;
      }
    }

    return reply.status(200).send({
      success: true,
      data: {
        ...log,
        parsedMetadata,
      },
    });
  }
}

export async function analyticsRoutes(fastify: FastifyInstance) {
  const controller = new AnalyticsController();

  fastify.get('/admin/analytics/overview', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getAdminOverview(req, res));
  fastify.get('/admin/analytics/users', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getUsersAnalyticsSummary(req, res));
  fastify.get('/admin/analytics/users/:userId', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getUserAnalyticsDetail(req, res));
  fastify.get('/admin/audit-logs', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getAuditLogs(req, res));
  fastify.get('/admin/audit-logs/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getAuditLogDetail(req, res));
}
