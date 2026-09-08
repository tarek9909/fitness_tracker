import { getDatabasePool } from '../../database/pool.js';
import { getUserLocalDate, getWeekdayNumber } from '../../shared/utils/date-utils.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { UsersRepository } from '../users/users.repository.js';
import { GoalsRepository } from '../goals/goals.routes.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { beginIdempotentRequest, completeIdempotentRequest, releaseIdempotentRequest, isDateOnly, normalizeDateInput, parseBoundedPositiveInt } from '../../shared/utils/request-utils.js';

const logCardioSchema = z.object({
  cardioActivityId: z.number(),
  cardioDate: z.preprocess(normalizeDateInput, z.string().refine(isDateOnly, 'Use YYYY-MM-DD')).optional(),
  durationMinutes: z.number().int().min(1),
  distanceKm: z.number().optional(),
  caloriesBurned: z.number().optional(),
  averageHeartRate: z.number().optional(),
  speedKmh: z.number().optional(),
  inclinePct: z.number().optional(),
  notes: z.string().optional(),
  clientOperationId: z.string().optional(),
});

async function ensureCardioActivitiesSeeded(db: any): Promise<void> {
  try {
    const countRes = (await db.queryOne('SELECT COUNT(*) as count FROM cardio_activities WHERE is_active = 1')) as { count: number } | null;
    if (!countRes || Number(countRes.count) === 0) {
      const activities: [number, string, number, number, number, number][] = [
        [1, 'Treadmill Incline Walking', 1, 1, 1, 1],
        [2, 'Stationary Cycling', 1, 0, 1, 1],
        [3, 'Rowing Machine', 1, 0, 1, 1],
        [4, 'Outdoor Running', 1, 0, 1, 1],
        [5, 'Stair Climber', 1, 0, 0, 1],
        [6, 'Walking', 1, 1, 1, 1],
      ];
      for (const a of activities) {
        const existing = await db.queryOne('SELECT id FROM cardio_activities WHERE id = ? OR name = ?', [a[0], a[1]]);
        if (!existing) {
          try {
            await db.execute(
              `INSERT INTO cardio_activities (id, name, supports_speed, supports_incline, supports_distance, is_active)
               VALUES (?, ?, ?, ?, ?, ?)`,
              a,
            );
          } catch {
            await db.execute(
              `INSERT INTO cardio_activities (name, supports_speed, supports_incline, supports_distance, is_active)
               VALUES (?, ?, ?, ?, ?)`,
              [a[1], a[2], a[3], a[4], a[5]],
            );
          }
        }
      }
    }
  } catch {
    // Ignore seeding failures
  }
}

export class CardioController {
  private db = getDatabasePool();
  private usersRepo = new UsersRepository();
  private goalsRepo = new GoalsRepository();

  async logCardio(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = logCardioSchema.parse(request.body);
    const { reservation, replay } = await beginIdempotentRequest(this.db, request, auth.userId, body);
    if (replay) {
      return reply.status(replay.statusCode).send(replay.body);
    }

    try {
    const user = await this.usersRepo.findById(auth.userId);

    const dateStr = body.cardioDate || getUserLocalDate(user?.timezone || 'UTC');

    let activity = await this.db.queryOne<{ name: string }>(
      'SELECT name FROM cardio_activities WHERE id = ?',
      [body.cardioActivityId],
    );
    if (!activity) {
      const countRes = await this.db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM cardio_activities');
      if (!countRes || Number(countRes.count) === 0) {
        await ensureCardioActivitiesSeeded(this.db);
        activity = await this.db.queryOne<{ name: string }>(
          'SELECT name FROM cardio_activities WHERE id = ?',
          [body.cardioActivityId],
        );
      }
    }
    if (!activity) throw new NotFoundError('Cardio activity not found');
    const activityName = activity.name;

    const responsePayload = await this.db.withTransaction(async (conn) => {
      let res: { insertId: number; affectedRows: number };
      try {
        // Tier 1: Insert both cardio_date and target_date, plus aliases for speed and incline
        res = await conn.execute(
          `INSERT INTO cardio_logs (
            user_id, cardio_activity_id, activity_name_snapshot, cardio_date, target_date, duration_minutes, distance_km, calories_burned,
            speed_kmh, average_speed_kmh, incline, incline_pct, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            auth.userId,
            body.cardioActivityId,
            activityName,
            dateStr,
            dateStr,
            body.durationMinutes,
            body.distanceKm || null,
            body.caloriesBurned || null,
            body.speedKmh || null,
            body.speedKmh || null,
            body.inclinePct || null,
            body.inclinePct || null,
            body.notes || null,
          ]
        );
      } catch {
        try {
          // Tier 2: Insert both date columns without extra speed/incline aliases
          res = await conn.execute(
            `INSERT INTO cardio_logs (
              user_id, cardio_activity_id, activity_name_snapshot, cardio_date, target_date, duration_minutes, distance_km, calories_burned,
              speed_kmh, incline, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              auth.userId,
              body.cardioActivityId,
              activityName,
              dateStr,
              dateStr,
              body.durationMinutes,
              body.distanceKm || null,
              body.caloriesBurned || null,
              body.speedKmh || null,
              body.inclinePct || null,
              body.notes || null,
            ]
          );
        } catch {
          try {
            // Tier 3: Minimal schema with cardio_date only
            res = await conn.execute(
              `INSERT INTO cardio_logs (
                user_id, cardio_activity_id, activity_name_snapshot, cardio_date, duration_minutes, distance_km, calories_burned,
                speed_kmh, incline, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                auth.userId,
                body.cardioActivityId,
                activityName,
                dateStr,
                body.durationMinutes,
                body.distanceKm || null,
                body.caloriesBurned || null,
                body.speedKmh || null,
                body.inclinePct || null,
                body.notes || null,
              ]
            );
          } catch {
            // Tier 4: MySQL dump schema with target_date, average_speed_kmh, incline_pct
            res = await conn.execute(
              `INSERT INTO cardio_logs (
                user_id, cardio_activity_id, activity_name_snapshot, target_date, duration_minutes, distance_km, calories_burned,
                average_speed_kmh, incline_pct, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                auth.userId,
                body.cardioActivityId,
                activityName,
                dateStr,
                body.durationMinutes,
                body.distanceKm || null,
                body.caloriesBurned || null,
                body.speedKmh || null,
                body.inclinePct || null,
                body.notes || null,
              ]
            );
          }
        }
      }

      // Check if task exists and mark completed if duration target reached
      let totalMinutes = 0;
      try {
        const totalMinutesRes = await conn.queryOne<{ total: number }>(
          'SELECT SUM(duration_minutes) as total FROM cardio_logs WHERE user_id = ? AND (cardio_date = ? OR target_date = ?)',
          [auth.userId, dateStr, dateStr]
        );
        totalMinutes = Number(totalMinutesRes?.total || 0);
      } catch {
        try {
          const totalMinutesRes = await conn.queryOne<{ total: number }>(
            'SELECT SUM(duration_minutes) as total FROM cardio_logs WHERE user_id = ? AND cardio_date = ?',
            [auth.userId, dateStr]
          );
          totalMinutes = Number(totalMinutesRes?.total || 0);
        } catch {
          const totalMinutesRes = await conn.queryOne<{ total: number }>(
            'SELECT SUM(duration_minutes) as total FROM cardio_logs WHERE user_id = ? AND target_date = ?',
            [auth.userId, dateStr]
          );
          totalMinutes = Number(totalMinutesRes?.total || 0);
        }
      }

      // Check cardio targets using user date's weekday
      const weekday = getWeekdayNumber(dateStr);
      const target = await this.goalsRepo.getActiveCardioTarget(auth.userId, dateStr, weekday, conn);
      if (target && totalMinutes >= (target.min_duration_minutes || target.target_minutes_min || 0)) {
        const taskKey = `cardio:${target.id}`;
        await conn.execute(
          `UPDATE daily_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND task_date = ? AND task_key = ?`,
          [auth.userId, dateStr, taskKey]
        );
      }

      const payload = {
        success: true,
        data: {
          id: res.insertId,
          durationMinutes: body.durationMinutes,
          cardioDate: dateStr,
        },
      };

      if (reservation) {
        await completeIdempotentRequest(conn, reservation, 201, payload);
      }

      return payload;
    });

    return reply.status(201).send(responsePayload);
  } catch (error) {
    await releaseIdempotentRequest(this.db, reservation);
    throw error;
  }
}

