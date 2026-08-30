import { getDatabasePool } from '../../database/pool.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { GoalsRepository } from '../goals/goals.routes.js';
import { UsersRepository } from '../users/users.repository.js';
import { getUserLocalDate } from '../../shared/utils/date-utils.js';

export class ProgressController {
  private db = getDatabasePool();
  private goalsRepo = new GoalsRepository();
  private usersRepo = new UsersRepository();

  async getOverallProgress(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const userId = auth.userId;

    // Weight progress
    const goal = await this.goalsRepo.getActiveWeightGoal(userId);
    const weights = await this.db.query(
      'SELECT weight_kg, measurement_date FROM body_weight_entries WHERE user_id = ? ORDER BY measurement_date ASC',
      [userId]
    );

    const startWeight = (goal?.starting_weight_kg !== undefined && goal?.starting_weight_kg !== null) 
      ? Number(goal.starting_weight_kg)
      : (goal?.start_weight_kg !== undefined && goal?.start_weight_kg !== null)
        ? Number(goal.start_weight_kg)
        : weights[0]?.weight_kg || null;
    const currentWeight = weights[weights.length - 1]?.weight_kg || startWeight;
    const targetWeight = goal?.target_weight_kg || null;

    let weightProgressPct = 0;
    if (startWeight && currentWeight && targetWeight && startWeight !== targetWeight) {
      weightProgressPct = Math.min(100, Math.max(0, Math.round(((startWeight - currentWeight) / (startWeight - targetWeight)) * 100)));
    }

    // Workouts completed
    const sessionsRes = await this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM workout_sessions WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );
    const completedWorkouts = sessionsRes?.count || 0;

    // Total cardio minutes
    const cardioRes = await this.db.queryOne<{ total: number }>(
      'SELECT SUM(duration_minutes) as total FROM cardio_logs WHERE user_id = ?',
      [userId]
    );
    const totalCardioMinutes = cardioRes?.total || 0;

    // Tasks adherence in last 30 days
    const tasksRes = await this.db.query<{ status: string; task_type: string; count: number }>(
      `SELECT status, task_type, COUNT(*) as count FROM daily_tasks WHERE user_id = ? GROUP BY status, task_type`,
      [userId]
    );

    const user = await this.usersRepo.findById(userId);
    const today = getUserLocalDate(user?.timezone || 'UTC');
    const adherenceConfig = await this.goalsRepo.getAdherenceConfigForUser(userId, today);
    const adherenceWeights = {
      diet: Number(adherenceConfig.diet_weight_pct ?? 35),
      workout: Number(adherenceConfig.workout_weight_pct ?? 25),
      cardio: Number(adherenceConfig.cardio_weight_pct ?? 15),
      water: Number(adherenceConfig.water_weight_pct ?? 15),
      weight: Number(adherenceConfig.weight_logging_weight_pct ?? 10),
    };

    const byType: Record<string, { total: number; completed: number }> = {
      workout: { total: 0, completed: 0 },
      diet: { total: 0, completed: 0 },
      cardio: { total: 0, completed: 0 },
      water: { total: 0, completed: 0 },
      weight: { total: 0, completed: 0 },
    };

    let completedTasks = 0;
    let totalTasks = 0;
    for (const t of tasksRes) {
      const c = Number(t.count || 0);
      totalTasks += c;
      if (t.status === 'completed') completedTasks += c;
      const typeKey = t.task_type?.toLowerCase();
      if (typeKey && byType[typeKey]) {
        byType[typeKey].total += c;
        if (t.status === 'completed') byType[typeKey].completed += c;
      }
    }

    let totalActiveWeight = 0;
    let weightedSum = 0;
    for (const k of Object.keys(byType) as Array<keyof typeof adherenceWeights>) {
      const itm = byType[k];
      if (itm.total > 0) {
        const rate = itm.completed / itm.total;
        const w = adherenceWeights[k] || 0;
        totalActiveWeight += w;
        weightedSum += rate * w;
      }
    }

    const overallAdherencePct = totalTasks > 0 && totalActiveWeight > 0
      ? Math.round((weightedSum / totalActiveWeight) * 100)
      : (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : null);

    return reply.status(200).send({
      success: true,
      data: {
        weight: {
          startWeightKg: startWeight,
          currentWeightKg: currentWeight,
          targetWeightKg: targetWeight,
          weightLostKg: startWeight && currentWeight ? Math.round((startWeight - currentWeight) * 10) / 10 : 0,
          progressPct: weightProgressPct,
        },
        workouts: {
          completedSessions: completedWorkouts,
        },
        cardio: {
          totalMinutes: totalCardioMinutes,
        },
        adherence: {
          overallPct: overallAdherencePct,
          completedTasks,
          totalTasks,
        },
      },
    });
  }

  async getWorkoutProgress(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const userId = auth.userId;

    // Get max weight and volume per exercise
    const sql = `
      SELECT e.id as exercise_id, e.name as exercise_name,
             MAX(wsets.weight_kg) as max_weight_kg,
             MAX(wsets.weight_kg * (1 + wsets.reps / 30.0)) as estimated_one_rep_max,
             COUNT(DISTINCT ws.id) as sessions_performed
      FROM workout_sets wsets
      JOIN workout_session_exercises wse ON wse.id = wsets.workout_session_exercise_id
      JOIN workout_sessions ws ON ws.id = wse.workout_session_id
      JOIN exercises e ON e.id = wse.exercise_id
      WHERE ws.user_id = ? AND wsets.completed = 1 AND wsets.weight_kg IS NOT NULL
      GROUP BY e.id, e.name
      ORDER BY sessions_performed DESC
    `;

    const exerciseProgress = await this.db.query(sql, [userId]);
    return reply.status(200).send({
      success: true,
      data: exerciseProgress,
    });
  }
}

export async function progressRoutes(fastify: FastifyInstance) {
  const controller = new ProgressController();

  fastify.get('/me/progress', { preHandler: [authenticate] }, (req, res) => controller.getOverallProgress(req, res));
  fastify.get('/me/progress/workouts', { preHandler: [authenticate] }, (req, res) => controller.getWorkoutProgress(req, res));
}
