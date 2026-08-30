import { getDatabasePool } from '../../database/pool.js';
import { getUserLocalDate } from '../../shared/utils/date-utils.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { UsersRepository } from '../users/users.repository.js';
import { GoalsRepository } from '../goals/goals.routes.js';
import { beginIdempotentRequest, completeIdempotentRequest, releaseIdempotentRequest, parseBoundedPositiveInt, parsePositiveInt, isDateOnly } from '../../shared/utils/request-utils.js';
import { DbConnection } from '../../database/types.js';

const logWaterSchema = z.object({
  amountMl: z.number().int().min(1).max(10000),
  intakeDate: z.string().refine(isDateOnly, 'Use YYYY-MM-DD').optional(),
  clientOperationId: z.string().optional(),
});

export class WaterController {
  private db = getDatabasePool();
  private usersRepo = new UsersRepository();
  private goalsRepo = new GoalsRepository();

  async logWater(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = logWaterSchema.parse(request.body);

    const { reservation, replay } = await beginIdempotentRequest(this.db, request, auth.userId, body);
    if (replay) {
      return reply.status(replay.statusCode).send(replay.body);
    }

    try {
      const user = await this.usersRepo.findById(auth.userId);
      const dateStr = body.intakeDate || getUserLocalDate(user?.timezone || 'UTC');

      const responsePayload = await this.db.withTransaction(async (conn) => {
        const res = await conn.execute(
          'INSERT INTO water_entries (user_id, intake_date, amount_ml) VALUES (?, ?, ?)',
          [auth.userId, dateStr, body.amountMl]
        );

        const todayData = await this.getTodayWaterData(auth.userId, dateStr, conn);

        // If target achieved, mark task completed
        if (todayData.targetMl != null && todayData.totalMl >= todayData.targetMl) {
          await conn.execute(
            `UPDATE daily_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND task_date = ? AND task_key = 'water'`,
            [auth.userId, dateStr]
          );
        }

        const payload = {
          success: true,
          data: {
            entry: { id: res.insertId, amountMl: body.amountMl, intakeDate: dateStr },
            today: todayData,
            dailyTotalMl: todayData.totalMl,
          },
        };

        if (reservation) {
          await completeIdempotentRequest(conn, reservation, 201, payload);
        }

        return payload;
      });

      return reply.status(201).send(responsePayload);
    } catch (err) {
      if (reservation) {
        await releaseIdempotentRequest(this.db, reservation);
      }
      throw err;
    }
  }

  async getTodayWater(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const user = await this.usersRepo.findById(auth.userId);
    const dateStr = getUserLocalDate(user?.timezone || 'UTC');
    const todayData = await this.getTodayWaterData(auth.userId, dateStr);

    return reply.status(200).send({
      success: true,
      data: todayData,
    });
  }

  async getWaterHistory(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const query = (request.query || {}) as { limit?: string; page?: string };
    const limit = parseBoundedPositiveInt(query.limit, 'limit', 1, 100, 60);
    const page = parseBoundedPositiveInt(query.page, 'page', 1, 100000, 1);
    const offset = (page - 1) * limit;

    const [history, totalRow] = await Promise.all([
      this.db.query(`
        SELECT 
          intake_date,
          SUM(amount_ml) as total_ml,
          SUM(amount_ml) as amount_ml,
          COUNT(id) as entry_count
        FROM water_entries
        WHERE user_id = ?
        GROUP BY intake_date
        ORDER BY intake_date DESC
        LIMIT ? OFFSET ?
      `, [auth.userId, limit, offset]),
      this.db.queryOne<{ total: number }>(
        'SELECT COUNT(DISTINCT intake_date) as total FROM water_entries WHERE user_id = ?',
        [auth.userId],
      ),
    ]);

    const formatted = (history || []).map((h: any) => ({
      intake_date: typeof h.intake_date === 'string' ? h.intake_date : new Date(h.intake_date).toISOString().split('T')[0],
      total_ml: Number(h.total_ml || 0),
      amount_ml: Number(h.amount_ml || 0),
      entry_count: Number(h.entry_count || 0),
    }));

    return reply.status(200).send({
      success: true,
      data: formatted,
      pagination: {
        page,
        limit,
        total: Number(totalRow?.total || 0),
        totalPages: Math.ceil(Number(totalRow?.total || 0) / limit),
      },
    });
  }

  async deleteWaterEntry(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { entryId: string };
    const entryId = parsePositiveInt(params.entryId, 'entryId');

    const user = await this.usersRepo.findById(auth.userId);
    const dateStr = getUserLocalDate(user?.timezone || 'UTC');

    const todayData = await this.db.withTransaction(async (conn) => {
      await conn.execute(
        'DELETE FROM water_entries WHERE id = ? AND user_id = ?',
        [entryId, auth.userId]
      );
      return this.getTodayWaterData(auth.userId, dateStr, conn);
    });

    return reply.status(200).send({
      success: true,
      data: todayData,
    });
  }

  private async getTodayWaterData(userId: number, dateStr: string, client: DbConnection = this.db) {
    const target = await this.goalsRepo.getActiveWaterTarget(userId, dateStr, client);
    const rawTarget = target?.target_ml ?? target?.daily_target_ml;
    const targetMl = rawTarget != null ? Number(rawTarget) : null;

    const entries = await client.query(
      'SELECT * FROM water_entries WHERE user_id = ? AND intake_date = ? ORDER BY id DESC',
      [userId, dateStr]
    );

    const totalMl = entries.reduce((sum: number, e: any) => sum + (e.amount_ml || 0), 0);
    const remainingMl = targetMl != null ? Math.max(0, targetMl - totalMl) : null;
    const completionPercent = targetMl != null && targetMl > 0 ? Math.min(100, Math.round((totalMl / targetMl) * 100)) : null;

    return {
      date: dateStr,
      totalMl,
      targetMl,
      remainingMl,
      completionPercent,
      entries,
    };
  }
}

export async function waterRoutes(fastify: FastifyInstance) {
  const controller = new WaterController();

  fastify.get('/me/water/today', { preHandler: [authenticate] }, (req, res) => controller.getTodayWater(req, res));
  fastify.post('/me/water', { preHandler: [authenticate] }, (req, res) => controller.logWater(req, res));
  fastify.delete('/me/water/:entryId', { preHandler: [authenticate] }, (req, res) => controller.deleteWaterEntry(req, res));
  fastify.get('/me/water/history', { preHandler: [authenticate] }, (req, res) => controller.getWaterHistory(req, res));
}
