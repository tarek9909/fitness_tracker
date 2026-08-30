import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { WorkoutPlanService } from './workout-plan.service.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { recordAuditEvent } from '../../shared/utils/audit-utils.js';
import { parsePositiveInt } from '../../shared/utils/request-utils.js';

const createPlanSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  goalCategory: z.string().max(50).optional(),
});

const updatePlanSchema = createPlanSchema.partial().extend({
  isArchived: z.boolean().optional(),
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
  rirTarget: z.number().min(0).max(10).optional(),
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

  async listPlans(request: FastifyRequest, reply: FastifyReply) {
    const plans = await this.service.getPlans();
    return reply.status(200).send({ success: true, data: plans });
  }

  async getPlan(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { planId: string };
    const plan = await this.service.getPlanById(parsePositiveInt(params.planId, 'planId'));
    return reply.status(200).send({ success: true, data: plan });
  }

  async createPlan(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = createPlanSchema.parse(request.body);
    const plan = await this.service.createPlan({ ...body, createdBy: auth.userId });
    await recordAuditEvent(request, 'workout_plan.created', 'workout_plan', plan.id, { name: plan.name });
    return reply.status(201).send({ success: true, data: plan });
  }

  async updatePlan(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { planId: string };
    const planId = parsePositiveInt(params.planId, 'planId');
    const body = updatePlanSchema.parse(request.body);
    const plan = await this.service.updatePlan(planId, body);
    await recordAuditEvent(request, 'workout_plan.updated', 'workout_plan', plan.id, body);
    return reply.status(200).send({ success: true, data: plan });
  }

  async getVersion(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { versionId: string };
    const version = await this.service.getVersionDetails(parsePositiveInt(params.versionId, 'versionId'));
    return reply.status(200).send({ success: true, data: version });
  }

  async createVersion(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { planId: string };
    const planId = parsePositiveInt(params.planId, 'planId');
    const body = cloneVersionSchema.parse(request.body || {});
    const auth = (request as AuthenticatedRequest).user;
    const version = await this.service.createNewVersion(
      planId,
      body.fromVersionId,
      auth.userId
    );
    await recordAuditEvent(request, 'workout_plan_version.cloned', 'workout_plan_version', version.id, { planId, fromVersionId: body.fromVersionId });
    return reply.status(201).send({ success: true, data: version });
  }

  async publishVersion(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { versionId: string };
    const versionId = parsePositiveInt(params.versionId, 'versionId');
    const version = await this.service.publishVersion(versionId);
    await recordAuditEvent(request, 'workout_plan_version.published', 'workout_plan_version', version.id, { versionNumber: version.version_number });
    return reply.status(200).send({ success: true, data: version });
  }

  async addDay(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { versionId: string };
    const versionId = parsePositiveInt(params.versionId, 'versionId');
    const body = addDaySchema.parse(request.body);
    const result = await this.service.addDay(versionId, body);
    return reply.status(201).send({ success: true, data: result });
  }

  async updateDay(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { dayId: string };
    const dayId = parsePositiveInt(params.dayId, 'dayId');
    const body = updateDaySchema.parse(request.body);
    await this.service.updateDay(dayId, body);
    return reply.status(200).send({ success: true, data: { message: 'Day updated' } });
  }

  async deleteDay(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { dayId: string };
    const dayId = parsePositiveInt(params.dayId, 'dayId');
    await this.service.deleteDay(dayId);
    return reply.status(200).send({ success: true, data: { message: 'Day deleted' } });
  }

  async addExerciseToDay(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { dayId: string };
    const dayId = parsePositiveInt(params.dayId, 'dayId');
    const body = addExerciseSchema.parse(request.body);
    const result = await this.service.addExerciseToDay(dayId, body);
    return reply.status(201).send({ success: true, data: result });
  }

  async updateExercise(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const exerciseId = parsePositiveInt(params.id, 'exerciseId');
    const body = updateExerciseSchema.parse(request.body);
    await this.service.updateExercise(exerciseId, body);
    return reply.status(200).send({ success: true, data: { message: 'Exercise updated' } });
  }

  async deleteExercise(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const exerciseId = parsePositiveInt(params.id, 'exerciseId');
    await this.service.deleteExercise(exerciseId);
    return reply.status(200).send({ success: true, data: { message: 'Exercise removed from day' } });
  }
}
