import { getDatabasePool } from '../../database/pool.js';
import { getUserLocalDate } from '../../shared/utils/date-utils.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { UsersRepository } from '../users/users.repository.js';
import { GoalsRepository } from '../goals/goals.routes.js';
import { beginIdempotentRequest, completeIdempotentRequest, releaseIdempotentRequest, isDateOnly, parseBoundedPositiveInt } from '../../shared/utils/request-utils.js';
import { DbConnection } from '../../database/types.js';

const logWeightSchema = z.object({
  weightKg: z.number().min(20).max(500),
  date: z.string().refine(isDateOnly, 'Use YYYY-MM-DD').optional(),
  notes: z.string().optional(),
  clientOperationId: z.string().optional(),
});

export class WeightController {
  private db = getDatabasePool();
  private usersRepo = new UsersRepository();
  private goalsRepo = new GoalsRepository();

  async logWeight(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = logWeightSchema.parse(request.body);

    const { reservation, replay } = await beginIdempotentRequest(this.db, request, auth.userId, body);
    if (replay) {
      return reply.status(replay.statusCode).send(replay.body);
    }

    try {
      const user = await this.usersRepo.findById(auth.userId);
      const dateStr = body.date || getUserLocalDate(user?.timezone || 'UTC');

      const responsePayload = await this.db.withTransaction(async (conn) => {
        const existing = await conn.queryOne<any>(
          'SELECT id FROM body_weight_entries WHERE user_id = ? AND measurement_date = ?',
          [auth.userId, dateStr]
        );

        if (existing) {
          await conn.execute(
            'UPDATE body_weight_entries SET weight_kg = ?, notes = ? WHERE id = ?',
            [body.weightKg, body.notes || null, existing.id]
          );
        } else {
          await conn.execute(
            'INSERT INTO body_weight_entries (user_id, measurement_date, weight_kg, notes) VALUES (?, ?, ?, ?)',
            [auth.userId, dateStr, body.weightKg, body.notes || null]
          );
        }

        // Mark task completed
        await conn.execute(
          `UPDATE daily_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND task_date = ? AND task_key = 'weight'`,
          [auth.userId, dateStr]
        );

        const history = await this.getWeightHistoryData(auth.userId, conn);
        const payload = {
          success: true,
          data: {
            weightKg: body.weightKg,
            date: dateStr,
            ...history,
          },
        };

        if (reservation) {
          await completeIdempotentRequest(conn, reservation, 200, payload);
        }

        return payload;
      });

      return reply.status(200).send(responsePayload);
    } catch (err) {
      if (reservation) {
        await releaseIdempotentRequest(this.db, reservation);
      }
      throw err;
    }
  }

  async getWeight(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const query = (request.query || {}) as { limit?: string; page?: string };
    const limit = parseBoundedPositiveInt(query.limit, 'limit', 1, 100, 30);
    const page = parseBoundedPositiveInt(query.page, 'page', 1, 100000, 1);
    const offset = (page - 1) * limit;
    const [history, totalRow] = await Promise.all([
      this.getWeightHistoryData(auth.userId, this.db, limit, offset),
      this.db.queryOne<{ total: number }>(
        'SELECT COUNT(*) as total FROM body_weight_entries WHERE user_id = ?',
        [auth.userId],
      ),
    ]);
    const total = Number(totalRow?.total || 0);
    return reply.status(200).send({
      success: true,
      data: history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  private async getWeightHistoryData(
    userId: number,
    client: DbConnection = this.db,
    limit = 30,
    offset = 0,
  ) {
    const [entries, recentEntries] = await Promise.all([
      client.query(
        'SELECT * FROM body_weight_entries WHERE user_id = ? ORDER BY measurement_date DESC LIMIT ? OFFSET ?',
        [userId, limit, offset],
      ),
      client.query(
        'SELECT weight_kg, measurement_date FROM body_weight_entries WHERE user_id = ? ORDER BY measurement_date DESC LIMIT 7',
        [userId],
      ),
    ]);

    const goal = await this.goalsRepo.getActiveWeightGoal(userId, client);
    const latest = recentEntries[0]?.weight_kg != null ? Number(recentEntries[0].weight_kg) : null;

    let progressPct = 0;
    let weightLostKg = 0;
    let remainingKg = 0;

    if (goal && latest) {
      const startWeight = Number(goal.starting_weight_kg ?? goal.start_weight_kg ?? latest);
      const targetWeight = Number(goal.target_weight_kg ?? latest);
      const totalDelta = startWeight - targetWeight;
      const currentDelta = startWeight - latest;
      weightLostKg = Math.round(currentDelta * 10) / 10;
      remainingKg = Math.max(0, Math.round((latest - targetWeight) * 10) / 10);
      if (totalDelta > 0) {
        progressPct = Math.min(100, Math.max(0, Math.round((currentDelta / totalDelta) * 100)));
      }
    }

    // Calculate 7-day rolling average from latest entries
    const last7 = recentEntries;
    const rolling7DayAvg = last7.length > 0
      ? Math.round((last7.reduce((sum: number, e: any) => sum + Number(e.weight_kg), 0) / last7.length) * 10) / 10
      : latest;

    return {
      currentWeightKg: latest,
      rolling7DayAvg,
      rollingAverageKg: rolling7DayAvg,
      goal: goal ? {
        startWeightKg: goal.starting_weight_kg ?? goal.start_weight_kg,
        targetWeightKg: goal.target_weight_kg,
        progressPct,
        weightLostKg,
        remainingKg,
      } : null,
      entries,
    };
  }
}

export async function weightRoutes(fastify: FastifyInstance) {
  const controller = new WeightController();

  fastify.get('/me/weight', { preHandler: [authenticate] }, (req, res) => controller.getWeight(req, res));
  fastify.post('/me/weight', { preHandler: [authenticate] }, (req, res) => controller.logWeight(req, res));
  fastify.put('/me/weight', { preHandler: [authenticate] }, (req, res) => controller.logWeight(req, res));
  fastify.get('/me/weight/history', { preHandler: [authenticate] }, (req, res) => controller.getWeight(req, res));
}
