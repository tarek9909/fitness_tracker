import { getDatabasePool } from '../../database/pool.js';
import { getUserLocalDate, getWeekdayNumber } from '../../shared/utils/date-utils.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { UsersRepository } from '../users/users.repository.js';
import { AssignmentRepository } from '../assignments/assignment.routes.js';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { isDateOnly, parsePositiveInt, parseBoundedPositiveInt } from '../../shared/utils/request-utils.js';
import { beginIdempotentRequest, completeIdempotentRequest, releaseIdempotentRequest } from '../../shared/utils/request-utils.js';
import { DbConnection } from '../../database/types.js';

const startSessionSchema = z.object({
  workoutPlanDayId: z.number().int().positive().optional(),
  sessionDate: z.string().refine(isDateOnly, 'Use YYYY-MM-DD').optional(),
  clientOperationId: z.string().min(8).max(191).optional(),
});

const logSetSchema = z.object({
  sessionExerciseId: z.number().int().positive(),
  setNumber: z.number().int().min(1).max(100),
  setType: z.enum(['warmup', 'working', 'dropset', 'failure']).default('working'),
  weightKg: z.number().min(0).max(1000).optional(),
  reps: z.number().int().min(1).max(500).optional(),
  durationSeconds: z.number().int().min(1).max(86400).optional(),
  distanceMeters: z.number().min(0).max(100000).optional(),
  notes: z.string().max(1000).optional(),
  completed: z.boolean().default(true),
  clientOperationId: z.string().min(8).max(191).optional(),
});

