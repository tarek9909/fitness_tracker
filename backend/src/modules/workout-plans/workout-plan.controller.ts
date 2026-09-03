import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { WorkoutPlanService } from './workout-plan.service.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { ValidationError } from '../../shared/errors/app-error.js';
import { recordAuditEvent } from '../../shared/utils/audit-utils.js';
import { isDateOnly, parsePositiveInt } from '../../shared/utils/request-utils.js';
import { assertCanViewWorkoutPlan, assertCanModifyWorkoutPlan } from './workout-plan-ownership.js';
import { getDatabasePool } from '../../database/pool.js';
import { getUserLocalDate } from '../../shared/utils/date-utils.js';

const createPlanSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  goalCategory: z.string().max(50).optional(),
});

const updatePlanSchema = createPlanSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

const activatePlanSchema = z.object({
  effectiveFrom: z.string().refine(isDateOnly, 'effectiveFrom must be a valid YYYY-MM-DD date').optional(),
});

const cloneVersionSchema = z.object({
  fromVersionId: z.number().int().positive().optional(),
});

const addDaySchema = z.object({
  weekdayNumber: z.number().int().min(1).max(7),
  name: z.string().min(1).max(100),
  isRestDay: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

const updateDaySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isRestDay: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

const exerciseFields = {
  exerciseId: z.number().int().positive(),
  orderIndex: z.number().int().min(1).optional(),
  targetSets: z.number().int().min(1).max(50),
  repsMin: z.number().int().min(1).max(500).optional(),
  repsMax: z.number().int().min(1).max(500).optional(),
  restSeconds: z.number().int().min(0).max(3600).optional(),
  notes: z.string().max(2000).optional(),
  isOptional: z.boolean().optional(),
};

const validateRepRange = (data: { repsMin?: number; repsMax?: number }, ctx: z.RefinementCtx) => {
  if (data.repsMin !== undefined && data.repsMax !== undefined && data.repsMax < data.repsMin) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['repsMax'], message: 'repsMax cannot be less than repsMin' });
  }
};

const addExerciseSchema = z.object(exerciseFields).superRefine(validateRepRange);

const updateExerciseSchema = z.object(exerciseFields).partial().superRefine(validateRepRange);

export class WorkoutPlanController {
  private service = new WorkoutPlanService();
  private db = getDatabasePool();

  private async getPlanForDay(dayId: number) {
    return this.db.queryOne<any>(
      `SELECT wp.* FROM workout_plans wp
       JOIN workout_plan_versions wpv ON wpv.workout_plan_id = wp.id
       JOIN workout_plan_days wpd ON wpd.workout_plan_version_id = wpv.id
       WHERE wpd.id = ?`,
      [dayId]
    );
  }

  private async getPlanForExercise(exerciseId: number) {
    return this.db.queryOne<any>(
      `SELECT wp.* FROM workout_plans wp
       JOIN workout_plan_versions wpv ON wpv.workout_plan_id = wp.id
       JOIN workout_plan_days wpd ON wpd.workout_plan_version_id = wpv.id
       JOIN workout_plan_exercises wpe ON wpe.workout_plan_day_id = wpd.id
       WHERE wpe.id = ?`,
      [exerciseId]
    );
  }

  private async getPlanForVersion(versionId: number) {
    return this.db.queryOne<any>(
      `SELECT wp.* FROM workout_plans wp
       JOIN workout_plan_versions wpv ON wpv.workout_plan_id = wp.id
       WHERE wpv.id = ?`,
      [versionId]
    );
  }

  // --- Admin Endpoints ---

  async listPlans(request: FastifyRequest, reply: FastifyReply) {
    const plans = await this.service.getPlans();
    return reply.status(200).send({ success: true, data: plans });
  }

