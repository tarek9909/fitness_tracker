import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ExercisesService } from './exercises.service.js';
import { parseBoundedPositiveInt, parsePositiveInt } from '../../shared/utils/request-utils.js';

const createExerciseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  primaryMuscleGroupId: z.number().optional(),
  equipmentTypeId: z.number().optional(),
  trackingType: z.enum(['weight_reps', 'reps_only', 'duration', 'distance', 'weight_duration', 'custom']).default('weight_reps'),
  videoUrl: z.string().url().optional().or(z.literal('')),
  instructions: z.string().optional(),
});

const updateExerciseSchema = createExerciseSchema.partial();

export class ExercisesController {
  private service = new ExercisesService();

  async listExercises(request: FastifyRequest, reply: FastifyReply) {
    const q = (request.query || {}) as any;
    const page = parseBoundedPositiveInt(q.page, 'page', 1, 100000, 1);
    const limit = parseBoundedPositiveInt(q.limit, 'limit', 1, 100, 50);
    const muscleGroupId = (q.muscleGroupId !== undefined && q.muscleGroupId !== '')
      ? parsePositiveInt(String(q.muscleGroupId).trim(), 'muscleGroupId')
      : undefined;
    const equipmentTypeId = (q.equipmentTypeId !== undefined && q.equipmentTypeId !== '')
      ? parsePositiveInt(String(q.equipmentTypeId).trim(), 'equipmentTypeId')
      : undefined;

    const result = await this.service.getExercises({
      search: q.search,
      muscleGroupId,
      equipmentTypeId,
      trackingType: q.trackingType,
      isArchived: q.isArchived !== undefined ? q.isArchived === 'true' || q.isArchived === '1' : undefined,
      page,
      limit,
    });

    return reply.status(200).send({
      success: true,
      data: result.exercises,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  }

  async getExercise(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const exerciseId = parsePositiveInt(params.id, 'exerciseId');
    const exercise = await this.service.getExerciseById(exerciseId);
    return reply.status(200).send({
      success: true,
      data: exercise,
    });
  }

  async createExercise(request: FastifyRequest, reply: FastifyReply) {
    const body = createExerciseSchema.parse(request.body);
    const exercise = await this.service.createExercise(body);
    return reply.status(201).send({
      success: true,
      data: exercise,
    });
  }

  async updateExercise(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const exerciseId = parsePositiveInt(params.id, 'exerciseId');
    const body = updateExerciseSchema.parse(request.body);
    const exercise = await this.service.updateExercise(exerciseId, body);
    return reply.status(200).send({
      success: true,
      data: exercise,
    });
  }

  async archiveExercise(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const exerciseId = parsePositiveInt(params.id, 'exerciseId');
    const exercise = await this.service.setArchiveStatus(exerciseId, true);
    return reply.status(200).send({
      success: true,
      data: exercise,
    });
  }

  async restoreExercise(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const exerciseId = parsePositiveInt(params.id, 'exerciseId');
    const exercise = await this.service.setArchiveStatus(exerciseId, false);
    return reply.status(200).send({
      success: true,
      data: exercise,
    });
  }

  async getMetadata(request: FastifyRequest, reply: FastifyReply) {
    const metadata = await this.service.getMetadata();
    return reply.status(200).send({
      success: true,
      data: metadata,
    });
  }
}