async getCardioHistory(request: FastifyRequest, reply: FastifyReply) {
  const auth = (request as AuthenticatedRequest).user;
  const query = (request.query || {}) as { limit?: string; page?: string };
  const limit = parseBoundedPositiveInt(query.limit, 'limit', 1, 100, 50);
  const page = parseBoundedPositiveInt(query.page, 'page', 1, 100000, 1);
  const offset = (page - 1) * limit;

  let logs: any[] = [];
  try {
    logs = await this.db.query(`
      SELECT cl.*, 
             ca.name as activity_name 
      FROM cardio_logs cl
      JOIN cardio_activities ca ON ca.id = cl.cardio_activity_id
      WHERE cl.user_id = ?
      ORDER BY cl.id DESC
      LIMIT ? OFFSET ?
    `, [auth.userId, limit, offset]);
  } catch {
    try {
      logs = await this.db.query(`
        SELECT cl.*
        FROM cardio_logs cl
        WHERE cl.user_id = ?
        ORDER BY cl.id DESC
        LIMIT ? OFFSET ?
      `, [auth.userId, limit, offset]);
    } catch {
      logs = [];
    }
  }

  const totalRow = await this.db.queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM cardio_logs WHERE user_id = ?',
    [auth.userId],
  );
  const total = Number(totalRow?.total || 0);

  const normalizedLogs = logs.map((l: any) => ({
    ...l,
    cardio_date: l.cardio_date || l.target_date,
    target_date: l.target_date || l.cardio_date,
    speed_kmh: l.speed_kmh != null ? l.speed_kmh : l.average_speed_kmh,
    average_speed_kmh: l.average_speed_kmh != null ? l.average_speed_kmh : l.speed_kmh,
    incline: l.incline != null ? l.incline : l.incline_pct,
    incline_pct: l.incline_pct != null ? l.incline_pct : l.incline,
  }));

  return reply.status(200).send({
    success: true,
    data: normalizedLogs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

  async getCardioActivities(request: FastifyRequest, reply: FastifyReply) {
    await ensureCardioActivitiesSeeded(this.db);
    let activities = await this.db.query('SELECT * FROM cardio_activities WHERE is_active = 1 ORDER BY id ASC');
    if (activities.length === 0) {
      activities = await this.db.query('SELECT * FROM cardio_activities ORDER BY id ASC');
    }
    return reply.status(200).send({
      success: true,
      data: activities,
    });
  }
}

export async function cardioRoutes(fastify: FastifyInstance) {
  const controller = new CardioController();

  fastify.get('/me/cardio/activities', { preHandler: [authenticate] }, (req, res) => controller.getCardioActivities(req, res));
  fastify.get('/admin/cardio/activities', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getCardioActivities(req, res));
  fastify.post('/me/cardio', { preHandler: [authenticate] }, (req, res) => controller.logCardio(req, res));
  fastify.get('/me/cardio/history', { preHandler: [authenticate] }, (req, res) => controller.getCardioHistory(req, res));
}