  async getPlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { planId?: string; id?: string };
    const planId = parsePositiveInt(params.planId || params.id!, 'planId');
    const plan = await this.service.getPlanById(planId);
    assertCanViewWorkoutPlan(plan, auth);
    return reply.status(200).send({ success: true, data: plan });
  }

  async createPlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = createPlanSchema.parse(request.body);
    const plan = await this.service.createPlan({ ...body, createdBy: auth.userId, visibility: 'admin' });
    await recordAuditEvent(request, 'workout_plan.created', 'workout_plan', plan.id, { name: plan.name });
    return reply.status(201).send({ success: true, data: plan });
  }

  async updatePlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { planId?: string; id?: string };
    const planId = parsePositiveInt(params.planId || params.id!, 'planId');
    const existing = await this.service.getPlanById(planId);
    assertCanModifyWorkoutPlan(existing, auth);
    const body = updatePlanSchema.parse(request.body);
    const plan = await this.service.updatePlan(planId, body);
    await recordAuditEvent(request, 'workout_plan.updated', 'workout_plan', plan.id, body);
    return reply.status(200).send({ success: true, data: plan });
  }

  async deletePlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { planId?: string; id?: string };
    const planId = parsePositiveInt(params.planId || params.id!, 'planId');
    const existing = await this.service.getPlanById(planId);
    assertCanModifyWorkoutPlan(existing, auth);
    await this.service.updatePlan(planId, { isArchived: true });
    return reply.status(200).send({ success: true, data: { message: 'Workout plan archived successfully' } });
  }

  async getVersion(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { versionId: string };
    const versionId = parsePositiveInt(params.versionId, 'versionId');
    const plan = await this.getPlanForVersion(versionId);
    assertCanViewWorkoutPlan(plan, auth);
    const version = await this.service.getVersionDetails(versionId);
    return reply.status(200).send({ success: true, data: version });
  }

  async createVersion(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { planId?: string; id?: string };
    const planId = parsePositiveInt(params.planId || params.id!, 'planId');
    const plan = await this.service.getPlanById(planId);
    assertCanModifyWorkoutPlan(plan, auth);
    const body = cloneVersionSchema.parse(request.body || {});
    const version = await this.service.createNewVersion(planId, body.fromVersionId, auth.userId);
    await recordAuditEvent(request, 'workout_plan_version.cloned', 'workout_plan_version', version.id, { planId, fromVersionId: body.fromVersionId });
    return reply.status(201).send({ success: true, data: version });
  }

  async publishVersion(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { versionId: string };
    const versionId = parsePositiveInt(params.versionId, 'versionId');
    const plan = await this.getPlanForVersion(versionId);
    assertCanModifyWorkoutPlan(plan, auth);
    const version = await this.service.publishVersion(versionId);
    await recordAuditEvent(request, 'workout_plan_version.published', 'workout_plan_version', version.id, { versionNumber: version.version_number });
    return reply.status(200).send({ success: true, data: version });
  }

  async addDay(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { versionId: string };
    const versionId = parsePositiveInt(params.versionId, 'versionId');
    const plan = await this.getPlanForVersion(versionId);
    assertCanModifyWorkoutPlan(plan, auth);
    const body = addDaySchema.parse(request.body);
    const result = await this.service.addDay(versionId, body);
    return reply.status(201).send({ success: true, data: result });
  }

  async updateDay(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { dayId: string };
    const dayId = parsePositiveInt(params.dayId, 'dayId');
    const plan = await this.getPlanForDay(dayId);
    assertCanModifyWorkoutPlan(plan, auth);
    const body = updateDaySchema.parse(request.body);
    await this.service.updateDay(dayId, body);
    return reply.status(200).send({ success: true, data: { message: 'Day updated' } });
  }

  async deleteDay(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { dayId: string };
    const dayId = parsePositiveInt(params.dayId, 'dayId');
    const plan = await this.getPlanForDay(dayId);
    assertCanModifyWorkoutPlan(plan, auth);
    await this.service.deleteDay(dayId);
    return reply.status(200).send({ success: true, data: { message: 'Day deleted' } });
  }

  async addExerciseToDay(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { dayId: string };
    const dayId = parsePositiveInt(params.dayId, 'dayId');
    const plan = await this.getPlanForDay(dayId);
    assertCanModifyWorkoutPlan(plan, auth);
    const body = addExerciseSchema.parse(request.body);
    const result = await this.service.addExerciseToDay(dayId, body);
    return reply.status(201).send({ success: true, data: result });
  }

  async updateExercise(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id?: string; planExerciseId?: string };
    const exerciseId = parsePositiveInt(params.planExerciseId || params.id!, 'exerciseId');
    const plan = await this.getPlanForExercise(exerciseId);
    assertCanModifyWorkoutPlan(plan, auth);
    const body = updateExerciseSchema.parse(request.body);
    await this.service.updateExercise(exerciseId, body);
    return reply.status(200).send({ success: true, data: { message: 'Exercise updated' } });
  }

  async deleteExercise(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id?: string; planExerciseId?: string };
    const exerciseId = parsePositiveInt(params.planExerciseId || params.id!, 'exerciseId');
    const plan = await this.getPlanForExercise(exerciseId);
    assertCanModifyWorkoutPlan(plan, auth);
    await this.service.deleteExercise(exerciseId);
    return reply.status(200).send({ success: true, data: { message: 'Exercise removed from day' } });
  }

  // --- Self-Service User Endpoints (/me/workout-plans) ---

  async listMyPlans(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const plans = await this.service.getPlansForUser(auth.userId);
    return reply.status(200).send({ success: true, data: plans });
  }

  async createMyPlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = createPlanSchema.parse(request.body);
    const plan = await this.service.createPlan({
      ...body,
      createdBy: auth.userId,
      ownerUserId: auth.userId,
      visibility: 'private',
    });
    await recordAuditEvent(request, 'workout_plan.created', 'workout_plan', plan.id, { name: plan.name, isPrivate: true });
    return reply.status(201).send({ success: true, data: plan });
  }

  async cloneMyPlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id?: string; planId?: string };
    const planId = parsePositiveInt(params.id || params.planId!, 'planId');
    const sourcePlan = await this.service.getPlanById(planId);
    assertCanViewWorkoutPlan(sourcePlan, auth);
    const body = z.object({ name: z.string().min(1).max(150).optional() }).parse(request.body || {});
    const cloned = await this.service.clonePlan(planId, auth.userId, body.name);
    return reply.status(201).send({ success: true, data: cloned });
  }

  async activateMyPlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { id?: string; planId?: string };
    const planId = parsePositiveInt(params.id || params.planId!, 'planId');
    const plan = await this.service.getPlanById(planId);
    assertCanViewWorkoutPlan(plan, auth);
    const body = activatePlanSchema.parse(request.body || {});
    const user = await this.db.queryOne<{ timezone?: string | null }>('SELECT timezone FROM users WHERE id = ?', [auth.userId]);
    const today = getUserLocalDate(user?.timezone || 'UTC');
    const effectiveFrom = body.effectiveFrom || today;
    if (effectiveFrom < today) {
      throw new ValidationError('A plan cannot be activated in the past.');
    }
    const result = await this.service.activatePlanForUser(auth.userId, planId, effectiveFrom);
    await recordAuditEvent(request, 'workout_plan.activated', 'workout_plan', planId, { versionId: result.versionId, effectiveFrom });
    return reply.status(200).send({ success: true, data: result });
  }
}
