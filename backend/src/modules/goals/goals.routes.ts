import { getDatabasePool } from '../../database/pool.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { parsePositiveInt, isDateOnly } from '../../shared/utils/request-utils.js';
import { getUserLocalDate } from '../../shared/utils/date-utils.js';
import { NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { UsersRepository } from '../users/users.repository.js';

import { DbConnection } from '../../database/types.js';

export class GoalsRepository {
  private db = getDatabasePool();

  async getWeightGoalsForUser(userId: number, client: DbConnection = this.db): Promise<any[]> {
    const sql = `
      SELECT *, starting_weight_kg as start_weight_kg 
      FROM user_weight_goals 
      WHERE user_id = ? 
      ORDER BY start_date DESC, id DESC
    `;
    return client.query(sql, [userId]);
  }

  async getActiveWeightGoal(userId: number, client: DbConnection = this.db): Promise<any | null> {
    const sql = `
      SELECT *, starting_weight_kg as start_weight_kg 
      FROM user_weight_goals 
      WHERE user_id = ? AND status = 'active' 
      ORDER BY start_date DESC, id DESC LIMIT 1
    `;
    return client.queryOne(sql, [userId]);
  }

  async createWeightGoal(data: {
    userId: number;
    goalType?: string | null;
    startWeightKg: number;
    targetWeightKg: number;
    startDate: string;
    targetDate?: string | null;
    notes?: string | null;
    createdBy?: number | null;
  }): Promise<number> {
    const sql = `
      INSERT INTO user_weight_goals (user_id, goal_type, starting_weight_kg, target_weight_kg, start_date, target_date, status, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `;
    const res = await this.db.execute(sql, [
      data.userId,
      data.goalType || 'lose_weight',
      data.startWeightKg,
      data.targetWeightKg,
      data.startDate,
      data.targetDate || null,
      data.notes || null,
      data.createdBy || null,
    ]);
    return res.insertId;
  }

  async getWaterTargetsForUser(userId: number, client: DbConnection = this.db): Promise<any[]> {
    const sql = `
      SELECT *, target_ml as daily_target_ml 
      FROM user_water_targets 
      WHERE user_id = ? 
      ORDER BY effective_from DESC, id DESC
    `;
    return client.query(sql, [userId]);
  }

  async getActiveWaterTarget(userId: number, dateStr: string, client: DbConnection = this.db): Promise<any | null> {
    const sql = `
      SELECT *, target_ml as daily_target_ml 
      FROM user_water_targets 
      WHERE user_id = ? AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until >= ?)
      ORDER BY effective_from DESC, id DESC LIMIT 1
    `;
    return client.queryOne(sql, [userId, dateStr, dateStr]);
  }

  async createWaterTarget(data: {
    userId: number;
    dailyTargetMl: number;
    effectiveFrom: string;
    effectiveUntil?: string | null;
  }): Promise<number> {
    return this.db.withTransaction(async (conn) => {
      if (!data.effectiveUntil) {
        await conn.execute(
          `UPDATE user_water_targets 
           SET effective_until = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = ? AND status = 'active' AND effective_from < ? AND (effective_until IS NULL OR effective_until > ?)`,
          [data.effectiveFrom, data.userId, data.effectiveFrom, data.effectiveFrom]
        );
      }
      await conn.execute(
        `UPDATE user_water_targets 
         SET status = 'inactive', updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND status = 'active' AND effective_from >= ?`,
        [data.userId, data.effectiveFrom]
      );
      const sql = `
        INSERT INTO user_water_targets (user_id, target_ml, effective_from, effective_until, status)
        VALUES (?, ?, ?, ?, 'active')
      `;
      const res = await conn.execute(sql, [
        data.userId,
        data.dailyTargetMl,
        data.effectiveFrom,
        data.effectiveUntil || null,
      ]);
      return res.insertId;
    });
  }

  async getWaterQuickAddForUser(userId: number, client: DbConnection = this.db): Promise<any[]> {
    const sql = `
      SELECT id, user_id, amount_ml, display_order, is_active, created_at
      FROM user_water_quick_add_options
      WHERE user_id = ?
      ORDER BY display_order ASC, amount_ml ASC
    `;
    const rows = await client.query(sql, [userId]);
    return rows;
  }

  async saveWaterQuickAddForUser(
    userId: number,
    options: Array<{ amountMl: number; displayOrder?: number; isActive?: boolean }>
  ): Promise<any[]> {
    return this.db.withTransaction(async (conn) => {
      await conn.execute(`DELETE FROM user_water_quick_add_options WHERE user_id = ?`, [userId]);
      let order = 1;
      const seenAmounts = new Set<number>();
      for (const opt of options) {
        if (seenAmounts.has(opt.amountMl)) continue;
        seenAmounts.add(opt.amountMl);
        await conn.execute(
          `INSERT INTO user_water_quick_add_options (user_id, amount_ml, display_order, is_active) VALUES (?, ?, ?, ?)`,
          [userId, opt.amountMl, opt.displayOrder ?? order++, opt.isActive !== false ? 1 : 0]
        );
      }
      return conn.query(
        `SELECT id, user_id, amount_ml, display_order, is_active FROM user_water_quick_add_options WHERE user_id = ? ORDER BY display_order ASC`,
        [userId]
      );
    });
  }

  async getCardioTargetsForUser(userId: number, client: DbConnection = this.db): Promise<any[]> {
    const sql = `
      SELECT uct.*, 
             uct.target_minutes_min as min_duration_minutes,
             uct.target_minutes_max as max_duration_minutes,
             ca.name as activity_name 
             FROM user_cardio_targets uct
      LEFT JOIN cardio_activities ca ON ca.id = uct.cardio_activity_id
      WHERE uct.user_id = ?
      ORDER BY uct.effective_from DESC, uct.id DESC
    `;
    const targets = await client.query<any>(sql, [userId]);
    if (targets.length === 0) return targets;

    const targetIds = targets.map((target: any) => target.id);
    const placeholders = targetIds.map(() => '?').join(',');
    const dayRows = await client.query<{ user_cardio_target_id: number; weekday: number }>(
      `SELECT user_cardio_target_id, weekday
       FROM user_cardio_target_days
       WHERE user_cardio_target_id IN (${placeholders})
       ORDER BY user_cardio_target_id ASC, weekday ASC`,
      targetIds
    );
    const weekdaysByTargetId = new Map<number, number[]>();
    for (const row of dayRows) {
      const weekdays = weekdaysByTargetId.get(row.user_cardio_target_id) || [];
      weekdays.push(row.weekday);
      weekdaysByTargetId.set(row.user_cardio_target_id, weekdays);
    }
    for (const target of targets) {
      target.weekdays = weekdaysByTargetId.get(target.id) || [];
    }
    return targets;
  }

  async getActiveCardioTarget(userId: number, dateStr: string, weekdayNumber: number, client: DbConnection = this.db): Promise<any | null> {
    const sql = `
      SELECT uct.*, 
             uct.target_minutes_min as min_duration_minutes,
             uct.target_minutes_max as max_duration_minutes,
             ca.name as activity_name 
      FROM user_cardio_targets uct
      LEFT JOIN cardio_activities ca ON ca.id = uct.cardio_activity_id
      JOIN user_cardio_target_days uctd ON uctd.user_cardio_target_id = uct.id
      WHERE uct.user_id = ? AND uct.status = 'active' AND uctd.weekday = ?
        AND uct.effective_from <= ? AND (uct.effective_until IS NULL OR uct.effective_until >= ?)
      ORDER BY uct.effective_from DESC, uct.id DESC LIMIT 1
    `;
    return client.queryOne(sql, [userId, weekdayNumber, dateStr, dateStr]);
  }

  async createCardioTarget(data: {
    userId: number;
    cardioActivityId?: number | null;
    minDurationMinutes: number;
    maxDurationMinutes?: number | null;
    targetSpeedMinKmh?: number | null;
    targetSpeedMaxKmh?: number | null;
    targetInclineMin?: number | null;
    targetInclineMax?: number | null;
    targetDistanceMinKm?: number | null;
    targetDistanceMaxKm?: number | null;
    weekdays: number[];
    effectiveFrom: string;
    effectiveUntil?: string | null;
    notes?: string | null;
  }): Promise<number> {
    const sql = `
      INSERT INTO user_cardio_targets (
        user_id, cardio_activity_id, target_minutes_min, target_minutes_max,
        target_speed_min_kmh, target_speed_max_kmh, target_incline_min, target_incline_max,
        target_distance_min_km, target_distance_max_km, effective_from, effective_until, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `;
    const res = await this.db.execute(sql, [
      data.userId,
      data.cardioActivityId || null,
      data.minDurationMinutes,
      data.maxDurationMinutes || null,
      data.targetSpeedMinKmh !== undefined ? data.targetSpeedMinKmh : null,
      data.targetSpeedMaxKmh !== undefined ? data.targetSpeedMaxKmh : null,
      data.targetInclineMin !== undefined ? data.targetInclineMin : null,
      data.targetInclineMax !== undefined ? data.targetInclineMax : null,
      data.targetDistanceMinKm !== undefined ? data.targetDistanceMinKm : null,
      data.targetDistanceMaxKm !== undefined ? data.targetDistanceMaxKm : null,
      data.effectiveFrom,
      data.effectiveUntil || null,
      data.notes || null,
    ]);
    const targetId = res.insertId;

    for (const day of data.weekdays) {
      await this.db.execute(
        `INSERT INTO user_cardio_target_days (user_cardio_target_id, weekday) VALUES (?, ?)`,
        [targetId, day]
      );
    }
    return targetId;
  }

  async deleteCardioTarget(targetId: number, userId: number): Promise<boolean> {
    const res = await this.db.execute(
      `UPDATE user_cardio_targets SET status = 'cancelled' WHERE id = ? AND user_id = ?`,
      [targetId, userId]
    );
    return res.affectedRows > 0;
  }

  async getAdherenceConfigForUser(userId: number, asOfDate?: string, client: DbConnection = this.db): Promise<any> {
    const dateStr = asOfDate || new Date().toISOString().split('T')[0];
    const sql = `
      SELECT id, user_id, diet_weight_pct, workout_weight_pct, cardio_weight_pct, water_weight_pct, weight_logging_weight_pct, effective_from, effective_until, is_active, created_at, updated_at
      FROM user_adherence_configs
      WHERE user_id = ? AND is_active = 1 AND effective_from <= ? AND (effective_until IS NULL OR effective_until >= ?)
      ORDER BY effective_from DESC, id DESC LIMIT 1
    `;
    const config = await client.queryOne<any>(sql, [userId, dateStr, dateStr]);
    if (config) {
      return {
        ...config,
        is_custom: true,
      };
    }
    return {
      user_id: userId,
      diet_weight_pct: 35,
      workout_weight_pct: 25,
      cardio_weight_pct: 15,
      water_weight_pct: 15,
      weight_logging_weight_pct: 10,
      effective_from: dateStr,
      is_active: 1,
      is_custom: false,
    };
  }

  async saveAdherenceConfigForUser(
    userId: number,
    data: {
      dietWeightPct: number;
      workoutWeightPct: number;
      cardioWeightPct: number;
      waterWeightPct: number;
      weightLoggingWeightPct: number;
      effectiveFrom?: string;
      effectiveUntil?: string | null;
    }
  ): Promise<number> {
    const total =
      Math.round(
        (data.dietWeightPct +
          data.workoutWeightPct +
          data.cardioWeightPct +
          data.waterWeightPct +
          data.weightLoggingWeightPct) *
          100
      ) / 100;
    if (Math.abs(total - 100) > 0.01) {
      throw new ValidationError(`Adherence component weights must sum exactly to 100% (currently ${total}%)`);
    }

    return this.db.withTransaction(async (conn) => {
      const effectiveFrom = data.effectiveFrom || new Date().toISOString().split('T')[0];
      await conn.execute(
        `UPDATE user_adherence_configs 
         SET effective_until = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND is_active = 1 AND effective_from < ? AND (effective_until IS NULL OR effective_until > ?)`,
        [effectiveFrom, userId, effectiveFrom, effectiveFrom]
      );
      await conn.execute(
        `UPDATE user_adherence_configs 
         SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND is_active = 1 AND effective_from >= ?`,
        [userId, effectiveFrom]
      );
      const res = await conn.execute(
        `INSERT INTO user_adherence_configs (
          user_id, diet_weight_pct, workout_weight_pct, cardio_weight_pct, water_weight_pct, weight_logging_weight_pct, effective_from, effective_until, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          userId,
          data.dietWeightPct,
          data.workoutWeightPct,
          data.cardioWeightPct,
          data.waterWeightPct,
          data.weightLoggingWeightPct,
          effectiveFrom,
          data.effectiveUntil || null,
        ]
      );
      return res.insertId;
    });
  }
}

const createWeightGoalSchema = z.object({
  goalType: z.enum(['lose_weight', 'gain_weight', 'build_muscle', 'maintain_weight']).optional().nullable(),
  startWeightKg: z.number().min(20).max(500),
  targetWeightKg: z.number().min(20).max(500),
  startDate: z.string().refine(isDateOnly, 'Use YYYY-MM-DD').optional(),
  targetDate: z.string().refine(isDateOnly, 'Use YYYY-MM-DD').optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.startDate && data.targetDate && data.targetDate < data.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetDate'], message: 'targetDate cannot be before startDate' });
  }
});

const createWaterTargetSchema = z.object({
  dailyTargetMl: z.number().min(500).max(10000),
  effectiveFrom: z.string().refine(isDateOnly, 'Use YYYY-MM-DD'),
  effectiveUntil: z.string().refine(isDateOnly, 'Use YYYY-MM-DD').optional().nullable(),
});

const waterQuickAddSchema = z.object({
  options: z
    .array(
      z.union([
        z.number().int().min(50).max(5000),
        z.object({
          amountMl: z.number().int().min(50).max(5000),
          displayOrder: z.number().int().min(1).optional(),
          isActive: z.boolean().optional(),
        }),
      ])
    )
    .min(1, 'At least one quick add option is required')
    .max(10, 'Maximum 10 quick add options allowed'),
});

const createCardioTargetSchema = z.object({
  cardioActivityId: z.number().int().positive().optional().nullable(),
  minDurationMinutes: z.number().int().min(1).max(1440),
  maxDurationMinutes: z.number().int().min(1).max(1440).optional().nullable(),
  targetSpeedMinKmh: z.number().min(0).max(100).optional().nullable(),
  targetSpeedMaxKmh: z.number().min(0).max(100).optional().nullable(),
  targetInclineMin: z.number().min(0).max(100).optional().nullable(),
  targetInclineMax: z.number().min(0).max(100).optional().nullable(),
  targetDistanceMinKm: z.number().min(0).max(1000).optional().nullable(),
  targetDistanceMaxKm: z.number().min(0).max(1000).optional().nullable(),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1, 'At least one weekday is required'),
  effectiveFrom: z.string().refine(isDateOnly, 'Use YYYY-MM-DD'),
  effectiveUntil: z.string().refine(isDateOnly, 'Use YYYY-MM-DD').optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const adherenceConfigSchema = z.object({
  dietWeightPct: z.number().min(0).max(100),
  workoutWeightPct: z.number().min(0).max(100),
  cardioWeightPct: z.number().min(0).max(100),
  waterWeightPct: z.number().min(0).max(100),
  weightLoggingWeightPct: z.number().min(0).max(100),
  effectiveFrom: z.string().refine(isDateOnly, 'Use YYYY-MM-DD').optional(),
  effectiveUntil: z.string().refine(isDateOnly, 'Use YYYY-MM-DD').optional().nullable(),
});

export class GoalsController {
  private repo = new GoalsRepository();
  private usersRepo = new UsersRepository();
  private db = getDatabasePool();

  async getWeightGoals(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const goals = await this.repo.getWeightGoalsForUser(userId);
    return reply.status(200).send({ success: true, data: goals });
  }

  async createWeightGoal(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const body = createWeightGoalSchema.parse(request.body);
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    const id = await this.repo.createWeightGoal({
      userId,
      goalType: body.goalType,
      startWeightKg: body.startWeightKg,
      targetWeightKg: body.targetWeightKg,
      startDate: body.startDate || getUserLocalDate(user.timezone || 'UTC'),
      targetDate: body.targetDate,
      notes: body.notes,
    });
    return reply.status(201).send({ success: true, data: { id } });
  }

  async getWaterTargets(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const targets = await this.repo.getWaterTargetsForUser(userId);
    return reply.status(200).send({ success: true, data: targets });
  }

  async createWaterTarget(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const body = createWaterTargetSchema.parse(request.body);
    const id = await this.repo.createWaterTarget({
      userId,
      dailyTargetMl: body.dailyTargetMl,
      effectiveFrom: body.effectiveFrom,
      effectiveUntil: body.effectiveUntil,
    });
    return reply.status(201).send({ success: true, data: { id } });
  }

  async getWaterQuickAdd(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const options = await this.repo.getWaterQuickAddForUser(userId);
    return reply.status(200).send({ success: true, data: options });
  }

  async saveWaterQuickAdd(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const body = waterQuickAddSchema.parse(request.body);
    const normalized = body.options.map((item, idx) =>
      typeof item === 'number' ? { amountMl: item, displayOrder: idx + 1, isActive: true } : item
    );
    const updated = await this.repo.saveWaterQuickAddForUser(userId, normalized);
    return reply.status(200).send({ success: true, data: updated });
  }

  async getCardioTargets(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const targets = await this.repo.getCardioTargetsForUser(userId);
    return reply.status(200).send({ success: true, data: targets });
  }

  async createCardioTarget(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const body = createCardioTargetSchema.parse(request.body);
    const id = await this.repo.createCardioTarget({
      userId,
      cardioActivityId: body.cardioActivityId,
      minDurationMinutes: body.minDurationMinutes,
      maxDurationMinutes: body.maxDurationMinutes,
      targetSpeedMinKmh: body.targetSpeedMinKmh,
      targetSpeedMaxKmh: body.targetSpeedMaxKmh,
      targetInclineMin: body.targetInclineMin,
      targetInclineMax: body.targetInclineMax,
      targetDistanceMinKm: body.targetDistanceMinKm,
      targetDistanceMaxKm: body.targetDistanceMaxKm,
      weekdays: body.weekdays,
      effectiveFrom: body.effectiveFrom,
      effectiveUntil: body.effectiveUntil,
      notes: body.notes,
    });
    return reply.status(201).send({ success: true, data: { id } });
  }

  async deleteCardioTarget(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string; targetId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const targetId = parsePositiveInt(params.targetId, 'targetId');
    const ok = await this.repo.deleteCardioTarget(targetId, userId);
    if (!ok) throw new NotFoundError('Cardio target not found');
    return reply.status(200).send({ success: true, data: { message: 'Cardio target removed' } });
  }

  async getAdherenceConfig(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const query = request.query as { date?: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const config = await this.repo.getAdherenceConfigForUser(userId, query.date);
    return reply.status(200).send({ success: true, data: config });
  }

  async saveAdherenceConfig(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const body = adherenceConfigSchema.parse(request.body);
    const id = await this.repo.saveAdherenceConfigForUser(userId, body);
    const updated = await this.repo.getAdherenceConfigForUser(userId, body.effectiveFrom);
    return reply.status(200).send({ success: true, data: { id, ...updated } });
  }

  async getMyGoals(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const user = await this.usersRepo.findById(auth.userId);
    const today = getUserLocalDate(user?.timezone || 'UTC');
    const [weightGoal, waterTarget, cardioTargets, waterQuickAdd, adherenceConfig] = await Promise.all([
      this.repo.getActiveWeightGoal(auth.userId),
      this.repo.getActiveWaterTarget(auth.userId, today),
      this.repo.getCardioTargetsForUser(auth.userId),
      this.repo.getWaterQuickAddForUser(auth.userId),
      this.repo.getAdherenceConfigForUser(auth.userId, today),
    ]);
    return reply.status(200).send({
      success: true,
      data: {
        weightGoal,
        waterTarget,
        cardioTargets,
        waterQuickAdd,
        adherenceConfig,
      },
    });
  }

  async setMyWeightGoal(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const user = await this.usersRepo.findById(auth.userId);
    const today = getUserLocalDate(user?.timezone || 'UTC');
    const body = createWeightGoalSchema.parse(request.body);
    const startDate = body.startDate || today;
    if (body.targetDate && body.targetDate < startDate) {
      throw new ValidationError('targetDate cannot be before startDate');
    }

    await this.db.execute(
      `UPDATE user_weight_goals SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'active'`,
      [auth.userId]
    );

    const id = await this.repo.createWeightGoal({
      userId: auth.userId,
      goalType: body.goalType || 'lose_weight',
      startWeightKg: body.startWeightKg,
      targetWeightKg: body.targetWeightKg,
      startDate,
      targetDate: body.targetDate,
      notes: body.notes,
      createdBy: auth.userId,
    });

    const active = await this.repo.getActiveWeightGoal(auth.userId);
    return reply.status(200).send({ success: true, data: active || { id, ...body, startDate } });
  }

  async setMyWaterTarget(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const user = await this.usersRepo.findById(auth.userId);
    const today = getUserLocalDate(user?.timezone || 'UTC');
    const body = z.object({ dailyTargetMl: z.number().min(500).max(10000) }).parse(request.body);

    const id = await this.repo.createWaterTarget({
      userId: auth.userId,
      dailyTargetMl: body.dailyTargetMl,
      effectiveFrom: today,
    });

    const active = await this.repo.getActiveWaterTarget(auth.userId, today);
    return reply.status(200).send({ success: true, data: active || { id, targetMl: body.dailyTargetMl, effectiveFrom: today } });
  }

  async setMyWaterQuickAdd(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const parsed = waterQuickAddSchema.parse(request.body);
    const normalized = parsed.options.map((opt, idx) => {
      if (typeof opt === 'number') {
        return { amountMl: opt, displayOrder: idx + 1, isActive: true };
      }
      return {
        amountMl: opt.amountMl,
        displayOrder: opt.displayOrder ?? idx + 1,
        isActive: opt.isActive ?? true,
      };
    });
    const saved = await this.repo.saveWaterQuickAddForUser(auth.userId, normalized);
    return reply.status(200).send({ success: true, data: saved });
  }

  async getMyCardioTargets(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const targets = await this.repo.getCardioTargetsForUser(auth.userId);
    return reply.status(200).send({ success: true, data: targets });
  }

  async createMyCardioTarget(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const user = await this.usersRepo.findById(auth.userId);
    const today = getUserLocalDate(user?.timezone || 'UTC');
    const body = createCardioTargetSchema.partial({ effectiveFrom: true }).parse(request.body);
    const effectiveFrom = body.effectiveFrom || today;

    const targetId = await this.repo.createCardioTarget({
      ...body,
      userId: auth.userId,
      effectiveFrom,
      weekdays: body.weekdays || [1, 2, 3, 4, 5, 6, 7],
    });

    const targets = await this.repo.getCardioTargetsForUser(auth.userId);
    const created = targets.find((t: any) => t.id === targetId);
    return reply.status(201).send({ success: true, data: created || { id: targetId, ...body, effectiveFrom } });
  }

  async deleteMyCardioTarget(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { targetId: string };
    const targetId = parsePositiveInt(params.targetId, 'targetId');
    const removed = await this.repo.deleteCardioTarget(targetId, auth.userId);
    if (!removed) {
      throw new NotFoundError('Cardio target not found or not owned by user');
    }
    return reply.status(200).send({ success: true, data: { message: 'Cardio target removed' } });
  }
}

export async function goalsRoutes(fastify: FastifyInstance) {
  const controller = new GoalsController();

  fastify.get('/me/goals', { preHandler: [authenticate] }, (req, res) => controller.getMyGoals(req, res));
  fastify.put('/me/goals/weight', { preHandler: [authenticate] }, (req, res) => controller.setMyWeightGoal(req, res));
  fastify.put('/me/goals/water', { preHandler: [authenticate] }, (req, res) => controller.setMyWaterTarget(req, res));
  fastify.put('/me/goals/water-quick-add', { preHandler: [authenticate] }, (req, res) => controller.setMyWaterQuickAdd(req, res));
  fastify.get('/me/goals/cardio', { preHandler: [authenticate] }, (req, res) => controller.getMyCardioTargets(req, res));
  fastify.post('/me/goals/cardio', { preHandler: [authenticate] }, (req, res) => controller.createMyCardioTarget(req, res));
  fastify.delete('/me/goals/cardio/:targetId', { preHandler: [authenticate] }, (req, res) => controller.deleteMyCardioTarget(req, res));

  // Admin user goal & target management
  fastify.get('/admin/users/:userId/weight-goals', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.getWeightGoals(req, res)
  );
  fastify.post('/admin/users/:userId/weight-goals', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.createWeightGoal(req, res)
  );

  fastify.get('/admin/users/:userId/water-targets', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.getWaterTargets(req, res)
  );
  fastify.post('/admin/users/:userId/water-targets', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.createWaterTarget(req, res)
  );

  fastify.get('/admin/users/:userId/water-quick-add', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.getWaterQuickAdd(req, res)
  );
  fastify.put('/admin/users/:userId/water-quick-add', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.saveWaterQuickAdd(req, res)
  );
  fastify.post('/admin/users/:userId/water-quick-add', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.saveWaterQuickAdd(req, res)
  );

  fastify.get('/admin/users/:userId/cardio-targets', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.getCardioTargets(req, res)
  );
  fastify.post('/admin/users/:userId/cardio-targets', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.createCardioTarget(req, res)
  );
  fastify.delete('/admin/users/:userId/cardio-targets/:targetId', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.deleteCardioTarget(req, res)
  );

  fastify.get('/admin/users/:userId/adherence-config', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.getAdherenceConfig(req, res)
  );
  fastify.put('/admin/users/:userId/adherence-config', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.saveAdherenceConfig(req, res)
  );
  fastify.post('/admin/users/:userId/adherence-config', { preHandler: [authenticate, requireAdmin] }, (req, res) =>
    controller.saveAdherenceConfig(req, res)
  );
}
