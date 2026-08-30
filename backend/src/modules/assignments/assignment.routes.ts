import { getDatabasePool } from '../../database/pool.js';
import { NotFoundError, ConflictError } from '../../shared/errors/app-error.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { parsePositiveInt, isDateOnly } from '../../shared/utils/request-utils.js';

export class AssignmentRepository {
  private db = getDatabasePool();

  async getWorkoutAssignmentsForUser(userId: number): Promise<any[]> {
    const sql = `
      SELECT uwa.*, wp.name as workout_plan_name, wpv.version_number
      FROM user_workout_assignments uwa
      JOIN workout_plan_versions wpv ON wpv.id = uwa.workout_plan_version_id
      JOIN workout_plans wp ON wp.id = wpv.workout_plan_id
      WHERE uwa.user_id = ?
      ORDER BY uwa.effective_from DESC
    `;
    return this.db.query(sql, [userId]);
  }

  async getDietAssignmentsForUser(userId: number): Promise<any[]> {
    const sql = `
      SELECT uda.*, dp.name as diet_plan_name, dpv.version_number
      FROM user_diet_assignments uda
      JOIN diet_plan_versions dpv ON dpv.id = uda.diet_plan_version_id
      JOIN diet_plans dp ON dp.id = dpv.diet_plan_id
      WHERE uda.user_id = ?
      ORDER BY uda.effective_from DESC
    `;
    return this.db.query(sql, [userId]);
  }

  async assignWorkout(data: { userId: number; workoutPlanVersionId: number; effectiveFrom: string; effectiveUntil?: string | null; notes?: string | null; assignedBy?: number | null }): Promise<number> {
    const version = await this.db.queryOne<{ id: number; status: string }>(
      'SELECT id, status FROM workout_plan_versions WHERE id = ?',
      [data.workoutPlanVersionId]
    );
    if (!version) throw new NotFoundError('Workout plan version not found');
    if (version.status !== 'published') {
      throw new ConflictError('Cannot assign a draft or unpublished workout version', 'PLAN_VERSION_NOT_PUBLISHED');
    }

    const overlap = await this.db.queryOne<any>(
      `SELECT id FROM user_workout_assignments 
       WHERE user_id = ? AND status = 'active'
         AND effective_from <= ?
         AND (effective_until IS NULL OR effective_until >= ?)`,
      [data.userId, data.effectiveUntil || '9999-12-31', data.effectiveFrom]
    );
    if (overlap) {
      throw new ConflictError('Workout assignment date range overlaps with an existing assignment', 'ASSIGNMENT_OVERLAP');
    }

    const sql = `
      INSERT INTO user_workout_assignments (user_id, workout_plan_version_id, effective_from, effective_until, status, notes, assigned_by)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `;
    const res = await this.db.execute(sql, [
      data.userId,
      data.workoutPlanVersionId,
      data.effectiveFrom,
      data.effectiveUntil || null,
      data.notes || null,
      data.assignedBy || null,
    ]);
    return res.insertId;
  }

  async assignDiet(data: { userId: number; dietPlanVersionId: number; effectiveFrom: string; effectiveUntil?: string | null; notes?: string | null; assignedBy?: number | null }): Promise<number> {
    const version = await this.db.queryOne<{ id: number; status: string }>(
      'SELECT id, status FROM diet_plan_versions WHERE id = ?',
      [data.dietPlanVersionId]
    );
    if (!version) throw new NotFoundError('Diet plan version not found');
    if (version.status !== 'published') {
      throw new ConflictError('Cannot assign a draft or unpublished diet version', 'PLAN_VERSION_NOT_PUBLISHED');
    }

    const overlap = await this.db.queryOne<any>(
      `SELECT id FROM user_diet_assignments 
       WHERE user_id = ? AND status = 'active'
         AND effective_from <= ?
         AND (effective_until IS NULL OR effective_until >= ?)`,
      [data.userId, data.effectiveUntil || '9999-12-31', data.effectiveFrom]
    );
    if (overlap) {
      throw new ConflictError('Diet assignment date range overlaps with an existing assignment', 'ASSIGNMENT_OVERLAP');
    }

    const sql = `
      INSERT INTO user_diet_assignments (user_id, diet_plan_version_id, effective_from, effective_until, status, notes, assigned_by)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `;
    const res = await this.db.execute(sql, [
      data.userId,
      data.dietPlanVersionId,
      data.effectiveFrom,
      data.effectiveUntil || null,
      data.notes || null,
      data.assignedBy || null,
    ]);
    return res.insertId;
  }