const completeWorkoutSchema = z.object({
  notes: z.string().max(2000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  clientOperationId: z.string().min(8).max(191).optional(),
});

export class WorkoutSessionController {
  private db = getDatabasePool();
  private usersRepo = new UsersRepository();
  private assignRepo = new AssignmentRepository();

  async startWorkout(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = startSessionSchema.parse(request.body || {});
    const idempotency = await beginIdempotentRequest(this.db, request, auth.userId, body);
    if (idempotency.replay) {
      return reply.status(idempotency.replay.statusCode).send(idempotency.replay.body);
    }

    try {
      const user = await this.usersRepo.findById(auth.userId);
      const dateStr = body.sessionDate || getUserLocalDate(user?.timezone || 'UTC');
      const weekday = getWeekdayNumber(dateStr);

      const activeAssign = await this.assignRepo.getActiveWorkoutAssignment(auth.userId, dateStr);
      if (!activeAssign) throw new NotFoundError('No active workout plan assigned');

      let dayId = body.workoutPlanDayId;
      const day = await this.db.queryOne<{ id: number; is_rest_day: number; name: string }>(
        `SELECT id, is_rest_day, name FROM workout_plan_days
         WHERE workout_plan_version_id = ? AND ${dayId ? 'id = ?' : 'weekday = ?'}`,
        [activeAssign.workout_plan_version_id, dayId || weekday],
      );
      if (!day) throw new NotFoundError('Workout day is not part of the active assigned plan');
      if (day.is_rest_day) throw new ValidationError('Today is a scheduled rest day');
      dayId = day.id;
      const workoutName = day.name || 'Workout';

      // Atomically check or create session, snapshot exercises, and complete idempotency
      const { session, statusCode } = await this.db.withTransaction(async (conn) => {
        const existing = await conn.queryOne<any>(
          'SELECT id, status FROM workout_sessions WHERE user_id = ? AND workout_date = ?',
          [auth.userId, dateStr]
        );

        let sessionId: number;
        let isNew = false;

        if (existing) {
          sessionId = existing.id;
        } else {
          try {
            const res = await conn.execute(
              `INSERT INTO workout_sessions (user_id, source_type, user_workout_assignment_id, workout_plan_version_id, workout_plan_day_id, workout_date, workout_name_snapshot, status, started_at)
               VALUES (?, 'planned', ?, ?, ?, ?, ?, 'in_progress', CURRENT_TIMESTAMP)`,
              [auth.userId, activeAssign.id, activeAssign.workout_plan_version_id, dayId, dateStr, workoutName]
            );
            sessionId = res.insertId;
            isNew = true;
          } catch (err: any) {
            if (err?.message?.includes('UNIQUE constraint failed') || err?.code === 'SQLITE_CONSTRAINT' || err?.code === 'ER_DUP_ENTRY') {
              const fallback = await conn.queryOne<any>(
                'SELECT id, status FROM workout_sessions WHERE user_id = ? AND workout_date = ?',
                [auth.userId, dateStr]
              );
              if (fallback) {
                sessionId = fallback.id;
              } else {
                throw err;
              }
            } else {
              throw err;
            }
          }

          if (isNew) {
            const planExercises = await conn.query(
              `SELECT wpe.*, 
                      e.name as exercise_name, 
                      e.tracking_type
               FROM workout_plan_exercises wpe
               JOIN exercises e ON e.id = wpe.exercise_id
               WHERE wpe.workout_plan_day_id = ? 
               ORDER BY wpe.exercise_order ASC`,
              [dayId]
            );

            for (const pe of planExercises) {
              await conn.execute(
                `INSERT INTO workout_session_exercises (
                   workout_session_id, workout_plan_exercise_id, exercise_id, exercise_order,
                   exercise_name_snapshot, tracking_type_snapshot, planned_sets_snapshot,
                   planned_reps_min_snapshot, planned_reps_max_snapshot, planned_rest_seconds_snapshot,
                   status
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [
                  sessionId,
                  pe.id,
                  pe.exercise_id,
                  pe.exercise_order,
                  pe.exercise_name || 'Exercise',
                  pe.tracking_type || 'weight_reps',
                  pe.target_sets,
                  pe.target_reps_min,
                  pe.target_reps_max,
                  pe.rest_seconds,
                ]
              );
            }

            // Mark daily task in_progress
            const taskKey = `workout:${dayId}`;
            await conn.execute(
              `UPDATE daily_tasks SET status = 'in_progress' WHERE user_id = ? AND task_date = ? AND task_key = ?`,
              [auth.userId, dateStr, taskKey]
            );
          }
        }

        const details = await this.getSessionDetails(sessionId, auth.userId, conn);
        const code = isNew ? 201 : 200;
        const responseBody = { success: true, data: details };
        if (idempotency.reservation) {
          await completeIdempotentRequest(conn, idempotency.reservation, code, responseBody);
        }
        return { session: details, statusCode: code };
      });

      return reply.status(statusCode).send({ success: true, data: session });
    } catch (error) {
      await releaseIdempotentRequest(this.db, idempotency.reservation);
      throw error;
    }
  }

  async getSession(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { sessionId: string };
    const session = await this.getSessionDetails(parsePositiveInt(params.sessionId, 'sessionId'), auth.userId);
    if (!session) throw new NotFoundError('Workout session not found');
    return reply.status(200).send({ success: true, data: session });
  }

  async logSet(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { sessionId: string };
    const sessionId = parsePositiveInt(params.sessionId, 'sessionId');
    const body = logSetSchema.parse(request.body);
    const idempotency = await beginIdempotentRequest(this.db, request, auth.userId, body);
    if (idempotency.replay) {
      return reply.status(idempotency.replay.statusCode).send(idempotency.replay.body);
    }

    try {
      const updatedSession = await this.db.withTransaction(async (conn) => {
        const session = await conn.queryOne<any>(
          'SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?',
          [sessionId, auth.userId]
        );
        if (!session) throw new NotFoundError('Workout session not found');
        if (session.status !== 'in_progress') {
          throw new ValidationError('Only an in-progress workout session can accept set entries');
        }

        const sessionExercise = await conn.queryOne<any>(
          `SELECT wse.id, wse.tracking_type_snapshot FROM workout_session_exercises wse
           JOIN workout_sessions ws ON ws.id = wse.workout_session_id
           WHERE wse.id = ? AND ws.id = ? AND ws.user_id = ?`,
          [body.sessionExerciseId, sessionId, auth.userId],
        );
        if (!sessionExercise) throw new NotFoundError('Workout exercise does not belong to this session');

        if (body.completed) {
          const trackingType = String(sessionExercise.tracking_type_snapshot || 'weight_reps');
          const missingField =
            trackingType === 'reps_only' || trackingType === 'bodyweight_reps'
              ? body.reps === undefined ? 'reps' : null
              : trackingType === 'duration' || trackingType === 'time_only'
                ? body.durationSeconds === undefined ? 'durationSeconds' : null
                : trackingType === 'distance'
                  ? body.distanceMeters === undefined ? 'distanceMeters' : null
                  : trackingType === 'distance_duration'
                    ? body.distanceMeters === undefined
                      ? 'distanceMeters'
                      : body.durationSeconds === undefined ? 'durationSeconds' : null
                    : trackingType === 'weight_duration'
                      ? body.weightKg === undefined
                        ? 'weightKg'
                        : body.durationSeconds === undefined ? 'durationSeconds' : null
                      : null;
          if (missingField) {
            throw new ValidationError(`${missingField} is required for ${trackingType} exercises`);
          }
        }

        const existingSet = await conn.queryOne<any>(
          'SELECT id FROM workout_sets WHERE workout_session_exercise_id = ? AND set_number = ?',
          [sessionExercise.id, body.setNumber]
        );

        if (existingSet) {
          await conn.execute(
            `UPDATE workout_sets SET set_type = ?, weight_kg = ?, reps = ?, duration_seconds = ?, distance_meters = ?, notes = ?, completed = ?, performed_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [
              body.setType,
              body.weightKg !== undefined ? body.weightKg : null,
              body.reps !== undefined ? body.reps : null,
              body.durationSeconds !== undefined ? body.durationSeconds : null,
              body.distanceMeters !== undefined ? body.distanceMeters : null,
              body.notes || null,
              body.completed ? 1 : 0,
              existingSet.id,
            ]
          );
        } else {
          await conn.execute(
            `INSERT INTO workout_sets (workout_session_exercise_id, set_number, set_type, weight_kg, reps, duration_seconds, distance_meters, notes, completed, performed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              sessionExercise.id,
              body.setNumber,
              body.setType,
              body.weightKg !== undefined ? body.weightKg : null,
              body.reps !== undefined ? body.reps : null,
              body.durationSeconds !== undefined ? body.durationSeconds : null,
              body.distanceMeters !== undefined ? body.distanceMeters : null,
              body.notes || null,
              body.completed ? 1 : 0,
            ]
          );
        }

        const details = await this.getSessionDetails(sessionId, auth.userId, conn);
        const responseBody = { success: true, data: details };
        if (idempotency.reservation) {
          await completeIdempotentRequest(conn, idempotency.reservation, 200, responseBody);
        }
        return details;
      });

      return reply.status(200).send({ success: true, data: updatedSession });
    } catch (error) {
      await releaseIdempotentRequest(this.db, idempotency.reservation);
      throw error;
    }
  }

  async completeWorkout(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { sessionId: string };
    const sessionId = parsePositiveInt(params.sessionId, 'sessionId');
    const body = completeWorkoutSchema.parse(request.body || {});
    const idempotency = await beginIdempotentRequest(this.db, request, auth.userId, body);
    if (idempotency.replay) {
      return reply.status(idempotency.replay.statusCode).send(idempotency.replay.body);
    }

    try {
      const updated = await this.db.withTransaction(async (conn) => {
        const session = await conn.queryOne<any>(
          'SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?',
          [sessionId, auth.userId]
        );
        if (!session) throw new NotFoundError('Workout session not found');
        if (session.status === 'completed') {
          throw new ConflictError('Workout session is already completed', 'WORKOUT_ALREADY_COMPLETED');
        }
        if (session.status !== 'in_progress') {
          throw new ValidationError('Only an in-progress workout session can be completed');
        }

        const completionState = await conn.queryOne<any>(
          `SELECT COUNT(*) as total_exercises,
                  COUNT(DISTINCT CASE WHEN wst.id IS NOT NULL THEN wse.id END) as completed_exercises
           FROM workout_session_exercises wse
           LEFT JOIN workout_sets wst
             ON wst.workout_session_exercise_id = wse.id AND wst.completed = 1
           WHERE wse.workout_session_id = ?`,
          [sessionId],
        );
        if (Number(completionState?.total_exercises || 0) > 0 &&
            Number(completionState?.completed_exercises || 0) === 0) {
          throw new ValidationError('Record at least one completed set before completing this workout');
        }

        const updateRes = await conn.execute(
          `UPDATE workout_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP, notes = ? WHERE id = ? AND user_id = ?`,
          [body?.notes || null, sessionId, auth.userId]
        );
        if (updateRes.affectedRows === 0) throw new NotFoundError('Workout session not found');

        if (session.workout_plan_day_id) {
          const taskKey = `workout:${session.workout_plan_day_id}`;
          await conn.execute(
            `UPDATE daily_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND task_date = ? AND task_key = ?`,
            [auth.userId, session.workout_date, taskKey]
          );
        }

        const details = await this.getSessionDetails(sessionId, auth.userId, conn);
        const responseBody = { success: true, data: details };
        if (idempotency.reservation) {
          await completeIdempotentRequest(conn, idempotency.reservation, 200, responseBody);
        }
        return details;
      });

      return reply.status(200).send({ success: true, data: updated });
    } catch (error) {
      await releaseIdempotentRequest(this.db, idempotency.reservation);
      throw error;
    }
  }

  async getPreviousPerformance(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { exerciseId: string };
    const exerciseId = parsePositiveInt(params.exerciseId, 'exerciseId');

    const history = await this.db.query(`
      SELECT ws.id as session_id, ws.workout_date as session_date, ws.completed_at, wsets.set_number, wsets.set_type,
             wsets.weight_kg, wsets.reps, wsets.duration_seconds, wsets.distance_meters
      FROM workout_sets wsets
      JOIN workout_session_exercises wse ON wse.id = wsets.workout_session_exercise_id
      JOIN workout_sessions ws ON ws.id = wse.workout_session_id
      WHERE ws.user_id = ? AND wse.exercise_id = ? AND wsets.completed = 1
      ORDER BY ws.workout_date DESC, wsets.set_number ASC
      LIMIT 30
    `, [auth.userId, exerciseId]);

    const weights = history
      .map((s: any) => Number(s.weight_kg))
      .filter((value: number) => Number.isFinite(value));
    const reps = history
      .map((s: any) => Number(s.reps))
      .filter((value: number) => Number.isFinite(value));

    return reply.status(200).send({
      success: true,
      data: {
        exerciseId,
        lastWorkoutDate: history[0]?.session_date ?? null,
        maxWeightKg: weights.length > 0 ? Math.max(...weights) : null,
        highestCompletedReps: reps.length > 0 ? Math.max(...reps) : null,
        recentSets: history,
      },
    });
  }

  async skipWorkout(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { sessionId: string };
    const sessionId = parsePositiveInt(params.sessionId, 'sessionId');
    const body = z.object({
      notes: z.string().max(2000).optional(),
      clientOperationId: z.string().min(8).max(191).optional(),
    }).parse(request.body || {});
    const idempotency = await beginIdempotentRequest(this.db, request, auth.userId, body);
    if (idempotency.replay) return reply.status(idempotency.replay.statusCode).send(idempotency.replay.body);

    try {
      const details = await this.db.withTransaction(async (conn) => {
        const session = await conn.queryOne<any>(
          'SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?',
          [sessionId, auth.userId],
        );
        if (!session) throw new NotFoundError('Workout session not found');
        if (session.status === 'completed') {
          throw new ConflictError('Workout session is already completed', 'WORKOUT_ALREADY_COMPLETED');
        }

        const updateRes = await conn.execute(
          `UPDATE workout_sessions SET status = 'skipped', notes = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
          [body.notes || null, sessionId, auth.userId],
        );
        if (updateRes.affectedRows === 0) throw new NotFoundError('Workout session not found');

        if (session.workout_plan_day_id) {
          await conn.execute(
            `UPDATE daily_tasks SET status = 'skipped', completed_at = CURRENT_TIMESTAMP
             WHERE user_id = ? AND task_date = ? AND task_key = ?`,
            [auth.userId, session.workout_date, `workout:${session.workout_plan_day_id}`],
          );
        }

        const resDetails = await this.getSessionDetails(sessionId, auth.userId, conn);
        const responseBody = { success: true, data: resDetails };
        if (idempotency.reservation) {
          await completeIdempotentRequest(conn, idempotency.reservation, 200, responseBody);
        }
        return resDetails;
      });

      return reply.status(200).send({ success: true, data: details });
    } catch (error) {
      await releaseIdempotentRequest(this.db, idempotency.reservation);
      throw error;
    }
  }

  async getActiveWorkout(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const active = await this.db.queryOne<{ id: number }>(
      `SELECT id FROM workout_sessions WHERE user_id = ? AND status = 'in_progress' ORDER BY id DESC LIMIT 1`,
      [auth.userId]
    );
    if (!active) {
      return reply.status(200).send({
        success: true,
        data: null,
      });
    }

    const details = await this.getSessionDetails(active.id, auth.userId);
    return reply.status(200).send({
      success: true,
      data: details,
    });
  }

  async discardWorkout(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { sessionId: string };
    const sessionId = parsePositiveInt(params.sessionId, 'sessionId');
    const body = z.object({
      clientOperationId: z.string().min(8).max(191).optional(),
    }).parse(request.body || {});
    const idempotency = await beginIdempotentRequest(this.db, request, auth.userId, body);
    if (idempotency.replay) return reply.status(idempotency.replay.statusCode).send(idempotency.replay.body);

    try {
      const responseBody = await this.db.withTransaction(async (conn) => {
        const session = await conn.queryOne<any>(
          'SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?',
          [sessionId, auth.userId]
        );
        if (!session) throw new NotFoundError('Workout session not found');
        if (session.status === 'completed') {
          throw new ConflictError('Workout session is already completed', 'WORKOUT_ALREADY_COMPLETED');
        }

        const res = await conn.execute(
          `UPDATE workout_sessions SET status = 'skipped', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
          [sessionId, auth.userId]
        );
        if (res.affectedRows === 0) {
          throw new NotFoundError('Workout session not found');
        }
        const payload = { message: 'Workout session discarded' };
        if (idempotency.reservation) {
          await completeIdempotentRequest(conn, idempotency.reservation, 200, { success: true, data: payload });
        }
        return payload;
      });

      return reply.status(200).send({
        success: true,
        data: responseBody,
      });
    } catch (error) {
      await releaseIdempotentRequest(this.db, idempotency.reservation);
      throw error;
    }
  }

  async getWorkoutHistory(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const query = (request.query || {}) as { limit?: string; page?: string };
    const limit = parseBoundedPositiveInt(query.limit, 'limit', 1, 50, 20);
    const page = parseBoundedPositiveInt(query.page, 'page', 1, 100000, 1);
    const offset = (page - 1) * limit;

    const [sessions, totalRow] = await Promise.all([
      this.db.query(
        `SELECT ws.*, ws.workout_date as session_date,
                (SELECT COUNT(*) FROM workout_session_exercises wse WHERE wse.workout_session_id = ws.id) as exercise_count,
                (SELECT COUNT(*) FROM workout_sets wst 
                 JOIN workout_session_exercises wse ON wse.id = wst.workout_session_exercise_id
                 WHERE wse.workout_session_id = ws.id AND wst.completed = 1) as completed_sets_count
         FROM workout_sessions ws
         WHERE ws.user_id = ? AND ws.status = 'completed'
         ORDER BY ws.workout_date DESC, ws.id DESC
         LIMIT ? OFFSET ?`,
        [auth.userId, limit, offset]
      ),
      this.db.queryOne<{ total: number }>(
        `SELECT COUNT(*) as total FROM workout_sessions WHERE user_id = ? AND status = 'completed'`,
        [auth.userId],
      ),
    ]);
    const total = Number(totalRow?.total || 0);

    return reply.status(200).send({
      success: true,
      data: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  private async getSessionDetails(sessionId: number, userId?: number, client: DbConnection = this.db) {
    const session = await client.queryOne(
      `SELECT ws.*, ws.workout_date as session_date 
       FROM workout_sessions ws 
       WHERE ws.id = ?${userId === undefined ? '' : ' AND ws.user_id = ?'}`,
      userId === undefined ? [sessionId] : [sessionId, userId],
    );
    if (!session) return null;

    const exercises = await client.query(`
      SELECT wse.*, 
             wse.exercise_order as order_index,
             wse.planned_sets_snapshot as planned_sets,
             wse.planned_reps_min_snapshot as reps_min_target,
             wse.planned_reps_max_snapshot as reps_max_target,
             wse.planned_rest_seconds_snapshot as rest_seconds_target,
             e.name as exercise_name, 
             e.tracking_type, 
             mg.name as muscle_group_name, 
             eq.name as equipment_name
      FROM workout_session_exercises wse
      LEFT JOIN exercises e ON e.id = wse.exercise_id
      LEFT JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id AND emg.is_primary = 1
      LEFT JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
      LEFT JOIN equipment_types eq ON eq.id = e.equipment_type_id
      WHERE wse.workout_session_id = ?
      ORDER BY wse.exercise_order ASC
    `, [sessionId]);

    if (exercises.length > 0) {
      const exerciseIds = exercises.map((e: any) => e.id);
      const placeholders = exerciseIds.map(() => '?').join(',');
      const allSets = await client.query(
        `SELECT * FROM workout_sets 
         WHERE workout_session_exercise_id IN (${placeholders}) 
         ORDER BY set_number ASC`,
        exerciseIds
      );
      const setsByExerciseId = new Map<number, any[]>();
      for (const s of allSets) {
        if (!setsByExerciseId.has(s.workout_session_exercise_id)) {
          setsByExerciseId.set(s.workout_session_exercise_id, []);
        }
        setsByExerciseId.get(s.workout_session_exercise_id)!.push(s);
      }
      for (const ex of exercises) {
        ex.sets = setsByExerciseId.get(ex.id) || [];
      }
    } else {
      for (const ex of exercises) {
        ex.sets = [];
      }
    }

    return { ...session, exercises };
  }
}

export async function workoutSessionRoutes(fastify: FastifyInstance) {
  const controller = new WorkoutSessionController();

  fastify.post('/me/workouts/start', { preHandler: [authenticate] }, (req, res) => controller.startWorkout(req, res));
  fastify.get('/me/workouts/active', { preHandler: [authenticate] }, (req, res) => controller.getActiveWorkout(req, res));
  fastify.get('/me/workouts/active-session', { preHandler: [authenticate] }, (req, res) => controller.getActiveWorkout(req, res));
  fastify.get('/me/workouts/history', { preHandler: [authenticate] }, (req, res) => controller.getWorkoutHistory(req, res));
  fastify.get('/me/workouts/:sessionId', { preHandler: [authenticate] }, (req, res) => controller.getSession(req, res));
  fastify.post('/me/workouts/:sessionId/sets', { preHandler: [authenticate] }, (req, res) => controller.logSet(req, res));
  fastify.post('/me/workouts/:sessionId/complete', { preHandler: [authenticate] }, (req, res) => controller.completeWorkout(req, res));
  fastify.post('/me/workouts/:sessionId/skip', { preHandler: [authenticate] }, (req, res) => controller.skipWorkout(req, res));
  fastify.post('/me/workouts/:sessionId/discard', { preHandler: [authenticate] }, (req, res) => controller.discardWorkout(req, res));
  fastify.get('/me/exercises/:exerciseId/previous-performance', { preHandler: [authenticate] }, (req, res) => controller.getPreviousPerformance(req, res));
}