  async getActiveWorkoutAssignment(userId: number, dateStr: string): Promise<any | null> {
    const sql = `
      SELECT uwa.*, wpv.workout_plan_id, wpv.version_number
      FROM user_workout_assignments uwa
      JOIN workout_plan_versions wpv ON wpv.id = uwa.workout_plan_version_id
      WHERE uwa.user_id = ? 
        AND uwa.status = 'active'
        AND uwa.effective_from <= ?
        AND (uwa.effective_until IS NULL OR uwa.effective_until >= ?)
      ORDER BY uwa.effective_from DESC
      LIMIT 1
    `;
    return this.db.queryOne(sql, [userId, dateStr, dateStr]);
  }

  async getActiveDietAssignment(userId: number, dateStr: string): Promise<any | null> {
    const sql = `
      SELECT uda.*, dpv.diet_plan_id, dpv.version_number
      FROM user_diet_assignments uda
      JOIN diet_plan_versions dpv ON dpv.id = uda.diet_plan_version_id
      WHERE uda.user_id = ? 
        AND uda.status = 'active'
        AND uda.effective_from <= ?
        AND (uda.effective_until IS NULL OR uda.effective_until >= ?)
      ORDER BY uda.effective_from DESC
      LIMIT 1
    `;
    return this.db.queryOne(sql, [userId, dateStr, dateStr]);
  }
}

const assignWorkoutSchema = z.object({
  workoutPlanVersionId: z.number(),
  effectiveFrom: z.string().refine(isDateOnly, 'Use YYYY-MM-DD'),
  effectiveUntil: z.string().refine(isDateOnly, 'Use YYYY-MM-DD').optional(),
  notes: z.string().optional(),
});

const assignDietSchema = z.object({
  dietPlanVersionId: z.number(),
  effectiveFrom: z.string().refine(isDateOnly, 'Use YYYY-MM-DD'),
  effectiveUntil: z.string().refine(isDateOnly, 'Use YYYY-MM-DD').optional(),
  notes: z.string().optional(),
});

export class AssignmentController {
  private repo = new AssignmentRepository();

  async getWorkoutAssignments(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const list = await this.repo.getWorkoutAssignmentsForUser(userId);
    return reply.status(200).send({ success: true, data: list });
  }

  async assignWorkout(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const body = assignWorkoutSchema.parse(request.body);
    const auth = (request as AuthenticatedRequest).user;
    const id = await this.repo.assignWorkout({
      userId,
      workoutPlanVersionId: body.workoutPlanVersionId,
      effectiveFrom: body.effectiveFrom,
      effectiveUntil: body.effectiveUntil,
      notes: body.notes,
      assignedBy: auth.userId,
    });
    return reply.status(201).send({ success: true, data: { id } });
  }

  async getDietAssignments(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const list = await this.repo.getDietAssignmentsForUser(userId);
    return reply.status(200).send({ success: true, data: list });
  }

  async assignDiet(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { userId: string };
    const userId = parsePositiveInt(params.userId, 'userId');
    const body = assignDietSchema.parse(request.body);
    const auth = (request as AuthenticatedRequest).user;
    const id = await this.repo.assignDiet({
      userId,
      dietPlanVersionId: body.dietPlanVersionId,
      effectiveFrom: body.effectiveFrom,
      effectiveUntil: body.effectiveUntil,
      notes: body.notes,
      assignedBy: auth.userId,
    });
    return reply.status(201).send({ success: true, data: { id } });
  }
}

export async function assignmentRoutes(fastify: FastifyInstance) {
  const controller = new AssignmentController();

  fastify.get('/admin/users/:userId/workout-assignments', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getWorkoutAssignments(req, res));
  fastify.post('/admin/users/:userId/workout-assignments', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.assignWorkout(req, res));

  fastify.get('/admin/users/:userId/diet-assignments', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getDietAssignments(req, res));
  fastify.post('/admin/users/:userId/diet-assignments', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.assignDiet(req, res));
}
